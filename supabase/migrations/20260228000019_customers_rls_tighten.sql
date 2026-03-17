-- ============================================================================
-- Tighten RLS on customers table
--
-- After:
--   - SELECT: Only owner/admin roles
--   - INSERT: Only owner/admin roles (edge functions bypass via service_role)
--   - UPDATE: Only owner/admin roles
--   - DELETE: Only owner/admin roles
--
-- Note: customers table uses account_id, not tenant_id.
-- Policies check user role via tenant_users (same pattern as existing policies).
-- ============================================================================

-- Drop existing permissive policies
DROP POLICY IF EXISTS "customers_tenant_select" ON public.customers;
DROP POLICY IF EXISTS "customers_tenant_insert" ON public.customers;
DROP POLICY IF EXISTS "customers_tenant_update" ON public.customers;
DROP POLICY IF EXISTS "customers_tenant_delete" ON public.customers;

-- Ensure RLS is enabled
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- SELECT: Only tenant owners/admins can view customers
CREATE POLICY "customers_admin_select"
  ON public.customers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
        AND tu.role IN ('owner', 'admin')
    )
  );

-- INSERT: Only tenant owners/admins can directly insert customers
CREATE POLICY "customers_admin_insert"
  ON public.customers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
        AND tu.role IN ('owner', 'admin')
    )
  );

-- UPDATE: Only tenant owners/admins can update customers
CREATE POLICY "customers_admin_update"
  ON public.customers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
        AND tu.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
        AND tu.role IN ('owner', 'admin')
    )
  );

-- DELETE: Only tenant owners/admins can delete customers
CREATE POLICY "customers_admin_delete"
  ON public.customers FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
        AND tu.role IN ('owner', 'admin')
    )
  );
