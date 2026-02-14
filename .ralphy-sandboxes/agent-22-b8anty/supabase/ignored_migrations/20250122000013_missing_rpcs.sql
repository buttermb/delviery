-- Missing RPC Functions (Error #49-51)

-- 1. reserve_inventory
CREATE OR REPLACE FUNCTION public.reserve_inventory(
    p_menu_id UUID,
    p_items JSONB,
    p_trace_id TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_reservation_id UUID;
    v_item JSONB;
    v_product_id UUID;
    v_quantity NUMERIC;
    v_available NUMERIC;
BEGIN
    -- Create reservation record
    INSERT INTO public.inventory_reservations (
        menu_id,
        items,
        status,
        expires_at,
        trace_id
    ) VALUES (
        p_menu_id,
        p_items,
        'pending',
        NOW() + INTERVAL '15 minutes',
        p_trace_id
    ) RETURNING id INTO v_reservation_id;

    -- Check availability (Pessimistic check, actual decrement happens on confirm or via trigger if designed that way)
    -- Ideally we should lock rows here if we want strict reservation
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_quantity := COALESCE((v_item->>'quantity')::NUMERIC, 0);

        SELECT available_quantity INTO v_available
        FROM public.products
        WHERE id = v_product_id
        FOR UPDATE; -- Lock the row

        IF v_available < v_quantity THEN
            RAISE EXCEPTION 'Insufficient inventory for product %', v_product_id;
        END IF;
    END LOOP;

    RETURN v_reservation_id;
END;
$$;

-- 2. cancel_reservation
CREATE OR REPLACE FUNCTION public.cancel_reservation(
    p_reservation_id UUID,
    p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    UPDATE public.inventory_reservations
    SET status = 'cancelled',
        cancellation_reason = p_reason,
        updated_at = NOW()
    WHERE id = p_reservation_id;
END;
$$;

-- 3. confirm_menu_order
CREATE OR REPLACE FUNCTION public.confirm_menu_order(
    p_reservation_id UUID,
    p_order_data JSONB,
    p_payment_info JSONB,
    p_trace_id TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_order_id UUID;
    v_reservation RECORD;
BEGIN
    -- Get reservation
    SELECT * INTO v_reservation
    FROM public.inventory_reservations
    WHERE id = p_reservation_id AND status = 'pending';

    IF v_reservation IS NULL THEN
        RAISE EXCEPTION 'Invalid or expired reservation';
    END IF;

    -- Create Menu Order
    INSERT INTO public.menu_orders (
        menu_id,
        status,
        total_amount,
        order_data,
        payment_method,
        delivery_address,
        customer_notes,
        contact_phone,
        contact_email
    ) VALUES (
        v_reservation.menu_id,
        'pending',
        (p_order_data->>'total_amount')::NUMERIC,
        p_order_data || jsonb_build_object('inventory_already_reserved', true), -- Flag to skip double decrement if trigger handles it
        p_payment_info->>'method',
        p_order_data->>'delivery_address',
        p_order_data->>'notes',
        p_order_data->>'phone',
        p_order_data->>'email'
    ) RETURNING id INTO v_order_id;

    -- Update Reservation
    UPDATE public.inventory_reservations
    SET status = 'confirmed',
        order_id = v_order_id,
        updated_at = NOW()
    WHERE id = p_reservation_id;

    RETURN v_order_id;
END;
$$;
