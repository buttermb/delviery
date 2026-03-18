-- Add composite index on customers table for efficient tenant-scoped queries ordered by creation date
-- This index optimizes queries that filter by tenant_id and order by created_at in descending order

-- Create composite index with tenant_id and created_at DESC
CREATE INDEX IF NOT EXISTS idx_customers_tenant_id_created_at_desc
  ON public.customers(tenant_id, created_at DESC);

-- Add comment explaining the index purpose
COMMENT ON INDEX idx_customers_tenant_id_created_at_desc IS
  'Composite index for efficient tenant-scoped customer queries ordered by creation date (newest first). Optimizes queries like: SELECT * FROM customers WHERE tenant_id = ? ORDER BY created_at DESC';
