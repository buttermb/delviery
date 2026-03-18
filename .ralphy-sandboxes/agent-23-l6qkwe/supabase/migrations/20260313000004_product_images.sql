-- ============================================================================
-- PRODUCT_IMAGES TABLE: Multi-image support for products
-- ============================================================================
-- Provides a dedicated table for storing multiple images per product with
-- ordering, primary-image designation, size variants, and file metadata.
-- References public.products (the main retail products table).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Create the product_images table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false,
  original_filename TEXT,
  file_path TEXT NOT NULL,
  image_order INTEGER DEFAULT 0,
  sizes JSONB DEFAULT '{}'::jsonb,
  original_size_bytes INTEGER,
  optimized_size_bytes INTEGER,
  dimensions JSONB,
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 2. Partial unique index: only one primary image per product
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_images_one_primary
  ON public.product_images (product_id)
  WHERE is_primary = true;

-- ---------------------------------------------------------------------------
-- 3. Performance indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_product_images_product_id
  ON public.product_images (product_id);

CREATE INDEX IF NOT EXISTS idx_product_images_tenant_id
  ON public.product_images (tenant_id);

CREATE INDEX IF NOT EXISTS idx_product_images_order
  ON public.product_images (product_id, image_order);

-- ---------------------------------------------------------------------------
-- 4. Enable RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 5. RLS Policies
-- ---------------------------------------------------------------------------

-- Authenticated users can view product images within their tenant
DROP POLICY IF EXISTS "Authenticated users can view product images" ON public.product_images;
CREATE POLICY "Authenticated users can view product images"
  ON public.product_images
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.tenant_id = product_images.tenant_id
    )
    OR
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.user_id = auth.uid()
        AND admin_users.is_active = true
    )
  );

-- Block anonymous access
DROP POLICY IF EXISTS "Block anonymous access to product images" ON public.product_images;
CREATE POLICY "Block anonymous access to product images"
  ON public.product_images
  FOR SELECT
  TO anon
  USING (false);

-- Admins can manage product images (insert, update, delete)
DROP POLICY IF EXISTS "Admins can manage product images" ON public.product_images;
CREATE POLICY "Admins can manage product images"
  ON public.product_images
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.user_id = auth.uid()
        AND admin_users.is_active = true
    )
    OR
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
        AND user_roles.tenant_id = product_images.tenant_id
    )
  );

-- ---------------------------------------------------------------------------
-- 6. Helper function: set primary image for a product
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_primary_product_image(
  p_product_id UUID,
  p_image_id UUID,
  p_tenant_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Unset current primary for this product within the tenant
  UPDATE public.product_images
  SET is_primary = false
  WHERE product_id = p_product_id
    AND tenant_id = p_tenant_id
    AND is_primary = true;

  -- Set new primary
  UPDATE public.product_images
  SET is_primary = true
  WHERE id = p_image_id
    AND product_id = p_product_id
    AND tenant_id = p_tenant_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. Comments
-- ---------------------------------------------------------------------------
COMMENT ON TABLE public.product_images IS 'Multiple images per product with ordering and size variants';
COMMENT ON COLUMN public.product_images.product_id IS 'FK to products table';
COMMENT ON COLUMN public.product_images.tenant_id IS 'FK to tenants table for multi-tenant isolation';
COMMENT ON COLUMN public.product_images.is_primary IS 'Whether this is the primary/hero image for the product';
COMMENT ON COLUMN public.product_images.file_path IS 'Storage path or URL for the image file';
COMMENT ON COLUMN public.product_images.image_order IS 'Display order (0-based)';
COMMENT ON COLUMN public.product_images.sizes IS 'CDN URLs for different image sizes: {thumb, medium, large, full}';
COMMENT ON COLUMN public.product_images.dimensions IS 'Original image dimensions: {width, height}';
