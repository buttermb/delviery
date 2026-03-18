-- Fix infinite recursion in tenant_users RLS policies (CORRECTED)

-- Drop all existing problematic policies
DROP POLICY IF EXISTS "Tenant admins can manage their users" ON public.tenant_users;
DROP POLICY IF EXISTS "Users can view own tenant membership" ON public.tenant_users;
DROP POLICY IF EXISTS "Tenant owners can manage their users" ON public.tenant_users;
DROP POLICY IF EXISTS "Tenant admins manage users" ON public.tenant_users;
DROP POLICY IF EXISTS "tenant_isolation_tenant_users" ON public.tenant_users;

-- Drop existing function if any
DROP FUNCTION IF EXISTS public.is_tenant_admin(uuid, uuid);

-- Simple, non-recursive policies

-- Policy 1: Users can see their own tenant memberships
CREATE POLICY "tenant_users_select_own"
    ON public.tenant_users
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Policy 2: Super admins can see all
CREATE POLICY "tenant_users_select_super_admin"
    ON public.tenant_users
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE admin_users.user_id = auth.uid()
            AND admin_users.role = 'super_admin'
            AND admin_users.is_active = true
        )
    );

-- Policy 3: Users can update their own records
CREATE POLICY "tenant_users_update_own"
    ON public.tenant_users
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Policy 4: Super admins can manage all
CREATE POLICY "tenant_users_all_super_admin"
    ON public.tenant_users
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE admin_users.user_id = auth.uid()
            AND admin_users.role = 'super_admin'
            AND admin_users.is_active = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE admin_users.user_id = auth.uid()
            AND admin_users.role = 'super_admin'
            AND admin_users.is_active = true
        )
    );