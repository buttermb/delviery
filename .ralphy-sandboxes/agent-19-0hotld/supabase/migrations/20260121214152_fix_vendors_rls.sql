-- ============================================================================
-- Fix overly permissive RLS policies on vendors table
--
-- Problem: Current policies use complex joins through accounts.tenant_id
-- which can be overly permissive and hard to audit.
--
-- Solution: Use tenant_users table directly for tenant membership checks,
-- consistent with other tables in the system.
-- ============================================================================

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Allow all for authenticated" ON vendors;
DROP POLICY IF EXISTS "vendors_select" ON vendors;
DROP POLICY IF EXISTS "vendors_insert" ON vendors;
DROP POLICY IF EXISTS "vendors_update" ON vendors;
DROP POLICY IF EXISTS "vendors_delete" ON vendors;
DROP POLICY IF EXISTS "Users can view their account vendors" ON vendors;
DROP POLICY IF EXISTS "Users can insert their account vendors" ON vendors;
DROP POLICY IF EXISTS "Users can update their account vendors" ON vendors;
DROP POLICY IF EXISTS "Users can delete their account vendors" ON vendors;
DROP POLICY IF EXISTS "Account members can view their vendors" ON vendors;
DROP POLICY IF EXISTS "Account members can insert vendors" ON vendors;
DROP POLICY IF EXISTS "Account members can update vendors" ON vendors;
DROP POLICY IF EXISTS "Account members can delete vendors" ON vendors;

-- Create tenant-isolated policies using tenant_users table
-- This is consistent with other tables like clients, invoices, orders, products

CREATE POLICY "vendors_tenant_select" ON vendors FOR SELECT
  USING (tenant_id IN (
    SELECT tu.tenant_id FROM tenant_users tu WHERE tu.user_id = auth.uid()
  ));

CREATE POLICY "vendors_tenant_insert" ON vendors FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT tu.tenant_id FROM tenant_users tu WHERE tu.user_id = auth.uid()
  ));

CREATE POLICY "vendors_tenant_update" ON vendors FOR UPDATE
  USING (tenant_id IN (
    SELECT tu.tenant_id FROM tenant_users tu WHERE tu.user_id = auth.uid()
  ));

CREATE POLICY "vendors_tenant_delete" ON vendors FOR DELETE
  USING (tenant_id IN (
    SELECT tu.tenant_id FROM tenant_users tu WHERE tu.user_id = auth.uid()
  ));

-- ============================================================================
-- VERIFICATION QUERIES (Run these after migration to verify)
-- ============================================================================
-- Check policies exist:
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'vendors';
--
-- Expected result:
-- | policyname              | cmd    |
-- |-------------------------|--------|
-- | vendors_tenant_select   | SELECT |
-- | vendors_tenant_insert   | INSERT |
-- | vendors_tenant_update   | UPDATE |
-- | vendors_tenant_delete   | DELETE |
-- ============================================================================
