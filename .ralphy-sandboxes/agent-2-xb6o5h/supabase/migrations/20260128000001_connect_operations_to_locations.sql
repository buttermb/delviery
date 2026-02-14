-- =====================================================
-- MIGRATION: Connect Operations to Locations
-- Purpose: Enable multi-location inventory management by linking
--          operations (receiving, runners, inventory) to specific locations
-- =====================================================

-- 1. Add location_id to receiving_records for tracking which location received shipments
ALTER TABLE public.receiving_records
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL;

-- Create index for efficient location-based queries on receiving records
CREATE INDEX IF NOT EXISTS idx_receiving_records_location_id
  ON public.receiving_records(location_id);

-- 2. Add location_id to wholesale_runners for home base assignment
ALTER TABLE public.wholesale_runners
  ADD COLUMN IF NOT EXISTS home_location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL;

-- Create index for efficient location-based queries on runners
CREATE INDEX IF NOT EXISTS idx_wholesale_runners_home_location_id
  ON public.wholesale_runners(home_location_id);

-- 3. Create operations_location_summary view for dashboard metrics
CREATE OR REPLACE VIEW public.operations_location_summary AS
SELECT
  l.id AS location_id,
  l.name AS location_name,
  l.tenant_id,
  l.status AS location_status,
  l.address,
  l.city,
  l.state,
  -- Receiving stats
  COALESCE(rr.total_receiving_records, 0) AS total_receiving_records,
  COALESCE(rr.pending_receiving, 0) AS pending_receiving,
  COALESCE(rr.completed_receiving, 0) AS completed_receiving,
  -- Runner stats
  COALESCE(wr.total_runners, 0) AS total_runners,
  COALESCE(wr.active_runners, 0) AS active_runners,
  -- Inventory stats from location_inventory
  COALESCE(li.total_products, 0) AS total_products,
  COALESCE(li.total_quantity, 0) AS total_inventory_quantity,
  COALESCE(li.low_stock_products, 0) AS low_stock_products
FROM public.locations l
LEFT JOIN (
  SELECT
    location_id,
    COUNT(*) AS total_receiving_records,
    COUNT(*) FILTER (WHERE status = 'in_progress') AS pending_receiving,
    COUNT(*) FILTER (WHERE status = 'completed') AS completed_receiving
  FROM public.receiving_records
  WHERE location_id IS NOT NULL
  GROUP BY location_id
) rr ON l.id = rr.location_id
LEFT JOIN (
  SELECT
    home_location_id AS location_id,
    COUNT(*) AS total_runners,
    COUNT(*) FILTER (WHERE status = 'active') AS active_runners
  FROM public.wholesale_runners
  WHERE home_location_id IS NOT NULL
  GROUP BY home_location_id
) wr ON l.id = wr.location_id
LEFT JOIN (
  SELECT
    location_id,
    COUNT(DISTINCT product_id) AS total_products,
    SUM(quantity) AS total_quantity,
    COUNT(*) FILTER (WHERE quantity <= reorder_point) AS low_stock_products
  FROM public.location_inventory
  WHERE location_id IS NOT NULL
  GROUP BY location_id
) li ON l.id = li.location_id
WHERE l.status = 'active';

-- Grant access to the view for authenticated users
GRANT SELECT ON public.operations_location_summary TO authenticated;

-- 4. Create function to get location operations summary
CREATE OR REPLACE FUNCTION public.get_location_operations_summary(p_tenant_id uuid, p_location_id uuid DEFAULT NULL)
RETURNS TABLE (
  location_id uuid,
  location_name text,
  location_status text,
  address text,
  city text,
  state text,
  total_receiving_records bigint,
  pending_receiving bigint,
  completed_receiving bigint,
  total_runners bigint,
  active_runners bigint,
  total_products bigint,
  total_inventory_quantity numeric,
  low_stock_products bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller has access to this tenant
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT
    ols.location_id,
    ols.location_name,
    ols.location_status,
    ols.address,
    ols.city,
    ols.state,
    ols.total_receiving_records,
    ols.pending_receiving,
    ols.completed_receiving,
    ols.total_runners,
    ols.active_runners,
    ols.total_products,
    ols.total_inventory_quantity,
    ols.low_stock_products
  FROM public.operations_location_summary ols
  WHERE ols.tenant_id = p_tenant_id
  AND (p_location_id IS NULL OR ols.location_id = p_location_id);
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_location_operations_summary(uuid, uuid) TO authenticated;

-- 5. Add tenant_id to locations table if not exists (for proper RLS)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'locations'
    AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE public.locations
      ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

    -- Create index
    CREATE INDEX IF NOT EXISTS idx_locations_tenant_id ON public.locations(tenant_id);
  END IF;
END $$;

-- 6. Update RLS policy for locations to use tenant_id
DROP POLICY IF EXISTS "tenant_isolation_locations" ON public.locations;
CREATE POLICY "tenant_isolation_locations"
  ON public.locations
  FOR ALL
  USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    OR account_id IN (
      SELECT a.id FROM public.accounts a
      JOIN public.tenants t ON a.id = (t.settings->>'primary_account_id')::uuid
      JOIN public.profiles p ON p.tenant_id = t.id
      WHERE p.id = auth.uid()
    )
  );

-- Comment on new columns
COMMENT ON COLUMN public.receiving_records.location_id IS 'The location that received this shipment';
COMMENT ON COLUMN public.wholesale_runners.home_location_id IS 'The home/base location assigned to this runner';
COMMENT ON VIEW public.operations_location_summary IS 'Aggregated operations statistics by location for dashboard display';
