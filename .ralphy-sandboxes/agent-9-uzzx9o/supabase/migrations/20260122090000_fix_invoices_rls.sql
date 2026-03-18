-- ============================================================================
-- Fix overly permissive RLS policies on invoices table
--
-- Problem: Current policies are incomplete (SELECT only) and use admin_users
-- table which is inconsistent with the tenant_users pattern. The existing
-- "Admins can view all invoices" policy is overly permissive.
--
-- Solution: Use tenant_users table directly for tenant membership checks,
-- consistent with vendors, products, orders, and customers tables.
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

-- Create tenant-isolated policies using tenant_users table
-- This is consistent with vendors, products, orders, and customers tables

-- SELECT: Allow authenticated users who belong to the tenant
CREATE POLICY "invoices_tenant_select" ON invoices FOR SELECT
  USING (tenant_id IN (
    SELECT tu.tenant_id FROM tenant_users tu WHERE tu.user_id = auth.uid()
  ));

-- INSERT: Only tenant members can insert invoices for their tenant
CREATE POLICY "invoices_tenant_insert" ON invoices FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT tu.tenant_id FROM tenant_users tu WHERE tu.user_id = auth.uid()
  ));

-- UPDATE: Only tenant members can update invoices for their tenant
CREATE POLICY "invoices_tenant_update" ON invoices FOR UPDATE
  USING (tenant_id IN (
    SELECT tu.tenant_id FROM tenant_users tu WHERE tu.user_id = auth.uid()
  ));

-- DELETE: Only tenant members can delete invoices for their tenant
CREATE POLICY "invoices_tenant_delete" ON invoices FOR DELETE
  USING (tenant_id IN (
    SELECT tu.tenant_id FROM tenant_users tu WHERE tu.user_id = auth.uid()
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
