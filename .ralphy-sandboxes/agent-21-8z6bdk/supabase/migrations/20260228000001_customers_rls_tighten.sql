-- ============================================================================
-- Tighten RLS on customers table
--
-- Before: Any tenant member (including 'member' and 'viewer' roles) could
--   SELECT/INSERT/UPDATE/DELETE customers for their tenant.
--
-- After:
--   - SELECT: Only owner/admin roles for their tenant's customers
--   - INSERT: Only owner/admin roles (edge functions bypass via service_role)
--   - UPDATE: Only owner/admin roles for their tenant's customers
--   - DELETE: Only owner/admin roles for their tenant's customers
--
-- Edge functions (storefront-checkout, menu-order-place, etc.) run as
-- service_role which bypasses RLS entirely, so they can still create
-- customers for any tenant.
--
-- SECURITY DEFINER functions (create_pos_transaction_atomic, etc.) also
-- bypass RLS, so loyalty point updates continue to work.
-- ============================================================================

-- Drop existing permissive policies
DROP POLICY IF EXISTS "customers_tenant_select" ON public.customers;
DROP POLICY IF EXISTS "customers_tenant_insert" ON public.customers;
DROP POLICY IF EXISTS "customers_tenant_update" ON public.customers;
DROP POLICY IF EXISTS "customers_tenant_delete" ON public.customers;

-- Ensure RLS is enabled
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SELECT: Only tenant owners/admins can view customers
-- ============================================================================
CREATE POLICY "customers_admin_select"
  ON public.customers FOR SELECT
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
        AND tu.role IN ('owner', 'admin')
    )
  );

-- ============================================================================
-- INSERT: Only tenant owners/admins can directly insert customers
-- Edge functions use service_role and bypass RLS entirely.
-- ============================================================================
CREATE POLICY "customers_admin_insert"
  ON public.customers FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
        AND tu.role IN ('owner', 'admin')
    )
  );

-- ============================================================================
-- UPDATE: Only tenant owners/admins can update customers
-- ============================================================================
CREATE POLICY "customers_admin_update"
  ON public.customers FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
        AND tu.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
        AND tu.role IN ('owner', 'admin')
    )
  );

-- ============================================================================
-- DELETE: Only tenant owners/admins can delete customers
-- ============================================================================
CREATE POLICY "customers_admin_delete"
  ON public.customers FOR DELETE
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
        AND tu.role IN ('owner', 'admin')
    )
  );

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Check policies exist:
--   SELECT policyname, cmd FROM pg_policies WHERE tablename = 'customers';
--
-- Expected:
--   | policyname              | cmd    |
--   |-------------------------|--------|
--   | customers_admin_select  | SELECT |
--   | customers_admin_insert  | INSERT |
--   | customers_admin_update  | UPDATE |
--   | customers_admin_delete  | DELETE |
-- ============================================================================
