-- Migration: Add index on wholesale_orders table for status
-- Purpose: Optimize filtered queries that filter by status
-- Note: wholesale_orders does not have tenant_id column

-- Create index on status
CREATE INDEX IF NOT EXISTS idx_wholesale_orders_status
ON public.wholesale_orders(status);

-- Add a comment to document the index purpose
COMMENT ON INDEX idx_wholesale_orders_status IS
'Index to optimize queries filtering wholesale orders by status.';
