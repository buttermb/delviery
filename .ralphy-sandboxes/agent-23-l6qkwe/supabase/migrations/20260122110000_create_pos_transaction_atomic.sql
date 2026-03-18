-- Migration: Create atomic POS transaction function
-- This function handles POS transactions atomically to ensure data integrity
-- It creates the transaction, updates inventory, and handles edge cases

-- First, drop the function if it exists (for idempotency)
DROP FUNCTION IF EXISTS public.create_pos_transaction_atomic(UUID, JSONB, TEXT, NUMERIC, NUMERIC, NUMERIC, UUID, UUID);

-- Create the atomic transaction function
CREATE OR REPLACE FUNCTION public.create_pos_transaction_atomic(
  p_tenant_id UUID,
  p_items JSONB,
  p_payment_method TEXT,
  p_subtotal NUMERIC,
  p_tax_amount NUMERIC DEFAULT 0,
  p_discount_amount NUMERIC DEFAULT 0,
  p_customer_id UUID DEFAULT NULL,
  p_shift_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transaction_id UUID;
  v_transaction_number TEXT;
  v_item JSONB;
  v_total NUMERIC;
  v_product_id UUID;
  v_quantity INTEGER;
  v_current_stock INTEGER;
  v_product_name TEXT;
  v_insufficient_items JSONB := '[]'::JSONB;
BEGIN
  -- Calculate total amount
  v_total := COALESCE(p_subtotal, 0) + COALESCE(p_tax_amount, 0) - COALESCE(p_discount_amount, 0);

  -- Validate total is positive
  IF v_total < 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Transaction total cannot be negative',
      'error_code', 'NEGATIVE_TOTAL'
    );
  END IF;

  -- Validate items array is not empty
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Transaction must have at least one item',
      'error_code', 'EMPTY_CART'
    );
  END IF;

  -- STEP 1: Validate all items have sufficient stock BEFORE making any changes
  -- This prevents partial updates
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Support both 'id' and 'product_id' keys for flexibility
    v_product_id := COALESCE(
      (v_item->>'id')::UUID,
      (v_item->>'product_id')::UUID
    );
    v_quantity := COALESCE((v_item->>'quantity')::INTEGER, 0);

    -- Validate quantity is positive
    IF v_quantity <= 0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', format('Invalid quantity for product %s', v_product_id),
        'error_code', 'INVALID_QUANTITY'
      );
    END IF;

    -- Get current stock and product name
    SELECT stock_quantity, name INTO v_current_stock, v_product_name
    FROM products
    WHERE id = v_product_id
      AND tenant_id = p_tenant_id
    FOR UPDATE; -- Lock the row to prevent concurrent modifications

    -- Check if product exists
    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', format('Product %s not found', v_product_id),
        'error_code', 'PRODUCT_NOT_FOUND'
      );
    END IF;

    -- Check if sufficient stock
    IF v_current_stock < v_quantity THEN
      v_insufficient_items := v_insufficient_items || jsonb_build_object(
        'product_id', v_product_id,
        'product_name', v_product_name,
        'requested', v_quantity,
        'available', v_current_stock
      );
    END IF;
  END LOOP;

  -- If any items have insufficient stock, return error with details
  IF jsonb_array_length(v_insufficient_items) > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient stock for one or more items',
      'error_code', 'INSUFFICIENT_STOCK',
      'insufficient_items', v_insufficient_items
    );
  END IF;

  -- STEP 2: Generate unique transaction number
  -- Format: POS-YYYYMMDD-XXXX where XXXX is a random 4-digit number
  -- We use a loop to handle the rare case of collision
  LOOP
    v_transaction_number := 'POS-' || to_char(now(), 'YYYYMMDD') || '-' ||
      lpad(floor(random() * 10000)::TEXT, 4, '0');

    -- Check if this transaction number already exists
    IF NOT EXISTS (
      SELECT 1 FROM pos_transactions
      WHERE transaction_number = v_transaction_number
      AND tenant_id = p_tenant_id
    ) THEN
      EXIT; -- Unique number found, exit loop
    END IF;
  END LOOP;

  -- STEP 3: Create the transaction record
  INSERT INTO pos_transactions (
    id,
    tenant_id,
    transaction_number,
    subtotal,
    tax_amount,
    discount_amount,
    total_amount,
    payment_method,
    payment_status,
    items,
    shift_id,
    created_at,
    updated_at
  )
  VALUES (
    gen_random_uuid(),
    p_tenant_id,
    v_transaction_number,
    COALESCE(p_subtotal, 0),
    COALESCE(p_tax_amount, 0),
    COALESCE(p_discount_amount, 0),
    v_total,
    p_payment_method,
    'completed',
    p_items,
    p_shift_id,
    now(),
    now()
  )
  RETURNING id INTO v_transaction_id;

  -- STEP 4: Update inventory for each item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Support both 'id' and 'product_id' keys for flexibility
    v_product_id := COALESCE(
      (v_item->>'id')::UUID,
      (v_item->>'product_id')::UUID
    );
    v_quantity := (v_item->>'quantity')::INTEGER;

    -- Get product name for logging
    SELECT name INTO v_product_name
    FROM products
    WHERE id = v_product_id;

    UPDATE products
    SET
      stock_quantity = stock_quantity - v_quantity,
      available_quantity = GREATEST(0, COALESCE(available_quantity, stock_quantity) - v_quantity),
      updated_at = now()
    WHERE id = v_product_id
      AND tenant_id = p_tenant_id;

    -- Log the inventory movement for audit trail
    INSERT INTO wholesale_inventory_movements (
      id,
      inventory_id,
      product_name,
      movement_type,
      quantity_change,
      order_id,
      notes,
      performed_by,
      created_at
    )
    VALUES (
      gen_random_uuid(),
      v_product_id,
      v_product_name,
      'sale',
      -v_quantity,
      NULL,
      'POS Sale: ' || v_transaction_number,
      auth.uid(),
      now()
    );
  END LOOP;

  -- STEP 5: Update shift totals if shift is provided
  -- Note: There's already a trigger (update_shift_totals_trigger) that handles this,
  -- but we do it explicitly here for consistency within the atomic operation
  IF p_shift_id IS NOT NULL THEN
    UPDATE pos_shifts
    SET
      total_sales = COALESCE(total_sales, 0) + v_total,
      total_transactions = COALESCE(total_transactions, 0) + 1,
      cash_sales = CASE WHEN p_payment_method = 'cash' THEN COALESCE(cash_sales, 0) + v_total ELSE cash_sales END,
      card_sales = CASE WHEN p_payment_method = 'card' THEN COALESCE(card_sales, 0) + v_total ELSE card_sales END,
      other_sales = CASE WHEN p_payment_method NOT IN ('cash', 'card') THEN COALESCE(other_sales, 0) + v_total ELSE other_sales END,
      updated_at = now()
    WHERE id = p_shift_id
      AND tenant_id = p_tenant_id;
  END IF;

  -- STEP 6: Update customer loyalty points if applicable
  IF p_customer_id IS NOT NULL THEN
    UPDATE customers
    SET loyalty_points = COALESCE(loyalty_points, 0) + FLOOR(v_total)
    WHERE id = p_customer_id
      AND tenant_id = p_tenant_id;
  END IF;

  -- STEP 7: Sync to unified_orders if the table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'unified_orders') THEN
    INSERT INTO unified_orders (
      tenant_id, order_number, order_type, source, status,
      subtotal, tax_amount, discount_amount, total_amount,
      payment_method, payment_status, customer_id, shift_id,
      metadata, created_at
    ) VALUES (
      p_tenant_id, v_transaction_number, 'pos', 'pos_terminal', 'completed',
      p_subtotal, p_tax_amount, p_discount_amount, v_total,
      p_payment_method, 'paid', p_customer_id, p_shift_id,
      jsonb_build_object('source_transaction_id', v_transaction_id, 'items', p_items),
      now()
    );
  END IF;

  -- STEP 8: Return success response with transaction details
  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'transaction_number', v_transaction_number,
    'total', v_total,
    'items_count', jsonb_array_length(p_items),
    'payment_method', p_payment_method,
    'created_at', now()
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Log the error and return failure response
    RAISE WARNING 'POS Transaction Error: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'error_code', 'TRANSACTION_FAILED'
    );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_pos_transaction_atomic TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.create_pos_transaction_atomic IS
  'Atomically creates a POS transaction, updates inventory, and logs movements.
   Returns JSON with success status and transaction details or error information.
   Supports both "id" and "product_id" keys in items array for flexibility.';

-- Add 'sale' to wholesale_inventory_movements movement_type if not already allowed
-- First check if the constraint exists and what values it allows
DO $$
BEGIN
  -- Drop the old constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'wholesale_inventory_movements'
    AND constraint_name = 'wholesale_inventory_movements_movement_type_check'
  ) THEN
    ALTER TABLE wholesale_inventory_movements
    DROP CONSTRAINT wholesale_inventory_movements_movement_type_check;
  END IF;

  -- Add the new constraint with 'sale' and 'pos_sale' included
  ALTER TABLE wholesale_inventory_movements
  ADD CONSTRAINT wholesale_inventory_movements_movement_type_check
  CHECK (movement_type IN ('sale', 'pos_sale', 'restock', 'adjustment', 'transfer', 'fronted_return', 'damage', 'purchase', 'return', 'expired'));
EXCEPTION
  WHEN OTHERS THEN
    -- Constraint might not exist or might already include the values we need
    RAISE NOTICE 'Could not update movement_type constraint: %', SQLERRM;
END $$;

-- Add tenant_id column to wholesale_inventory_movements if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'wholesale_inventory_movements'
    AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE wholesale_inventory_movements ADD COLUMN tenant_id UUID;
    CREATE INDEX IF NOT EXISTS idx_wholesale_inventory_movements_tenant
      ON wholesale_inventory_movements(tenant_id);
  END IF;
END $$;
