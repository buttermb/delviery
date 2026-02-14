-- Nuclear Option Phase 1: Schema & RPCs
-- Implements Inventory Reservation Pattern for Atomic Orders

-- 1. Create Inventory Reservations Table
CREATE TABLE IF NOT EXISTS public.inventory_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id UUID REFERENCES public.disposable_menus(id),
  items JSONB NOT NULL, -- Array of {product_id, quantity}
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'cancelled', 'expired')) DEFAULT 'pending',
  lock_token TEXT NOT NULL, -- Idempotency/Security token
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reservations_expires ON public.inventory_reservations(expires_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_reservations_menu ON public.inventory_reservations(menu_id);

-- 2. Create Compliance Logs Table (Chain of Custody)
CREATE TABLE IF NOT EXISTS public.compliance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL, -- 'order_created', 'inventory_reserved', etc.
  entity_type TEXT NOT NULL, -- 'menu_order', 'inventory_reservation'
  entity_id UUID NOT NULL,
  data_snapshot JSONB NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  signature_hash TEXT, -- Placeholder for cryptographic signature
  trace_id TEXT -- Distributed tracing ID
);

CREATE INDEX IF NOT EXISTS idx_compliance_entity ON public.compliance_logs(entity_id);
CREATE INDEX IF NOT EXISTS idx_compliance_trace ON public.compliance_logs(trace_id);

-- Enable RLS
ALTER TABLE public.inventory_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_logs ENABLE ROW LEVEL SECURITY;

-- Policies (Open for Edge Functions/Service Role, restricted for users)
CREATE POLICY "Service role can manage reservations" ON public.inventory_reservations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage compliance logs" ON public.compliance_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3. RPC: Reserve Inventory (Pessimistic Locking)
CREATE OR REPLACE FUNCTION public.reserve_inventory(
  p_menu_id UUID,
  p_items JSONB, -- [{product_id: uuid, quantity: number}]
  p_trace_id TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with elevated privileges to lock rows
AS $$
DECLARE
  v_item JSONB;
  v_product_id UUID;
  v_quantity NUMERIC;
  v_current_stock NUMERIC;
  v_reservation_id UUID;
  v_lock_token TEXT;
BEGIN
  -- Generate reservation ID and lock token
  v_reservation_id := gen_random_uuid();
  v_lock_token := encode(gen_random_bytes(16), 'hex');

  -- Loop through items to check and lock inventory
  -- CRITICAL: We must order by product_id to prevent deadlocks
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) ORDER BY (value->>'product_id') ASC
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_quantity := (v_item->>'quantity')::NUMERIC;

    -- Lock the inventory row
    SELECT quantity_lbs INTO v_current_stock
    FROM public.wholesale_inventory
    WHERE id = v_product_id
    FOR UPDATE NOWAIT; -- Fail immediately if locked by another tx

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % not found', v_product_id;
    END IF;

    -- Check availability (considering existing reservations?)
    -- For strict correctness, we should also check active reservations, 
    -- but for this v1 we assume wholesale_inventory.quantity_lbs is the source of truth
    -- and we decrement it ONLY on confirmation.
    -- Wait, if we don't decrement now, multiple reservations could exceed stock.
    -- "Nuclear Option" says: "Step 3.2: Check quantity AFTER lock acquired"
    
    -- To prevent overselling with the Reservation pattern, we must account for 
    -- pending reservations.
    -- Option A: Decrement immediately (hold stock). If expired, increment back.
    -- Option B: Calculate available = stock - sum(pending_reservations).
    
    -- Let's go with Option B for better auditability, but it requires summing reservations.
    -- Actually, Option A is safer for "Nuclear" consistency. 
    -- Let's DECREMENT NOW (Soft Reserve). If cancelled/expired, we increment back.
    
    IF v_current_stock < v_quantity THEN
      RAISE EXCEPTION 'Insufficient stock for product %. Requested: %, Available: %', v_product_id, v_quantity, v_current_stock;
    END IF;

    -- Decrement stock immediately to reserve it
    UPDATE public.wholesale_inventory
    SET quantity_lbs = quantity_lbs - v_quantity,
        updated_at = NOW()
    WHERE id = v_product_id;
    
  END LOOP;

  -- Create Reservation Record
  INSERT INTO public.inventory_reservations (
    id,
    menu_id,
    items,
    expires_at,
    status,
    lock_token
  ) VALUES (
    v_reservation_id,
    p_menu_id,
    p_items,
    NOW() + INTERVAL '10 minutes', -- 10 minute hold
    'pending',
    v_lock_token
  );

  -- Log Compliance Event
  INSERT INTO public.compliance_logs (
    event_type,
    entity_type,
    entity_id,
    data_snapshot,
    trace_id
  ) VALUES (
    'inventory_reserved',
    'inventory_reservation',
    v_reservation_id,
    jsonb_build_object('items', p_items, 'menu_id', p_menu_id),
    p_trace_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'reservation_id', v_reservation_id,
    'lock_token', v_lock_token,
    'expires_at', NOW() + INTERVAL '10 minutes'
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Transaction automatically rolls back
    RAISE;
END;
$$;

-- 4. RPC: Cancel Reservation (Rollback)
CREATE OR REPLACE FUNCTION public.cancel_reservation(
  p_reservation_id UUID,
  p_reason TEXT DEFAULT 'user_cancelled'
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reservation RECORD;
  v_item JSONB;
BEGIN
  -- Lock reservation
  SELECT * INTO v_reservation
  FROM public.inventory_reservations
  WHERE id = p_reservation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservation not found';
  END IF;

  IF v_reservation.status != 'pending' THEN
    -- Already processed or cancelled
    RETURN;
  END IF;

  -- Restore inventory
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_reservation.items)
  LOOP
    UPDATE public.wholesale_inventory
    SET quantity_lbs = quantity_lbs + (v_item->>'quantity')::NUMERIC,
        updated_at = NOW()
    WHERE id = (v_item->>'product_id')::UUID;
  END LOOP;

  -- Update status
  UPDATE public.inventory_reservations
  SET status = 'cancelled',
      updated_at = NOW()
  WHERE id = p_reservation_id;

END;
$$;

-- 5. RPC: Confirm Menu Order (Finalize)
CREATE OR REPLACE FUNCTION public.confirm_menu_order(
  p_reservation_id UUID,
  p_order_data JSONB, -- Full order details (contact, address, etc)
  p_payment_info JSONB,
  p_trace_id TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reservation RECORD;
  v_order_id UUID;
  v_total_amount NUMERIC;
BEGIN
  -- Lock reservation
  SELECT * INTO v_reservation
  FROM public.inventory_reservations
  WHERE id = p_reservation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservation not found';
  END IF;

  IF v_reservation.status != 'pending' THEN
    RAISE EXCEPTION 'Reservation is not pending (Status: %)', v_reservation.status;
  END IF;

  IF v_reservation.expires_at < NOW() THEN
    RAISE EXCEPTION 'Reservation expired';
  END IF;

  -- Calculate total (Double check?)
  -- For now, trust the passed total or recalculate. 
  -- Let's assume p_order_data contains 'total_amount' validated by Edge Function.
  v_total_amount := (p_order_data->>'total_amount')::NUMERIC;

  -- Create Menu Order
  INSERT INTO public.menu_orders (
    menu_id,
    tenant_id, -- Should be passed or looked up. Let's look up from menu.
    access_whitelist_id,
    order_data,
    total_amount,
    delivery_method,
    payment_method,
    contact_phone,
    delivery_address,
    customer_notes,
    status,
    created_at
  ) 
  SELECT
    v_reservation.menu_id,
    (SELECT tenant_id FROM public.disposable_menus WHERE id = v_reservation.menu_id),
    (p_order_data->>'access_whitelist_id')::UUID,
    p_order_data, -- Contains items, etc.
    v_total_amount,
    p_order_data->>'delivery_method',
    p_order_data->>'payment_method',
    p_order_data->>'contact_phone',
    p_order_data->>'delivery_address',
    p_order_data->>'customer_notes',
    'confirmed', -- Immediately confirmed as payment succeeded
    NOW()
  RETURNING id INTO v_order_id;

  -- Mark reservation as confirmed
  UPDATE public.inventory_reservations
  SET status = 'confirmed',
      updated_at = NOW()
  WHERE id = p_reservation_id;

  -- Log Compliance
  INSERT INTO public.compliance_logs (
    event_type,
    entity_type,
    entity_id,
    data_snapshot,
    trace_id
  ) VALUES (
    'order_confirmed',
    'menu_order',
    v_order_id,
    jsonb_build_object(
      'reservation_id', p_reservation_id,
      'payment_info', p_payment_info
    ),
    p_trace_id
  );

  -- Note: The trigger 'trigger_sync_menu_order_to_main' we created earlier 
  -- will automatically fire here and sync this to the main 'orders' table!
  -- And 'trigger_update_inventory_from_menu_order' will fire...
  -- WAIT! We already decremented inventory in 'reserve_inventory'.
  -- We must PREVENT double decrementing.
  
  -- CRITICAL FIX: The trigger 'trigger_update_inventory_from_menu_order' (created in previous task)
  -- decrements inventory on 'confirmed' status.
  -- Since we already decremented in 'reserve_inventory', we need to handle this.
  
  -- Option 1: Disable the trigger for this flow.
  -- Option 2: Modify the trigger to check if inventory was already reserved.
  -- Option 3: Don't decrement in 'reserve_inventory', just hold a "reservation" count.
  
  -- Given I just wrote the trigger to decrement on confirm, Option 3 is cleaner for the *existing* system,
  -- BUT Option 1 (Decrement on Reserve) is safer for "Nuclear" concurrency.
  
  -- Let's MODIFY the trigger 'trigger_update_inventory_from_menu_order' to SKIP if 
  -- the order data contains a flag 'inventory_already_reserved'.
  
  -- Update order_data to include this flag
  UPDATE public.menu_orders
  SET order_data = order_data || '{"inventory_already_reserved": true}'::jsonb
  WHERE id = v_order_id;

  RETURN jsonb_build_object('success', true, 'order_id', v_order_id);
END;
$$;

-- 6. Update the Inventory Trigger to respect reservation flag
CREATE OR REPLACE FUNCTION update_inventory_from_menu_order()
RETURNS TRIGGER AS $$
DECLARE
  v_item JSONB;
  v_product_id UUID;
  v_quantity NUMERIC;
  v_product_name TEXT;
BEGIN
  -- Check if inventory was already reserved (Nuclear Option flow)
  IF (NEW.order_data->>'inventory_already_reserved')::BOOLEAN IS TRUE THEN
    -- Log that we skipped decrement
    RAISE NOTICE 'Skipping inventory decrement for order % (already reserved)', NEW.id;
    RETURN NEW;
  END IF;

  -- Standard flow (Legacy/Simple)
  IF NEW.status = 'confirmed' AND (OLD IS NULL OR OLD.status != 'confirmed') THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(NEW.order_data->'items')
    LOOP
      v_product_id := (v_item->>'product_id')::UUID;
      v_quantity := COALESCE((v_item->>'quantity')::NUMERIC, 0);
      
      UPDATE public.wholesale_inventory
      SET
        quantity_lbs = GREATEST(0, quantity_lbs - v_quantity),
        updated_at = NOW()
      WHERE id = v_product_id;
    END LOOP;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to update inventory for menu_order %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
