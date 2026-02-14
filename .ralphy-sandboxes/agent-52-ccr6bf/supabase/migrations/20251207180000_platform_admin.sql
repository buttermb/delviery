-- Create platform_admins table
CREATE TABLE IF NOT EXISTS public.platform_admins (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    email TEXT NOT NULL,
    role TEXT DEFAULT 'super_admin',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint on user_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_admins_user ON public.platform_admins(user_id);

-- Enable RLS
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

-- Policy: Only platform admins can view this table (recursive check, but simplified for now)
-- Actually, we need a function to check admin status without infinite recursion.
-- We'll use a security definer function.

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.platform_admins
    WHERE user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql;

-- Now policy using the function
CREATE POLICY "Admins can view admin table"
ON public.platform_admins
FOR SELECT
USING (public.is_platform_admin());

-- Function to check permission (exposed to API)
CREATE OR REPLACE FUNCTION public.check_platform_admin_access()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF public.is_platform_admin() THEN
    RETURN jsonb_build_object('access', true, 'role', 'super_admin');
  ELSE
    RETURN jsonb_build_object('access', false);
  END IF;
END;
$$;

-- Insert the current user as an admin (for development)
-- You (the developer) likely want to be the first admin.
-- We can't know your UUID easily here without a query, but we can insert based on email if we knew it.
-- For now, we will create the table. The user will have to manually insert themselves or we provide a script.
