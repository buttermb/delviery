-- Secure RPC to get platform metrics
CREATE OR REPLACE FUNCTION public.get_platform_metrics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_gmv NUMERIC;
  total_commission NUMERIC;
  active_vendors INTEGER;
  active_orders INTEGER;
BEGIN
  -- specific check
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Access Denied';
  END IF;

  SELECT COALESCE(SUM(total_amount), 0), COALESCE(SUM(platform_fee), 0)
  INTO total_gmv, total_commission
  FROM public.marketplace_orders
  WHERE status != 'cancelled';

  SELECT COUNT(DISTINCT seller_tenant_id)
  INTO active_vendors
  FROM public.marketplace_orders;

  SELECT COUNT(*)
  INTO active_orders
  FROM public.marketplace_orders
  WHERE status NOT IN ('delivered', 'cancelled', 'rejected');

  RETURN jsonb_build_object(
    'total_gmv', total_gmv,
    'total_commission', total_commission,
    'active_vendors', active_vendors,
    'active_orders', active_orders
  );
END;
$$;
