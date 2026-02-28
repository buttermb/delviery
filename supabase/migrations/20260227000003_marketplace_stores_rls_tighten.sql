-- Tighten RLS policies on marketplace_stores
-- Before: "Tenant members can manage their store" used FOR ALL, letting any tenant member
-- (including 'member' and 'viewer' roles) INSERT/UPDATE/DELETE stores.
-- After: Split into separate SELECT (all tenant members) and INSERT/UPDATE/DELETE (owner/admin only).
-- The public SELECT policy ("Public can view active public stores") is unchanged.

-- Drop the overly permissive ALL policy
DROP POLICY IF EXISTS "Tenant members can manage their store" ON public.marketplace_stores;

-- Tenant members can READ their own tenant's stores (any status, any role)
CREATE POLICY "Tenant members can view their stores"
  ON public.marketplace_stores FOR SELECT
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
  );

-- Only tenant owners/admins can INSERT stores
CREATE POLICY "Tenant admins can insert stores"
  ON public.marketplace_stores FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
        AND tu.role IN ('owner', 'admin')
    )
  );

-- Only tenant owners/admins can UPDATE stores
CREATE POLICY "Tenant admins can update stores"
  ON public.marketplace_stores FOR UPDATE
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

-- Only tenant owners/admins can DELETE stores
CREATE POLICY "Tenant admins can delete stores"
  ON public.marketplace_stores FOR DELETE
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
        AND tu.role IN ('owner', 'admin')
    )
  );
