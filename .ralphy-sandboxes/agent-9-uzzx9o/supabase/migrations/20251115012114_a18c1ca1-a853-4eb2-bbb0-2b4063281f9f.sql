-- Add current user to admin_users table
INSERT INTO public.admin_users (user_id, email, full_name, role, is_active)
VALUES (
  '39ae3d71-783a-4602-86df-c32681384eda',
  'alex1@gmail.com',
  'Alex',
  'super_admin',
  true
)
ON CONFLICT (user_id) DO UPDATE SET
  role = 'super_admin',
  is_active = true,
  updated_at = now();

-- Ensure forum_user_approvals has correct RLS policy
DROP POLICY IF EXISTS "Super admins can manage forum approvals" ON public.forum_user_approvals;

CREATE POLICY "Super admins can manage forum approvals"
ON public.forum_user_approvals
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE admin_users.user_id = auth.uid()
    AND admin_users.is_active = true
    AND admin_users.role = 'super_admin'
  )
);

-- Ensure admin_users RLS allows super admins to view other admins
DROP POLICY IF EXISTS "Super admins can view all admin users" ON public.admin_users;

CREATE POLICY "Super admins can view all admin users"
ON public.admin_users
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE au.user_id = auth.uid()
    AND au.is_active = true
    AND au.role = 'super_admin'
  )
);

DROP POLICY IF EXISTS "Super admins can manage admin users" ON public.admin_users;

CREATE POLICY "Super admins can manage admin users"
ON public.admin_users
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE au.user_id = auth.uid()
    AND au.is_active = true
    AND au.role = 'super_admin'
  )
);