-- Fix reserve_inventory function to include extensions schema for gen_random_bytes
CREATE OR REPLACE FUNCTION public.reserve_inventory(p_menu_id uuid, p_items jsonb, p_trace_id text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_item JSONB;
  v_product_id UUID;
  v_quantity NUMERIC;
  v_current_stock NUMERIC;
  v_reservation_id UUID;
  v_lock_token TEXT;
BEGIN
  v_reservation_id := gen_random_uuid();
  v_lock_token := encode(gen_random_bytes(16), 'hex');

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_quantity := (v_item->>'quantity')::NUMERIC;

    SELECT quantity_lbs INTO v_current_stock
    FROM public.wholesale_inventory
    WHERE id = v_product_id
    FOR UPDATE NOWAIT;

    IF v_current_stock IS NULL OR v_current_stock < v_quantity THEN
      RAISE EXCEPTION 'Insufficient stock for product %', v_product_id;
    END IF;

    UPDATE public.wholesale_inventory
    SET quantity_lbs = quantity_lbs - v_quantity
    WHERE id = v_product_id;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'reservation_id', v_reservation_id,
    'lock_token', v_lock_token
  );
END;
$$;

-- Create confirm_menu_order function
CREATE OR REPLACE FUNCTION public.confirm_menu_order(
  p_menu_id UUID,
  p_order_items JSONB,
  p_payment_method TEXT,
  p_contact_phone TEXT,
  p_contact_email TEXT DEFAULT NULL,
  p_customer_name TEXT DEFAULT NULL,
  p_customer_notes TEXT DEFAULT NULL,
  p_delivery_address TEXT DEFAULT NULL,
  p_total_amount NUMERIC DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order_id UUID;
  v_order_number TEXT;
  v_tenant_id UUID;
  v_item JSONB;
  v_total NUMERIC := 0;
BEGIN
  -- Get tenant_id from menu
  SELECT tenant_id INTO v_tenant_id
  FROM public.disposable_menus
  WHERE id = p_menu_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Menu not found: %', p_menu_id;
  END IF;

  -- Generate order number
  v_order_number := 'MO-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));

  -- Calculate total from items if not provided
  IF p_total_amount = 0 THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_order_items)
    LOOP
      v_total := v_total + ((v_item->>'quantity')::NUMERIC * COALESCE((v_item->>'price')::NUMERIC, 0));
    END LOOP;
  ELSE
    v_total := p_total_amount;
  END IF;

  -- Insert into menu_orders
  INSERT INTO public.menu_orders (
    menu_id,
    tenant_id,
    order_number,
    order_data,
    status,
    payment_method,
    payment_status,
    total_amount,
    contact_phone,
    contact_email,
    customer_name,
    customer_notes,
    delivery_address,
    created_at
  ) VALUES (
    p_menu_id,
    v_tenant_id,
    v_order_number,
    jsonb_build_object(
      'items', p_order_items,
      'contact', jsonb_build_object(
        'phone', p_contact_phone,
        'email', p_contact_email,
        'name', p_customer_name
      )
    ),
    'pending',
    p_payment_method,
    'unpaid',
    v_total,
    p_contact_phone,
    p_contact_email,
    p_customer_name,
    p_customer_notes,
    p_delivery_address,
    NOW()
  )
  RETURNING id INTO v_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_number', v_order_number,
    'total_amount', v_total
  );
END;
$$;

-- Create cancel_reservation function (restores inventory)
CREATE OR REPLACE FUNCTION public.cancel_reservation(
  p_menu_id UUID,
  p_items JSONB,
  p_reason TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_item JSONB;
  v_product_id UUID;
  v_quantity NUMERIC;
BEGIN
  -- Restore inventory for each item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_quantity := (v_item->>'quantity')::NUMERIC;

    UPDATE public.wholesale_inventory
    SET quantity_lbs = quantity_lbs + v_quantity
    WHERE id = v_product_id;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'reason', p_reason
  );
END;
$$;