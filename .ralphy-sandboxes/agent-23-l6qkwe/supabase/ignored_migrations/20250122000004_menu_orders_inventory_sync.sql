-- Automatically decrement inventory when menu orders are confirmed
-- This ensures disposable menu orders affect stock levels

CREATE OR REPLACE FUNCTION update_inventory_from_menu_order()
RETURNS TRIGGER AS $$
DECLARE
  v_item JSONB;
  v_product_id UUID;
  v_quantity NUMERIC;
  v_product_name TEXT;
BEGIN
  -- Only process when order status changes to 'confirmed'
  IF NEW.status = 'confirmed' AND (OLD IS NULL OR OLD.status != 'confirmed') THEN
    
    -- Loop through items in order_data.items array
    FOR v_item IN SELECT * FROM jsonb_array_elements(NEW.order_data->'items')
    LOOP
      -- Extract product details
      v_product_id := (v_item->>'product_id')::UUID;
      v_quantity := COALESCE((v_item->>'quantity')::NUMERIC, 0);
      
      -- Get product name for logging
      SELECT product_name INTO v_product_name
      FROM public.wholesale_inventory
      WHERE id = v_product_id;
      
      -- Decrement inventory quantity
      UPDATE public.wholesale_inventory
      SET
        quantity_lbs = GREATEST(0, quantity_lbs - v_quantity),
        updated_at = NOW()
      WHERE id = v_product_id;
      
      -- Check if update actually happened
      IF FOUND THEN
        RAISE NOTICE 'Decremented % lbs of product % (%) for menu order %',
          v_quantity, v_product_name, v_product_id, NEW.id;
      ELSE
        RAISE WARNING 'Product % not found in inventory for menu order %',
          v_product_id, NEW.id;
      END IF;
    END LOOP;
    
    -- Update menu order metadata to mark inventory processed
    UPDATE public.menu_orders
    SET order_data = order_data || jsonb_build_object('inventory_processed', true)
    WHERE id = NEW.id;
    
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the order confirmation
    RAISE WARNING 'Failed to update inventory for menu_order %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on menu_orders INSERT and UPDATE
DROP TRIGGER IF EXISTS trigger_update_inventory_from_menu_order ON public.menu_orders;
CREATE TRIGGER trigger_update_inventory_from_menu_order
  AFTER INSERT OR UPDATE OF status ON public.menu_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_from_menu_order();

RAISE NOTICE 'Created trigger to automatically decrement inventory when menu orders are confirmed';
