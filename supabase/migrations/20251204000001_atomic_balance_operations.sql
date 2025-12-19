-- ============================================================================
-- ATOMIC BALANCE OPERATIONS
-- Prevents race conditions on client balance updates using row-level locking
-- ============================================================================

-- 1. Atomic client balance adjustment with FOR UPDATE locking
CREATE OR REPLACE FUNCTION public.adjust_client_balance(
  p_client_id UUID,
  p_amount NUMERIC,
  p_operation TEXT -- 'add' or 'subtract'
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance NUMERIC;
  v_new_balance NUMERIC;
  v_tenant_id UUID;
BEGIN
  -- Lock the row and get current balance
  SELECT outstanding_balance, tenant_id INTO v_current_balance, v_tenant_id
  FROM wholesale_clients
  WHERE id = p_client_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Client not found: %', p_client_id;
  END IF;

  v_current_balance := COALESCE(v_current_balance, 0);

  -- Calculate new balance
  IF p_operation = 'add' THEN
    v_new_balance := v_current_balance + p_amount;
  ELSIF p_operation = 'subtract' THEN
    v_new_balance := GREATEST(0, v_current_balance - p_amount);
  ELSE
    RAISE EXCEPTION 'Invalid operation: %. Must be "add" or "subtract"', p_operation;
  END IF;

  -- Update the balance
  UPDATE wholesale_clients
  SET 
    outstanding_balance = v_new_balance,
    updated_at = NOW()
  WHERE id = p_client_id;

  -- Log the balance change for audit
  INSERT INTO wholesale_inventory_movements (
    tenant_id,
    movement_type,
    notes,
    created_at
  ) VALUES (
    v_tenant_id,
    'balance_adjustment',
    format('Client %s balance %s by %s. Old: %s, New: %s', 
      p_client_id, p_operation, p_amount, v_current_balance, v_new_balance),
    NOW()
  );

  RETURN v_new_balance;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.adjust_client_balance TO authenticated;

COMMENT ON FUNCTION public.adjust_client_balance IS 
  'Atomically adjusts a wholesale client balance with row-level locking to prevent race conditions';


-- 2. Atomic fronted inventory dispatch with balance update
CREATE OR REPLACE FUNCTION public.create_fronted_inventory_atomic(
  p_tenant_id UUID,
  p_client_id UUID,
  p_items JSONB, -- Array of {product_id, quantity, cost_per_unit, price_per_unit}
  p_payment_due_date DATE,
  p_notes TEXT DEFAULT NULL,
  p_deal_type TEXT DEFAULT 'standard'
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
  v_cost_per_unit NUMERIC;
  v_price_per_unit NUMERIC;
  v_expected_revenue NUMERIC := 0;
  v_total_expected_revenue NUMERIC := 0;
  v_product_name TEXT;
  v_client_name TEXT;
  v_fronted_ids UUID[] := '{}';
  v_fronted_id UUID;
  v_current_available NUMERIC;
BEGIN
  -- Get client name for records
  SELECT business_name INTO v_client_name
  FROM wholesale_clients
  WHERE id = p_client_id
  FOR UPDATE; -- Lock client row

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Client not found: %', p_client_id;
  END IF;

  -- Process each item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_quantity := (v_item->>'quantity')::NUMERIC;
    v_cost_per_unit := COALESCE((v_item->>'cost_per_unit')::NUMERIC, 0);
    v_price_per_unit := COALESCE((v_item->>'price_per_unit')::NUMERIC, 0);
    v_expected_revenue := v_quantity * v_price_per_unit;

    -- Lock and check product inventory
    SELECT name, available_quantity INTO v_product_name, v_current_available
    FROM products
    WHERE id = v_product_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product not found: %', v_product_id;
    END IF;

    IF v_current_available < v_quantity THEN
      RAISE EXCEPTION 'Insufficient inventory for product %: available %, requested %',
        v_product_name, v_current_available, v_quantity;
    END IF;

    -- Create fronted inventory record
    INSERT INTO fronted_inventory (
      account_id,
      product_id,
      quantity_fronted,
      client_id,
      fronted_to_customer_name,
      deal_type,
      cost_per_unit,
      price_per_unit,
      expected_revenue,
      expected_profit,
      payment_due_date,
      notes,
      status,
      created_at
    ) VALUES (
      p_tenant_id,
      v_product_id,
      v_quantity,
      p_client_id,
      v_client_name,
      p_deal_type,
      v_cost_per_unit,
      v_price_per_unit,
      v_expected_revenue,
      v_expected_revenue - (v_quantity * v_cost_per_unit),
      p_payment_due_date,
      p_notes,
      'active',
      NOW()
    )
    RETURNING id INTO v_fronted_id;

    v_fronted_ids := array_append(v_fronted_ids, v_fronted_id);

    -- Decrement product inventory
    UPDATE products
    SET 
      available_quantity = available_quantity - v_quantity,
      fronted_quantity = COALESCE(fronted_quantity, 0) + v_quantity,
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
      'fronted',
      -v_quantity,
      format('Fronted to %s: %s units of %s', v_client_name, v_quantity, v_product_name),
      NOW()
    );

    v_total_expected_revenue := v_total_expected_revenue + v_expected_revenue;
  END LOOP;

  -- Update client outstanding balance atomically
  PERFORM adjust_client_balance(p_client_id, v_total_expected_revenue, 'add');

  RETURN jsonb_build_object(
    'success', true,
    'fronted_ids', to_jsonb(v_fronted_ids),
    'total_expected_revenue', v_total_expected_revenue,
    'client_name', v_client_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_fronted_inventory_atomic TO authenticated;

COMMENT ON FUNCTION public.create_fronted_inventory_atomic IS 
  'Atomically creates fronted inventory records with inventory decrement and client balance update';


-- 3. Atomic payment recording with balance update
CREATE OR REPLACE FUNCTION public.record_fronted_payment_atomic(
  p_fronted_id UUID,
  p_payment_amount NUMERIC,
  p_payment_method TEXT DEFAULT 'cash',
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fronted RECORD;
  v_new_payment_received NUMERIC;
  v_new_status TEXT;
  v_remaining NUMERIC;
BEGIN
  -- Lock and get fronted inventory record
  SELECT 
    fi.*,
    wc.business_name as client_name
  INTO v_fronted
  FROM fronted_inventory fi
  LEFT JOIN wholesale_clients wc ON wc.id = fi.client_id
  WHERE fi.id = p_fronted_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fronted inventory record not found: %', p_fronted_id;
  END IF;

  IF v_fronted.status IN ('completed', 'returned') THEN
    RAISE EXCEPTION 'Cannot record payment for fronted inventory with status: %', v_fronted.status;
  END IF;

  -- Calculate new payment received
  v_new_payment_received := COALESCE(v_fronted.payment_received, 0) + p_payment_amount;
  v_remaining := COALESCE(v_fronted.expected_revenue, 0) - v_new_payment_received;

  -- Determine new status
  IF v_remaining <= 0 THEN
    v_new_status := 'completed';
  ELSIF v_new_payment_received > 0 THEN
    v_new_status := 'partial';
  ELSE
    v_new_status := v_fronted.status;
  END IF;

  -- Update fronted inventory record
  UPDATE fronted_inventory
  SET 
    payment_received = v_new_payment_received,
    status = v_new_status,
    updated_at = NOW()
  WHERE id = p_fronted_id;

  -- Update client balance atomically (subtract payment)
  IF v_fronted.client_id IS NOT NULL THEN
    PERFORM adjust_client_balance(v_fronted.client_id, p_payment_amount, 'subtract');
  END IF;

  -- Create payment record if wholesale_payments table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'wholesale_payments'
  ) THEN
    INSERT INTO wholesale_payments (
      tenant_id,
      client_id,
      amount,
      payment_method,
      notes,
      created_at
    ) VALUES (
      v_fronted.account_id,
      v_fronted.client_id,
      p_payment_amount,
      p_payment_method,
      COALESCE(p_notes, format('Payment for fronted inventory %s', p_fronted_id)),
      NOW()
    );
  END IF;

  -- Log the movement
  INSERT INTO wholesale_inventory_movements (
    tenant_id,
    movement_type,
    notes,
    created_at
  ) VALUES (
    v_fronted.account_id,
    'payment',
    format('Payment of %s received for fronted inventory to %s', 
      p_payment_amount, v_fronted.client_name),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'new_status', v_new_status,
    'payment_received', v_new_payment_received,
    'remaining', v_remaining,
    'client_name', v_fronted.client_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_fronted_payment_atomic TO authenticated;

COMMENT ON FUNCTION public.record_fronted_payment_atomic IS 
  'Atomically records payment for fronted inventory with client balance update';


-- 4. Ensure wholesale_inventory_movements has all needed columns
DO $$
BEGIN
  -- Add tenant_id if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'wholesale_inventory_movements'
    AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE wholesale_inventory_movements ADD COLUMN tenant_id UUID REFERENCES tenants(id);
  END IF;

  -- Add notes if missing  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'wholesale_inventory_movements'
    AND column_name = 'notes'
  ) THEN
    ALTER TABLE wholesale_inventory_movements ADD COLUMN notes TEXT;
  END IF;

  -- Add quantity_change if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'wholesale_inventory_movements'
    AND column_name = 'quantity_change'
  ) THEN
    ALTER TABLE wholesale_inventory_movements ADD COLUMN quantity_change NUMERIC;
  END IF;
END $$;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_inventory_movements_tenant 
  ON wholesale_inventory_movements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_type 
  ON wholesale_inventory_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_created 
  ON wholesale_inventory_movements(created_at DESC);











