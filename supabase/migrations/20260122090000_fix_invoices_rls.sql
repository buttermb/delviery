-- ============================================================================
-- Fix overly permissive RLS policies on invoices table
--
-- Problem: Current policies are incomplete (SELECT only) and use admin_users
-- table which is inconsistent with the tenant_users pattern. The invoices
-- table does NOT have a tenant_id column.
--
-- Solution: Use EXISTS checks against tenant_users for membership verification.
-- ============================================================================

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Tenants can view their own invoices" ON invoices;
DROP POLICY IF EXISTS "Admins can view all invoices" ON invoices;
DROP POLICY IF EXISTS "Super admins can view all invoices" ON invoices;
DROP POLICY IF EXISTS "Users can view invoices" ON invoices;
DROP POLICY IF EXISTS "Users can create invoices" ON invoices;
DROP POLICY IF EXISTS "Users can update invoices" ON invoices;
DROP POLICY IF EXISTS "Users can delete invoices" ON invoices;
DROP POLICY IF EXISTS "Tenant members can view invoices" ON invoices;
DROP POLICY IF EXISTS "Tenant members can create invoices" ON invoices;
DROP POLICY IF EXISTS "Tenant members can update invoices" ON invoices;
DROP POLICY IF EXISTS "Tenant members can delete invoices" ON invoices;
DROP POLICY IF EXISTS "invoices_tenant_select" ON invoices;
DROP POLICY IF EXISTS "invoices_tenant_insert" ON invoices;
DROP POLICY IF EXISTS "invoices_tenant_update" ON invoices;
DROP POLICY IF EXISTS "invoices_tenant_delete" ON invoices;

-- Ensure RLS is enabled
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Create policies using EXISTS check against tenant_users
-- (invoices table does not have a tenant_id column)

-- SELECT: Allow authenticated users who are tenant members
CREATE POLICY "invoices_tenant_select" ON invoices FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM tenant_users tu WHERE tu.user_id = auth.uid()
  ));

-- INSERT: Only admin/owner tenant members can insert invoices
CREATE POLICY "invoices_tenant_insert" ON invoices FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM tenant_users tu WHERE tu.user_id = auth.uid() AND tu.role IN ('admin', 'owner')
  ));

-- UPDATE: Only admin/owner tenant members can update invoices
CREATE POLICY "invoices_tenant_update" ON invoices FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM tenant_users tu WHERE tu.user_id = auth.uid() AND tu.role IN ('admin', 'owner')
  ));

-- DELETE: Only admin/owner tenant members can delete invoices
CREATE POLICY "invoices_tenant_delete" ON invoices FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM tenant_users tu WHERE tu.user_id = auth.uid() AND tu.role IN ('admin', 'owner')
  ));

-- ============================================================================
-- VERIFICATION QUERIES (Run these after migration to verify)
-- ============================================================================
-- Check policies exist:
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'invoices';
--
-- Expected result:
-- | policyname              | cmd    |
-- |-------------------------|--------|
-- | invoices_tenant_select  | SELECT |
-- | invoices_tenant_insert  | INSERT |
-- | invoices_tenant_update  | UPDATE |
-- | invoices_tenant_delete  | DELETE |
-- ============================================================================
