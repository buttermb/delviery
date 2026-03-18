-- ============================================================================
-- Add fulfillment_method to marketplace_orders
-- ============================================================================
-- Stores whether the order is for delivery or pickup.
-- Values: 'delivery', 'pickup' (nullable, defaults to 'delivery').
-- ============================================================================

-- 1. Add column to marketplace_orders
ALTER TABLE public.marketplace_orders
  ADD COLUMN IF NOT EXISTS fulfillment_method TEXT DEFAULT 'delivery';

-- 2. Update storefront_orders view to expose the new column
DROP VIEW IF EXISTS public.storefront_orders;
CREATE VIEW public.storefront_orders
WITH (security_invoker = true) AS
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
  preferred_contact_method,
  fulfillment_method,
  items,
  tracking_token,
  stripe_session_id,
  stripe_payment_intent_id,
  paid_at,
  created_at,
  updated_at
FROM public.marketplace_orders
WHERE store_id IS NOT NULL;

-- 3. Update create_marketplace_order RPC to accept fulfillment_method
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
  p_payment_method TEXT DEFAULT 'cash',
  p_idempotency_key TEXT DEFAULT NULL,
  p_preferred_contact_method TEXT DEFAULT NULL,
  p_fulfillment_method TEXT DEFAULT 'delivery'
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
  v_item JSONB;
  v_product RECORD;
  v_product_id UUID;
  v_quantity INTEGER;
  v_insufficient_stock JSONB := '[]'::jsonb;
  v_seq_number INTEGER;
  v_affected_rows INTEGER;
BEGIN
  -- Check idempotency to prevent double orders
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_order_id
    FROM public.marketplace_orders
    WHERE tracking_token = p_idempotency_key;

    IF v_order_id IS NOT NULL THEN
      RETURN v_order_id; -- Already created, return existing order
    END IF;
  END IF;

  -- Get tenant_id from store
  SELECT tenant_id INTO v_tenant_id
  FROM public.marketplace_stores
  WHERE id = p_store_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Store not found';
  END IF;

  -- Validate stock availability for all items (with row locks)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_quantity := COALESCE((v_item->>'quantity')::INTEGER, 1);

    SELECT id, name, stock_quantity, available_quantity
    INTO v_product
    FROM public.products
    WHERE id = v_product_id
    FOR UPDATE; -- Lock the row to prevent concurrent modifications

    IF v_product IS NOT NULL THEN
      IF COALESCE(v_product.stock_quantity, 0) < v_quantity THEN
        v_insufficient_stock := v_insufficient_stock || jsonb_build_object(
          'product_id', v_product_id,
          'product_name', v_product.name,
          'available', COALESCE(v_product.stock_quantity, 0),
          'requested', v_quantity
        );
      END IF;
    END IF;
  END LOOP;

  -- If any items have insufficient stock, fail before creating the order
  IF jsonb_array_length(v_insufficient_stock) > 0 THEN
    RAISE EXCEPTION 'Insufficient stock: %', v_insufficient_stock::TEXT;
  END IF;

  -- Generate sequential order number per tenant
  v_seq_number := public.next_tenant_order_number(v_tenant_id);
  v_order_number := v_seq_number::TEXT;

  -- Generate tracking token
  v_tracking_token := COALESCE(p_idempotency_key, LOWER(SUBSTRING(MD5(RANDOM()::TEXT || NOW()::TEXT) FROM 1 FOR 12)));

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
    preferred_contact_method,
    fulfillment_method,
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
    p_preferred_contact_method,
    COALESCE(p_fulfillment_method, 'delivery'),
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

  -- Decrement inventory for each item using checked pattern:
  -- WHERE stock_quantity >= qty ensures we never go negative.
  -- If 0 rows affected, a race condition occurred — rollback the order.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_quantity := COALESCE((v_item->>'quantity')::INTEGER, 1);

    UPDATE public.products
    SET
      stock_quantity = stock_quantity - v_quantity,
      available_quantity = GREATEST(0, COALESCE(available_quantity, 0) - v_quantity),
      updated_at = NOW()
    WHERE id = v_product_id
      AND COALESCE(stock_quantity, 0) >= v_quantity;

    GET DIAGNOSTICS v_affected_rows = ROW_COUNT;

    IF v_affected_rows = 0 THEN
      -- Race condition: stock changed between validation and deduction.
      -- Rollback the entire transaction (order + any prior decrements).
      RAISE EXCEPTION 'Inventory deduction failed: product % went out of stock between validation and deduction', v_product_id;
    END IF;
  END LOOP;

  RETURN v_order_id;
END;
$$;

-- Re-grant execute permissions (new signature with 15 params)
GRANT EXECUTE ON FUNCTION public.create_marketplace_order(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

COMMENT ON FUNCTION public.create_marketplace_order IS
  'Creates a marketplace order with inventory validation, checked deduction, preferred_contact_method, and fulfillment_method. Uses FOR UPDATE locks during validation and WHERE stock_quantity >= qty during deduction for defense-in-depth against race conditions.';
