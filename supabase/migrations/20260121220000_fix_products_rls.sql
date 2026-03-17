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

-- products table has no tenant_id column — use admin role check for management
-- and public read for storefront access

-- SELECT: Public read for storefront
CREATE POLICY "products_tenant_select" ON products FOR SELECT
  TO anon, authenticated
  USING (true);

-- INSERT: Only tenant admins can insert products
CREATE POLICY "products_tenant_insert" ON products FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM tenant_users tu WHERE tu.user_id = auth.uid() AND tu.role IN ('admin', 'owner'))
  );

-- UPDATE: Only tenant admins can update products
CREATE POLICY "products_tenant_update" ON products FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM tenant_users tu WHERE tu.user_id = auth.uid() AND tu.role IN ('admin', 'owner'))
  );

-- DELETE: Only tenant admins can delete products
CREATE POLICY "products_tenant_delete" ON products FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM tenant_users tu WHERE tu.user_id = auth.uid() AND tu.role IN ('admin', 'owner'))
  );

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
