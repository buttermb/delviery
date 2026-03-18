-- ============================================================================
-- Migration: Storefront Inventory Sync
-- Description: Adds proper inventory decrement for storefront orders
-- Date: 2026-01-28
-- ============================================================================

-- ============================================================================
-- 1. RPC: Decrement product stock for storefront orders
-- ============================================================================
-- This function decrements the stock_quantity and available_quantity
-- on the products table when a storefront order is placed.

CREATE OR REPLACE FUNCTION public.decrement_storefront_inventory(
    p_items JSONB -- Array of {product_id, quantity}
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_item JSONB;
    v_product RECORD;
    v_product_id UUID;
    v_quantity INTEGER;
    v_success_count INTEGER := 0;
    v_errors JSONB := '[]'::jsonb;
BEGIN
    -- Loop through each item and decrement inventory
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_quantity := (v_item->>'quantity')::INTEGER;

        -- Get current stock with FOR UPDATE lock
        SELECT id, name, stock_quantity, available_quantity
        INTO v_product
        FROM public.products
        WHERE id = v_product_id
        FOR UPDATE;

        IF v_product IS NULL THEN
            v_errors := v_errors || jsonb_build_object(
                'product_id', v_product_id,
                'error', 'Product not found'
            );
            CONTINUE;
        END IF;

        -- Check if sufficient stock
        IF COALESCE(v_product.stock_quantity, 0) < v_quantity THEN
            v_errors := v_errors || jsonb_build_object(
                'product_id', v_product_id,
                'product_name', v_product.name,
                'available', COALESCE(v_product.stock_quantity, 0),
                'requested', v_quantity,
                'error', 'Insufficient stock'
            );
            CONTINUE;
        END IF;

        -- Decrement the stock
        UPDATE public.products
        SET
            stock_quantity = GREATEST(0, COALESCE(stock_quantity, 0) - v_quantity),
            available_quantity = GREATEST(0, COALESCE(available_quantity, 0) - v_quantity),
            updated_at = NOW()
        WHERE id = v_product_id;

        v_success_count := v_success_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', jsonb_array_length(v_errors) = 0,
        'decremented_count', v_success_count,
        'errors', CASE WHEN jsonb_array_length(v_errors) > 0 THEN v_errors ELSE NULL END
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ============================================================================
-- 2. RPC: Restore product stock when order is cancelled
-- ============================================================================

CREATE OR REPLACE FUNCTION public.restore_storefront_inventory(
    p_items JSONB -- Array of {product_id, quantity}
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_item JSONB;
    v_product_id UUID;
    v_quantity INTEGER;
    v_success_count INTEGER := 0;
BEGIN
    -- Loop through each item and restore inventory
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_quantity := (v_item->>'quantity')::INTEGER;

        -- Restore the stock
        UPDATE public.products
        SET
            stock_quantity = COALESCE(stock_quantity, 0) + v_quantity,
            available_quantity = COALESCE(available_quantity, 0) + v_quantity,
            updated_at = NOW()
        WHERE id = v_product_id;

        IF FOUND THEN
            v_success_count := v_success_count + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'restored_count', v_success_count
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ============================================================================
-- 3. RPC: Create storefront order with inventory decrement
-- ============================================================================
-- This is a comprehensive order creation function that:
-- - Validates stock availability
-- - Creates the order in storefront_orders table
-- - Decrements inventory from products table
-- - Handles idempotency to prevent double orders

CREATE OR REPLACE FUNCTION public.create_storefront_order(
    p_store_id UUID,
    p_customer_name TEXT,
    p_customer_email TEXT,
    p_customer_phone TEXT DEFAULT NULL,
    p_delivery_address TEXT,
    p_delivery_notes TEXT DEFAULT NULL,
    p_items JSONB, -- Array of {product_id, quantity, price, variant}
    p_subtotal NUMERIC,
    p_tax NUMERIC DEFAULT 0,
    p_delivery_fee NUMERIC DEFAULT 0,
    p_total NUMERIC,
    p_payment_method TEXT,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_store RECORD;
    v_order_id UUID;
    v_order_number TEXT;
    v_tracking_token TEXT;
    v_item JSONB;
    v_product RECORD;
    v_product_id UUID;
    v_quantity INTEGER;
    v_insufficient_stock JSONB := '[]'::jsonb;
BEGIN
    -- Check idempotency to prevent double orders
    IF p_idempotency_key IS NOT NULL THEN
        SELECT id INTO v_order_id
        FROM public.storefront_orders
        WHERE idempotency_key = p_idempotency_key;

        IF v_order_id IS NOT NULL THEN
            RETURN v_order_id; -- Already created, return existing order
        END IF;
    END IF;

    -- Get store info
    SELECT id, tenant_id INTO v_store
    FROM public.marketplace_stores
    WHERE id = p_store_id;

    IF v_store IS NULL THEN
        RAISE EXCEPTION 'Store not found';
    END IF;

    -- Validate stock availability for all items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_quantity := (v_item->>'quantity')::INTEGER;

        SELECT id, name, stock_quantity, available_quantity
        INTO v_product
        FROM public.products
        WHERE id = v_product_id
        FOR UPDATE; -- Lock the row

        IF v_product IS NULL THEN
            RAISE EXCEPTION 'Product % not found', v_product_id;
        END IF;

        IF COALESCE(v_product.stock_quantity, 0) < v_quantity THEN
            v_insufficient_stock := v_insufficient_stock || jsonb_build_object(
                'product_id', v_product_id,
                'product_name', v_product.name,
                'available', COALESCE(v_product.stock_quantity, 0),
                'requested', v_quantity
            );
        END IF;
    END LOOP;

    -- If any items have insufficient stock, fail the order
    IF jsonb_array_length(v_insufficient_stock) > 0 THEN
        RAISE EXCEPTION 'Insufficient stock: %', v_insufficient_stock::TEXT;
    END IF;

    -- Generate order number and tracking token
    v_order_number := 'SF-' || to_char(NOW(), 'YYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    v_tracking_token := encode(gen_random_bytes(16), 'hex');

    -- Create the order
    INSERT INTO public.storefront_orders (
        store_id,
        tenant_id,
        order_number,
        tracking_token,
        customer_name,
        customer_email,
        customer_phone,
        delivery_address,
        delivery_notes,
        items,
        subtotal,
        tax,
        delivery_fee,
        total,
        payment_method,
        status,
        payment_status,
        idempotency_key,
        created_at,
        updated_at
    ) VALUES (
        p_store_id,
        v_store.tenant_id,
        v_order_number,
        v_tracking_token,
        p_customer_name,
        p_customer_email,
        p_customer_phone,
        p_delivery_address,
        p_delivery_notes,
        p_items,
        p_subtotal,
        p_tax,
        p_delivery_fee,
        p_total,
        p_payment_method,
        'pending',
        'pending',
        p_idempotency_key,
        NOW(),
        NOW()
    )
    RETURNING id INTO v_order_id;

    -- Decrement inventory for each item
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_quantity := (v_item->>'quantity')::INTEGER;

        UPDATE public.products
        SET
            stock_quantity = GREATEST(0, COALESCE(stock_quantity, 0) - v_quantity),
            available_quantity = GREATEST(0, COALESCE(available_quantity, 0) - v_quantity),
            updated_at = NOW()
        WHERE id = v_product_id;
    END LOOP;

    RETURN v_order_id;

EXCEPTION WHEN OTHERS THEN
    RAISE;
END;
$$;

-- ============================================================================
-- 4. GRANT PERMISSIONS
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.decrement_storefront_inventory(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_storefront_inventory(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_storefront_order(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT) TO anon, authenticated;

-- ============================================================================
-- 5. Ensure storefront_orders table has required columns
-- ============================================================================
DO $$
BEGIN
    -- Add idempotency_key column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'storefront_orders' AND column_name = 'idempotency_key'
    ) THEN
        ALTER TABLE public.storefront_orders ADD COLUMN idempotency_key TEXT UNIQUE;
    END IF;

    -- Add tracking_token column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'storefront_orders' AND column_name = 'tracking_token'
    ) THEN
        ALTER TABLE public.storefront_orders ADD COLUMN tracking_token TEXT UNIQUE;
    END IF;
END $$;

-- Create index for idempotency key lookups
CREATE INDEX IF NOT EXISTS idx_storefront_orders_idempotency_key
ON public.storefront_orders(idempotency_key)
WHERE idempotency_key IS NOT NULL;

-- ============================================================================
-- 6. UPDATE create_marketplace_order to decrement inventory
-- ============================================================================
-- This replaces the existing function to add inventory decrement

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

  -- Generate order number
  v_order_number := 'SF-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));

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

-- Update grants for new signature
GRANT EXECUTE ON FUNCTION public.create_marketplace_order(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT) TO anon, authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON FUNCTION public.decrement_storefront_inventory IS
'Decrements product stock_quantity and available_quantity for storefront orders. Used when an order is confirmed.';

COMMENT ON FUNCTION public.restore_storefront_inventory IS
'Restores product inventory when a storefront order is cancelled or refunded.';

COMMENT ON FUNCTION public.create_storefront_order IS
'Creates a storefront order with inventory validation and decrement. Supports idempotency to prevent duplicate orders.';

COMMENT ON FUNCTION public.create_marketplace_order IS
'Creates a marketplace order with inventory validation and decrement. Now includes stock checking and decrement from products table.';
