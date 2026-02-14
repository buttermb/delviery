-- Allow tenant owners/admins to update their own tenant record
CREATE POLICY "Tenant owners can update own tenant"
ON public.tenants
FOR UPDATE
USING (
  id IN (
    SELECT tenant_id FROM public.tenant_users
    WHERE user_id = auth.uid()
    AND status = 'active'
    AND role IN ('owner', 'admin')
  )
)
WITH CHECK (
  id IN (
    SELECT tenant_id FROM public.tenant_users
    WHERE user_id = auth.uid()
    AND status = 'active'
    AND role IN ('owner', 'admin')
  )
);