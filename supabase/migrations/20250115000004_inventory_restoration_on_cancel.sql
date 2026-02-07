-- ============================================
-- INVENTORY RESTORATION ON ORDER CANCEL
-- Automatically restores inventory when orders are cancelled
-- ============================================

-- Function to restore inventory for regular orders (products table)
CREATE OR REPLACE FUNCTION public.restore_order_inventory()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  order_item RECORD;
BEGIN
  -- Only trigger when order status changes to cancelled
  IF NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status != 'cancelled') THEN
    
    -- Restore inventory for each order item
    FOR order_item IN
      SELECT product_id, quantity
      FROM order_items
      WHERE order_id = NEW.id
    LOOP
      -- Restore to products.available_quantity if column exists
      IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'products' 
        AND column_name = 'available_quantity'
      ) THEN
        UPDATE products
        SET available_quantity = COALESCE(available_quantity, 0) + order_item.quantity,
            updated_at = NOW()
        WHERE id = order_item.product_id;
      END IF;
      
      -- Also restore to inventory.stock if table exists
      IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'inventory'
      ) THEN
        UPDATE inventory
        SET stock = COALESCE(stock, 0) + order_item.quantity,
            updated_at = NOW()
        WHERE product_id = order_item.product_id;
      END IF;
    END LOOP;
    
    -- Create audit log entry
    IF EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'activity_logs'
    ) THEN
      INSERT INTO activity_logs (
        user_id,
        tenant_id,
        action,
        resource,
        resource_id,
        metadata,
        created_at
      )
      VALUES (
        NULL, -- System action
        NEW.tenant_id,
        'order_cancelled_inventory_restored',
        'order',
        NEW.id,
        jsonb_build_object(
          'order_number', NEW.order_number,
          'previous_status', OLD.status,
          'new_status', NEW.status,
          'items_restored', (
            SELECT COUNT(*) FROM order_items WHERE order_id = NEW.id
          )
        ),
        NOW()
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on orders table
DROP TRIGGER IF EXISTS trigger_restore_inventory_on_cancel ON public.orders;

CREATE TRIGGER trigger_restore_inventory_on_cancel
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  WHEN (NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status != 'cancelled'))
  EXECUTE FUNCTION public.restore_order_inventory();

-- Function to restore wholesale inventory
CREATE OR REPLACE FUNCTION public.restore_wholesale_order_inventory()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  order_item RECORD;
BEGIN
  -- Only trigger when wholesale order status changes to cancelled
  IF NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status != 'cancelled') THEN
    
    -- Restore inventory for each wholesale order item
    FOR order_item IN
      SELECT inventory_id, quantity_lbs, quantity_units
      FROM wholesale_order_items
      WHERE order_id = NEW.id
    LOOP
      -- Restore to wholesale_inventory if table exists
      IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'wholesale_inventory'
      ) THEN
        UPDATE wholesale_inventory
        SET 
          quantity_lbs = COALESCE(quantity_lbs, 0) + COALESCE(order_item.quantity_lbs, 0),
          quantity_units = COALESCE(quantity_units, 0) + COALESCE(order_item.quantity_units, 0),
          updated_at = NOW()
        WHERE id = order_item.inventory_id;
      END IF;
    END LOOP;
    
    -- Create audit log entry
    IF EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'activity_logs'
    ) THEN
      INSERT INTO activity_logs (
        user_id,
        tenant_id,
        action,
        resource,
        resource_id,
        metadata,
        created_at
      )
      VALUES (
        NULL, -- System action
        NEW.tenant_id,
        'wholesale_order_cancelled_inventory_restored',
        'wholesale_order',
        NEW.id,
        jsonb_build_object(
          'order_number', NEW.order_number,
          'previous_status', OLD.status,
          'new_status', NEW.status,
          'items_restored', (
            SELECT COUNT(*) FROM wholesale_order_items WHERE order_id = NEW.id
          )
        ),
        NOW()
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on wholesale_orders table
DROP TRIGGER IF EXISTS trigger_restore_wholesale_inventory_on_cancel ON public.wholesale_orders;

CREATE TRIGGER trigger_restore_wholesale_inventory_on_cancel
  AFTER UPDATE OF status ON public.wholesale_orders
  FOR EACH ROW
  WHEN (NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status != 'cancelled'))
  EXECUTE FUNCTION public.restore_wholesale_order_inventory();

-- Add comments
COMMENT ON FUNCTION public.restore_order_inventory IS 'Automatically restores inventory when regular orders are cancelled';
COMMENT ON FUNCTION public.restore_wholesale_order_inventory IS 'Automatically restores inventory when wholesale orders are cancelled';

