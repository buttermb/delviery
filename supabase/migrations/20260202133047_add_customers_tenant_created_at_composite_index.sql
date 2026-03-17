-- Migration: Add index on customers table for created_at DESC
-- Purpose: Optimize tenant-scoped queries ordered by creation date
-- Note: customers table does NOT have tenant_id column; removed from original composite index
-- Note: This is a duplicate of earlier migrations; using IF NOT EXISTS to be safe

-- Create index with created_at DESC
CREATE INDEX IF NOT EXISTS idx_customers_created_at_desc
  ON public.customers(created_at DESC);

-- Add comment explaining the index purpose
COMMENT ON INDEX idx_customers_created_at_desc IS
  'Index for efficient customer queries ordered by creation date (newest first). Optimizes queries like: SELECT * FROM customers ORDER BY created_at DESC';
