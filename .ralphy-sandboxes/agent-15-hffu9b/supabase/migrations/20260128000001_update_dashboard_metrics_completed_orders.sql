-- Update Dashboard Metrics Materialized View
-- Filter revenue by completed/delivered orders only
-- This ensures only orders that have been fulfilled contribute to revenue totals

-- Drop the existing materialized view to recreate with new definition
DROP MATERIALIZED VIEW IF EXISTS dashboard_metrics;

-- Create updated materialized view for dashboard metrics
-- Now filters revenue calculations to only include completed/delivered orders
CREATE MATERIALIZED VIEW dashboard_metrics AS
SELECT
  t.id as tenant_id,
  t.account_id,
  -- Active orders remain unfiltered (pending, assigned, in_transit)
  COUNT(DISTINCT wo.id) FILTER (WHERE wo.status IN ('pending', 'assigned', 'in_transit')) as active_orders,
  -- Total completed orders
  COUNT(DISTINCT wo.id) FILTER (WHERE wo.status IN ('completed', 'delivered')) as total_orders,
  -- Today's revenue - only completed/delivered orders
  COALESCE(SUM(wo.total_amount) FILTER (
    WHERE DATE(wo.created_at) = CURRENT_DATE
    AND wo.status IN ('completed', 'delivered')
  ), 0) as today_revenue,
  -- Last week's revenue - only completed/delivered orders
  COALESCE(SUM(wo.total_amount) FILTER (
    WHERE DATE(wo.created_at) >= DATE_TRUNC('week', CURRENT_DATE) - INTERVAL '7 days'
    AND DATE(wo.created_at) < DATE_TRUNC('week', CURRENT_DATE)
    AND wo.status IN ('completed', 'delivered')
  ), 0) as last_week_revenue,
  -- This month's revenue - only completed/delivered orders
  COALESCE(SUM(wo.total_amount) FILTER (
    WHERE DATE(wo.created_at) >= DATE_TRUNC('month', CURRENT_DATE)
    AND wo.status IN ('completed', 'delivered')
  ), 0) as this_month_revenue,
  -- Active deliveries (unchanged)
  COUNT(DISTINCT wd.id) FILTER (WHERE wd.status IN ('assigned', 'picked_up', 'in_transit')) as active_deliveries,
  -- Low stock items (unchanged)
  COUNT(DISTINCT wi.id) FILTER (WHERE wi.quantity_lbs < COALESCE(wi.low_stock_threshold, 30) OR wi.weight_lbs < COALESCE(wi.low_stock_threshold, 30)) as low_stock_items,
  NOW() as last_updated
FROM tenants t
LEFT JOIN wholesale_orders wo ON wo.tenant_id = t.id OR wo.account_id = t.account_id
LEFT JOIN wholesale_deliveries wd ON wd.tenant_id = t.id OR wd.account_id = t.account_id
LEFT JOIN wholesale_inventory wi ON wi.tenant_id = t.id OR wi.account_id = t.account_id
GROUP BY t.id, t.account_id;

-- Create index for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_dashboard_metrics_tenant ON dashboard_metrics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_metrics_account ON dashboard_metrics(account_id);

-- Grant permissions
GRANT SELECT ON dashboard_metrics TO authenticated;

-- Add comment
COMMENT ON MATERIALIZED VIEW dashboard_metrics IS 'Aggregated dashboard metrics with revenue filtered to completed/delivered orders only';
