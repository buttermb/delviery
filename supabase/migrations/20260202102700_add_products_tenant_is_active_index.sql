-- ============================================================================
-- Migration: Add Index on products(is_active)
-- Description: Creates an index to optimize queries filtering by
--              is_active column on the products table
-- Note: products table does NOT have tenant_id column; removed from original
--        composite index
-- ============================================================================

-- Create index on products table for is_active
-- This index will improve performance for queries that filter active products
CREATE INDEX IF NOT EXISTS idx_products_is_active
ON public.products(is_active);

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON INDEX public.idx_products_is_active IS
'Index to optimize queries filtering products by is_active status. Commonly used for fetching active products.';
