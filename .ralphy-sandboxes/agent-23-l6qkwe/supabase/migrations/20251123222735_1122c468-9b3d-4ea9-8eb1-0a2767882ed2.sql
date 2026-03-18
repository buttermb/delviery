-- Update is_tenant_owner to use user_roles table
CREATE OR REPLACE FUNCTION public.is_tenant_owner(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_users tu
    JOIN public.user_roles ur
      ON ur.user_id = tu.user_id
    WHERE tu.user_id = auth.uid()
      AND tu.tenant_id = p_tenant_id
      AND tu.status = 'active'
      AND ur.role = 'owner'::app_role
  );
$$;

-- Create helper function to check if user can manage tenant accounts
CREATE OR REPLACE FUNCTION public.can_manage_tenant_accounts(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_users tu
    JOIN public.user_roles ur
      ON ur.user_id = tu.user_id
    WHERE tu.user_id = auth.uid()
      AND tu.tenant_id = p_tenant_id
      AND tu.status = 'active'
      AND ur.role IN ('owner'::app_role, 'admin'::app_role)
  );
$$;

-- Drop old policies
DROP POLICY IF EXISTS "Admins and owners can manage accounts" ON public.accounts;
DROP POLICY IF EXISTS "Tenant owners can create own account" ON public.accounts;

-- Create new policies using the updated helper functions
CREATE POLICY "Admins and owners can manage accounts"
ON public.accounts
FOR ALL
TO authenticated
USING (
  is_admin_user()
  OR can_manage_tenant_accounts(tenant_id)
)
WITH CHECK (
  is_admin_user()
  OR can_manage_tenant_accounts(tenant_id)
);

CREATE POLICY "Tenant managers can create account"
ON public.accounts
FOR INSERT
TO authenticated
WITH CHECK (
  can_manage_tenant_accounts(tenant_id)
);