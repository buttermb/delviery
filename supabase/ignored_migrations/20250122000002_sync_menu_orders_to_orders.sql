-- Sync disposable menu orders to main orders table
-- This trigger ensures menu_orders appear in Live Orders and other dashboards

CREATE OR REPLACE FUNCTION sync_menu_order_to_main_orders()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant_id UUID;
  v_client_id UUID;
  v_order_number TEXT;
  v_existing_order UUID;
BEGIN
  -- Check if order already exists in main orders table (prevent duplicates)
  SELECT id INTO v_existing_order
  FROM public.orders
  WHERE id = NEW.id;

  IF v_existing_order IS NOT NULL THEN
    -- Order already exists, skip
    RETURN NEW;
  END IF;

  -- Extract tenant_id from menu
  SELECT tenant_id INTO v_tenant_id
  FROM public.disposable_menus
  WHERE id = NEW.menu_id;

  -- Extract client_id from whitelist (if exists)
  SELECT customer_id INTO v_client_id
  FROM public.menu_access_whitelist
  WHERE id = NEW.access_whitelist_id;

  -- Generate order number with MENU prefix
  v_order_number := 'MENU-' || UPPER(SUBSTRING(NEW.id::TEXT FROM 1 FOR 8));

  -- Insert into main orders table
  INSERT INTO public.orders (
    id,
    order_number,
    tenant_id,
    user_id,
    status,
    total_amount,
    delivery_address,
    customer_notes,
    created_at,
    updated_at,
    metadata
  ) VALUES (
    NEW.id,  -- Use same UUID to link tables
    v_order_number,
    v_tenant_id,
    v_client_id,
    -- Map menu_order status to main order status
    CASE NEW.status
      WHEN 'pending' THEN 'pending'
      WHEN 'confirmed' THEN 'confirmed'
      WHEN 'rejected' THEN 'cancelled'
      ELSE 'pending'
    END,
    NEW.total_amount,
    NEW.delivery_address,
    NEW.customer_notes,
    NEW.created_at,
    NOW(),
    -- Store complete menu order context in metadata
    jsonb_build_object(
      'source', 'disposable_menu',
      'menu_id', NEW.menu_id,
      'access_whitelist_id', NEW.access_whitelist_id,
      'contact_phone', NEW.contact_phone,
      'payment_method', NEW.payment_method,
      'delivery_method', NEW.delivery_method,
      'order_data', NEW.order_data
    )
  );

  RAISE NOTICE 'Synced menu_order % to main orders table as %', NEW.id, v_order_number;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the menu_order insert
    RAISE WARNING 'Failed to sync menu_order % to main orders: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on menu_orders INSERT
DROP TRIGGER IF EXISTS trigger_sync_menu_order_to_main ON public.menu_orders;
CREATE TRIGGER trigger_sync_menu_order_to_main
  AFTER INSERT ON public.menu_orders
  FOR EACH ROW
  EXECUTE FUNCTION sync_menu_order_to_main_orders();

-- Also sync on status updates (pending → confirmed)
CREATE OR REPLACE FUNCTION sync_menu_order_status_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Update corresponding order in main orders table
  UPDATE public.orders
  SET
    status = CASE NEW.status
      WHEN 'pending' THEN 'pending'
      WHEN 'confirmed' THEN 'confirmed'
      WHEN 'rejected' THEN 'cancelled'
      ELSE status
    END,
    updated_at = NOW(),
    metadata = metadata || jsonb_build_object('menu_order_status', NEW.status)
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_sync_menu_order_status ON public.menu_orders;
CREATE TRIGGER trigger_sync_menu_order_status
  AFTER UPDATE OF status ON public.menu_orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION sync_menu_order_status_update();

RAISE NOTICE 'Created triggers to sync menu_orders to main orders table';
