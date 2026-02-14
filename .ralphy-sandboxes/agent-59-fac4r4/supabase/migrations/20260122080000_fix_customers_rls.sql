-- ============================================================================
-- Fix overly permissive RLS policies on customers table
--
-- Problem: Current policies use complex joins through accounts.tenant_id
-- or use get_user_tenant_id() function which can be overly permissive.
-- The "Account admins can manage customers" policy uses admin_users table
-- which is inconsistent with the tenant_users pattern.
--
-- Solution: Use tenant_users table directly for tenant membership checks,
-- consistent with vendors, products, and orders tables in the system.
-- ============================================================================

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Account admins can manage customers" ON customers;
DROP POLICY IF EXISTS "tenant_isolation_customers" ON customers;
DROP POLICY IF EXISTS "Tenant members can view own customers" ON customers;
DROP POLICY IF EXISTS "Tenant members can insert customers" ON customers;
DROP POLICY IF EXISTS "Tenant members can update own customers" ON customers;
DROP POLICY IF EXISTS "Tenant members can delete customers" ON customers;
DROP POLICY IF EXISTS "Allow realtime subscriptions for customers" ON customers;
DROP POLICY IF EXISTS "Tenants can view own customers" ON customers;
DROP POLICY IF EXISTS "Tenants can manage own customers" ON customers;
DROP POLICY IF EXISTS "customers_tenant_select" ON customers;
DROP POLICY IF EXISTS "customers_tenant_insert" ON customers;
DROP POLICY IF EXISTS "customers_tenant_update" ON customers;
DROP POLICY IF EXISTS "customers_tenant_delete" ON customers;

-- Ensure RLS is enabled
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Create tenant-isolated policies using tenant_users table
-- This is consistent with vendors, products, and orders tables

-- SELECT: Allow authenticated users who belong to the tenant
CREATE POLICY "customers_tenant_select" ON customers FOR SELECT
  USING (tenant_id IN (
    SELECT tu.tenant_id FROM tenant_users tu WHERE tu.user_id = auth.uid()
  ));

-- INSERT: Only tenant members can insert customers for their tenant
CREATE POLICY "customers_tenant_insert" ON customers FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT tu.tenant_id FROM tenant_users tu WHERE tu.user_id = auth.uid()
  ));

-- UPDATE: Only tenant members can update customers for their tenant
CREATE POLICY "customers_tenant_update" ON customers FOR UPDATE
  USING (tenant_id IN (
    SELECT tu.tenant_id FROM tenant_users tu WHERE tu.user_id = auth.uid()
  ));

-- DELETE: Only tenant members can delete customers for their tenant
CREATE POLICY "customers_tenant_delete" ON customers FOR DELETE
  USING (tenant_id IN (
    SELECT tu.tenant_id FROM tenant_users tu WHERE tu.user_id = auth.uid()
  ));

-- ============================================================================
-- VERIFICATION QUERIES (Run these after migration to verify)
-- ============================================================================
-- Check policies exist:
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'customers';
--
-- Expected result:
-- | policyname               | cmd    |
-- |--------------------------|--------|
-- | customers_tenant_select  | SELECT |
-- | customers_tenant_insert  | INSERT |
-- | customers_tenant_update  | UPDATE |
-- | customers_tenant_delete  | DELETE |
-- ============================================================================
