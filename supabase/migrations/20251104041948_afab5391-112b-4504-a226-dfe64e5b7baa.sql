-- Allow unauthenticated users to view tenant information on login pages
-- This is needed so login pages can verify the tenant exists before authentication
CREATE POLICY "Public can view active tenants for login"
  ON public.tenants FOR SELECT
  TO anon
  USING (status = 'active');