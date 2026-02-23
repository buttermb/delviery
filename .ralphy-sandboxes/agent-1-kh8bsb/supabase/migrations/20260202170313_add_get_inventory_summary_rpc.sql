-- Migration: Add get_inventory_summary RPC function
-- Date: 2026-02-02 17:03
-- Description: Creates an RPC function to retrieve inventory summary for a tenant

-- Create the get_inventory_summary function
CREATE OR REPLACE FUNCTION public.get_inventory_summary(
  p_tenant_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
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

  -- Build the inventory summary object
  SELECT jsonb_build_object(
    -- Total products
    'total_products', (
      SELECT COUNT(*)
      FROM public.products p
      WHERE p.tenant_id = p_tenant_id
        AND p.is_active = true
    ),

    -- Stock status breakdown
    'stock_status', jsonb_build_object(
      'in_stock', (
        SELECT COUNT(*)
        FROM public.products p
        WHERE p.tenant_id = p_tenant_id
          AND p.is_active = true
          AND p.stock_quantity > COALESCE(p.low_stock_threshold, 10)
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

    -- Total inventory value (based on cost)
    'inventory_value', jsonb_build_object(
      'total', (
        SELECT COALESCE(SUM(p.stock_quantity * COALESCE(p.cost, 0)), 0)
        FROM public.products p
        WHERE p.tenant_id = p_tenant_id
          AND p.is_active = true
      ),
      'retail_value', (
        SELECT COALESCE(SUM(p.stock_quantity * p.price), 0)
        FROM public.products p
        WHERE p.tenant_id = p_tenant_id
          AND p.is_active = true
      )
    ),

    -- Category breakdown
    'by_category', (
      SELECT COALESCE(
        jsonb_object_agg(
          category,
          jsonb_build_object(
            'count', count,
            'total_quantity', total_quantity,
            'total_value', total_value
          )
        ),
        '{}'::jsonb
      )
      FROM (
        SELECT
          p.category,
          COUNT(*) as count,
          SUM(p.stock_quantity) as total_quantity,
          SUM(p.stock_quantity * p.price) as total_value
        FROM public.products p
        WHERE p.tenant_id = p_tenant_id
          AND p.is_active = true
        GROUP BY p.category
      ) category_stats
    ),

    -- Low stock items (detailed)
    'low_stock_items', (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id', p.id,
            'name', p.name,
            'sku', p.sku,
            'category', p.category,
            'stock_quantity', p.stock_quantity,
            'low_stock_threshold', COALESCE(p.low_stock_threshold, 10),
            'price', p.price
          )
          ORDER BY p.stock_quantity ASC
        ),
        '[]'::jsonb
      )
      FROM public.products p
      WHERE p.tenant_id = p_tenant_id
        AND p.is_active = true
        AND p.stock_quantity <= COALESCE(p.low_stock_threshold, 10)
        AND p.stock_quantity >= 0
      LIMIT 20
    ),

    -- Generated timestamp
    'generated_at', NOW()
  ) INTO result;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.get_inventory_summary(uuid) IS
  'Returns inventory summary for a tenant including stock status, values, and category breakdown. Enforces tenant membership via tenant_users.';

-- Grant execution permissions
REVOKE ALL ON FUNCTION public.get_inventory_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_inventory_summary(uuid) TO authenticated;
