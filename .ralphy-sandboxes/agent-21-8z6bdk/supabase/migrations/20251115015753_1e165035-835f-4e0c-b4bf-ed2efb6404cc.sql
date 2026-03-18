-- Create security definer function to check super admin status without triggering RLS
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE user_id = auth.uid()
      AND role = 'super_admin'
      AND is_active = true
  )
$$;

-- Drop all existing problematic RLS policies on admin_users
DROP POLICY IF EXISTS "Admin users can view other admins" ON public.admin_users;
DROP POLICY IF EXISTS "Admins can view all admin users" ON public.admin_users;
DROP POLICY IF EXISTS "Super admins can manage admin users" ON public.admin_users;
DROP POLICY IF EXISTS "Super admins can view all admin users" ON public.admin_users;
DROP POLICY IF EXISTS "Users can view own admin record" ON public.admin_users;

-- Create new simple policies using SECURITY DEFINER function
CREATE POLICY "Super admins have full access"
ON public.admin_users
FOR ALL
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

CREATE POLICY "Users can view their own admin record"
ON public.admin_users
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Fix forum_user_approvals RLS policy
DROP POLICY IF EXISTS "Super admins can manage all approvals" ON public.forum_user_approvals;

CREATE POLICY "Super admins can manage all approvals"
ON public.forum_user_approvals
FOR ALL
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());