-- ============================================
-- REGULAR ORDERS INVENTORY SYNC
-- Automatically decrement inventory when regular orders are confirmed
-- ============================================

CREATE OR REPLACE FUNCTION public.update_inventory_from_regular_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  order_item RECORD;
  v_product_name TEXT;
  v_current_stock NUMERIC;
BEGIN
  -- Only trigger when order status changes to 'confirmed'
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
    
    -- Loop through items in order_items table
    FOR order_item IN
      SELECT product_id, quantity
      FROM order_items
      WHERE order_id = NEW.id
    LOOP
      -- 1. Deduct from products.available_quantity if column exists
      IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'products' 
        AND column_name = 'available_quantity'
      ) THEN
        UPDATE products
        SET available_quantity = GREATEST(0, COALESCE(available_quantity, 0) - order_item.quantity),
            updated_at = NOW()
        WHERE id = order_item.product_id
        RETURNING name INTO v_product_name;
      END IF;
      
      -- 2. Deduct from inventory.stock if table exists (Legacy support)
      IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'inventory'
      ) THEN
        UPDATE inventory
        SET stock = GREATEST(0, COALESCE(stock, 0) - order_item.quantity),
            updated_at = NOW()
        WHERE product_id = order_item.product_id;
      END IF;
      
      -- Log the deduction
      RAISE NOTICE 'Decremented % units of product % (%) for order %',
        order_item.quantity, v_product_name, order_item.product_id, NEW.id;
        
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
        'order_confirmed_inventory_deducted',
        'order',
        NEW.id,
        jsonb_build_object(
          'order_number', NEW.order_number,
          'previous_status', OLD.status,
          'new_status', NEW.status,
          'items_processed', (
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
DROP TRIGGER IF EXISTS trigger_deduct_inventory_on_confirm ON public.orders;

CREATE TRIGGER trigger_deduct_inventory_on_confirm
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  WHEN (NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed'))
  EXECUTE FUNCTION public.update_inventory_from_regular_order();

-- Add comments
COMMENT ON FUNCTION public.update_inventory_from_regular_order IS 'Automatically deducts inventory when regular orders are confirmed';
