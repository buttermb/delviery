-- ============================================
-- REGULAR ORDERS INVENTORY SYNC
-- Automatically decrement inventory when marketplace orders are confirmed.
-- Logs low-stock events to low_inventory_log when stock drops below threshold.
-- ============================================

CREATE OR REPLACE FUNCTION public.update_inventory_from_regular_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
  v_tenant_id uuid;
  v_product_name text;
  v_current_stock integer;
  v_threshold integer;
  v_items_processed integer := 0;
BEGIN
  -- Derive tenant_id from store
  SELECT ms.tenant_id INTO v_tenant_id
  FROM marketplace_stores ms
  WHERE ms.id = NEW.store_id;

  -- Loop through items in the JSONB array
  FOR v_item IN
    SELECT
      (elem->>'product_id')::uuid AS product_id,
      COALESCE((elem->>'quantity')::integer, 1) AS quantity
    FROM jsonb_array_elements(COALESCE(NEW.items, '[]'::jsonb)) AS elem
    WHERE elem->>'product_id' IS NOT NULL
  LOOP
    -- Deduct from products.stock_quantity (only if track_inventory is on)
    UPDATE products
    SET stock_quantity = GREATEST(0, COALESCE(stock_quantity, 0) - v_item.quantity),
        updated_at = NOW()
    WHERE id = v_item.product_id
      AND track_inventory = true
    RETURNING name, stock_quantity, low_stock_threshold
    INTO v_product_name, v_current_stock, v_threshold;

    IF FOUND THEN
      v_items_processed := v_items_processed + 1;

      -- Check if stock dropped to or below threshold → log it
      IF v_current_stock <= COALESCE(v_threshold, 10) THEN
        INSERT INTO low_inventory_log (
          tenant_id, product_id, quantity_after,
          threshold, triggered_by_order_id
        ) VALUES (
          v_tenant_id, v_item.product_id, v_current_stock,
          COALESCE(v_threshold, 10), NEW.id
        );
      END IF;
    END IF;
  END LOOP;

  -- Audit log (if we processed items)
  IF v_items_processed > 0 AND v_tenant_id IS NOT NULL THEN
    INSERT INTO activity_logs (
      user_id, tenant_id, action, resource, resource_id, metadata, created_at
    ) VALUES (
      NULL,
      v_tenant_id,
      'order_confirmed_inventory_deducted',
      'order',
      NEW.id,
      jsonb_build_object(
        'order_number', NEW.order_number,
        'previous_status', OLD.status,
        'new_status', NEW.status,
        'items_processed', v_items_processed
      ),
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger on marketplace_orders (the actual base table)
DROP TRIGGER IF EXISTS trigger_deduct_inventory_on_confirm ON public.marketplace_orders;

CREATE TRIGGER trigger_deduct_inventory_on_confirm
  AFTER UPDATE OF status ON public.marketplace_orders
  FOR EACH ROW
  WHEN (NEW.status = 'confirmed' AND OLD.status IS DISTINCT FROM 'confirmed')
  EXECUTE FUNCTION public.update_inventory_from_regular_order();

COMMENT ON FUNCTION public.update_inventory_from_regular_order IS
  'Deducts inventory on order confirm and logs low-stock events to low_inventory_log';
