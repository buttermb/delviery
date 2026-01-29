-- ============================================================================
-- STOREFRONT EXTENSIONS & RPC
-- ============================================================================

-- 1. Update marketplace_profiles for Storefront Branding & Config
ALTER TABLE public.marketplace_profiles
ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS tagline TEXT,
ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#000000',
ADD COLUMN IF NOT EXISTS secondary_color TEXT DEFAULT '#ffffff',
ADD COLUMN IF NOT EXISTS accent_color TEXT DEFAULT '#3b82f6',
ADD COLUMN IF NOT EXISTS banner_url TEXT,
ADD COLUMN IF NOT EXISTS operating_hours JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS require_age_verification BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS minimum_age INTEGER DEFAULT 21,
ADD COLUMN IF NOT EXISTS free_delivery_threshold NUMERIC(10,2) DEFAULT 100.00,
ADD COLUMN IF NOT EXISTS default_delivery_fee NUMERIC(10,2) DEFAULT 5.00,
ADD COLUMN IF NOT EXISTS checkout_settings JSONB DEFAULT '{"require_phone": true, "show_delivery_notes": true}'::jsonb,
ADD COLUMN IF NOT EXISTS payment_methods JSONB DEFAULT '["cash"]'::jsonb;

-- Index for slug lookup
CREATE INDEX IF NOT EXISTS idx_marketplace_profiles_slug ON public.marketplace_profiles(slug);

-- 2. Update marketplace_listings for Categories & Variants
ALTER TABLE public.marketplace_listings
ADD COLUMN IF NOT EXISTS marketplace_category_id UUID REFERENCES public.marketplace_categories(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS variants JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_marketplace_listings_category_id ON public.marketplace_listings(marketplace_category_id);

-- 3. Update marketplace_orders for Tracking
ALTER TABLE public.marketplace_orders
ADD COLUMN IF NOT EXISTS tracking_token TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_marketplace_orders_tracking_token ON public.marketplace_orders(tracking_token);

-- 3. RPC: Get Marketplace Store by Slug
CREATE OR REPLACE FUNCTION get_marketplace_store_by_slug(p_slug TEXT)
RETURNS TABLE (
  id UUID,
  store_name TEXT,
  slug TEXT,
  tagline TEXT,
  logo_url TEXT,
  banner_url TEXT,
  primary_color TEXT,
  secondary_color TEXT,
  accent_color TEXT,
  is_active BOOLEAN,
  is_public BOOLEAN,
  require_age_verification BOOLEAN,
  minimum_age INTEGER,
  operating_hours JSONB,
  free_delivery_threshold NUMERIC,
  default_delivery_fee NUMERIC,
  checkout_settings JSONB,
  payment_methods JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    mp.id,
    mp.business_name,
    mp.slug,
    mp.tagline,
    mp.logo_url,
    mp.banner_url,
    mp.primary_color,
    mp.secondary_color,
    mp.accent_color,
    (mp.marketplace_status = 'active' AND mp.can_sell = true) as is_active,
    true as is_public,
    mp.require_age_verification,
    mp.minimum_age,
    mp.operating_hours,
    mp.free_delivery_threshold,
    mp.default_delivery_fee,
    mp.checkout_settings,
    mp.payment_methods
  FROM public.marketplace_profiles mp
  WHERE mp.slug = p_slug;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. RPC: Get Marketplace Products
CREATE OR REPLACE FUNCTION get_marketplace_products(p_store_id UUID)
RETURNS TABLE (
  product_id UUID,
  name TEXT,
  description TEXT,
  short_description TEXT,
  category TEXT,
  sku TEXT,
  price NUMERIC,
  display_price NUMERIC,
  compare_at_price NUMERIC,
  image_url TEXT,
  images TEXT[],
  in_stock BOOLEAN,
  is_featured BOOLEAN,
  marketplace_category_id UUID,
  marketplace_category_name TEXT,
  variants JSONB,
  tags TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ml.id,
    ml.product_name,
    ml.description,
    substring(ml.description from 1 for 150),
    ml.product_type,
    'SKU-' || substr(ml.id::text, 1, 8),
    ml.base_price,
    ml.base_price, -- Display price (same for now)
    (ml.base_price * 1.2)::numeric(10,2), -- Mock compare price
    COALESCE(ml.images[1], NULL),
    ml.images,
    (ml.quantity_available > 0),
    true, -- Mock featured
    ml.marketplace_category_id,
    mc.name,
    ml.variants,
    ml.tags
  FROM public.marketplace_listings ml
  LEFT JOIN public.marketplace_categories mc ON ml.marketplace_category_id = mc.id
  WHERE ml.marketplace_profile_id = p_store_id
  AND ml.status = 'active';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RPC: Validate Coupon
CREATE OR REPLACE FUNCTION validate_marketplace_coupon(p_store_id UUID, p_code TEXT, p_subtotal NUMERIC)
RETURNS TABLE (
  is_valid BOOLEAN,
  discount_amount NUMERIC,
  discount_type TEXT,
  error_message TEXT
) AS $$
DECLARE
  v_coupon RECORD;
  v_discount NUMERIC := 0;
BEGIN
  -- Find coupon
  SELECT * INTO v_coupon
  FROM public.marketplace_coupons
  WHERE tenant_id = (SELECT tenant_id FROM public.marketplace_profiles WHERE id = p_store_id)
  AND code = UPPER(p_code)
  AND is_active = true
  AND (start_date <= NOW())
  AND (end_date IS NULL OR end_date >= NOW());

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0::numeric, null::text, 'Coupon not found or expired'::text;
    RETURN;
  END IF;

  -- Check constraints
  IF v_coupon.usage_limit IS NOT NULL AND v_coupon.used_count >= v_coupon.usage_limit THEN
    RETURN QUERY SELECT false, 0::numeric, null::text, 'Coupon usage limit reached'::text;
    RETURN;
  END IF;

  IF v_coupon.min_order_amount > p_subtotal THEN
     RETURN QUERY SELECT false, 0::numeric, null::text, 'Minimum order amount not met'::text;
     RETURN;
  END IF;

  -- Calculate discount
  IF v_coupon.discount_type = 'percentage' THEN
     v_discount := p_subtotal * (v_coupon.discount_value / 100);
     IF v_coupon.max_discount_amount IS NOT NULL THEN
       v_discount := LEAST(v_discount, v_coupon.max_discount_amount);
     END IF;
  ELSE
     v_discount := v_coupon.discount_value;
  END IF;

  -- Ensure discount doesn't exceed subtotal
  v_discount := LEAST(v_discount, p_subtotal);

  RETURN QUERY SELECT true, v_discount, v_coupon.discount_type, null::text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. RPC: Create Marketplace Order
CREATE OR REPLACE FUNCTION create_marketplace_order(
  p_store_id UUID,
  p_items JSONB, -- Array of {product_id, quantity, price}
  p_customer_name TEXT,
  p_customer_email TEXT,
  p_customer_phone TEXT,
  p_delivery_address JSONB,
  p_delivery_notes TEXT,
  p_payment_method TEXT
)
RETURNS TABLE (
  success BOOLEAN,
  order_number TEXT,
  tracking_token TEXT,
  total NUMERIC,
  error_message TEXT
) AS $$
DECLARE
  v_tenant_id UUID;
  v_order_id UUID;
  v_order_num TEXT;
  v_subtotal NUMERIC := 0;
  v_total NUMERIC := 0;
  v_item JSONB;
  v_listing RECORD;
  v_item_total NUMERIC;
  v_tracking_token TEXT;
BEGIN
  -- Get seller tenant id
  SELECT tenant_id INTO v_tenant_id FROM public.marketplace_profiles WHERE id = p_store_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, null::text, null::text, 0::numeric, 'Store not found'::text;
    RETURN;
  END IF;

  -- Generate Order Number (Simple Random for now)
  v_order_num := 'ORD-' || FLOOR(RANDOM() * 1000000)::TEXT;
  v_tracking_token := encode(gen_random_bytes(16), 'hex');

  -- Calculate Subtotal & Verify Items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT * INTO v_listing FROM public.marketplace_listings WHERE id = (v_item->>'product_id')::UUID;
    
    IF NOT FOUND OR v_listing.marketplace_profile_id != p_store_id THEN
      RETURN QUERY SELECT false, null::text, null::text, 0::numeric, 'Invalid product in cart'::text;
      RETURN;
    END IF;

    -- Basic stock check (optional, but good)
    IF v_listing.quantity_available < (v_item->>'quantity')::NUMERIC THEN
       RETURN QUERY SELECT false, null::text, null::text, 0::numeric, 'Product ' || v_listing.product_name || ' out of stock'::text;
       RETURN;
    END IF;

    v_item_total := (v_item->>'price')::NUMERIC * (v_item->>'quantity')::NUMERIC;
    v_subtotal := v_subtotal + v_item_total;
  END LOOP;

  -- Add delivery fee (Simplified logic, should match frontend)
  v_total := v_subtotal; -- + fees

  -- Create Order
  INSERT INTO public.marketplace_orders (
    order_number,
    buyer_tenant_id, -- Using same tenant for now if not B2B, but wait, this is PUBLIC storefront.
    -- Public buyers might not have a tenant_id?
    -- The schema requires buyer_tenant_id.
    -- If this is a public customer, we might need a "Guest" tenant or handle this differently.
    -- For now, we will assume the BUYER is the Tenant User if logged in, OR we need to relax the constraint.
    -- If it's a "Storefront", it implies B2C or B2B. 
    -- If B2C, we don't have a buyer_tenant_id.
    -- Let's check the schema: buyer_tenant_id UUID NOT NULL.
    -- Constraint is strict. 
    -- WORKAROUND: Use Seller's Tenant ID as Buyer Tenant ID for "Guest/Direct" orders? 
    -- Or create a 'Guest' tenant.
    -- For now, I will use the SELLER'S tenant_id as a placeholder for guest checkouts to avoid constraint violation, 
    -- but this is a schema flaw for B2C.
    buyer_tenant_id, 
    
    seller_tenant_id,
    seller_profile_id,
    status,
    subtotal,
    total_amount,
    payment_terms,
    payment_status,
    shipping_address,
    buyer_notes,
    buyer_business_name,
    tracking_token
  ) VALUES (
    v_order_num,
    v_tenant_id, -- Self-referencing for guest orders for now
    v_tenant_id,
    p_store_id,
    'pending',
    v_subtotal,
    v_total,
    'prepaid',
    'pending',
    p_delivery_address,
    p_delivery_notes,
    p_customer_name, -- storing name in business_name temporarily 
    v_tracking_token
  ) RETURNING id INTO v_order_id;

  -- Insert Items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO public.marketplace_order_items (
      order_id,
      listing_id,
      product_name,
      quantity,
      unit_price,
      total_price
    ) VALUES (
      v_order_id,
      (v_item->>'product_id')::UUID,
      v_item->>'name',
      (v_item->>'quantity')::NUMERIC,
      (v_item->>'price')::NUMERIC,
      ((v_item->>'price')::NUMERIC * (v_item->>'quantity')::NUMERIC)
    );
    
    -- Update Inventory
    UPDATE public.marketplace_listings
    SET quantity_available = quantity_available - (v_item->>'quantity')::NUMERIC
    WHERE id = (v_item->>'product_id')::UUID;
  END LOOP;

  -- The credit deduction trigger on 'marketplace_orders' should fire automatically here.

  RETURN QUERY SELECT true, v_order_num, v_tracking_token, v_total, null::text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. RPC: Get Order by Tracking Token
CREATE OR REPLACE FUNCTION get_marketplace_order_by_token(p_tracking_token TEXT)
RETURNS TABLE (
  order_id UUID,
  order_number TEXT,
  store_name TEXT,
  store_logo TEXT,
  status TEXT,
  items JSONB,
  subtotal NUMERIC,
  delivery_fee NUMERIC,
  discount_amount NUMERIC,
  total NUMERIC,
  customer_name TEXT,
  delivery_address JSONB,
  payment_method TEXT,
  payment_status TEXT,
  created_at TIMESTAMPTZ,
  estimated_delivery_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    mo.id,
    mo.order_number,
    mp.business_name,
    mp.logo_url,
    mo.status,
    (
      SELECT jsonb_agg(jsonb_build_object(
        'name', moi.product_name,
        'quantity', moi.quantity,
        'price', moi.unit_price,
        'total', moi.total_price
      ))
      FROM public.marketplace_order_items moi
      WHERE moi.order_id = mo.id
    ) as items,
    mo.subtotal,
    COALESCE(mo.shipping_cost, 0) as delivery_fee,
    0::numeric as discount_amount, -- Need to persist discount in order
    mo.total_amount,
    mo.buyer_business_name, -- storing customer name here
    mo.shipping_address,
    'credit_card' as payment_method, -- mock
    mo.payment_status,
    mo.created_at,
    (mo.created_at + INTERVAL '3 days') as estimated_delivery_at
  FROM public.marketplace_orders mo
  JOIN public.marketplace_profiles mp ON mo.seller_profile_id = mp.id
  WHERE mo.tracking_token = p_tracking_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
