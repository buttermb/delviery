-- ============================================================================
-- Fix overly permissive RLS policies on customers table
--
-- Problem: Current policies use complex joins through accounts.tenant_id
-- or use get_user_tenant_id() function which can be overly permissive.
-- The customers table does NOT have a tenant_id column.
--
-- Solution: Use EXISTS checks against tenant_users for membership verification.
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

-- Create policies using EXISTS check against tenant_users
-- (customers table does not have a tenant_id column)

-- SELECT: Allow authenticated users who are tenant members
CREATE POLICY "customers_tenant_select" ON customers FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM tenant_users tu WHERE tu.user_id = auth.uid()
  ));

-- INSERT: Only admin/owner tenant members can insert customers
CREATE POLICY "customers_tenant_insert" ON customers FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM tenant_users tu WHERE tu.user_id = auth.uid() AND tu.role IN ('admin', 'owner')
  ));

-- UPDATE: Only admin/owner tenant members can update customers
CREATE POLICY "customers_tenant_update" ON customers FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM tenant_users tu WHERE tu.user_id = auth.uid() AND tu.role IN ('admin', 'owner')
  ));

-- DELETE: Only admin/owner tenant members can delete customers
CREATE POLICY "customers_tenant_delete" ON customers FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM tenant_users tu WHERE tu.user_id = auth.uid() AND tu.role IN ('admin', 'owner')
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
