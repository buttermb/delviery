-- ============================================================================
-- TRIGGER CONSOLIDATION
-- Disables conflicting inventory/order triggers and creates unified handlers
-- ============================================================================

-- 1. DOCUMENT & DISABLE CONFLICTING MENU ORDER TRIGGERS
-- These triggers were causing duplicate inventory decrements and sync issues

-- Menu order triggers to disable (they conflict with each other):
DROP TRIGGER IF EXISTS trigger_update_inventory_from_menu_order ON public.menu_orders;
DROP TRIGGER IF EXISTS trigger_sync_menu_order_to_main ON public.menu_orders;
DROP TRIGGER IF EXISTS trigger_sync_menu_order_status ON public.menu_orders;
DROP TRIGGER IF EXISTS trigger_sync_menu_order_to_systems ON public.menu_orders;
DROP TRIGGER IF EXISTS on_menu_order_created ON public.menu_orders;
DROP TRIGGER IF EXISTS menu_order_sync_trigger ON public.menu_orders;

-- 2. DISABLE CONFLICTING WHOLESALE ORDER TRIGGERS
DROP TRIGGER IF EXISTS wholesale_order_sync_trigger ON public.wholesale_orders;
DROP TRIGGER IF EXISTS trigger_restore_wholesale_inventory_on_cancel ON public.wholesale_orders;

-- Note: We keep these useful triggers:
-- - trigger_audit_wholesale_orders (audit logging)
-- - set_wholesale_order_number_trigger (number generation)
-- - check_subscription_before_wholesale_order (subscription check)
-- - workflow_trigger_wholesale_orders_* (workflow automation)

-- 3. CREATE UNIFIED MENU ORDER HANDLER
-- Single trigger that handles all menu order operations properly
CREATE OR REPLACE FUNCTION public.handle_menu_order_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item JSONB;
  v_product_id UUID;
  v_quantity NUMERIC;
  v_tenant_id UUID;
  v_order_id UUID;
BEGIN
  -- Get tenant_id
  v_tenant_id := COALESCE(NEW.tenant_id, (
    SELECT tenant_id FROM disposable_menus WHERE id = NEW.menu_id
  ));

  -- CASE 1: New order being created
  IF TG_OP = 'INSERT' THEN
    -- Sync to unified_orders if table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'unified_orders') THEN
      INSERT INTO unified_orders (
        tenant_id, order_number, order_type, source, status,
        total_amount, payment_status, menu_id, whitelist_id,
        contact_phone, contact_name, delivery_address,
        metadata, created_at
      ) VALUES (
        v_tenant_id,
        COALESCE(NEW.order_number, 'MO-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || 
          UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6))),
        'menu',
        'menu_link',
        NEW.status,
        COALESCE(NEW.total_amount, 0),
        COALESCE(NEW.payment_status, 'unpaid'),
        NEW.menu_id,
        NEW.access_whitelist_id,
        NEW.contact_phone,
        COALESCE((NEW.order_data->>'customer_name')::TEXT, 'Menu Customer'),
        NEW.delivery_address,
        jsonb_build_object('source_menu_order_id', NEW.id, 'items', NEW.order_data->'items'),
        NEW.created_at
      )
      ON CONFLICT DO NOTHING;
    END IF;

    -- Only decrement inventory if status is confirmed/processing and not already reserved
    IF NEW.status IN ('confirmed', 'preparing', 'processing') 
       AND (NEW.order_data->>'inventory_already_reserved')::BOOLEAN IS NOT TRUE THEN
      IF NEW.order_data ? 'items' AND jsonb_typeof(NEW.order_data->'items') = 'array' THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(NEW.order_data->'items')
        LOOP
          v_product_id := (v_item->>'product_id')::UUID;
          v_quantity := COALESCE((v_item->>'quantity')::NUMERIC, 0);

          IF v_product_id IS NOT NULL AND v_quantity > 0 THEN
            -- Decrement products table
            UPDATE products
            SET 
              available_quantity = GREATEST(0, COALESCE(available_quantity, 0) - v_quantity),
              updated_at = NOW()
            WHERE id = v_product_id;

            -- Also decrement wholesale_inventory if applicable
            UPDATE wholesale_inventory
            SET 
              quantity_lbs = GREATEST(0, COALESCE(quantity_lbs, 0) - v_quantity),
              updated_at = NOW()
            WHERE id = v_product_id OR product_id = v_product_id;

            -- Log movement
            INSERT INTO wholesale_inventory_movements (
              tenant_id, inventory_id, movement_type, quantity_change, notes, created_at
            ) VALUES (
              v_tenant_id, v_product_id, 'menu_sale', -v_quantity,
              format('Menu order %s: %s units', NEW.id, v_quantity), NOW()
            );
          END IF;
        END LOOP;

        -- Mark inventory as processed
        NEW.order_data := NEW.order_data || jsonb_build_object('inventory_processed', true);
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  -- CASE 2: Order status updated
  IF TG_OP = 'UPDATE' THEN
    -- Handle confirmation (decrement inventory if not already done)
    IF NEW.status IN ('confirmed', 'preparing', 'processing') 
       AND OLD.status NOT IN ('confirmed', 'preparing', 'processing')
       AND (NEW.order_data->>'inventory_processed')::BOOLEAN IS NOT TRUE 
       AND (NEW.order_data->>'inventory_already_reserved')::BOOLEAN IS NOT TRUE THEN
      
      IF NEW.order_data ? 'items' AND jsonb_typeof(NEW.order_data->'items') = 'array' THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(NEW.order_data->'items')
        LOOP
          v_product_id := (v_item->>'product_id')::UUID;
          v_quantity := COALESCE((v_item->>'quantity')::NUMERIC, 0);

          IF v_product_id IS NOT NULL AND v_quantity > 0 THEN
            UPDATE products
            SET available_quantity = GREATEST(0, COALESCE(available_quantity, 0) - v_quantity)
            WHERE id = v_product_id;

            UPDATE wholesale_inventory
            SET quantity_lbs = GREATEST(0, COALESCE(quantity_lbs, 0) - v_quantity)
            WHERE id = v_product_id OR product_id = v_product_id;

            INSERT INTO wholesale_inventory_movements (
              tenant_id, inventory_id, movement_type, quantity_change, notes, created_at
            ) VALUES (
              v_tenant_id, v_product_id, 'menu_sale', -v_quantity,
              format('Menu order %s confirmed: %s units', NEW.id, v_quantity), NOW()
            );
          END IF;
        END LOOP;
        
        NEW.order_data := NEW.order_data || jsonb_build_object('inventory_processed', true);
      END IF;
    END IF;

    -- Handle cancellation (restore inventory)
    IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' 
       AND (OLD.order_data->>'inventory_processed')::BOOLEAN IS TRUE THEN
      
      IF OLD.order_data ? 'items' AND jsonb_typeof(OLD.order_data->'items') = 'array' THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(OLD.order_data->'items')
        LOOP
          v_product_id := (v_item->>'product_id')::UUID;
          v_quantity := COALESCE((v_item->>'quantity')::NUMERIC, 0);

          IF v_product_id IS NOT NULL AND v_quantity > 0 THEN
            UPDATE products
            SET available_quantity = COALESCE(available_quantity, 0) + v_quantity
            WHERE id = v_product_id;

            UPDATE wholesale_inventory
            SET quantity_lbs = COALESCE(quantity_lbs, 0) + v_quantity
            WHERE id = v_product_id OR product_id = v_product_id;

            INSERT INTO wholesale_inventory_movements (
              tenant_id, inventory_id, movement_type, quantity_change, notes, created_at
            ) VALUES (
              v_tenant_id, v_product_id, 'menu_cancel_restore', v_quantity,
              format('Menu order %s cancelled: %s units restored', NEW.id, v_quantity), NOW()
            );
          END IF;
        END LOOP;
        
        NEW.order_data := NEW.order_data || jsonb_build_object('inventory_restored', true);
      END IF;
    END IF;

    -- Sync status to unified_orders
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'unified_orders') THEN
      UPDATE unified_orders
      SET 
        status = NEW.status,
        payment_status = NEW.payment_status,
        updated_at = NOW()
      WHERE (metadata->>'source_menu_order_id')::UUID = NEW.id;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

-- Create the unified menu order trigger
CREATE TRIGGER unified_menu_order_handler
  BEFORE INSERT OR UPDATE ON public.menu_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_menu_order_changes();


-- 4. CREATE UNIFIED WHOLESALE ORDER HANDLER (for inventory restoration on cancel)
CREATE OR REPLACE FUNCTION public.handle_wholesale_order_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
BEGIN
  -- Only handle cancellation for inventory restoration
  -- Order creation uses create_wholesale_order_atomic RPC
  IF TG_OP = 'UPDATE' AND NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    -- Restore inventory for each order item
    FOR v_item IN
      SELECT inventory_id, quantity_lbs, quantity_units
      FROM wholesale_order_items
      WHERE order_id = NEW.id
    LOOP
      UPDATE wholesale_inventory
      SET 
        quantity_lbs = COALESCE(quantity_lbs, 0) + COALESCE(v_item.quantity_lbs, 0),
        quantity_units = COALESCE(quantity_units, 0) + COALESCE(v_item.quantity_units, 0),
        updated_at = NOW()
      WHERE id = v_item.inventory_id;

      -- Log the restoration
      INSERT INTO wholesale_inventory_movements (
        tenant_id, inventory_id, order_id, movement_type, quantity_change, notes, created_at
      ) VALUES (
        NEW.tenant_id, v_item.inventory_id, NEW.id, 'cancel_restore', v_item.quantity_lbs,
        format('Wholesale order %s cancelled: %s lbs restored', NEW.order_number, v_item.quantity_lbs),
        NOW()
      );
    END LOOP;

    -- Sync to unified_orders
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'unified_orders') THEN
      UPDATE unified_orders
      SET 
        status = 'cancelled',
        cancelled_at = NOW(),
        cancellation_reason = NEW.delivery_notes,
        updated_at = NOW()
      WHERE (metadata->>'source_order_id')::UUID = NEW.id
         OR (order_type = 'wholesale' AND wholesale_client_id = NEW.client_id AND order_number = NEW.order_number);
    END IF;
  END IF;

  -- Sync status changes to unified_orders
  IF TG_OP = 'UPDATE' AND NEW.status != OLD.status AND NEW.status != 'cancelled' THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'unified_orders') THEN
      UPDATE unified_orders
      SET 
        status = NEW.status,
        payment_status = NEW.payment_status,
        updated_at = NOW()
      WHERE (metadata->>'source_order_id')::UUID = NEW.id
         OR (order_type = 'wholesale' AND wholesale_client_id = NEW.client_id AND order_number = NEW.order_number);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create the unified wholesale order trigger
DROP TRIGGER IF EXISTS unified_wholesale_order_handler ON public.wholesale_orders;
CREATE TRIGGER unified_wholesale_order_handler
  AFTER UPDATE ON public.wholesale_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_wholesale_order_changes();


-- 5. LOG TRIGGER CONSOLIDATION
DO $$
BEGIN
  RAISE NOTICE '=== TRIGGER CONSOLIDATION COMPLETE ===';
  RAISE NOTICE 'Disabled triggers:';
  RAISE NOTICE '  - trigger_update_inventory_from_menu_order';
  RAISE NOTICE '  - trigger_sync_menu_order_to_main';
  RAISE NOTICE '  - trigger_sync_menu_order_status';
  RAISE NOTICE '  - trigger_sync_menu_order_to_systems';
  RAISE NOTICE '  - on_menu_order_created';
  RAISE NOTICE '  - menu_order_sync_trigger';
  RAISE NOTICE '  - wholesale_order_sync_trigger';
  RAISE NOTICE '  - trigger_restore_wholesale_inventory_on_cancel';
  RAISE NOTICE 'New unified triggers:';
  RAISE NOTICE '  - unified_menu_order_handler (handles all menu order operations)';
  RAISE NOTICE '  - unified_wholesale_order_handler (handles wholesale order operations)';
  RAISE NOTICE '========================================';
END $$;


-- 6. CREATE AUDIT VIEW for trigger status
CREATE OR REPLACE VIEW public.inventory_trigger_status AS
SELECT 
  tgname as trigger_name,
  relname as table_name,
  CASE WHEN tgenabled = 'O' THEN 'enabled' 
       WHEN tgenabled = 'D' THEN 'disabled'
       ELSE tgenabled::TEXT 
  END as status
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
WHERE relname IN ('menu_orders', 'wholesale_orders', 'products', 'wholesale_inventory', 'fronted_inventory')
  AND NOT tgisinternal
ORDER BY relname, tgname;

COMMENT ON VIEW public.inventory_trigger_status IS 
  'View to audit all triggers on inventory-related tables';




