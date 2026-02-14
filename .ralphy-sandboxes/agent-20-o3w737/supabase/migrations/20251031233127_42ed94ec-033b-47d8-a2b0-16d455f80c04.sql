-- Create or replace the has_role function (security definer)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create or replace the is_admin_user function
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'::app_role
  )
$$;

-- Add RLS policies for accounts table
CREATE POLICY "Users can view own account"
ON public.accounts
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT account_id 
    FROM public.profiles 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all accounts"
ON public.accounts
FOR SELECT
TO authenticated
USING (is_admin_user());

CREATE POLICY "Admins can manage all accounts"
ON public.accounts
FOR ALL
TO authenticated
USING (is_admin_user())
WITH CHECK (is_admin_user());

-- Add RLS policies for account_settings table
CREATE POLICY "Users can view own account settings"
ON public.account_settings
FOR SELECT
TO authenticated
USING (
  account_id IN (
    SELECT account_id 
    FROM public.profiles 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all account settings"
ON public.account_settings
FOR SELECT
TO authenticated
USING (is_admin_user());

CREATE POLICY "Admins can manage all account settings"
ON public.account_settings
FOR ALL
TO authenticated
USING (is_admin_user())
WITH CHECK (is_admin_user());