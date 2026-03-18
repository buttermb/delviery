-- Re-implement inventory reservation logic with state tracking

-- 1. reserve_inventory
CREATE OR REPLACE FUNCTION public.reserve_inventory(
  p_menu_id UUID,
  p_items JSONB,
  p_trace_id TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reservation_id UUID;
  v_item JSONB;
  v_product_id UUID;
  v_quantity NUMERIC;
  v_current_stock NUMERIC;
BEGIN
  -- Generate ID
  v_reservation_id := gen_random_uuid();

  -- 1. Check and Decrement Stock (Atomic Loop)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_quantity := (v_item->>'quantity')::NUMERIC;

    -- Lock and Check
    SELECT quantity_lbs INTO v_current_stock
    FROM public.wholesale_inventory
    WHERE id = v_product_id
    FOR UPDATE;

    IF v_current_stock IS NULL OR v_current_stock < v_quantity THEN
      RAISE EXCEPTION 'Insufficient stock for product %', v_product_id;
    END IF;

    -- Decrement
    UPDATE public.wholesale_inventory
    SET quantity_lbs = quantity_lbs - v_quantity,
        updated_at = NOW()
    WHERE id = v_product_id;
  END LOOP;

  -- 2. Create Reservation Record
  INSERT INTO public.inventory_reservations (
    id,
    menu_id,
    items,
    status,
    expires_at,
    trace_id,
    created_at
  ) VALUES (
    v_reservation_id,
    p_menu_id,
    p_items,
    'pending',
    NOW() + INTERVAL '15 minutes',
    p_trace_id,
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'reservation_id', v_reservation_id
  );
END;
$$;

-- 2. confirm_menu_order
CREATE OR REPLACE FUNCTION public.confirm_menu_order(
  p_reservation_id UUID,
  p_order_data JSONB,
  p_payment_info JSONB,
  p_trace_id TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id UUID;
  v_reservation RECORD;
BEGIN
  -- Get and Lock Reservation
  SELECT * INTO v_reservation
  FROM public.inventory_reservations
  WHERE id = p_reservation_id
  FOR UPDATE;

  IF v_reservation IS NULL THEN
    RAISE EXCEPTION 'Reservation not found';
  END IF;

  IF v_reservation.status != 'pending' THEN
    RAISE EXCEPTION 'Reservation is not pending (Status: %)', v_reservation.status;
  END IF;

  -- Create Order
  INSERT INTO public.menu_orders (
    menu_id,
    status,
    total_amount,
    order_data,
    payment_method,
    delivery_address,
    customer_notes,
    contact_phone,
    contact_email,
    created_at
  ) VALUES (
    v_reservation.menu_id,
    'confirmed', -- or 'pending' if manual approval needed, but usually confirmed after payment
    (p_order_data->>'total_amount')::NUMERIC,
    p_order_data,
    p_payment_info->>'method',
    p_order_data->>'delivery_address',
    p_order_data->>'notes',
    p_order_data->>'phone',
    p_order_data->>'email',
    NOW()
  ) RETURNING id INTO v_order_id;

  -- Update Reservation
  UPDATE public.inventory_reservations
  SET status = 'confirmed',
      order_id = v_order_id,
      updated_at = NOW()
  WHERE id = p_reservation_id;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id
  );
END;
$$;

-- 3. cancel_reservation
CREATE OR REPLACE FUNCTION public.cancel_reservation(
  p_reservation_id UUID,
  p_reason TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reservation RECORD;
  v_item JSONB;
  v_product_id UUID;
  v_quantity NUMERIC;
BEGIN
  -- Get and Lock Reservation
  SELECT * INTO v_reservation
  FROM public.inventory_reservations
  WHERE id = p_reservation_id
  FOR UPDATE;

  IF v_reservation IS NULL OR v_reservation.status != 'pending' THEN
    -- Already processed or doesn't exist, do nothing
    RETURN;
  END IF;

  -- Restore Inventory
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_reservation.items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_quantity := (v_item->>'quantity')::NUMERIC;

    UPDATE public.wholesale_inventory
    SET quantity_lbs = quantity_lbs + v_quantity,
        updated_at = NOW()
    WHERE id = v_product_id;
  END LOOP;

  -- Update Reservation Status
  UPDATE public.inventory_reservations
  SET status = 'cancelled',
      cancellation_reason = p_reason,
      updated_at = NOW()
  WHERE id = p_reservation_id;
END;
$$;
