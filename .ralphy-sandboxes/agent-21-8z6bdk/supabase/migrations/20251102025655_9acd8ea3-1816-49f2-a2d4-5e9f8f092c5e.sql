-- ============================================================================
-- FIX INFINITE RECURSION IN tenant_users RLS POLICY (FIXED VERSION)
-- ============================================================================

-- Drop existing recursive policies
DROP POLICY IF EXISTS "Tenant owners can manage their users" ON public.tenant_users;
DROP POLICY IF EXISTS "Tenant admins manage users" ON public.tenant_users;
DROP POLICY IF EXISTS "tenant_isolation_tenant_users" ON public.tenant_users;
DROP POLICY IF EXISTS "Tenant admins can manage their users" ON public.tenant_users;
DROP POLICY IF EXISTS "Users can view own tenant membership" ON public.tenant_users;

-- Create security definer function to check tenant admin role
CREATE OR REPLACE FUNCTION public.is_tenant_admin(
    user_id uuid,
    tenant_id_param uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM public.tenant_users
        WHERE tenant_users.user_id = is_tenant_admin.user_id
        AND tenant_users.tenant_id = is_tenant_admin.tenant_id_param
        AND tenant_users.role IN ('owner', 'admin')
        AND tenant_users.status = 'active'
    );
END;
$$;

-- Create new policy using the function (breaks recursion)
CREATE POLICY "Tenant admins can manage their users"
    ON public.tenant_users
    FOR ALL
    TO authenticated
    USING (
        user_id = auth.uid()
        OR
        is_tenant_admin(auth.uid(), tenant_id)
        OR
        EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE admin_users.user_id = auth.uid()
            AND admin_users.role = 'super_admin'
            AND admin_users.is_active = true
        )
    )
    WITH CHECK (
        user_id = auth.uid()
        OR
        is_tenant_admin(auth.uid(), tenant_id)
        OR
        EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE admin_users.user_id = auth.uid()
            AND admin_users.role = 'super_admin'
            AND admin_users.is_active = true
        )
    );

-- Users can view their own tenant membership
CREATE POLICY "Users can view own tenant membership"
    ON public.tenant_users
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());