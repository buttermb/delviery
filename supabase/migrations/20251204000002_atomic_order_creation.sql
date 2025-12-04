-- ============================================================================
-- ATOMIC WHOLESALE ORDER CREATION
-- Single transaction for order creation, inventory decrement, and balance update
-- ============================================================================

-- Create wholesale order atomically with all related operations
CREATE OR REPLACE FUNCTION public.create_wholesale_order_atomic(
  p_tenant_id UUID,
  p_client_id UUID,
  p_items JSONB, -- Array of {inventory_id, quantity_lbs, price_per_lb}
  p_delivery_address TEXT DEFAULT NULL,
  p_delivery_notes TEXT DEFAULT NULL,
  p_payment_method TEXT DEFAULT 'credit',
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id UUID;
  v_order_number TEXT;
  v_item JSONB;
  v_inventory_id UUID;
  v_quantity_lbs NUMERIC;
  v_price_per_lb NUMERIC;
  v_item_total NUMERIC;
  v_total_amount NUMERIC := 0;
  v_client RECORD;
  v_inventory RECORD;
  v_new_balance NUMERIC;
  v_processed_items JSONB := '[]'::JSONB;
  v_existing_order_id UUID;
BEGIN
  -- Check idempotency (prevent duplicate orders)
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_order_id
    FROM wholesale_orders
    WHERE tenant_id = p_tenant_id
      AND (metadata->>'idempotency_key') = p_idempotency_key;
    
    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true,
        'order_id', v_existing_order_id,
        'idempotent', true,
        'message', 'Order already exists with this idempotency key'
      );
    END IF;
  END IF;

  -- Lock and get client info
  SELECT 
    id, business_name, credit_limit, outstanding_balance, status
  INTO v_client
  FROM wholesale_clients
  WHERE id = p_client_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Client not found: %', p_client_id;
  END IF;

  IF v_client.status = 'suspended' THEN
    RAISE EXCEPTION 'Client % is suspended', v_client.business_name;
  END IF;

  -- First pass: validate all items and calculate total
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_inventory_id := (v_item->>'inventory_id')::UUID;
    v_quantity_lbs := (v_item->>'quantity_lbs')::NUMERIC;
    v_price_per_lb := (v_item->>'price_per_lb')::NUMERIC;

    -- Lock and validate inventory
    SELECT wi.*, p.name as product_name
    INTO v_inventory
    FROM wholesale_inventory wi
    LEFT JOIN products p ON p.id = wi.product_id
    WHERE wi.id = v_inventory_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Inventory item not found: %', v_inventory_id;
    END IF;

    IF v_inventory.quantity_lbs < v_quantity_lbs THEN
      RAISE EXCEPTION 'Insufficient inventory for %: available % lbs, requested % lbs',
        COALESCE(v_inventory.product_name, v_inventory_id::TEXT),
        v_inventory.quantity_lbs,
        v_quantity_lbs;
    END IF;

    -- Use inventory price if not specified
    IF v_price_per_lb IS NULL OR v_price_per_lb <= 0 THEN
      v_price_per_lb := COALESCE(v_inventory.base_price, 0);
    END IF;

    v_item_total := v_quantity_lbs * v_price_per_lb;
    v_total_amount := v_total_amount + v_item_total;

    v_processed_items := v_processed_items || jsonb_build_object(
      'inventory_id', v_inventory_id,
      'product_name', COALESCE(v_inventory.product_name, 'Unknown'),
      'quantity_lbs', v_quantity_lbs,
      'price_per_lb', v_price_per_lb,
      'subtotal', v_item_total
    );
  END LOOP;

  -- Check credit limit
  v_new_balance := COALESCE(v_client.outstanding_balance, 0) + v_total_amount;
  IF v_new_balance > COALESCE(v_client.credit_limit, 0) THEN
    RAISE EXCEPTION 'Credit limit exceeded for %: limit %, current balance %, order total %, would be %',
      v_client.business_name,
      v_client.credit_limit,
      v_client.outstanding_balance,
      v_total_amount,
      v_new_balance;
  END IF;

  -- Generate order number
  SELECT 'WO-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || 
         LPAD((COALESCE(MAX(
           CASE WHEN order_number ~ '^WO-[0-9]{6}-[0-9]+$'
           THEN CAST(SUBSTRING(order_number FROM 'WO-[0-9]{6}-([0-9]+)$') AS INTEGER)
           ELSE 0 END
         ), 0) + 1)::TEXT, 4, '0')
  INTO v_order_number
  FROM wholesale_orders
  WHERE tenant_id = p_tenant_id;

  -- Create the order
  INSERT INTO wholesale_orders (
    tenant_id,
    client_id,
    order_number,
    total_amount,
    delivery_address,
    delivery_notes,
    status,
    payment_status,
    metadata,
    created_at,
    updated_at
  ) VALUES (
    p_tenant_id,
    p_client_id,
    v_order_number,
    v_total_amount,
    p_delivery_address,
    p_delivery_notes,
    'pending',
    CASE WHEN p_payment_method = 'cash' THEN 'unpaid' ELSE 'unpaid' END,
    CASE WHEN p_idempotency_key IS NOT NULL 
      THEN jsonb_build_object('idempotency_key', p_idempotency_key)
      ELSE '{}'::JSONB
    END,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_order_id;

  -- Create order items and decrement inventory
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_processed_items)
  LOOP
    v_inventory_id := (v_item->>'inventory_id')::UUID;
    v_quantity_lbs := (v_item->>'quantity_lbs')::NUMERIC;
    v_price_per_lb := (v_item->>'price_per_lb')::NUMERIC;
    v_item_total := (v_item->>'subtotal')::NUMERIC;

    -- Insert order item
    INSERT INTO wholesale_order_items (
      order_id,
      inventory_id,
      quantity_lbs,
      price_per_lb,
      subtotal,
      created_at
    ) VALUES (
      v_order_id,
      v_inventory_id,
      v_quantity_lbs,
      v_price_per_lb,
      v_item_total,
      NOW()
    );

    -- Decrement inventory
    UPDATE wholesale_inventory
    SET 
      quantity_lbs = quantity_lbs - v_quantity_lbs,
      updated_at = NOW()
    WHERE id = v_inventory_id;

    -- Log inventory movement
    INSERT INTO wholesale_inventory_movements (
      tenant_id,
      inventory_id,
      order_id,
      movement_type,
      quantity_change,
      notes,
      created_at
    ) VALUES (
      p_tenant_id,
      v_inventory_id,
      v_order_id,
      'sale',
      -v_quantity_lbs,
      format('Wholesale order %s: %s lbs sold to %s', 
        v_order_number, v_quantity_lbs, v_client.business_name),
      NOW()
    );
  END LOOP;

  -- Update client outstanding balance
  UPDATE wholesale_clients
  SET 
    outstanding_balance = v_new_balance,
    last_order_date = NOW(),
    updated_at = NOW()
  WHERE id = p_client_id;

  -- Sync to unified_orders if table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'unified_orders'
  ) THEN
    INSERT INTO unified_orders (
      tenant_id,
      order_number,
      order_type,
      source,
      status,
      total_amount,
      payment_status,
      wholesale_client_id,
      delivery_address,
      delivery_notes,
      metadata,
      created_at
    ) VALUES (
      p_tenant_id,
      v_order_number,
      'wholesale',
      'admin',
      'pending',
      v_total_amount,
      'unpaid',
      p_client_id,
      p_delivery_address,
      p_delivery_notes,
      jsonb_build_object('source_order_id', v_order_id),
      NOW()
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_number', v_order_number,
    'total_amount', v_total_amount,
    'new_client_balance', v_new_balance,
    'items', v_processed_items
  );

EXCEPTION
  WHEN OTHERS THEN
    -- On any error, the transaction will be rolled back
    RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_wholesale_order_atomic TO authenticated;

COMMENT ON FUNCTION public.create_wholesale_order_atomic IS 
  'Atomically creates a wholesale order with inventory decrement and client balance update. Supports idempotency.';


-- Function to cancel wholesale order atomically (restores inventory and balance)
CREATE OR REPLACE FUNCTION public.cancel_wholesale_order_atomic(
  p_order_id UUID,
  p_reason TEXT DEFAULT 'Cancelled by admin',
  p_restore_inventory BOOLEAN DEFAULT TRUE,
  p_reverse_balance BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_item RECORD;
  v_restored_items INT := 0;
BEGIN
  -- Lock and get order
  SELECT 
    wo.*,
    wc.business_name as client_name,
    wc.outstanding_balance as client_balance
  INTO v_order
  FROM wholesale_orders wo
  LEFT JOIN wholesale_clients wc ON wc.id = wo.client_id
  WHERE wo.id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found: %', p_order_id;
  END IF;

  IF v_order.status = 'cancelled' THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Order is already cancelled'
    );
  END IF;

  -- Restore inventory if requested and order wasn't already delivered
  IF p_restore_inventory AND v_order.status NOT IN ('delivered', 'completed') THEN
    FOR v_item IN
      SELECT * FROM wholesale_order_items WHERE order_id = p_order_id
    LOOP
      UPDATE wholesale_inventory
      SET 
        quantity_lbs = quantity_lbs + v_item.quantity_lbs,
        updated_at = NOW()
      WHERE id = v_item.inventory_id;

      -- Log restoration
      INSERT INTO wholesale_inventory_movements (
        tenant_id,
        inventory_id,
        order_id,
        movement_type,
        quantity_change,
        notes,
        created_at
      ) VALUES (
        v_order.tenant_id,
        v_item.inventory_id,
        p_order_id,
        'return',
        v_item.quantity_lbs,
        format('Order %s cancelled: %s lbs restored', v_order.order_number, v_item.quantity_lbs),
        NOW()
      );

      v_restored_items := v_restored_items + 1;
    END LOOP;
  END IF;

  -- Reverse client balance if requested and order was unpaid
  IF p_reverse_balance AND v_order.payment_status != 'paid' AND v_order.client_id IS NOT NULL THEN
    PERFORM adjust_client_balance(v_order.client_id, v_order.total_amount, 'subtract');
  END IF;

  -- Update order status
  UPDATE wholesale_orders
  SET 
    status = 'cancelled',
    delivery_notes = COALESCE(delivery_notes, '') || E'\n[CANCELLED] ' || p_reason,
    updated_at = NOW()
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'order_number', v_order.order_number,
    'inventory_restored', p_restore_inventory AND v_order.status NOT IN ('delivered', 'completed'),
    'items_restored', v_restored_items,
    'balance_reversed', p_reverse_balance AND v_order.payment_status != 'paid'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_wholesale_order_atomic TO authenticated;

COMMENT ON FUNCTION public.cancel_wholesale_order_atomic IS 
  'Atomically cancels a wholesale order, optionally restoring inventory and reversing client balance';


-- Add idempotency index
CREATE INDEX IF NOT EXISTS idx_wholesale_orders_idempotency 
  ON wholesale_orders((metadata->>'idempotency_key'))
  WHERE metadata->>'idempotency_key' IS NOT NULL;

-- Add order_id to inventory movements if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'wholesale_inventory_movements'
    AND column_name = 'order_id'
  ) THEN
    ALTER TABLE wholesale_inventory_movements ADD COLUMN order_id UUID;
    CREATE INDEX idx_inventory_movements_order ON wholesale_inventory_movements(order_id);
  END IF;
END $$;



