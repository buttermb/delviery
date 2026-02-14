-- ============================================================================
-- Fix overly permissive RLS policies on pos_transactions table
--
-- Problem: Current policies have inconsistent naming and may be using different
-- patterns (is_tenant_member function vs direct tenant_users subquery). Some
-- policies from older migrations may still exist. Missing DELETE policy in
-- the most recent migration.
--
-- Solution: Use tenant_users table directly for tenant membership checks,
-- consistent with vendors, products, orders, customers, and invoices tables.
-- ============================================================================

-- Drop all existing policies that may exist from various migrations
DROP POLICY IF EXISTS "Users can insert transactions" ON pos_transactions;
DROP POLICY IF EXISTS "Users can create transactions" ON pos_transactions;
DROP POLICY IF EXISTS "Users can view transactions" ON pos_transactions;
DROP POLICY IF EXISTS "Users can select transactions" ON pos_transactions;
DROP POLICY IF EXISTS "Users can update transactions" ON pos_transactions;
DROP POLICY IF EXISTS "Users can delete transactions" ON pos_transactions;
DROP POLICY IF EXISTS "Tenant members can create transactions" ON pos_transactions;
DROP POLICY IF EXISTS "Tenant members can view transactions" ON pos_transactions;
DROP POLICY IF EXISTS "Tenant members can update transactions" ON pos_transactions;
DROP POLICY IF EXISTS "Tenant members can delete transactions" ON pos_transactions;
DROP POLICY IF EXISTS "Tenant members can insert POS transactions" ON pos_transactions;
DROP POLICY IF EXISTS "Tenant members can view POS transactions" ON pos_transactions;
DROP POLICY IF EXISTS "Tenant members can update POS transactions" ON pos_transactions;
DROP POLICY IF EXISTS "Tenant members can delete POS transactions" ON pos_transactions;
DROP POLICY IF EXISTS "Tenant admins can insert their POS transactions" ON pos_transactions;
DROP POLICY IF EXISTS "pos_transactions_tenant_select" ON pos_transactions;
DROP POLICY IF EXISTS "pos_transactions_tenant_insert" ON pos_transactions;
DROP POLICY IF EXISTS "pos_transactions_tenant_update" ON pos_transactions;
DROP POLICY IF EXISTS "pos_transactions_tenant_delete" ON pos_transactions;

-- Ensure RLS is enabled
ALTER TABLE pos_transactions ENABLE ROW LEVEL SECURITY;

-- Create tenant-isolated policies using tenant_users table
-- This is consistent with vendors, products, orders, customers, and invoices tables

-- SELECT: Allow authenticated users who belong to the tenant
CREATE POLICY "pos_transactions_tenant_select" ON pos_transactions FOR SELECT
  USING (tenant_id IN (
    SELECT tu.tenant_id FROM tenant_users tu WHERE tu.user_id = auth.uid()
  ));

-- INSERT: Only tenant members can insert transactions for their tenant
CREATE POLICY "pos_transactions_tenant_insert" ON pos_transactions FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT tu.tenant_id FROM tenant_users tu WHERE tu.user_id = auth.uid()
  ));

-- UPDATE: Only tenant members can update transactions for their tenant
CREATE POLICY "pos_transactions_tenant_update" ON pos_transactions FOR UPDATE
  USING (tenant_id IN (
    SELECT tu.tenant_id FROM tenant_users tu WHERE tu.user_id = auth.uid()
  ));

-- DELETE: Only tenant members can delete transactions for their tenant
CREATE POLICY "pos_transactions_tenant_delete" ON pos_transactions FOR DELETE
  USING (tenant_id IN (
    SELECT tu.tenant_id FROM tenant_users tu WHERE tu.user_id = auth.uid()
  ));

-- ============================================================================
-- VERIFICATION QUERIES (Run these after migration to verify)
-- ============================================================================
-- Check policies exist:
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'pos_transactions';
--
-- Expected result:
-- | policyname                       | cmd    |
-- |----------------------------------|--------|
-- | pos_transactions_tenant_select   | SELECT |
-- | pos_transactions_tenant_insert   | INSERT |
-- | pos_transactions_tenant_update   | UPDATE |
-- | pos_transactions_tenant_delete   | DELETE |
-- ============================================================================
