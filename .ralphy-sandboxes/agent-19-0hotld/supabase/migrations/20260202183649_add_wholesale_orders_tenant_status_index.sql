-- Migration: Add composite index on wholesale_orders table for tenant_id and status
-- Purpose: Optimize filtered queries that filter by both tenant_id and status
-- This index will significantly improve query performance for queries like:
-- SELECT * FROM wholesale_orders WHERE tenant_id = ? AND status = ?
-- Common use cases include dashboard queries, order lists filtered by status within a tenant

-- Create composite index on (tenant_id, status)
-- This index is useful for queries that filter by tenant_id and status together
CREATE INDEX IF NOT EXISTS idx_wholesale_orders_tenant_id_status
ON public.wholesale_orders(tenant_id, status);

-- Add a comment to document the index purpose
COMMENT ON INDEX idx_wholesale_orders_tenant_id_status IS
'Composite index to optimize queries filtering wholesale orders by tenant_id and status. Common for dashboard and wholesale order list queries.';
