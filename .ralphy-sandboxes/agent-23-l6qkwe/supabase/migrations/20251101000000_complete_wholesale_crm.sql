-- ============================================================================
-- COMPLETE WHOLESALE CRM - PRODUCT ENHANCEMENTS
-- Adds all missing fields from the comprehensive MVP spec
-- ============================================================================

-- ============================================================================
-- ENHANCE wholesale_inventory TABLE
-- ============================================================================

-- Add bulk discount support
ALTER TABLE wholesale_inventory
ADD COLUMN IF NOT EXISTS bulk_discounts JSONB DEFAULT '[]'::jsonb;

-- Add order quantity limits
ALTER TABLE wholesale_inventory
ADD COLUMN IF NOT EXISTS min_order_lbs DECIMAL(10,2) DEFAULT 1;

ALTER TABLE wholesale_inventory
ADD COLUMN IF NOT EXISTS max_order_lbs DECIMAL(10,2);

-- Add product status
ALTER TABLE wholesale_inventory
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' 
  CHECK (status IN ('active', 'coming_soon', 'out_of_stock', 'discontinued'));

-- Add featured flag
ALTER TABLE wholesale_inventory
ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;

-- Add low stock alert threshold
ALTER TABLE wholesale_inventory
ADD COLUMN IF NOT EXISTS low_stock_alert_lbs DECIMAL(10,2);

-- Add genetics/lineage (if not already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'wholesale_inventory' 
    AND column_name = 'genetics'
  ) THEN
    ALTER TABLE wholesale_inventory ADD COLUMN genetics TEXT;
  END IF;
END $$;

-- Add comments for clarity
COMMENT ON COLUMN wholesale_inventory.bulk_discounts IS 'JSON array: [{qty: 10, discount: 0.05, price: 2850}, ...]';
COMMENT ON COLUMN wholesale_inventory.min_order_lbs IS 'Minimum order quantity in pounds';
COMMENT ON COLUMN wholesale_inventory.max_order_lbs IS 'Maximum order quantity in pounds';
COMMENT ON COLUMN wholesale_inventory.status IS 'Product availability status';
COMMENT ON COLUMN wholesale_inventory.is_featured IS 'Show prominently in menus';
COMMENT ON COLUMN wholesale_inventory.low_stock_alert_lbs IS 'Alert when stock drops below this';

-- ============================================================================
-- CREATE product_images TABLE for multi-image support
-- ============================================================================

CREATE TABLE IF NOT EXISTS product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES wholesale_inventory(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false,
  original_filename TEXT,
  file_path TEXT NOT NULL,
  image_order INTEGER DEFAULT 0,
  
  -- Multiple sizes
  sizes JSONB DEFAULT '{}'::jsonb, -- {thumb: 'url', medium: 'url', large: 'url', full: 'url'}
  
  -- Watermark settings
  watermark_settings JSONB DEFAULT '{}'::jsonb,
  
  -- File metadata
  original_size_bytes INTEGER,
  optimized_size_bytes INTEGER,
  dimensions JSONB, -- {width: 800, height: 800}
  
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure only one primary image per product
  CONSTRAINT unique_primary_image UNIQUE (product_id, is_primary) 
    DEFERRABLE INITIALLY DEFERRED
);

-- Partial unique index for is_primary = true
CREATE UNIQUE INDEX IF NOT EXISTS product_images_one_primary 
ON product_images (product_id) 
WHERE is_primary = true;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_product_images_product_id 
ON product_images(product_id);

CREATE INDEX IF NOT EXISTS idx_product_images_order 
ON product_images(product_id, image_order);

-- Comments
COMMENT ON TABLE product_images IS 'Multiple images per product with optimization and watermarking';
COMMENT ON COLUMN product_images.sizes IS 'CDN URLs for different image sizes (thumb, medium, large, full)';
COMMENT ON COLUMN product_images.watermark_settings IS 'Watermark configuration: {enabled: true, opacity: 0.3, position: "bottom-right"}';

-- ============================================================================
-- ENHANCE invitations TABLE (for SMS integration)
-- ============================================================================

-- Create invitations table if it doesn't exist
CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id UUID NOT NULL REFERENCES disposable_menus(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES wholesale_clients(id) ON DELETE SET NULL,
  
  -- Contact info
  phone TEXT NOT NULL,
  email TEXT,
  
  -- Invitation details
  method TEXT DEFAULT 'sms' CHECK (method IN ('sms', 'email', 'signal', 'telegram')),
  message TEXT,
  unique_link TEXT NOT NULL,
  
  -- Status tracking
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  opened_at TIMESTAMPTZ,
  accessed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'opened', 'accessed', 'failed')),
  
  -- SMS specific
  sms_provider TEXT, -- 'twilio', 'aws-sns', etc.
  sms_message_id TEXT,
  sms_delivery_status TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_invitations_menu_id ON invitations(menu_id);
CREATE INDEX IF NOT EXISTS idx_invitations_customer_id ON invitations(customer_id);
CREATE INDEX IF NOT EXISTS idx_invitations_phone ON invitations(phone);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON invitations(status);

-- ============================================================================
-- ENHANCE disposable_menus for burn & regenerate
-- ============================================================================

-- Add regenerated_from field if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'disposable_menus' 
    AND column_name = 'regenerated_from'
  ) THEN
    ALTER TABLE disposable_menus 
    ADD COLUMN regenerated_from UUID REFERENCES disposable_menus(id);
  END IF;
END $$;

-- Add auto_regenerate flag
ALTER TABLE disposable_menus
ADD COLUMN IF NOT EXISTS auto_regenerate BOOLEAN DEFAULT false;

COMMENT ON COLUMN disposable_menus.regenerated_from IS 'If this menu was regenerated from a burned menu';
COMMENT ON COLUMN disposable_menus.auto_regenerate IS 'Automatically regenerate and re-invite on burn';

-- ============================================================================
-- ENHANCE menu_burn_history for tracking
-- ============================================================================

-- Ensure burn history has regenerate tracking
ALTER TABLE menu_burn_history
ADD COLUMN IF NOT EXISTS regenerated_menu_id UUID REFERENCES disposable_menus(id);

ALTER TABLE menu_burn_history
ADD COLUMN IF NOT EXISTS auto_regenerated BOOLEAN DEFAULT false;

ALTER TABLE menu_burn_history
ADD COLUMN IF NOT EXISTS reinvite_sent BOOLEAN DEFAULT false;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- Product images policies
DROP POLICY IF EXISTS "Admins can view all product images" ON product_images;
CREATE POLICY "Admins can view all product images"
ON product_images FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM wholesale_inventory w
    WHERE w.id = product_images.product_id
  )
);

DROP POLICY IF EXISTS "Admins can manage product images" ON product_images;
CREATE POLICY "Admins can manage product images"
ON product_images FOR ALL
TO authenticated
USING (true) -- Admin only via application logic
WITH CHECK (true);

-- Invitations policies
DROP POLICY IF EXISTS "Admins can view all invitations" ON invitations;
CREATE POLICY "Admins can view all invitations"
ON invitations FOR SELECT
TO authenticated
USING (true); -- Admin only

DROP POLICY IF EXISTS "Admins can manage invitations" ON invitations;
CREATE POLICY "Admins can manage invitations"
ON invitations FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to set primary image (ensures only one primary)
CREATE OR REPLACE FUNCTION set_primary_product_image(
  p_product_id UUID,
  p_image_id UUID
) RETURNS void AS $$
BEGIN
  -- Unset current primary
  UPDATE product_images
  SET is_primary = false
  WHERE product_id = p_product_id AND is_primary = true;
  
  -- Set new primary
  UPDATE product_images
  SET is_primary = true
  WHERE id = p_image_id AND product_id = p_product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get product with images
CREATE OR REPLACE FUNCTION get_product_with_images(p_product_id UUID)
RETURNS TABLE (
  product wholesale_inventory,
  images JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    w.*,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', pi.id,
          'is_primary', pi.is_primary,
          'sizes', pi.sizes,
          'image_order', pi.image_order
        ) ORDER BY pi.image_order, pi.is_primary DESC
      ) FILTER (WHERE pi.id IS NOT NULL),
      '[]'::jsonb
    ) as images
  FROM wholesale_inventory w
  LEFT JOIN product_images pi ON pi.product_id = w.id
  WHERE w.id = p_product_id
  GROUP BY w.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Wholesale inventory indexes
CREATE INDEX IF NOT EXISTS idx_wholesale_inventory_status 
ON wholesale_inventory(status) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_wholesale_inventory_featured 
ON wholesale_inventory(is_featured) WHERE is_featured = true;

CREATE INDEX IF NOT EXISTS idx_wholesale_inventory_category 
ON wholesale_inventory(category);

-- Product images indexes (already created above)

-- Invitations indexes (already created above)

COMMENT ON TABLE product_images IS 'Complete multi-image system with optimization, watermarking, and multiple sizes';
COMMENT ON TABLE invitations IS 'SMS/Email invitation tracking for menu access';

