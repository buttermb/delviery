-- Fix SECURITY DEFINER functions missing SET search_path protection
-- This prevents search_path manipulation attacks where malicious users
-- could hijack function execution by creating tables in their own schemas

-- Fix functions from 20250122000008_critical_sync_fix.sql
CREATE OR REPLACE FUNCTION public.sync_menu_order_inventory()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Decrement inventory when menu order is placed
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.status IN ('confirmed', 'preparing') THEN
    UPDATE public.wholesale_inventory wi
    SET 
      quantity_lbs = GREATEST(0, quantity_lbs - oi.quantity_lbs),
      quantity_units = GREATEST(0, quantity_units - oi.quantity_units),
      updated_at = NOW()
    FROM (
      SELECT 
        moi.product_id,
        SUM(moi.quantity) as quantity_lbs,
        SUM(moi.quantity) as quantity_units
      FROM jsonb_to_recordset(NEW.order_data->'items') AS moi(product_id uuid, quantity numeric)
      GROUP BY moi.product_id
    ) oi
    WHERE wi.id = oi.product_id;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_inventory_on_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    UPDATE public.wholesale_inventory wi
    SET 
      quantity_lbs = quantity_lbs + oi.quantity_lbs,
      quantity_units = quantity_units + oi.quantity_units,
      updated_at = NOW()
    FROM (
      SELECT 
        moi.product_id,
        SUM(moi.quantity) as quantity_lbs,
        SUM(moi.quantity) as quantity_units
      FROM jsonb_to_recordset(OLD.order_data->'items') AS moi(product_id uuid, quantity numeric)
      GROUP BY moi.product_id
    ) oi
    WHERE wi.id = oi.product_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Fix function from 20251107000001_add_commission_tracking.sql
CREATE OR REPLACE FUNCTION public.calculate_commission_on_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_commission_rate NUMERIC;
BEGIN
  IF NEW.payment_status = 'completed' THEN
    SELECT t.id, COALESCE(t.commission_rate, 0.15) 
    INTO v_tenant_id, v_commission_rate
    FROM public.tenants t
    WHERE t.id = NEW.tenant_id;
    
    INSERT INTO public.commission_transactions (
      tenant_id,
      order_id,
      customer_payment_amount,
      commission_rate,
      commission_amount,
      status,
      processed_at
    ) VALUES (
      v_tenant_id,
      NEW.id,
      NEW.total_amount,
      v_commission_rate,
      NEW.total_amount * v_commission_rate,
      'pending',
      NOW()
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Fix function from 20250122000004_menu_orders_inventory_sync.sql
CREATE OR REPLACE FUNCTION public.sync_menu_order_to_inventory()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.status = 'confirmed' THEN
    UPDATE public.wholesale_inventory wi
    SET 
      quantity_lbs = GREATEST(0, quantity_lbs - oi.quantity),
      updated_at = NOW()
    FROM (
      SELECT 
        (item->>'product_id')::uuid as product_id,
        (item->>'quantity')::numeric as quantity
      FROM jsonb_array_elements(NEW.order_data->'items') item
    ) oi
    WHERE wi.id = oi.product_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Fix emergency wipe function
CREATE OR REPLACE FUNCTION public.emergency_wipe_all_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE NOTICE 'EMERGENCY WIPE: This function requires explicit implementation for safety';
END;
$$;

-- Fix function from 20251104030517
CREATE OR REPLACE FUNCTION public.auto_assign_order_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tenant_id IS NULL AND NEW.merchant_id IS NOT NULL THEN
    SELECT tenant_id INTO NEW.tenant_id
    FROM public.merchants
    WHERE id = NEW.merchant_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Fix functions from 20251101000000_complete_wholesale_crm.sql
CREATE OR REPLACE FUNCTION public.delete_product_image(p_product_id UUID, p_image_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.wholesale_product_images
  WHERE id = p_image_id AND product_id = p_product_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_product_with_images(p_product_id UUID)
RETURNS TABLE (
  id UUID,
  product_name TEXT,
  category TEXT,
  price_per_lb NUMERIC,
  images JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    w.id,
    w.product_name,
    w.category,
    w.price_per_lb,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', wi.id,
          'image_url', wi.image_url,
          'is_primary', wi.is_primary,
          'display_order', wi.display_order
        ) ORDER BY wi.display_order
      ) FILTER (WHERE wi.id IS NOT NULL),
      '[]'::jsonb
    ) as images
  FROM public.wholesale_inventory w
  LEFT JOIN public.wholesale_product_images wi ON w.id = wi.product_id
  WHERE w.id = p_product_id
  GROUP BY w.id;
END;
$$;

-- Fix function from 20250201000001_comprehensive_rls_policies.sql
CREATE OR REPLACE FUNCTION public.get_user_tenant_id(_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  SELECT tenant_id INTO v_tenant_id
  FROM public.tenant_users
  WHERE user_id = _user_id
  AND status = 'active'
  LIMIT 1;
  
  RETURN v_tenant_id;
END;
$$;

-- Add comments documenting the security fix
COMMENT ON FUNCTION public.sync_menu_order_inventory() IS 
  'SECURITY DEFINER function with SET search_path = public to prevent search_path manipulation attacks';
COMMENT ON FUNCTION public.restore_inventory_on_cancel() IS 
  'SECURITY DEFINER function with SET search_path = public to prevent search_path manipulation attacks';
COMMENT ON FUNCTION public.calculate_commission_on_order() IS 
  'SECURITY DEFINER function with SET search_path = public to prevent search_path manipulation attacks';
COMMENT ON FUNCTION public.sync_menu_order_to_inventory() IS 
  'SECURITY DEFINER function with SET search_path = public to prevent search_path manipulation attacks';
COMMENT ON FUNCTION public.emergency_wipe_all_data() IS 
  'SECURITY DEFINER function with SET search_path = public to prevent search_path manipulation attacks. USE WITH EXTREME CAUTION.';
COMMENT ON FUNCTION public.auto_assign_order_tenant() IS 
  'SECURITY DEFINER function with SET search_path = public to prevent search_path manipulation attacks';
COMMENT ON FUNCTION public.delete_product_image(UUID, UUID) IS 
  'SECURITY DEFINER function with SET search_path = public to prevent search_path manipulation attacks';
COMMENT ON FUNCTION public.get_product_with_images(UUID) IS 
  'SECURITY DEFINER function with SET search_path = public to prevent search_path manipulation attacks';
COMMENT ON FUNCTION public.get_user_tenant_id(UUID) IS 
  'SECURITY DEFINER function with SET search_path = public to prevent search_path manipulation attacks';