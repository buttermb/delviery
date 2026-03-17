-- Migration: Add index on orders table for created_at DESC
-- Purpose: Optimize queries that sort orders by created_at
-- Note: orders table does NOT have tenant_id column; removed from original composite index
-- This index will improve query performance for queries like:
-- SELECT * FROM orders ORDER BY created_at DESC
-- Common use cases include:
-- - Dashboard queries showing recent orders
-- - Order lists sorted by most recent first
-- - Paginated order queries with time-based sorting

-- Create index on (created_at DESC)
-- The DESC order is important for efficient descending sorts (most recent first)
CREATE INDEX IF NOT EXISTS idx_orders_created_at_desc
ON public.orders(created_at DESC);

-- Add a comment to document the index purpose
COMMENT ON INDEX idx_orders_created_at_desc IS
'Index to optimize queries sorting orders by created_at DESC. Commonly used for dashboard and recent order list queries.';
