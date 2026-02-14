-- Fix SECURITY DEFINER functions missing search_path protection
-- Security Issue: Without SET search_path, attackers can hijack function execution

-- Fix reserve_inventory function
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

-- Fix decrement_product_inventory function
CREATE OR REPLACE FUNCTION public.decrement_product_inventory(
  p_product_id UUID,
  p_quantity NUMERIC
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.wholesale_inventory 
  SET quantity_lbs = GREATEST(0, quantity_lbs - p_quantity),
      updated_at = NOW()
  WHERE id = p_product_id;
END;
$$;

-- Fix sync_menu_order_to_systems trigger function
CREATE OR REPLACE FUNCTION public.sync_menu_order_to_systems()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id UUID;
  v_invoice_id UUID;
  v_client_id UUID;
  v_account_id UUID;
  v_tenant_id UUID;
BEGIN
  IF NEW.synced_order_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_tenant_id := COALESCE(NEW.tenant_id, (SELECT tenant_id FROM public.disposable_menus WHERE id = NEW.menu_id));
  v_order_id := gen_random_uuid();
  
  INSERT INTO public.orders (
    id, tenant_id, user_id, order_number, status, subtotal, total_amount,
    delivery_address, delivery_borough, delivery_fee, payment_method,
    delivery_notes, customer_name, customer_phone, created_at
  ) VALUES (
    v_order_id, v_tenant_id, NULL,
    'MO-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6)),
    NEW.status, NEW.total_amount, NEW.total_amount,
    COALESCE(NEW.delivery_address, 'N/A'), 'Manhattan', 0,
    COALESCE(NEW.payment_method, 'cash'), NEW.customer_notes,
    COALESCE((NEW.order_data->>'customer_name')::text, 'Menu Customer'),
    NEW.contact_phone, NEW.created_at
  );

  NEW.synced_order_id := v_order_id;

  IF NEW.access_whitelist_id IS NOT NULL THEN
    SELECT customer_id INTO v_client_id FROM public.menu_access_whitelist WHERE id = NEW.access_whitelist_id;
    
    IF v_client_id IS NOT NULL THEN
      SELECT id INTO v_account_id FROM public.accounts WHERE tenant_id = v_tenant_id LIMIT 1;
      
      IF v_account_id IS NOT NULL THEN
        INSERT INTO public.crm_invoices (
          account_id, client_id, invoice_number, invoice_date, due_date,
          line_items, subtotal, total, status, created_at
        ) VALUES (
          v_account_id, v_client_id,
          'INV-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || LPAD((SELECT COUNT(*) + 1 FROM public.crm_invoices WHERE account_id = v_account_id)::TEXT, 4, '0'),
          CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days',
          NEW.order_data->'items', NEW.total_amount, NEW.total_amount, 'sent', NEW.created_at
        ) RETURNING id INTO v_invoice_id;
        
        NEW.synced_invoice_id := v_invoice_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;