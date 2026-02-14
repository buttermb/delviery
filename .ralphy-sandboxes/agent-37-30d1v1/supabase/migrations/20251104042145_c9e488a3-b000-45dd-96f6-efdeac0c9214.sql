-- Drop the existing policy that only allows anon users
DROP POLICY IF EXISTS "Public can view active tenants for login" ON public.tenants;

-- Create new policy that allows both anon and authenticated users to view active tenants
-- This allows anyone to verify a tenant exists on login pages
CREATE POLICY "Anyone can view active tenants for login"
  ON public.tenants FOR SELECT
  USING (status = 'active');