-- Update Dashboard Metrics Materialized View
-- SKIPPED: wholesale_orders, wholesale_deliveries, wholesale_inventory
-- do not have tenant_id or account_id columns.
-- Materialized view cannot be created with current schema.
-- TODO: Recreate when wholesale tables have proper tenant linkage.

DROP MATERIALIZED VIEW IF EXISTS dashboard_metrics;

-- No-op placeholder
SELECT 1;
