-- ============================================================================
-- POS ATOMIC OPERATIONS
-- Fixes race conditions in POS and remaining balance update flows
-- ============================================================================

-- 1. Atomic POS transaction with inventory decrement
CREATE OR REPLACE FUNCTION public.create_pos_transaction_atomic(
  p_tenant_id UUID,
  p_items JSONB, -- Array of {product_id, product_name, quantity, price, stock_quantity}
  p_payment_method TEXT,
  p_subtotal NUMERIC,
  p_tax_amount NUMERIC DEFAULT 0,
  p_discount_amount NUMERIC DEFAULT 0,
  p_customer_id UUID DEFAULT NULL,
  p_shift_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transaction_id UUID;
  v_transaction_number TEXT;
  v_item JSONB;
  v_product_id UUID;
  v_quantity NUMERIC;
  v_current_stock NUMERIC;
  v_total NUMERIC;
BEGIN
  v_total := p_subtotal + p_tax_amount - p_discount_amount;

  -- Generate transaction number
  SELECT 'POS-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || 
         LPAD((COALESCE(MAX(
           CASE WHEN transaction_number ~ '^POS-[0-9]{6}-[0-9]+$'
           THEN CAST(SUBSTRING(transaction_number FROM 'POS-[0-9]{6}-([0-9]+)$') AS INTEGER)
           ELSE 0 END
         ), 0) + 1)::TEXT, 4, '0')
  INTO v_transaction_number
  FROM pos_transactions
  WHERE tenant_id = p_tenant_id;

  -- Validate and lock all products first
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_quantity := (v_item->>'quantity')::NUMERIC;

    -- Lock product row and check stock
    SELECT stock_quantity INTO v_current_stock
    FROM products
    WHERE id = v_product_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product not found: %', v_product_id;
    END IF;

    IF v_current_stock < v_quantity THEN
      RAISE EXCEPTION 'Insufficient stock for product %: available %, requested %',
        v_item->>'product_name', v_current_stock, v_quantity;
    END IF;
  END LOOP;

  -- Create transaction
  INSERT INTO pos_transactions (
    tenant_id,
    transaction_number,
    shift_id,
    customer_id,
    subtotal,
    tax_amount,
    discount_amount,
    total_amount,
    payment_method,
    payment_status,
    items,
    created_at
  ) VALUES (
    p_tenant_id,
    v_transaction_number,
    p_shift_id,
    p_customer_id,
    p_subtotal,
    p_tax_amount,
    p_discount_amount,
    v_total,
    p_payment_method,
    'completed',
    p_items,
    NOW()
  )
  RETURNING id INTO v_transaction_id;

  -- Decrement inventory for each item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_quantity := (v_item->>'quantity')::NUMERIC;

    UPDATE products
    SET 
      stock_quantity = stock_quantity - v_quantity,
      available_quantity = GREATEST(0, COALESCE(available_quantity, stock_quantity) - v_quantity),
      updated_at = NOW()
    WHERE id = v_product_id;

    -- Log inventory movement
    INSERT INTO wholesale_inventory_movements (
      tenant_id,
      inventory_id,
      movement_type,
      quantity_change,
      notes,
      created_at
    ) VALUES (
      p_tenant_id,
      v_product_id,
      'pos_sale',
      -v_quantity,
      format('POS transaction %s: %s units of %s', 
        v_transaction_number, v_quantity, v_item->>'product_name'),
      NOW()
    );
  END LOOP;

  -- Update customer loyalty points if applicable
  IF p_customer_id IS NOT NULL THEN
    UPDATE customers
    SET loyalty_points = COALESCE(loyalty_points, 0) + FLOOR(v_total)
    WHERE id = p_customer_id;
  END IF;

  -- Sync to unified_orders if exists
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
      NOW()
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'transaction_number', v_transaction_number,
    'total', v_total
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_pos_transaction_atomic TO authenticated;

COMMENT ON FUNCTION public.create_pos_transaction_atomic IS 
  'Atomically creates POS transaction with inventory decrement and optional loyalty points';


-- 2. Atomic delivery completion with collection (for runner portal)
CREATE OR REPLACE FUNCTION public.complete_delivery_with_collection(
  p_delivery_id UUID,
  p_amount_collected NUMERIC,
  p_proof_photo_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_delivery RECORD;
  v_new_balance NUMERIC;
BEGIN
  -- Lock and get delivery with order and client info
  SELECT 
    wd.*,
    wo.client_id,
    wo.order_number,
    wc.business_name,
    wc.outstanding_balance
  INTO v_delivery
  FROM wholesale_deliveries wd
  LEFT JOIN wholesale_orders wo ON wo.id = wd.order_id
  LEFT JOIN wholesale_clients wc ON wc.id = wo.client_id
  WHERE wd.id = p_delivery_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery not found: %', p_delivery_id;
  END IF;

  IF v_delivery.status = 'delivered' THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Delivery already completed'
    );
  END IF;

  -- Update delivery status
  UPDATE wholesale_deliveries
  SET 
    status = 'delivered',
    delivered_at = NOW(),
    proof_of_delivery_url = COALESCE(p_proof_photo_url, proof_of_delivery_url),
    amount_collected = p_amount_collected,
    updated_at = NOW()
  WHERE id = p_delivery_id;

  -- Update order status
  IF v_delivery.order_id IS NOT NULL THEN
    UPDATE wholesale_orders
    SET 
      status = 'delivered',
      updated_at = NOW()
    WHERE id = v_delivery.order_id;
  END IF;

  -- Update client balance if collection was made
  IF p_amount_collected > 0 AND v_delivery.client_id IS NOT NULL THEN
    -- Use atomic balance adjustment
    PERFORM adjust_client_balance(v_delivery.client_id, p_amount_collected, 'subtract');
    
    -- Get new balance
    SELECT outstanding_balance INTO v_new_balance
    FROM wholesale_clients
    WHERE id = v_delivery.client_id;

    -- Create payment record
    INSERT INTO wholesale_payments (
      tenant_id,
      client_id,
      amount,
      payment_method,
      notes,
      created_at
    ) VALUES (
      v_delivery.tenant_id,
      v_delivery.client_id,
      p_amount_collected,
      'cash',
      format('Collection on delivery %s (Order: %s)', p_delivery_id, v_delivery.order_number),
      NOW()
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'delivery_id', p_delivery_id,
    'order_number', v_delivery.order_number,
    'amount_collected', p_amount_collected,
    'new_client_balance', v_new_balance,
    'client_name', v_delivery.business_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_delivery_with_collection TO authenticated;

COMMENT ON FUNCTION public.complete_delivery_with_collection IS 
  'Atomically completes delivery with optional cash collection and balance update';


-- 3. Atomic fronted return processing
CREATE OR REPLACE FUNCTION public.process_fronted_return_atomic(
  p_fronted_id UUID,
  p_good_returns INT,
  p_damaged_returns INT DEFAULT 0,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fronted RECORD;
  v_return_value NUMERIC;
  v_current_product_stock NUMERIC;
BEGIN
  -- Lock and get fronted inventory record
  SELECT 
    fi.*,
    p.name as product_name,
    p.available_quantity as product_stock,
    wc.business_name as client_name
  INTO v_fronted
  FROM fronted_inventory fi
  LEFT JOIN products p ON p.id = fi.product_id
  LEFT JOIN wholesale_clients wc ON wc.id = fi.client_id
  WHERE fi.id = p_fronted_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fronted inventory record not found: %', p_fronted_id;
  END IF;

  -- Calculate return value (good returns reduce balance)
  v_return_value := p_good_returns * COALESCE(v_fronted.price_per_unit, 0);

  -- Update fronted inventory
  UPDATE fronted_inventory
  SET 
    quantity_returned = COALESCE(quantity_returned, 0) + p_good_returns,
    quantity_damaged = COALESCE(quantity_damaged, 0) + p_damaged_returns,
    status = CASE 
      WHEN (COALESCE(quantity_returned, 0) + p_good_returns + COALESCE(quantity_damaged, 0) + p_damaged_returns) >= quantity_fronted
      THEN 'returned'
      ELSE status
    END,
    updated_at = NOW()
  WHERE id = p_fronted_id;

  -- Return good items to inventory
  IF p_good_returns > 0 THEN
    UPDATE products
    SET 
      available_quantity = COALESCE(available_quantity, 0) + p_good_returns,
      fronted_quantity = GREATEST(0, COALESCE(fronted_quantity, 0) - p_good_returns),
      updated_at = NOW()
    WHERE id = v_fronted.product_id;

    -- Log inventory movement
    INSERT INTO wholesale_inventory_movements (
      tenant_id,
      inventory_id,
      movement_type,
      quantity_change,
      notes,
      created_at
    ) VALUES (
      v_fronted.account_id,
      v_fronted.product_id,
      'fronted_return',
      p_good_returns,
      format('Return from %s: %s units of %s', 
        v_fronted.client_name, p_good_returns, v_fronted.product_name),
      NOW()
    );
  END IF;

  -- Update client balance (reduce by return value)
  IF v_return_value > 0 AND v_fronted.client_id IS NOT NULL THEN
    PERFORM adjust_client_balance(v_fronted.client_id, v_return_value, 'subtract');
  END IF;

  -- Log damaged items
  IF p_damaged_returns > 0 THEN
    INSERT INTO wholesale_inventory_movements (
      tenant_id,
      inventory_id,
      movement_type,
      quantity_change,
      notes,
      created_at
    ) VALUES (
      v_fronted.account_id,
      v_fronted.product_id,
      'damage',
      -p_damaged_returns,
      format('Damaged return from %s: %s units of %s. %s', 
        v_fronted.client_name, p_damaged_returns, v_fronted.product_name, COALESCE(p_notes, '')),
      NOW()
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'fronted_id', p_fronted_id,
    'good_returned', p_good_returns,
    'damaged', p_damaged_returns,
    'balance_reduced', v_return_value,
    'client_name', v_fronted.client_name,
    'product_name', v_fronted.product_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_fronted_return_atomic TO authenticated;

COMMENT ON FUNCTION public.process_fronted_return_atomic IS 
  'Atomically processes fronted inventory returns with inventory restoration and balance adjustment';


-- 4. Add transaction_number column to pos_transactions if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'pos_transactions'
    AND column_name = 'transaction_number'
  ) THEN
    ALTER TABLE pos_transactions ADD COLUMN transaction_number TEXT;
    CREATE INDEX idx_pos_transactions_number ON pos_transactions(transaction_number);
  END IF;
END $$;



