-- ============================================================================
-- Sequential Order Number Generation Per Tenant
-- ============================================================================
-- Replaces random hex order numbers (SF-YYMMDD-XXXXXX) with sequential
-- per-tenant numbers starting from 1001.
-- Uses PostgreSQL advisory locks to prevent race conditions.
-- ============================================================================

-- 1. Create sequence tracking table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.tenant_order_sequences (
  tenant_id UUID PRIMARY KEY,
  last_order_number INTEGER NOT NULL DEFAULT 1000,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.tenant_order_sequences ENABLE ROW LEVEL SECURITY;

-- RLS: only service role / security definer functions access this table
CREATE POLICY "Service role only" ON public.tenant_order_sequences
  FOR ALL USING (false);

COMMENT ON TABLE public.tenant_order_sequences IS
  'Tracks the last sequential order number per tenant. Used by next_tenant_order_number().';

-- 2. Helper function: next_tenant_order_number
-- ============================================================================

CREATE OR REPLACE FUNCTION public.next_tenant_order_number(p_tenant_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_number INTEGER;
BEGIN
  -- Advisory lock keyed on tenant_id prevents concurrent allocations
  -- for the same tenant from getting the same number.
  PERFORM pg_advisory_xact_lock(hashtext(p_tenant_id::text));

  -- Upsert: increment if exists, insert with 1001 if not
  INSERT INTO public.tenant_order_sequences (tenant_id, last_order_number, updated_at)
  VALUES (p_tenant_id, 1001, NOW())
  ON CONFLICT (tenant_id) DO UPDATE
    SET last_order_number = tenant_order_sequences.last_order_number + 1,
        updated_at = NOW()
  RETURNING last_order_number INTO v_next_number;

  RETURN v_next_number;
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_tenant_order_number(UUID) TO authenticated;

COMMENT ON FUNCTION public.next_tenant_order_number IS
  'Returns the next sequential order number for a tenant. Uses advisory locks for concurrency safety.';

-- 3. Update create_marketplace_order to use sequential numbering
-- ============================================================================

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
  p_idempotency_key TEXT DEFAULT NULL
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

  -- Validate stock availability for all items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_quantity := COALESCE((v_item->>'quantity')::INTEGER, 1);

    SELECT id, name, stock_quantity, available_quantity
    INTO v_product
    FROM public.products
    WHERE id = v_product_id
    FOR UPDATE; -- Lock the row

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

  -- If any items have insufficient stock, fail the order
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

  -- Decrement inventory for each item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_quantity := COALESCE((v_item->>'quantity')::INTEGER, 1);

    UPDATE public.products
    SET
      stock_quantity = GREATEST(0, COALESCE(stock_quantity, 0) - v_quantity),
      available_quantity = GREATEST(0, COALESCE(available_quantity, 0) - v_quantity),
      updated_at = NOW()
    WHERE id = v_product_id;
  END LOOP;

  RETURN v_order_id;
END;
$$;

-- Re-grant execute permissions
GRANT EXECUTE ON FUNCTION public.create_marketplace_order(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT) TO anon, authenticated;
