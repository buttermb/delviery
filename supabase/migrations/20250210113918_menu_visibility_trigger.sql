-- ============================================
-- MENU VISIBILITY AUTO-UPDATE TRIGGER
-- Automatically updates menu_visibility and removes from menus when stock reaches 0
-- ============================================

-- Function to update menu visibility based on stock
CREATE OR REPLACE FUNCTION public.update_menu_visibility()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Auto-hide from menus when stock reaches 0
  IF NEW.available_quantity <= 0 OR NEW.available_quantity IS NULL THEN
    NEW.menu_visibility = false;
    
    -- Remove from all menus if hidden
    DELETE FROM public.disposable_menu_products 
    WHERE product_id = NEW.id;
    
  ELSIF NEW.available_quantity > 0 AND (OLD.available_quantity <= 0 OR OLD.available_quantity IS NULL) THEN
    -- Show in menus when stock becomes available
    NEW.menu_visibility = true;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on products table
DROP TRIGGER IF EXISTS trigger_update_menu_visibility ON public.products;

CREATE TRIGGER trigger_update_menu_visibility
  BEFORE UPDATE OF available_quantity, menu_visibility ON public.products
  FOR EACH ROW
  WHEN (
    (OLD.available_quantity IS DISTINCT FROM NEW.available_quantity) OR
    (OLD.menu_visibility IS DISTINCT FROM NEW.menu_visibility)
  )
  EXECUTE FUNCTION public.update_menu_visibility();

-- Also trigger on INSERT for new products
CREATE OR REPLACE FUNCTION public.set_menu_visibility_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Set menu_visibility based on initial stock
  IF NEW.available_quantity > 0 THEN
    NEW.menu_visibility = true;
  ELSE
    NEW.menu_visibility = false;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_menu_visibility_on_insert ON public.products;

CREATE TRIGGER trigger_set_menu_visibility_on_insert
  BEFORE INSERT ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.set_menu_visibility_on_insert();

-- Add comments
COMMENT ON FUNCTION public.update_menu_visibility IS 'Automatically updates menu_visibility and removes products from menus when stock reaches 0';
COMMENT ON FUNCTION public.set_menu_visibility_on_insert IS 'Sets initial menu_visibility for new products based on stock';

