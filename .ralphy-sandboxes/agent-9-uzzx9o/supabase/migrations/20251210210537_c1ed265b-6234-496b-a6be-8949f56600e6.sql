-- Fix tenant_users RLS: Remove overly permissive public policy
DROP POLICY IF EXISTS "Service role can manage tenant users" ON public.tenant_users;

-- Add policy for users to view same-tenant members
CREATE POLICY "Users can view same tenant members"
ON public.tenant_users
FOR SELECT
TO authenticated
USING (
  tenant_id IN (
    SELECT tu.tenant_id 
    FROM public.tenant_users tu 
    WHERE tu.user_id = auth.uid()
  )
);

-- Add policy for tenant admins/owners to manage team members
CREATE POLICY "Admins can manage tenant users"
ON public.tenant_users
FOR ALL
TO authenticated
USING (
  tenant_id IN (
    SELECT tu.tenant_id 
    FROM public.tenant_users tu 
    WHERE tu.user_id = auth.uid() 
    AND tu.role IN ('owner', 'admin')
  )
)
WITH CHECK (
  tenant_id IN (
    SELECT tu.tenant_id 
    FROM public.tenant_users tu 
    WHERE tu.user_id = auth.uid() 
    AND tu.role IN ('owner', 'admin')
  )
);