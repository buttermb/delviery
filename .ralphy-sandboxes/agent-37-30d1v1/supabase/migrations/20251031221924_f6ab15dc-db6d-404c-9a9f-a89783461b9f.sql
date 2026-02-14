-- Create admin bypass function for RLS policies
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  );
END;
$$;

-- Update RLS policies on key tables to allow admin bypass
-- Orders table
DROP POLICY IF EXISTS "Admin can view all orders" ON public.orders;
CREATE POLICY "Admin can view all orders"
ON public.orders
FOR SELECT
TO authenticated
USING (is_admin_user() OR user_id = auth.uid());

DROP POLICY IF EXISTS "Admin can update all orders" ON public.orders;
CREATE POLICY "Admin can update all orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (is_admin_user() OR user_id = auth.uid());

-- Profiles table
DROP POLICY IF EXISTS "Admin can view all profiles" ON public.profiles;
CREATE POLICY "Admin can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (is_admin_user() OR user_id = auth.uid());

DROP POLICY IF EXISTS "Admin can update all profiles" ON public.profiles;
CREATE POLICY "Admin can update all profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (is_admin_user() OR user_id = auth.uid());

-- Couriers table
DROP POLICY IF EXISTS "Admin can view all couriers" ON public.couriers;
CREATE POLICY "Admin can view all couriers"
ON public.couriers
FOR SELECT
TO authenticated
USING (is_admin_user());

DROP POLICY IF EXISTS "Admin can update all couriers" ON public.couriers;
CREATE POLICY "Admin can update all couriers"
ON public.couriers
FOR UPDATE
TO authenticated
USING (is_admin_user());

-- Admin users table
DROP POLICY IF EXISTS "Admin users can view other admins" ON public.admin_users;
CREATE POLICY "Admin users can view other admins"
ON public.admin_users
FOR SELECT
TO authenticated
USING (is_admin_user());

-- Audit logs
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (is_admin_user());