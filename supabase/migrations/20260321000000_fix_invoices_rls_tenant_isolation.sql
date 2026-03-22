-- ============================================================================
-- Fix invoices RLS policies for proper tenant isolation
--
-- Problem: The current policies from 20260122090000_fix_invoices_rls.sql only
-- check if a user EXISTS in tenant_users — they do NOT check that the invoice's
-- tenant_id matches the user's tenant. This allows any authenticated tenant
-- member to see ALL invoices across tenants.
--
-- The invoices table DOES have a tenant_id column (added in
-- 20251104000000_three_tier_auth_system.sql).
--
-- Fix: Use tenant_id IN (SELECT tu.tenant_id ...) to properly isolate by tenant.
-- ============================================================================

-- Drop existing permissive policies
DROP POLICY IF EXISTS "invoices_tenant_select" ON invoices;
DROP POLICY IF EXISTS "invoices_tenant_insert" ON invoices;
DROP POLICY IF EXISTS "invoices_tenant_update" ON invoices;
DROP POLICY IF EXISTS "invoices_tenant_delete" ON invoices;

-- Ensure RLS is enabled
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- SELECT: Allow authenticated users to view invoices for their tenant(s)
CREATE POLICY "invoices_tenant_select" ON invoices FOR SELECT
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM tenant_users tu WHERE tu.user_id = auth.uid()
    )
  );

-- INSERT: Only admin/owner tenant members can insert invoices for their tenant
CREATE POLICY "invoices_tenant_insert" ON invoices FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tu.tenant_id FROM tenant_users tu
      WHERE tu.user_id = auth.uid() AND tu.role IN ('admin', 'owner')
    )
  );

-- UPDATE: Only admin/owner tenant members can update invoices for their tenant
CREATE POLICY "invoices_tenant_update" ON invoices FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM tenant_users tu
      WHERE tu.user_id = auth.uid() AND tu.role IN ('admin', 'owner')
    )
  );

-- DELETE: Only admin/owner tenant members can delete invoices for their tenant
CREATE POLICY "invoices_tenant_delete" ON invoices FOR DELETE
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM tenant_users tu
      WHERE tu.user_id = auth.uid() AND tu.role IN ('admin', 'owner')
    )
  );
