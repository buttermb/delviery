-- Marketplace Customers & Account Management

-- 1. Create Marketplace Customers Table
CREATE TABLE IF NOT EXISTS public.marketplace_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.marketplace_profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(store_id, email)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_marketplace_customers_store_email ON public.marketplace_customers(store_id, email);

-- RLS
ALTER TABLE public.marketplace_customers ENABLE ROW LEVEL SECURITY;

-- Policy: Only allow access via RPC (Security Definer) for now, or Super Admins
CREATE POLICY "Super admins can view all customers"
  ON public.marketplace_customers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.super_admin_users 
      WHERE id = auth.uid()::text::uuid
    )
  );
  
CREATE POLICY "Sellers can view own customers"
  ON public.marketplace_customers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.marketplace_profiles mp
      WHERE mp.id = marketplace_customers.store_id
      AND mp.tenant_id = (SELECT tenant_id FROM public.tenant_users WHERE id = auth.uid()::text::uuid)
    )
  );

-- 2. Add customer_id to orders
ALTER TABLE public.marketplace_orders 
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.marketplace_customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_marketplace_orders_customer_id ON public.marketplace_orders(customer_id);

-- 3. RPC: Get Customer by Email (Secure Lookup)
CREATE OR REPLACE FUNCTION get_marketplace_customer_by_email(p_store_id UUID, p_email TEXT)
RETURNS TABLE (
  id UUID,
  email TEXT,
  first_name TEXT,
  last_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mc.id,
    mc.email,
    mc.first_name,
    mc.last_name
  FROM public.marketplace_customers mc
  WHERE mc.store_id = p_store_id
  AND mc.email = lower(p_email);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Update Create Order RPC to Handle Customer Upsert with Explicit Column References
CREATE OR REPLACE FUNCTION create_marketplace_order(
  p_store_id UUID,
  p_items JSONB,
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
  v_customer_id UUID;
  v_order_num TEXT;
  v_subtotal NUMERIC := 0;
  v_total NUMERIC := 0;
  v_item JSONB;
  v_listing RECORD;
  v_item_total NUMERIC;
  v_tracking_token TEXT;
  v_first_name TEXT;
  v_last_name TEXT;
BEGIN
  -- Get seller tenant id
  SELECT tenant_id INTO v_tenant_id FROM public.marketplace_profiles WHERE id = p_store_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, null::text, null::text, 0::numeric, 'Store not found'::text;
    RETURN;
  END IF;

  -- Generate Order Number
  v_order_num := 'ORD-' || FLOOR(RANDOM() * 1000000)::TEXT;
  v_tracking_token := encode(gen_random_bytes(16), 'hex');

  -- Parse Name
  v_first_name := split_part(p_customer_name, ' ', 1);
  v_last_name := substring(p_customer_name from length(v_first_name) + 2);

  -- Upsert Customer
  INSERT INTO public.marketplace_customers (store_id, email, first_name, last_name, phone)
  VALUES (p_store_id, lower(p_customer_email), v_first_name, v_last_name, p_customer_phone)
  ON CONFLICT (store_id, email) 
  DO UPDATE SET 
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    phone = EXCLUDED.phone,
    updated_at = NOW()
  RETURNING id INTO v_customer_id;

  -- Calculate Subtotal & Verify Items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT * INTO v_listing FROM public.marketplace_listings WHERE id = (v_item->>'product_id')::UUID;
    
    IF NOT FOUND OR v_listing.marketplace_profile_id != p_store_id THEN
      RETURN QUERY SELECT false, null::text, null::text, 0::numeric, 'Invalid product in cart'::text;
      RETURN;
    END IF;

    IF v_listing.quantity_available < (v_item->>'quantity')::NUMERIC THEN
       RETURN QUERY SELECT false, null::text, null::text, 0::numeric, 'Product ' || v_listing.product_name || ' out of stock'::text;
       RETURN;
    END IF;

    v_item_total := (v_item->>'price')::NUMERIC * (v_item->>'quantity')::NUMERIC;
    v_subtotal := v_subtotal + v_item_total;
  END LOOP;

  v_total := v_subtotal; 

  -- Create Order with explicit column references to avoid ambiguity
  INSERT INTO public.marketplace_orders (
    order_number,
    buyer_tenant_id,
    seller_tenant_id,
    seller_profile_id,
    customer_id,
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
    v_tenant_id,
    v_tenant_id,
    p_store_id,
    v_customer_id,
    'pending',
    v_subtotal,
    v_total,
    'prepaid',
    'pending',
    p_delivery_address,
    p_delivery_notes,
    p_customer_name,
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
    
    UPDATE public.marketplace_listings
    SET quantity_available = quantity_available - (v_item->>'quantity')::NUMERIC
    WHERE id = (v_item->>'product_id')::UUID;
  END LOOP;

  RETURN QUERY SELECT true, v_order_num, v_tracking_token, v_total, null::text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
