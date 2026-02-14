-- Drop and recreate confirm_menu_order to match edge function expectations
DROP FUNCTION IF EXISTS public.confirm_menu_order(UUID, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC);

CREATE OR REPLACE FUNCTION public.confirm_menu_order(
  p_reservation_id UUID,
  p_order_data JSONB,
  p_payment_info JSONB,
  p_trace_id TEXT DEFAULT NULL
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
  v_menu_id UUID;
  v_total NUMERIC;
BEGIN
  -- Extract data from order_data
  v_menu_id := (p_order_data->>'menu_id')::UUID;
  v_total := COALESCE((p_order_data->>'total_amount')::NUMERIC, 0);

  -- Get tenant_id from menu
  SELECT tenant_id INTO v_tenant_id
  FROM public.disposable_menus
  WHERE id = v_menu_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Menu not found: %', v_menu_id;
  END IF;

  -- Generate order number
  v_order_number := 'MO-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));

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
    v_menu_id,
    v_tenant_id,
    v_order_number,
    jsonb_build_object(
      'items', p_order_data->'order_items',
      'contact', jsonb_build_object(
        'phone', p_order_data->>'contact_phone',
        'email', p_order_data->>'contact_email',
        'name', p_order_data->>'customer_name'
      ),
      'payment', p_payment_info,
      'reservation_id', p_reservation_id,
      'trace_id', p_trace_id
    ),
    'confirmed',
    p_order_data->>'payment_method',
    CASE WHEN (p_payment_info->>'success')::BOOLEAN THEN 'paid' ELSE 'unpaid' END,
    v_total,
    p_order_data->>'contact_phone',
    p_order_data->>'contact_email',
    p_order_data->>'customer_name',
    p_order_data->>'customer_notes',
    p_order_data->>'delivery_address',
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

-- Also update cancel_reservation to use correct parameter names (p_reservation_id, p_reason)
DROP FUNCTION IF EXISTS public.cancel_reservation(UUID, JSONB, TEXT);

CREATE OR REPLACE FUNCTION public.cancel_reservation(
  p_reservation_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Log the cancellation (in production we'd have a reservations table)
  -- For now this is a placeholder since we don't persist reservations
  
  RETURN jsonb_build_object(
    'success', true,
    'reservation_id', p_reservation_id,
    'reason', p_reason
  );
END;
$$;