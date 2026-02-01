-- CRITICAL FIX: Comprehensive Sync for Disposable Menu Orders
-- Implements user's requested logic with schema adaptations for Lovable Cloud

-- 1. Add tracking columns to menu_orders
ALTER TABLE public.menu_orders 
ADD COLUMN IF NOT EXISTS synced_order_id UUID REFERENCES public.orders(id),
ADD COLUMN IF NOT EXISTS synced_invoice_id UUID REFERENCES public.crm_invoices(id);

-- 2. Main Sync Trigger Function
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

  -- Get tenant_id from disposable_menus if not in NEW
  IF NEW.tenant_id IS NULL THEN
    SELECT tenant_id INTO v_tenant_id
    FROM public.disposable_menus
    WHERE id = NEW.menu_id;
  ELSE
    v_tenant_id := NEW.tenant_id;
  END IF;

  -- 1. Create record in orders table for Live Orders panel
  -- Check if already exists to be safe
  SELECT id INTO v_order_id FROM public.orders WHERE id = NEW.id;

  IF v_order_id IS NULL THEN
    INSERT INTO public.orders (
      id, -- Use same ID for traceability
      tenant_id,
      user_id, -- NULL for guest
      order_number,
      status,
      total_amount,
      delivery_address,
      payment_method,
      customer_notes,
      created_at,
      updated_at,
      metadata
    ) VALUES (
      NEW.id,
      v_tenant_id,
      NULL,
      'MENU-' || UPPER(SUBSTRING(NEW.id::text, 1, 8)),
      NEW.status,
      NEW.total_amount,
      NEW.delivery_address,
      NEW.payment_method,
      NEW.customer_notes,
      NEW.created_at,
      NOW(),
      jsonb_build_object('source', 'disposable_menu', 'menu_id', NEW.menu_id)
    )
    RETURNING id INTO v_order_id;
  END IF;

  -- Update NEW for the trigger
  NEW.synced_order_id := v_order_id;

  -- 2. Create CRM invoice if client_id exists
  IF NEW.access_whitelist_id IS NOT NULL THEN
     DECLARE 
       v_real_client_id UUID;
     BEGIN
       SELECT customer_id INTO v_real_client_id
       FROM public.menu_access_whitelist
       WHERE id = NEW.access_whitelist_id;
       
       IF v_real_client_id IS NOT NULL THEN
         -- Find account
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
              total_amount,
              status
            ) VALUES (
              v_account_id,
              v_real_client_id,
              'INV-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || UPPER(SUBSTRING(NEW.id::TEXT, 1, 6)),
              CURRENT_DATE,
              CURRENT_DATE + INTERVAL '30 days',
              NEW.order_data->'items',
              NEW.total_amount,
              NEW.total_amount,
              'sent'
            )
            RETURNING id INTO v_invoice_id;

            NEW.synced_invoice_id := v_invoice_id;
         END IF;
       END IF;
     END;
  END IF;

  -- 3. Decrement inventory
  -- Only if NOT already reserved (Nuclear Option check)
  IF (NEW.order_data->>'inventory_already_reserved')::BOOLEAN IS NOT TRUE THEN
    IF NEW.order_data ? 'items' THEN
      FOR v_item IN SELECT * FROM jsonb_array_elements(NEW.order_data->'items')
      LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_quantity := COALESCE((v_item->>'quantity')::NUMERIC, 0);

        -- Decrement products table (available_quantity)
        UPDATE public.products
        SET 
          available_quantity = GREATEST(0, available_quantity - v_quantity),
          total_quantity = GREATEST(0, total_quantity - v_quantity)
        WHERE id = v_product_id;

        -- Decrement wholesale_inventory (if exists)
        UPDATE public.wholesale_inventory
        SET quantity_lbs = GREATEST(0, quantity_lbs - v_quantity)
        WHERE id = v_product_id;
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Attach Trigger (BEFORE INSERT)
DROP TRIGGER IF EXISTS on_menu_order_created ON public.menu_orders;
CREATE TRIGGER on_menu_order_created
  BEFORE INSERT ON public.menu_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_menu_order_to_systems();

-- 4. Backfill Existing Orders
DO $$
DECLARE
  v_order RECORD;
  v_new_order_id UUID;
BEGIN
  FOR v_order IN SELECT * FROM public.menu_orders WHERE synced_order_id IS NULL
  LOOP
    -- 1. Insert into orders
    INSERT INTO public.orders (
      id, tenant_id, order_number, status, total_amount, created_at, updated_at, metadata
    ) VALUES (
      v_order.id,
      v_order.tenant_id,
      'MENU-' || UPPER(SUBSTRING(v_order.id::text, 1, 8)),
      v_order.status,
      v_order.total_amount,
      v_order.created_at,
      NOW(),
      jsonb_build_object('source', 'disposable_menu', 'menu_id', v_order.menu_id)
    )
    ON CONFLICT (id) DO NOTHING
    RETURNING id INTO v_new_order_id;

    -- 2. Update menu_order
    UPDATE public.menu_orders
    SET synced_order_id = COALESCE(v_new_order_id, v_order.id)
    WHERE id = v_order.id;
  END LOOP;
END $$;
