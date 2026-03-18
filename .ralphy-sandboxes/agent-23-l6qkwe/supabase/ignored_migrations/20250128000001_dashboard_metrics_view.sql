-- Dashboard Metrics Materialized View
-- Aggregates dashboard data for fast queries
-- Refreshes every 5 minutes via cron job

-- Create materialized view for dashboard metrics
CREATE MATERIALIZED VIEW IF NOT EXISTS dashboard_metrics AS
SELECT 
  t.id as tenant_id,
  t.account_id,
  COUNT(DISTINCT wo.id) FILTER (WHERE wo.status IN ('pending', 'assigned', 'in_transit')) as active_orders,
  COUNT(DISTINCT wo.id) as total_orders,
  COALESCE(SUM(wo.total_amount) FILTER (WHERE DATE(wo.created_at) = CURRENT_DATE), 0) as today_revenue,
  COALESCE(SUM(wo.total_amount) FILTER (WHERE DATE(wo.created_at) >= DATE_TRUNC('week', CURRENT_DATE) - INTERVAL '7 days' 
    AND DATE(wo.created_at) < DATE_TRUNC('week', CURRENT_DATE)), 0) as last_week_revenue,
  COUNT(DISTINCT wd.id) FILTER (WHERE wd.status IN ('assigned', 'picked_up', 'in_transit')) as active_deliveries,
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

-- Function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_dashboard_metrics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_metrics;
END;
$$;

-- Grant permissions
GRANT SELECT ON dashboard_metrics TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_dashboard_metrics() TO authenticated;

-- Add comment
COMMENT ON MATERIALIZED VIEW dashboard_metrics IS 'Aggregated dashboard metrics refreshed every 5 minutes';
COMMENT ON FUNCTION refresh_dashboard_metrics IS 'Refreshes the dashboard_metrics materialized view';

-- Note: To enable auto-refresh, you need pg_cron extension enabled in Supabase
-- Run this in Supabase SQL editor after enabling pg_cron:
-- SELECT cron.schedule('refresh-dashboard', '*/5 * * * *', 'SELECT refresh_dashboard_metrics()');

