-- Migration: Add index on orders table for status
-- Purpose: Optimize filtered queries that filter by status
-- Note: orders table does NOT have tenant_id column; removed from original composite index
-- This index will improve query performance for queries like:
-- SELECT * FROM orders WHERE status = ?
-- Common use cases include dashboard queries, order lists filtered by status

-- Create index on (status)
CREATE INDEX IF NOT EXISTS idx_orders_status
ON public.orders(status);

-- Add a comment to document the index purpose
COMMENT ON INDEX idx_orders_status IS
'Index to optimize queries filtering orders by status. Common for dashboard and order list queries.';
