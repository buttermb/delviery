-- Remove the recursive policy causing infinite loop
DROP POLICY IF EXISTS "Tenant owners and admins can manage their users" ON public.tenant_users;
DROP POLICY IF EXISTS "Super admins can manage all tenant users" ON public.tenant_users;

-- The other policies from my previous migration are good and non-recursive:
-- tenant_users_select_own (users see their own records)
-- tenant_users_select_super_admin (super admins see all)
-- tenant_users_update_own (users update own)
-- tenant_users_all_super_admin (super admins manage all)