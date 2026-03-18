-- Fix critical order sync constraints (Error #1 & #2)
-- 1. Fix delivery_borough case sensitivity ('Manhattan' -> 'manhattan')
-- 2. Add missing required columns (subtotal, delivery_fee, contact_phone)
-- 3. Fix column mapping (customer_notes -> delivery_notes)

CREATE OR REPLACE FUNCTION public.sync_menu_order_to_systems()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_order_id UUID;
  v_invoice_id UUID;
  v_tenant_id UUID;
  v_account_id UUID;
  v_item JSONB;
  v_product_id UUID;
  v_quantity NUMERIC;
BEGIN
  -- Prevent infinite loops
  IF NEW.synced_order_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Get tenant_id
  IF NEW.tenant_id IS NULL THEN
    SELECT tenant_id INTO v_tenant_id
    FROM public.disposable_menus
    WHERE id = NEW.menu_id;
  ELSE
    v_tenant_id := NEW.tenant_id;
  END IF;

  -- 1. Create order with CORRECT schema
  SELECT id INTO v_order_id FROM public.orders WHERE id = NEW.id;

  IF v_order_id IS NULL THEN
    INSERT INTO public.orders (
      id,
      tenant_id,
      user_id,
      order_number,
      status,
      subtotal,                        -- ✅ ADDED
      total_amount,
      delivery_address,
      delivery_borough,                -- ✅ FIXED VALUE BELOW
      delivery_fee,                    -- ✅ ADDED
      payment_method,
      delivery_notes,                  -- ✅ CHANGED FROM customer_notes
      contact_phone,                   -- ✅ ADDED
      created_at,
      updated_at,
      metadata
    ) VALUES (
      NEW.id,
      v_tenant_id,
      NULL,
      'MENU-' || UPPER(SUBSTRING(NEW.id::text, 1, 8)),
      NEW.status,
      NEW.total_amount,                -- ✅ subtotal = total for menu orders
      NEW.total_amount,
      COALESCE(NEW.delivery_address, 'N/A'),
      'manhattan',                     -- ✅ FIXED: lowercase
      0,                               -- ✅ delivery_fee = 0 for menu orders
      COALESCE(NEW.payment_method, 'cash'),
      NEW.customer_notes,              -- ✅ Maps to delivery_notes
      NEW.contact_phone,               -- ✅ ADDED
      NEW.created_at,
      NOW(),
      jsonb_build_object('source', 'disposable_menu', 'menu_id', NEW.menu_id)
    )
    RETURNING id INTO v_order_id;
  END IF;

  NEW.synced_order_id := v_order_id;

  -- 2. Create CRM invoice (unchanged)
  IF NEW.access_whitelist_id IS NOT NULL THEN
     DECLARE 
       v_real_client_id UUID;
     BEGIN
       SELECT customer_id INTO v_real_client_id
       FROM public.menu_access_whitelist
       WHERE id = NEW.access_whitelist_id;

       IF v_real_client_id IS NOT NULL THEN
         SELECT id INTO v_account_id FROM public.accounts WHERE tenant_id = v_tenant_id LIMIT 1;

         IF v_account_id IS NOT NULL THEN
            INSERT INTO public.crm_invoices (
              account_id,
              client_id,
              invoice_number,
              invoice_date,
              due_date,
              line_items,
              subtotal,
              total,                     -- ✅ Use 'total' not 'total_amount'
              status
            ) VALUES (
              v_account_id,
              v_real_client_id,
              'INV-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || UPPER(SUBSTRING(NEW.id::TEXT, 1, 6)),
              CURRENT_DATE,
              CURRENT_DATE + INTERVAL '30 days',
              NEW.order_data->'items',
              NEW.total_amount,
              NEW.total_amount,          -- ✅ FIXED
              'sent'
            )
            RETURNING id INTO v_invoice_id;

            NEW.synced_invoice_id := v_invoice_id;
         END IF;
       END IF;
     END;
  END IF;

  -- 3. Decrement inventory (unchanged)
  IF (NEW.order_data->>'inventory_already_reserved')::BOOLEAN IS NOT TRUE THEN
    IF NEW.order_data ? 'items' THEN
      FOR v_item IN SELECT * FROM jsonb_array_elements(NEW.order_data->'items')
      LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_quantity := COALESCE((v_item->>'quantity')::NUMERIC, 0);

        UPDATE public.products
        SET 
          available_quantity = GREATEST(0, available_quantity - v_quantity),
          total_quantity = GREATEST(0, total_quantity - v_quantity)
        WHERE id = v_product_id;

        UPDATE public.wholesale_inventory
        SET quantity_lbs = GREATEST(0, quantity_lbs - v_quantity)
        WHERE id = v_product_id;
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
