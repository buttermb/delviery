-- ============================================
-- Phase 1: P0 Critical Security & Data Integrity Fixes
-- ============================================

-- 1. Add non-negative stock constraint to products table
-- First drop if exists to make idempotent
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_stock_non_negative'
  ) THEN
    ALTER TABLE public.products 
    ADD CONSTRAINT products_stock_non_negative 
    CHECK (stock_quantity >= 0);
  END IF;
END $$;

-- Also add to available_quantity if it exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'available_quantity'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'products_available_non_negative'
    ) THEN
      ALTER TABLE public.products 
      ADD CONSTRAINT products_available_non_negative 
      CHECK (available_quantity >= 0);
    END IF;
  END IF;
END $$;

-- 2. Add invoice number uniqueness constraint per tenant
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'crm_invoices_tenant_number_unique'
  ) THEN
    ALTER TABLE public.crm_invoices
    ADD CONSTRAINT crm_invoices_tenant_number_unique 
    UNIQUE (account_id, invoice_number);
  END IF;
END $$;

-- Also for invoices table if it exists
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoices') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'invoices_tenant_number_unique'
    ) THEN
      ALTER TABLE public.invoices
      ADD CONSTRAINT invoices_tenant_number_unique 
      UNIQUE (tenant_id, invoice_number);
    END IF;
  END IF;
END $$;

-- 3. Create atomic POS transaction RPC function
CREATE OR REPLACE FUNCTION public.create_pos_transaction_atomic(
  p_tenant_id UUID,
  p_items JSONB,
  p_payment_method TEXT,
  p_payment_status TEXT DEFAULT 'completed',
  p_customer_id UUID DEFAULT NULL,
  p_shift_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_discount_amount NUMERIC DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item JSONB;
  v_product_id UUID;
  v_quantity NUMERIC;
  v_price NUMERIC;
  v_current_stock NUMERIC;
  v_subtotal NUMERIC := 0;
  v_total NUMERIC := 0;
  v_transaction_id UUID;
  v_transaction_number TEXT;
  v_product_name TEXT;
BEGIN
  -- Validate tenant access
  IF NOT EXISTS (
    SELECT 1 FROM tenant_users 
    WHERE tenant_id = p_tenant_id 
    AND user_id = auth.uid() 
    AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Not a member of this tenant';
  END IF;

  -- Validate items array is not empty
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Cannot create transaction with no items';
  END IF;

  -- First pass: Validate all items and lock rows
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_quantity := (v_item->>'quantity')::NUMERIC;
    
    IF v_quantity <= 0 THEN
      RAISE EXCEPTION 'Invalid quantity: must be positive';
    END IF;

    -- Lock the product row and check tenant ownership + stock
    SELECT stock_quantity, name, price INTO v_current_stock, v_product_name, v_price
    FROM products
    WHERE id = v_product_id 
    AND tenant_id = p_tenant_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % not found or does not belong to tenant', v_product_id;
    END IF;

    IF v_current_stock < v_quantity THEN
      RAISE EXCEPTION 'Insufficient stock for %: requested %, available %', 
        v_product_name, v_quantity, v_current_stock;
    END IF;

    -- Calculate subtotal
    v_subtotal := v_subtotal + (COALESCE((v_item->>'price')::NUMERIC, v_price) * v_quantity);
  END LOOP;

  -- Apply discount (ensure it doesn't exceed subtotal)
  p_discount_amount := LEAST(COALESCE(p_discount_amount, 0), v_subtotal);
  v_total := v_subtotal - p_discount_amount;

  -- Generate transaction number
  v_transaction_number := 'POS-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));

  -- Create the transaction record
  INSERT INTO pos_transactions (
    tenant_id,
    transaction_number,
    shift_id,
    customer_id,
    subtotal,
    discount_amount,
    total_amount,
    payment_method,
    payment_status,
    notes,
    items,
    created_at
  ) VALUES (
    p_tenant_id,
    v_transaction_number,
    p_shift_id,
    p_customer_id,
    v_subtotal,
    p_discount_amount,
    v_total,
    p_payment_method,
    p_payment_status,
    p_notes,
    p_items,
    NOW()
  )
  RETURNING id INTO v_transaction_id;

  -- Second pass: Decrement stock for all items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_quantity := (v_item->>'quantity')::NUMERIC;

    UPDATE products
    SET 
      stock_quantity = stock_quantity - v_quantity,
      updated_at = NOW()
    WHERE id = v_product_id 
    AND tenant_id = p_tenant_id;

    -- Log inventory change
    INSERT INTO inventory_sync_log (product_id, change_amount, change_source, tenant_id)
    VALUES (v_product_id, -v_quantity, 'pos_sale', p_tenant_id);
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'transaction_number', v_transaction_number,
    'subtotal', v_subtotal,
    'discount', p_discount_amount,
    'total', v_total
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.create_pos_transaction_atomic TO authenticated;

-- 4. Create inventory release function for order cancellation
CREATE OR REPLACE FUNCTION public.release_order_inventory(
  p_order_id UUID,
  p_order_type TEXT DEFAULT 'wholesale'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_order_status TEXT;
  v_items JSONB;
  v_item JSONB;
  v_product_id UUID;
  v_quantity NUMERIC;
  v_restored_count INT := 0;
BEGIN
  -- Get order details based on type
  IF p_order_type = 'wholesale' THEN
    SELECT tenant_id, status INTO v_tenant_id, v_order_status
    FROM wholesale_orders
    WHERE id = p_order_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Order not found');
    END IF;

    -- Only release inventory if order was confirmed (inventory was reserved)
    IF v_order_status NOT IN ('confirmed', 'ready', 'shipped') THEN
      RETURN jsonb_build_object('success', true, 'message', 'No inventory to release');
    END IF;

    -- Get items from wholesale_order_items
    FOR v_item IN 
      SELECT jsonb_build_object('product_id', product_id, 'quantity', quantity)
      FROM wholesale_order_items
      WHERE order_id = p_order_id
    LOOP
      v_product_id := (v_item->>'product_id')::UUID;
      v_quantity := (v_item->>'quantity')::NUMERIC;

      -- Restore inventory
      UPDATE products
      SET 
        stock_quantity = stock_quantity + v_quantity,
        updated_at = NOW()
      WHERE id = v_product_id 
      AND tenant_id = v_tenant_id;

      -- Log the restoration
      INSERT INTO inventory_sync_log (product_id, change_amount, change_source, tenant_id)
      VALUES (v_product_id, v_quantity, 'order_cancellation', v_tenant_id);

      v_restored_count := v_restored_count + 1;
    END LOOP;

  ELSIF p_order_type = 'menu' THEN
    SELECT tenant_id, status, order_data INTO v_tenant_id, v_order_status, v_items
    FROM menu_orders
    WHERE id = p_order_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Menu order not found');
    END IF;

    IF v_order_status NOT IN ('confirmed', 'preparing', 'ready') THEN
      RETURN jsonb_build_object('success', true, 'message', 'No inventory to release');
    END IF;

    -- Extract items from order_data
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_items->'items')
    LOOP
      v_product_id := (v_item->>'product_id')::UUID;
      v_quantity := COALESCE((v_item->>'quantity')::NUMERIC, 1);

      IF v_product_id IS NOT NULL THEN
        UPDATE products
        SET 
          stock_quantity = stock_quantity + v_quantity,
          updated_at = NOW()
        WHERE id = v_product_id 
        AND tenant_id = v_tenant_id;

        INSERT INTO inventory_sync_log (product_id, change_amount, change_source, tenant_id)
        VALUES (v_product_id, v_quantity, 'menu_order_cancellation', v_tenant_id);

        v_restored_count := v_restored_count + 1;
      END IF;
    END LOOP;
  END IF;

  -- Log audit trail
  INSERT INTO audit_logs (
    tenant_id,
    user_id,
    entity_type,
    entity_id,
    action,
    details
  ) VALUES (
    v_tenant_id,
    auth.uid(),
    p_order_type || '_order',
    p_order_id,
    'inventory_released',
    jsonb_build_object('items_restored', v_restored_count, 'previous_status', v_order_status)
  );

  RETURN jsonb_build_object(
    'success', true,
    'items_restored', v_restored_count,
    'order_type', p_order_type
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.release_order_inventory TO authenticated;

-- 5. Create trigger to auto-release inventory on order cancellation
CREATE OR REPLACE FUNCTION public.trigger_release_inventory_on_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only trigger on status change to 'cancelled'
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    PERFORM release_order_inventory(NEW.id, 'wholesale');
  END IF;
  RETURN NEW;
END;
$$;

-- Drop existing trigger if exists and recreate
DROP TRIGGER IF EXISTS trigger_wholesale_order_cancellation ON wholesale_orders;
CREATE TRIGGER trigger_wholesale_order_cancellation
  AFTER UPDATE OF status ON wholesale_orders
  FOR EACH ROW
  EXECUTE FUNCTION trigger_release_inventory_on_cancel();

-- Same for menu_orders
CREATE OR REPLACE FUNCTION public.trigger_release_menu_inventory_on_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    PERFORM release_order_inventory(NEW.id, 'menu');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_menu_order_cancellation ON menu_orders;
CREATE TRIGGER trigger_menu_order_cancellation
  AFTER UPDATE OF status ON menu_orders
  FOR EACH ROW
  EXECUTE FUNCTION trigger_release_menu_inventory_on_cancel();