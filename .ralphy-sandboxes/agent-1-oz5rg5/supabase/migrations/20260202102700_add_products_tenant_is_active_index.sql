-- ============================================================================
-- Migration: Add Composite Index on products(tenant_id, is_active)
-- Description: Creates a composite index to optimize queries filtering by
--              tenant_id and is_active columns on the products table
-- ============================================================================

-- Create composite index on products table for tenant_id and is_active
-- This index will improve performance for queries that filter active products
-- by tenant, which is a common query pattern in multi-tenant applications
CREATE INDEX IF NOT EXISTS idx_products_tenant_id_is_active
ON public.products(tenant_id, is_active);

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON INDEX public.idx_products_tenant_id_is_active IS
'Composite index to optimize queries filtering products by tenant_id and is_active status. Commonly used for fetching active products for a specific tenant.';
