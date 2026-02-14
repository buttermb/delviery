-- Fix SECURITY DEFINER functions missing SET search_path protection
-- This prevents search_path manipulation attacks

-- 1. Fix calculate_commission function
CREATE OR REPLACE FUNCTION public.calculate_commission()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant_id UUID;
  v_total_amount NUMERIC;
BEGIN
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
    SELECT tenant_id INTO v_tenant_id FROM public.disposable_menus WHERE id = NEW.menu_id;
    v_total_amount := NEW.total_amount;
    
    IF v_tenant_id IS NOT NULL AND v_total_amount > 0 THEN
      INSERT INTO public.commission_transactions (
        tenant_id,
        order_id,
        customer_payment_amount,
        commission_rate,
        commission_amount,
        status,
        processed_at
      )
      VALUES (
        v_tenant_id,
        NEW.id,
        v_total_amount,
        2.00,
        v_total_amount * 0.02,
        'pending',
        NOW()
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Fix decrement_product_inventory function
CREATE OR REPLACE FUNCTION public.decrement_product_inventory(p_product_id UUID, p_quantity NUMERIC)
RETURNS VOID AS $$
BEGIN
  UPDATE public.wholesale_inventory 
  SET quantity_lbs = GREATEST(0, quantity_lbs - p_quantity),
      updated_at = NOW()
  WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Fix sync_menu_order_to_systems function
CREATE OR REPLACE FUNCTION public.sync_menu_order_to_systems()
RETURNS TRIGGER AS $$
DECLARE
  v_order_id UUID;
  v_invoice_id UUID;
  v_client_id UUID;
  v_account_id UUID;
  v_tenant_id UUID;
  v_item JSONB;
  v_product_id UUID;
  v_quantity NUMERIC;
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

  IF NEW.status IN ('confirmed', 'preparing') AND (NEW.order_data->'items') IS NOT NULL THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(NEW.order_data->'items')
    LOOP
      v_product_id := (v_item->>'product_id')::UUID;
      v_quantity := COALESCE((v_item->>'quantity')::NUMERIC, 0);
      
      IF v_product_id IS NOT NULL AND v_quantity > 0 THEN
        PERFORM public.decrement_product_inventory(
          v_product_id,
          COALESCE((v_item->>'quantity')::NUMERIC, 0)
        );
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Fix cleanup_expired_reservations function
CREATE OR REPLACE FUNCTION public.cleanup_expired_reservations()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reservation RECORD;
  v_item JSONB;
  v_count INTEGER := 0;
  v_product_id UUID;
  v_quantity NUMERIC;
BEGIN
  FOR v_reservation IN
    SELECT * FROM public.inventory_reservations
    WHERE status = 'pending'
      AND expires_at < NOW()
    FOR UPDATE SKIP LOCKED
  LOOP
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_reservation.items)
    LOOP
      v_product_id := (v_item->>'product_id')::UUID;
      v_quantity := (v_item->>'quantity')::NUMERIC;
      
      UPDATE public.wholesale_inventory
      SET quantity_lbs = quantity_lbs + v_quantity,
          updated_at = NOW()
      WHERE id = v_product_id;
    END LOOP;
    
    UPDATE public.inventory_reservations
    SET status = 'expired',
        updated_at = NOW()
    WHERE id = v_reservation.id;
    
    v_count := v_count + 1;
  END LOOP;
  
  RETURN jsonb_build_object(
    'cleaned', v_count,
    'timestamp', NOW()
  );
END;
$$;