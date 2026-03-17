-- Migration: Add index on customers table for created_at DESC
-- Purpose: Optimize queries that sort customers by created_at
-- Note: customers table does NOT have tenant_id column; removed from original composite index
-- Note: This is a duplicate of 20260202104916 migration; using IF NOT EXISTS to be safe
-- This index will improve query performance for queries like:
-- SELECT * FROM customers ORDER BY created_at DESC

-- Create index on (created_at DESC)
-- The DESC order is important for efficient descending sorts (most recent first)
CREATE INDEX IF NOT EXISTS idx_customers_created_at_desc
ON public.customers(created_at DESC);

-- Add a comment to document the index purpose
COMMENT ON INDEX idx_customers_created_at_desc IS
'Index to optimize queries sorting customers by created_at DESC. Commonly used for dashboard and recent customer list queries.';
