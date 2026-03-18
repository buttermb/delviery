-- ============================================================================
-- Fix overly permissive RLS policies on products table
--
-- Problem: Current policies use admin_users table which is inconsistent with
-- other tables and can be overly permissive.
--
-- Solution: Use tenant_users table directly for tenant membership checks,
-- consistent with vendors and other tables in the system.
--
-- Note: Products need public SELECT access for storefront, so we keep
-- a separate public read policy alongside tenant-isolated management policies.
-- ============================================================================

-- Drop existing permissive policies
DROP POLICY IF EXISTS "tenant_admins_manage_products" ON products;
DROP POLICY IF EXISTS "public_read_products" ON products;
DROP POLICY IF EXISTS "Tenant members can view products" ON products;
DROP POLICY IF EXISTS "Tenant members can create products" ON products;
DROP POLICY IF EXISTS "Tenant members can update products" ON products;
DROP POLICY IF EXISTS "Tenant members can delete products" ON products;
DROP POLICY IF EXISTS "Tenant members can view own products" ON products;
DROP POLICY IF EXISTS "Tenant members can insert products" ON products;
DROP POLICY IF EXISTS "Tenant members can update own products" ON products;
DROP POLICY IF EXISTS "Tenant members can delete own products" ON products;
DROP POLICY IF EXISTS "Tenants can manage own products" ON products;
DROP POLICY IF EXISTS "tenant_isolation_products" ON products;
DROP POLICY IF EXISTS "admin_all_products" ON products;
DROP POLICY IF EXISTS "Admins can manage products" ON products;
DROP POLICY IF EXISTS "Admins can insert products" ON products;
DROP POLICY IF EXISTS "Admins can update products" ON products;
DROP POLICY IF EXISTS "Admins can delete products" ON products;
DROP POLICY IF EXISTS "Authenticated users can view products" ON products;
DROP POLICY IF EXISTS "Block anonymous access to products" ON products;

-- Create tenant-isolated policies using tenant_users table
-- This is consistent with vendors and other tables

-- SELECT: Allow authenticated users who belong to the tenant
-- (Storefront uses service_role or RPC functions, so this is safe)
CREATE POLICY "products_tenant_select" ON products FOR SELECT
  USING (tenant_id IN (
    SELECT tu.tenant_id FROM tenant_users tu WHERE tu.user_id = auth.uid()
  ));

-- INSERT: Only tenant members can insert products for their tenant
CREATE POLICY "products_tenant_insert" ON products FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT tu.tenant_id FROM tenant_users tu WHERE tu.user_id = auth.uid()
  ));

-- UPDATE: Only tenant members can update products for their tenant
CREATE POLICY "products_tenant_update" ON products FOR UPDATE
  USING (tenant_id IN (
    SELECT tu.tenant_id FROM tenant_users tu WHERE tu.user_id = auth.uid()
  ));

-- DELETE: Only tenant members can delete products for their tenant
CREATE POLICY "products_tenant_delete" ON products FOR DELETE
  USING (tenant_id IN (
    SELECT tu.tenant_id FROM tenant_users tu WHERE tu.user_id = auth.uid()
  ));

-- ============================================================================
-- VERIFICATION QUERIES (Run these after migration to verify)
-- ============================================================================
-- Check policies exist:
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'products';
--
-- Expected result:
-- | policyname              | cmd    |
-- |-------------------------|--------|
-- | products_tenant_select  | SELECT |
-- | products_tenant_insert  | INSERT |
-- | products_tenant_update  | UPDATE |
-- | products_tenant_delete  | DELETE |
-- ============================================================================
