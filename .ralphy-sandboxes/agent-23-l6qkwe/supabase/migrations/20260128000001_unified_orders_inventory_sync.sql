-- ============================================================================
-- UNIFIED ORDERS INVENTORY SYNC
-- Connects orders to inventory so order creation/confirmation triggers
-- stock decrement, and cancellation triggers stock restoration.
-- ============================================================================

-- Function to decrement inventory when unified orders are confirmed
CREATE OR REPLACE FUNCTION public.sync_unified_order_inventory()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
  v_product_name TEXT;
  v_items_processed INTEGER := 0;
BEGIN
  -- CASE 1: Order created with status = 'confirmed' (direct confirmation)
  IF TG_OP = 'INSERT' AND NEW.status = 'confirmed' THEN
    -- Decrement inventory for all order items
    FOR v_item IN
      SELECT
        uoi.product_id,
        uoi.inventory_id,
        uoi.quantity,
        uoi.product_name,
        uoi.quantity_unit
      FROM unified_order_items uoi
      WHERE uoi.order_id = NEW.id
        AND (uoi.product_id IS NOT NULL OR uoi.inventory_id IS NOT NULL)
    LOOP
      -- Decrement from products table if product_id is set
      IF v_item.product_id IS NOT NULL THEN
        UPDATE products
        SET
          stock_quantity = GREATEST(0, COALESCE(stock_quantity, 0) - v_item.quantity),
          available_quantity = GREATEST(0, COALESCE(available_quantity, 0) - v_item.quantity),
          updated_at = NOW()
        WHERE id = v_item.product_id
        RETURNING name INTO v_product_name;

        v_items_processed := v_items_processed + 1;
      END IF;

      -- Also decrement from wholesale_inventory if inventory_id is set
      IF v_item.inventory_id IS NOT NULL THEN
        UPDATE wholesale_inventory
        SET
          quantity_lbs = GREATEST(0, COALESCE(quantity_lbs, 0) -
            CASE WHEN v_item.quantity_unit IN ('lb', 'lbs') THEN v_item.quantity ELSE 0 END),
          quantity_units = GREATEST(0, COALESCE(quantity_units, 0) -
            CASE WHEN v_item.quantity_unit NOT IN ('lb', 'lbs') THEN v_item.quantity::INTEGER ELSE 0 END),
          updated_at = NOW()
        WHERE id = v_item.inventory_id;

        v_items_processed := v_items_processed + 1;
      END IF;
    END LOOP;

    -- Log the inventory sync action
    IF v_items_processed > 0 THEN
      INSERT INTO activity_logs (
        user_id,
        tenant_id,
        action,
        resource,
        resource_id,
        metadata,
        created_at
      )
      SELECT
        NULL, -- System action
        NEW.tenant_id,
        'unified_order_confirmed_inventory_deducted',
        'unified_order',
        NEW.id,
        jsonb_build_object(
          'order_number', NEW.order_number,
          'order_type', NEW.order_type,
          'status', NEW.status,
          'items_processed', v_items_processed,
          'trigger_event', 'INSERT'
        ),
        NOW()
      WHERE EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'activity_logs'
      );
    END IF;

    RETURN NEW;
  END IF;

  -- CASE 2: Order status changed to 'confirmed'
  IF TG_OP = 'UPDATE' AND NEW.status = 'confirmed' AND OLD.status != 'confirmed' THEN
    -- Decrement inventory for all order items
    FOR v_item IN
      SELECT
        uoi.product_id,
        uoi.inventory_id,
        uoi.quantity,
        uoi.product_name,
        uoi.quantity_unit
      FROM unified_order_items uoi
      WHERE uoi.order_id = NEW.id
        AND (uoi.product_id IS NOT NULL OR uoi.inventory_id IS NOT NULL)
    LOOP
      -- Decrement from products table if product_id is set
      IF v_item.product_id IS NOT NULL THEN
        UPDATE products
        SET
          stock_quantity = GREATEST(0, COALESCE(stock_quantity, 0) - v_item.quantity),
          available_quantity = GREATEST(0, COALESCE(available_quantity, 0) - v_item.quantity),
          updated_at = NOW()
        WHERE id = v_item.product_id
        RETURNING name INTO v_product_name;

        v_items_processed := v_items_processed + 1;
      END IF;

      -- Also decrement from wholesale_inventory if inventory_id is set
      IF v_item.inventory_id IS NOT NULL THEN
        UPDATE wholesale_inventory
        SET
          quantity_lbs = GREATEST(0, COALESCE(quantity_lbs, 0) -
            CASE WHEN v_item.quantity_unit IN ('lb', 'lbs') THEN v_item.quantity ELSE 0 END),
          quantity_units = GREATEST(0, COALESCE(quantity_units, 0) -
            CASE WHEN v_item.quantity_unit NOT IN ('lb', 'lbs') THEN v_item.quantity::INTEGER ELSE 0 END),
          updated_at = NOW()
        WHERE id = v_item.inventory_id;

        v_items_processed := v_items_processed + 1;
      END IF;
    END LOOP;

    -- Log the inventory sync action
    IF v_items_processed > 0 THEN
      INSERT INTO activity_logs (
        user_id,
        tenant_id,
        action,
        resource,
        resource_id,
        metadata,
        created_at
      )
      SELECT
        NULL, -- System action
        NEW.tenant_id,
        'unified_order_confirmed_inventory_deducted',
        'unified_order',
        NEW.id,
        jsonb_build_object(
          'order_number', NEW.order_number,
          'order_type', NEW.order_type,
          'previous_status', OLD.status,
          'new_status', NEW.status,
          'items_processed', v_items_processed,
          'trigger_event', 'UPDATE'
        ),
        NOW()
      WHERE EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'activity_logs'
      );
    END IF;

    RETURN NEW;
  END IF;

  -- CASE 3: Order cancelled - restore inventory
  IF TG_OP = 'UPDATE' AND NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    -- Only restore if the order was previously confirmed
    IF OLD.status IN ('confirmed', 'processing', 'in_transit') THEN
      FOR v_item IN
        SELECT
          uoi.product_id,
          uoi.inventory_id,
          uoi.quantity,
          uoi.product_name,
          uoi.quantity_unit
        FROM unified_order_items uoi
        WHERE uoi.order_id = NEW.id
          AND (uoi.product_id IS NOT NULL OR uoi.inventory_id IS NOT NULL)
      LOOP
        -- Restore to products table if product_id is set
        IF v_item.product_id IS NOT NULL THEN
          UPDATE products
          SET
            stock_quantity = COALESCE(stock_quantity, 0) + v_item.quantity,
            available_quantity = COALESCE(available_quantity, 0) + v_item.quantity,
            updated_at = NOW()
          WHERE id = v_item.product_id
          RETURNING name INTO v_product_name;

          v_items_processed := v_items_processed + 1;
        END IF;

        -- Restore to wholesale_inventory if inventory_id is set
        IF v_item.inventory_id IS NOT NULL THEN
          UPDATE wholesale_inventory
          SET
            quantity_lbs = COALESCE(quantity_lbs, 0) +
              CASE WHEN v_item.quantity_unit IN ('lb', 'lbs') THEN v_item.quantity ELSE 0 END,
            quantity_units = COALESCE(quantity_units, 0) +
              CASE WHEN v_item.quantity_unit NOT IN ('lb', 'lbs') THEN v_item.quantity::INTEGER ELSE 0 END,
            updated_at = NOW()
          WHERE id = v_item.inventory_id;

          v_items_processed := v_items_processed + 1;
        END IF;
      END LOOP;

      -- Log the inventory restoration
      IF v_items_processed > 0 THEN
        INSERT INTO activity_logs (
          user_id,
          tenant_id,
          action,
          resource,
          resource_id,
          metadata,
          created_at
        )
        SELECT
          NULL, -- System action
          NEW.tenant_id,
          'unified_order_cancelled_inventory_restored',
          'unified_order',
          NEW.id,
          jsonb_build_object(
            'order_number', NEW.order_number,
            'order_type', NEW.order_type,
            'previous_status', OLD.status,
            'new_status', NEW.status,
            'cancellation_reason', NEW.cancellation_reason,
            'items_restored', v_items_processed
          ),
          NOW()
        WHERE EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'activity_logs'
        );
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_sync_unified_order_inventory ON public.unified_orders;

-- Create trigger on unified_orders for INSERT
CREATE TRIGGER trigger_sync_unified_order_inventory_insert
  AFTER INSERT ON public.unified_orders
  FOR EACH ROW
  WHEN (NEW.status = 'confirmed')
  EXECUTE FUNCTION public.sync_unified_order_inventory();

-- Create trigger on unified_orders for UPDATE (status changes)
CREATE TRIGGER trigger_sync_unified_order_inventory_update
  AFTER UPDATE OF status ON public.unified_orders
  FOR EACH ROW
  WHEN (
    (NEW.status = 'confirmed' AND OLD.status != 'confirmed')
    OR (NEW.status = 'cancelled' AND OLD.status != 'cancelled')
  )
  EXECUTE FUNCTION public.sync_unified_order_inventory();

-- Add comments for documentation
COMMENT ON FUNCTION public.sync_unified_order_inventory IS
  'Synchronizes inventory levels when unified orders are confirmed or cancelled. Decrements stock on confirmation, restores on cancellation.';

-- ============================================================================
-- UPDATE create_unified_order RPC to optionally auto-confirm and sync inventory
-- ============================================================================

-- Drop and recreate the function with inventory sync support
CREATE OR REPLACE FUNCTION create_unified_order(
  p_tenant_id uuid,
  p_order_type text,
  p_source text,
  p_items jsonb,
  p_customer_id uuid DEFAULT NULL,
  p_wholesale_client_id uuid DEFAULT NULL,
  p_menu_id uuid DEFAULT NULL,
  p_shift_id uuid DEFAULT NULL,
  p_delivery_address text DEFAULT NULL,
  p_delivery_notes text DEFAULT NULL,
  p_payment_method text DEFAULT NULL,
  p_courier_id uuid DEFAULT NULL,
  p_contact_name text DEFAULT NULL,
  p_contact_phone text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}',
  p_auto_confirm boolean DEFAULT FALSE
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_subtotal numeric := 0;
  v_item jsonb;
  v_initial_status text;
BEGIN
  -- Determine initial status
  v_initial_status := CASE WHEN p_auto_confirm THEN 'confirmed' ELSE 'pending' END;

  -- Calculate subtotal from items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_subtotal := v_subtotal + (
      (v_item->>'quantity')::numeric * (v_item->>'unit_price')::numeric
    );
  END LOOP;

  -- Insert order (trigger will handle inventory sync if auto_confirm = true)
  INSERT INTO unified_orders (
    tenant_id, order_type, source, status,
    customer_id, wholesale_client_id, menu_id, shift_id,
    subtotal, total_amount,
    delivery_address, delivery_notes,
    payment_method, courier_id,
    contact_name, contact_phone,
    metadata
  ) VALUES (
    p_tenant_id, p_order_type, p_source, v_initial_status,
    p_customer_id, p_wholesale_client_id, p_menu_id, p_shift_id,
    v_subtotal, v_subtotal, -- tax calculated separately if needed
    p_delivery_address, p_delivery_notes,
    p_payment_method, p_courier_id,
    p_contact_name, p_contact_phone,
    p_metadata
  )
  RETURNING id INTO v_order_id;

  -- Insert order items
  INSERT INTO unified_order_items (
    order_id, product_id, inventory_id,
    product_name, sku, quantity, quantity_unit, unit_price,
    metadata
  )
  SELECT
    v_order_id,
    (item->>'product_id')::uuid,
    (item->>'inventory_id')::uuid,
    item->>'product_name',
    item->>'sku',
    (item->>'quantity')::numeric,
    COALESCE(item->>'quantity_unit', 'each'),
    (item->>'unit_price')::numeric,
    COALESCE(item->'metadata', '{}')
  FROM jsonb_array_elements(p_items) item;

  RETURN v_order_id;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION create_unified_order(uuid, text, text, jsonb, uuid, uuid, uuid, uuid, text, text, text, uuid, text, text, jsonb, boolean) TO authenticated;

-- ============================================================================
-- HELPER FUNCTION: Manual inventory sync for existing orders
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_order_inventory_manual(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_item RECORD;
  v_items_processed INTEGER := 0;
  v_result jsonb := '{"success": false}'::jsonb;
BEGIN
  -- Get order details
  SELECT * INTO v_order FROM unified_orders WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  IF v_order.status != 'confirmed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order must be confirmed to sync inventory');
  END IF;

  -- Process each item
  FOR v_item IN
    SELECT
      uoi.product_id,
      uoi.inventory_id,
      uoi.quantity,
      uoi.product_name,
      uoi.quantity_unit
    FROM unified_order_items uoi
    WHERE uoi.order_id = p_order_id
      AND (uoi.product_id IS NOT NULL OR uoi.inventory_id IS NOT NULL)
  LOOP
    IF v_item.product_id IS NOT NULL THEN
      UPDATE products
      SET
        stock_quantity = GREATEST(0, COALESCE(stock_quantity, 0) - v_item.quantity),
        available_quantity = GREATEST(0, COALESCE(available_quantity, 0) - v_item.quantity),
        updated_at = NOW()
      WHERE id = v_item.product_id;

      v_items_processed := v_items_processed + 1;
    END IF;

    IF v_item.inventory_id IS NOT NULL THEN
      UPDATE wholesale_inventory
      SET
        quantity_lbs = GREATEST(0, COALESCE(quantity_lbs, 0) -
          CASE WHEN v_item.quantity_unit IN ('lb', 'lbs') THEN v_item.quantity ELSE 0 END),
        quantity_units = GREATEST(0, COALESCE(quantity_units, 0) -
          CASE WHEN v_item.quantity_unit NOT IN ('lb', 'lbs') THEN v_item.quantity::INTEGER ELSE 0 END),
        updated_at = NOW()
      WHERE id = v_item.inventory_id;

      v_items_processed := v_items_processed + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'items_processed', v_items_processed
  );
END;
$$;

GRANT EXECUTE ON FUNCTION sync_order_inventory_manual(uuid) TO authenticated;

COMMENT ON FUNCTION sync_order_inventory_manual IS
  'Manually triggers inventory decrement for a confirmed order. Use for orders that may have missed automatic sync.';
