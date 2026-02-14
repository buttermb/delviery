-- Create validate_marketplace_coupon RPC function
CREATE OR REPLACE FUNCTION public.validate_marketplace_coupon(
  p_store_id UUID,
  p_code TEXT,
  p_subtotal NUMERIC
)
RETURNS TABLE (
  is_valid BOOLEAN,
  discount_amount NUMERIC,
  discount_type TEXT,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coupon RECORD;
BEGIN
  -- Look up coupon for this store
  SELECT * INTO v_coupon
  FROM marketplace_coupons
  WHERE store_id = p_store_id
    AND UPPER(code) = UPPER(p_code)
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > NOW())
    AND (usage_limit IS NULL OR usage_count < usage_limit);

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0::NUMERIC, ''::TEXT, 'Invalid or expired coupon code'::TEXT;
    RETURN;
  END IF;

  -- Check minimum order amount
  IF v_coupon.min_order_amount IS NOT NULL AND p_subtotal < v_coupon.min_order_amount THEN
    RETURN QUERY SELECT false, 0::NUMERIC, ''::TEXT, 
      format('Minimum order of %s required', v_coupon.min_order_amount)::TEXT;
    RETURN;
  END IF;

  -- Calculate discount
  IF v_coupon.discount_type = 'percentage' THEN
    RETURN QUERY SELECT true, 
      LEAST(p_subtotal * (v_coupon.discount_value / 100), COALESCE(v_coupon.max_discount, p_subtotal)),
      v_coupon.discount_type,
      NULL::TEXT;
  ELSE
    RETURN QUERY SELECT true, 
      LEAST(v_coupon.discount_value, p_subtotal),
      v_coupon.discount_type,
      NULL::TEXT;
  END IF;
END;
$$;

-- Create create_marketplace_order RPC function
CREATE OR REPLACE FUNCTION public.create_marketplace_order(
  p_store_id UUID,
  p_items JSONB,
  p_customer_name TEXT,
  p_customer_email TEXT,
  p_customer_phone TEXT DEFAULT NULL,
  p_delivery_address JSONB DEFAULT NULL,
  p_delivery_notes TEXT DEFAULT NULL,
  p_payment_method TEXT DEFAULT 'cash'
)
RETURNS TABLE (
  success BOOLEAN,
  order_id UUID,
  order_number TEXT,
  tracking_token TEXT,
  total NUMERIC,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id UUID;
  v_order_number TEXT;
  v_tracking_token TEXT;
  v_subtotal NUMERIC := 0;
  v_store RECORD;
  v_item JSONB;
BEGIN
  -- Get store info
  SELECT * INTO v_store FROM marketplace_stores WHERE id = p_store_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, NULL::TEXT, 0::NUMERIC, 'Store not found or inactive'::TEXT;
    RETURN;
  END IF;

  -- Calculate subtotal from items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_subtotal := v_subtotal + (v_item->>'price')::NUMERIC * (v_item->>'quantity')::INTEGER;
  END LOOP;

  -- Generate order number and tracking token
  v_order_number := 'MKT-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
  v_tracking_token := UPPER(SUBSTRING(MD5(RANDOM()::TEXT || NOW()::TEXT) FROM 1 FOR 12));

  -- Create order
  INSERT INTO marketplace_storefront_orders (
    store_id,
    order_number,
    tracking_token,
    customer_name,
    customer_email,
    customer_phone,
    delivery_address,
    delivery_notes,
    payment_method,
    items,
    subtotal,
    delivery_fee,
    total,
    status,
    payment_status
  ) VALUES (
    p_store_id,
    v_order_number,
    v_tracking_token,
    p_customer_name,
    p_customer_email,
    p_customer_phone,
    p_delivery_address,
    p_delivery_notes,
    p_payment_method,
    p_items,
    v_subtotal,
    CASE WHEN v_subtotal >= COALESCE(v_store.free_delivery_threshold, 100) THEN 0 ELSE COALESCE(v_store.default_delivery_fee, 5) END,
    v_subtotal + CASE WHEN v_subtotal >= COALESCE(v_store.free_delivery_threshold, 100) THEN 0 ELSE COALESCE(v_store.default_delivery_fee, 5) END,
    'pending',
    'pending'
  )
  RETURNING id INTO v_order_id;

  RETURN QUERY SELECT true, v_order_id, v_order_number, v_tracking_token, 
    v_subtotal + CASE WHEN v_subtotal >= COALESCE(v_store.free_delivery_threshold, 100) THEN 0 ELSE COALESCE(v_store.default_delivery_fee, 5) END,
    NULL::TEXT;
END;
$$;

-- Create marketplace_coupons table if not exists
CREATE TABLE IF NOT EXISTS public.marketplace_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES marketplace_stores(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC NOT NULL,
  min_order_amount NUMERIC,
  max_discount NUMERIC,
  usage_limit INTEGER,
  usage_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(store_id, code)
);

-- Create marketplace_reviews table
CREATE TABLE IF NOT EXISTS public.marketplace_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES marketplace_stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  customer_name TEXT,
  customer_email TEXT,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  comment TEXT,
  is_approved BOOLEAN DEFAULT false,
  is_verified_purchase BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_marketplace_coupons_store ON marketplace_coupons(store_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_coupons_code ON marketplace_coupons(store_id, code);
CREATE INDEX IF NOT EXISTS idx_marketplace_reviews_store ON marketplace_reviews(store_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_reviews_product ON marketplace_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_reviews_approved ON marketplace_reviews(store_id, product_id, is_approved);

-- Enable RLS
ALTER TABLE public.marketplace_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_reviews ENABLE ROW LEVEL SECURITY;

-- RLS policies for marketplace_coupons
CREATE POLICY "Coupons are readable by everyone" ON marketplace_coupons
  FOR SELECT USING (true);

CREATE POLICY "Store owners can manage coupons" ON marketplace_coupons
  FOR ALL USING (
    store_id IN (
      SELECT ms.id FROM marketplace_stores ms
      JOIN tenant_users tu ON ms.tenant_id = tu.tenant_id
      WHERE tu.user_id = auth.uid()
    )
  );

-- RLS policies for marketplace_reviews
CREATE POLICY "Approved reviews are publicly readable" ON marketplace_reviews
  FOR SELECT USING (is_approved = true);

CREATE POLICY "Store owners can view all reviews" ON marketplace_reviews
  FOR SELECT USING (
    store_id IN (
      SELECT ms.id FROM marketplace_stores ms
      JOIN tenant_users tu ON ms.tenant_id = tu.tenant_id
      WHERE tu.user_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can submit reviews" ON marketplace_reviews
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Store owners can manage reviews" ON marketplace_reviews
  FOR UPDATE USING (
    store_id IN (
      SELECT ms.id FROM marketplace_stores ms
      JOIN tenant_users tu ON ms.tenant_id = tu.tenant_id
      WHERE tu.user_id = auth.uid()
    )
  );

CREATE POLICY "Store owners can delete reviews" ON marketplace_reviews
  FOR DELETE USING (
    store_id IN (
      SELECT ms.id FROM marketplace_stores ms
      JOIN tenant_users tu ON ms.tenant_id = tu.tenant_id
      WHERE tu.user_id = auth.uid()
    )
  );