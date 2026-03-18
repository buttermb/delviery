-- Migration: Add composite index on orders table for tenant_id and created_at DESC
-- Purpose: Optimize queries that filter and sort orders by tenant_id and created_at
-- This index will significantly improve query performance for queries like:
-- SELECT * FROM orders WHERE tenant_id = ? ORDER BY created_at DESC
-- Common use cases include:
-- - Dashboard queries showing recent orders for a tenant
-- - Order lists sorted by most recent first within a tenant
-- - Paginated order queries with time-based sorting

-- Create composite index on (tenant_id, created_at DESC)
-- The DESC order is important for efficient descending sorts (most recent first)
CREATE INDEX IF NOT EXISTS idx_orders_tenant_id_created_at_desc
ON public.orders(tenant_id, created_at DESC);

-- Add a comment to document the index purpose
COMMENT ON INDEX idx_orders_tenant_id_created_at_desc IS
'Composite index to optimize queries filtering orders by tenant_id and sorting by created_at DESC. Commonly used for dashboard and recent order list queries.';
