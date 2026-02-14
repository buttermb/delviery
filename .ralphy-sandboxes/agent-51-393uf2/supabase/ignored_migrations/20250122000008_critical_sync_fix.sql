-- CRITICAL INTEGRATION FIX: Sync menu_orders to ALL systems
-- Implements the user's requested logic with safety checks for Nuclear Option

-- 1. Add synced columns to menu_orders if they don't exist
ALTER TABLE public.menu_orders 
ADD COLUMN IF NOT EXISTS synced_order_id UUID REFERENCES public.orders(id),
ADD COLUMN IF NOT EXISTS converted_to_invoice_id UUID REFERENCES public.crm_invoices(id);

-- 2. Helper Function: Decrement Inventory (Safe Version)
CREATE OR REPLACE FUNCTION public.decrement_product_inventory(
  p_product_id UUID,
  p_quantity NUMERIC
)
RETURNS VOID AS $$
BEGIN
  -- Update product stock (wholesale_inventory)
  UPDATE public.wholesale_inventory 
  SET quantity_lbs = GREATEST(0, quantity_lbs - p_quantity),
      updated_at = NOW()
  WHERE id = p_product_id;

  -- (Optional) Create alert if low stock - skipping for now to keep it simple/robust
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Main Sync Trigger Function
CREATE OR REPLACE FUNCTION public.sync_menu_order_to_systems()
RETURNS TRIGGER AS $$
DECLARE
  v_order_id UUID;
  v_invoice_id UUID;
  v_client_id UUID;
  v_account_id UUID;
  v_item JSONB;
  v_order_number TEXT;
BEGIN
  -- Prevent infinite loops or double processing
  IF NEW.synced_order_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Generate Order Number
  v_order_number := 'MENU-' || UPPER(SUBSTRING(NEW.id::TEXT FROM 1 FOR 8));

  -- 1. Create entry in main 'orders' table (if not exists)
  -- Check if order already exists (idempotency)
  SELECT id INTO v_order_id FROM public.orders WHERE id = NEW.id;
  
  IF v_order_id IS NULL THEN
    INSERT INTO public.orders (
      id, -- Use same ID
      tenant_id,
      order_number,
      status,
      total_amount,
      delivery_address,
      contact_phone,
      customer_notes,
      created_at,
      updated_at,
      metadata
    ) VALUES (
      NEW.id,
      NEW.tenant_id,
      v_order_number,
      CASE NEW.status
        WHEN 'pending' THEN 'pending'
        WHEN 'confirmed' THEN 'confirmed'
        WHEN 'rejected' THEN 'cancelled'
        ELSE 'pending'
      END,
      NEW.total_amount,
      NEW.delivery_address,
      NEW.contact_phone,
      NEW.customer_notes,
      NEW.created_at,
      NOW(),
      jsonb_build_object('source', 'disposable_menu', 'menu_id', NEW.menu_id)
    )
    RETURNING id INTO v_order_id;
  END IF;

  -- 2. Link menu_order to main order
  -- We can't update NEW in an AFTER trigger, so we run an UPDATE
  UPDATE public.menu_orders 
  SET synced_order_id = v_order_id
  WHERE id = NEW.id;

  -- 3. Create CRM invoice if client_id exists (via whitelist)
  IF NEW.access_whitelist_id IS NOT NULL THEN
    -- Get client_id from whitelist
    SELECT customer_id INTO v_client_id
    FROM public.menu_access_whitelist
    WHERE id = NEW.access_whitelist_id;

    IF v_client_id IS NOT NULL THEN
      -- Get account_id from client
      SELECT account_id INTO v_account_id
      FROM public.crm_clients
      WHERE id = v_client_id;

      IF v_account_id IS NOT NULL THEN
        INSERT INTO public.crm_invoices (
          account_id,
          client_id,
          invoice_number,
          status,
          total_amount,
          line_items,
          created_at,
          due_date
        ) VALUES (
          v_account_id,
          v_client_id,
          'INV-' || UPPER(SUBSTRING(NEW.id::TEXT FROM 1 FOR 8)),
          'draft', -- Start as draft
          NEW.total_amount,
          NEW.order_data->'items', -- Assuming items array matches
          NEW.created_at,
          NEW.created_at + INTERVAL '30 days' -- Default net 30
        )
        RETURNING id INTO v_invoice_id;

        -- Link menu_order to invoice
        UPDATE public.menu_orders 
        SET converted_to_invoice_id = v_invoice_id
        WHERE id = NEW.id;
      END IF;
    END IF;
  END IF;

  -- 4. Decrement inventory (Safety Check)
  -- Only decrement if NOT already reserved by Nuclear Option Edge Function
  IF (NEW.order_data->>'inventory_already_reserved')::BOOLEAN IS NOT TRUE THEN
    IF NEW.order_data IS NOT NULL AND jsonb_typeof(NEW.order_data->'items') = 'array' THEN
      FOR v_item IN SELECT * FROM jsonb_array_elements(NEW.order_data->'items')
      LOOP
        PERFORM public.decrement_product_inventory(
          (v_item->>'product_id')::UUID,
          COALESCE((v_item->>'quantity')::NUMERIC, 0)
        );
      END LOOP;
    END IF;
  ELSE
    RAISE NOTICE 'Skipping inventory decrement for order % (already reserved)', NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create Trigger
DROP TRIGGER IF EXISTS trigger_sync_menu_order_to_systems ON public.menu_orders;
CREATE TRIGGER trigger_sync_menu_order_to_systems
  AFTER INSERT ON public.menu_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_menu_order_to_systems();

-- 5. Backfill Existing Orders (as requested)
SELECT public.sync_menu_order_to_systems() 
FROM public.menu_orders 
WHERE synced_order_id IS NULL;
