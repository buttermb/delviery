
-- Materialized view for real-time analytics summary
-- This aggregates data to avoid expensive queries on large log tables

CREATE MATERIALIZED VIEW IF NOT EXISTS menu_analytics_summary AS
SELECT 
  m.id as menu_id,
  m.tenant_id,
  COUNT(DISTINCT al.ip_address) as unique_visitors,
  COUNT(al.id) as total_views,
  COUNT(DISTINCT o.id) as order_count,
  COALESCE(SUM(o.total_amount), 0) as revenue,
  COALESCE(AVG(o.total_amount), 0) as avg_order_value,
  CASE 
    WHEN COUNT(DISTINCT al.ip_address) > 0 
    THEN COUNT(DISTINCT o.id)::float / COUNT(DISTINCT al.ip_address) 
    ELSE 0 
  END as conversion_rate,
  MAX(al.accessed_at) as last_accessed_at
FROM disposable_menus m
LEFT JOIN menu_access_logs al ON m.id = al.menu_id
LEFT JOIN menu_orders o ON m.id = o.menu_id
GROUP BY m.id, m.tenant_id;

-- Index for refreshing the view efficiently by menu_id
CREATE INDEX IF NOT EXISTS idx_analytics_menu_id ON menu_analytics_summary(menu_id);
CREATE INDEX IF NOT EXISTS idx_analytics_tenant_id ON menu_analytics_summary(tenant_id);

-- Function to refresh the view (can be called by cron or triggers)
CREATE OR REPLACE FUNCTION refresh_menu_analytics()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY menu_analytics_summary;
END;
$$ LANGUAGE plpgsql;
