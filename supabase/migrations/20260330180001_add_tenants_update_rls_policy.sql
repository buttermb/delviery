-- Add UPDATE RLS policy for tenants table
-- Allows tenant owners to update their own tenant record
-- Previously only SELECT was permitted, causing 400 errors on PATCH requests

CREATE POLICY tenants_update_own ON public.tenants
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = tenants.id
        AND tu.user_id = auth.uid()
        AND tu.role = 'owner'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = tenants.id
        AND tu.user_id = auth.uid()
        AND tu.role = 'owner'
    )
  );
