-- Migration: Add get_dashboard_stats RPC function
-- Date: 2026-02-02 16:53
-- Description: Creates an RPC function to retrieve dashboard statistics for a tenant within a date range

-- Create the get_dashboard_stats function
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(
  p_tenant_id uuid,
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  v_start_date timestamptz;
  v_end_date timestamptz;
BEGIN
  -- Enforce membership: caller must be a member of the tenant
  IF NOT EXISTS (
    SELECT 1
    FROM public.tenant_users tu
    WHERE tu.tenant_id = p_tenant_id
      AND tu.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

  -- Set default date range if not provided (last 30 days)
  v_start_date := COALESCE(p_start_date, NOW() - INTERVAL '30 days');
  v_end_date := COALESCE(p_end_date, NOW());

  -- Build the dashboard stats object
  SELECT jsonb_build_object(
    -- Orders statistics
    'orders', jsonb_build_object(
      'total', (
        SELECT COUNT(*)
        FROM public.orders o
        WHERE o.tenant_id = p_tenant_id
          AND o.created_at >= v_start_date
          AND o.created_at <= v_end_date
      ),
      'pending', (
        SELECT COUNT(*)
        FROM public.orders o
        WHERE o.tenant_id = p_tenant_id
          AND o.status = 'pending'
          AND o.created_at >= v_start_date
          AND o.created_at <= v_end_date
      ),
      'completed', (
        SELECT COUNT(*)
        FROM public.orders o
        WHERE o.tenant_id = p_tenant_id
          AND o.status IN ('delivered', 'completed')
          AND o.created_at >= v_start_date
          AND o.created_at <= v_end_date
      ),
      'cancelled', (
        SELECT COUNT(*)
        FROM public.orders o
        WHERE o.tenant_id = p_tenant_id
          AND o.status = 'cancelled'
          AND o.created_at >= v_start_date
          AND o.created_at <= v_end_date
      )
    ),

    -- Revenue statistics
    'revenue', jsonb_build_object(
      'total', (
        SELECT COALESCE(SUM(o.total_amount), 0)
        FROM public.orders o
        WHERE o.tenant_id = p_tenant_id
          AND o.status IN ('delivered', 'completed')
          AND o.created_at >= v_start_date
          AND o.created_at <= v_end_date
      ),
      'average_order_value', (
        SELECT COALESCE(AVG(o.total_amount), 0)
        FROM public.orders o
        WHERE o.tenant_id = p_tenant_id
          AND o.status IN ('delivered', 'completed')
          AND o.created_at >= v_start_date
          AND o.created_at <= v_end_date
      ),
      'pending', (
        SELECT COALESCE(SUM(o.total_amount), 0)
        FROM public.orders o
        WHERE o.tenant_id = p_tenant_id
          AND o.status IN ('pending', 'accepted', 'picked_up', 'in_transit')
          AND o.created_at >= v_start_date
          AND o.created_at <= v_end_date
      )
    ),

    -- Products statistics
    'products', jsonb_build_object(
      'total', (
        SELECT COUNT(*)
        FROM public.products p
        WHERE p.tenant_id = p_tenant_id
          AND p.is_active = true
      ),
      'low_stock', (
        SELECT COUNT(*)
        FROM public.products p
        WHERE p.tenant_id = p_tenant_id
          AND p.is_active = true
          AND p.stock_quantity <= COALESCE(p.low_stock_threshold, 10)
          AND p.stock_quantity > 0
      ),
      'out_of_stock', (
        SELECT COUNT(*)
        FROM public.products p
        WHERE p.tenant_id = p_tenant_id
          AND p.is_active = true
          AND p.stock_quantity = 0
      )
    ),

    -- Customers statistics
    'customers', jsonb_build_object(
      'total', (
        SELECT COUNT(*)
        FROM public.customers c
        WHERE c.tenant_id = p_tenant_id
      ),
      'new', (
        SELECT COUNT(*)
        FROM public.customers c
        WHERE c.tenant_id = p_tenant_id
          AND c.created_at >= v_start_date
          AND c.created_at <= v_end_date
      ),
      'active', (
        SELECT COUNT(DISTINCT o.customer_id)
        FROM public.orders o
        WHERE o.tenant_id = p_tenant_id
          AND o.created_at >= v_start_date
          AND o.created_at <= v_end_date
      )
    ),

    -- Date range metadata
    'date_range', jsonb_build_object(
      'start', v_start_date,
      'end', v_end_date
    ),

    -- Generated timestamp
    'generated_at', NOW()
  ) INTO result;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.get_dashboard_stats(uuid, timestamptz, timestamptz) IS
  'Returns dashboard statistics for a tenant within a specified date range. Enforces tenant membership via tenant_users.';

-- Grant execution permissions
REVOKE ALL ON FUNCTION public.get_dashboard_stats(uuid, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(uuid, timestamptz, timestamptz) TO authenticated;
