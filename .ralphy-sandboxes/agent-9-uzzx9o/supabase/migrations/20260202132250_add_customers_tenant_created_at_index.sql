-- Migration: Add composite index on customers table for tenant_id and created_at DESC
-- Purpose: Optimize queries that filter and sort customers by tenant_id and created_at
-- This index will significantly improve query performance for queries like:
-- SELECT * FROM customers WHERE tenant_id = ? ORDER BY created_at DESC
-- Common use cases include:
-- - Dashboard queries showing recent customers for a tenant
-- - Customer lists sorted by most recent first within a tenant
-- - Paginated customer queries with time-based sorting

-- Create composite index on (tenant_id, created_at DESC)
-- The DESC order is important for efficient descending sorts (most recent first)
CREATE INDEX IF NOT EXISTS idx_customers_tenant_id_created_at_desc
ON public.customers(tenant_id, created_at DESC);

-- Add a comment to document the index purpose
COMMENT ON INDEX idx_customers_tenant_id_created_at_desc IS
'Composite index to optimize queries filtering customers by tenant_id and sorting by created_at DESC. Commonly used for dashboard and recent customer list queries.';
