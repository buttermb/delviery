-- Drop and recreate the storefront_orders view with new columns
DROP VIEW IF EXISTS public.storefront_orders;
CREATE VIEW public.storefront_orders AS
SELECT 
  id,
  order_number,
  store_id,
  buyer_user_id AS customer_id,
  COALESCE(customer_name, '') AS customer_name,
  COALESCE(customer_email, '') AS customer_email,
  COALESCE(customer_phone, '') AS customer_phone,
  status,
  payment_status,
  subtotal,
  COALESCE(tax, 0) AS tax_amount,
  COALESCE(shipping_cost, 0) AS delivery_fee,
  total_amount AS total,
  shipping_address AS delivery_address,
  delivery_notes,
  items,
  tracking_token,
  stripe_session_id,
  stripe_payment_intent_id,
  paid_at,
  created_at,
  updated_at
FROM public.marketplace_orders
WHERE store_id IS NOT NULL;

-- Drop ALL existing function versions first
DROP FUNCTION IF EXISTS public.create_marketplace_order(uuid, jsonb, text, text, text, jsonb, text, text);

-- Create the corrected RPC function
CREATE OR REPLACE FUNCTION public.create_marketplace_order(
  p_store_id UUID,
  p_customer_name TEXT,
  p_customer_email TEXT,
  p_customer_phone TEXT DEFAULT NULL,
  p_delivery_address TEXT DEFAULT NULL,
  p_delivery_notes TEXT DEFAULT NULL,
  p_items JSONB DEFAULT '[]'::jsonb,
  p_subtotal NUMERIC DEFAULT 0,
  p_tax NUMERIC DEFAULT 0,
  p_delivery_fee NUMERIC DEFAULT 0,
  p_total NUMERIC DEFAULT 0,
  p_payment_method TEXT DEFAULT 'cash'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id UUID;
  v_order_number TEXT;
  v_tracking_token TEXT;
  v_tenant_id UUID;
BEGIN
  -- Get tenant_id from store
  SELECT tenant_id INTO v_tenant_id
  FROM public.marketplace_stores
  WHERE id = p_store_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Store not found';
  END IF;

  -- Generate order number
  v_order_number := 'SF-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
  
  -- Generate tracking token
  v_tracking_token := LOWER(SUBSTRING(MD5(RANDOM()::TEXT || NOW()::TEXT) FROM 1 FOR 12));

  -- Insert into marketplace_orders (the actual table)
  INSERT INTO public.marketplace_orders (
    store_id,
    buyer_tenant_id,
    seller_tenant_id,
    order_number,
    tracking_token,
    customer_name,
    customer_email,
    customer_phone,
    shipping_address,
    delivery_notes,
    items,
    subtotal,
    tax,
    shipping_cost,
    total_amount,
    shipping_method,
    status,
    payment_status
  ) VALUES (
    p_store_id,
    v_tenant_id,
    v_tenant_id,
    v_order_number,
    v_tracking_token,
    p_customer_name,
    p_customer_email,
    p_customer_phone,
    jsonb_build_object('address', p_delivery_address),
    p_delivery_notes,
    p_items,
    p_subtotal,
    p_tax,
    p_delivery_fee,
    p_total,
    p_payment_method,
    'pending',
    CASE WHEN p_payment_method = 'cash' THEN 'pending' ELSE 'awaiting_payment' END
  )
  RETURNING id INTO v_order_id;

  RETURN v_order_id;
END;
$$;

-- Grant execute permissions for public access
GRANT EXECUTE ON FUNCTION public.create_marketplace_order(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.create_marketplace_order(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT) TO authenticated;