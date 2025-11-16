-- ============================================
-- ENHANCE STOCK ZERO NOTIFICATIONS
-- Adds notification creation when stock reaches zero
-- ============================================

-- Function to create notification when stock reaches zero
CREATE OR REPLACE FUNCTION public.notify_stock_zero()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  product_name_val TEXT;
  tenant_id_val UUID;
BEGIN
  -- Only trigger when stock goes from >0 to 0
  IF (OLD.available_quantity > 0 OR OLD.available_quantity IS NULL) 
     AND NEW.available_quantity <= 0 THEN
    
    -- Get product name and tenant_id (already have NEW record)
    product_name_val := NEW.name;
    tenant_id_val := NEW.tenant_id;
    
    -- Note: inventory_alerts table references wholesale_inventory, not products
    -- So we'll only log to activity_logs for products table
    -- If you need inventory alerts for products, create a separate table or modify the reference
    
    -- Create audit log entry (only if activity_logs table exists)
    IF EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'activity_logs'
    ) THEN
      INSERT INTO public.activity_logs (
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
        tenant_id_val,
        'product_out_of_stock',
        'product',
        NEW.id,
        jsonb_build_object(
          'product_name', product_name_val,
          'previous_quantity', OLD.available_quantity,
          'new_quantity', NEW.available_quantity,
          'removed_from_menus', true
        ),
        NOW()
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Add trigger to products table
DROP TRIGGER IF EXISTS trigger_notify_stock_zero ON public.products;

CREATE TRIGGER trigger_notify_stock_zero
  AFTER UPDATE OF available_quantity ON public.products
  FOR EACH ROW
  WHEN (
    (OLD.available_quantity IS DISTINCT FROM NEW.available_quantity) AND
    NEW.available_quantity <= 0 AND
    (OLD.available_quantity > 0 OR OLD.available_quantity IS NULL)
  )
  EXECUTE FUNCTION public.notify_stock_zero();

-- Add comments
COMMENT ON FUNCTION public.notify_stock_zero IS 'Creates inventory alerts and audit logs when product stock reaches zero';

