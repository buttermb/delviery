-- Enable RLS on tenant_users if not already enabled
ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own tenant_users record
CREATE POLICY "Users can view own tenant user record"
  ON public.tenant_users
  FOR SELECT
  USING (auth.uid() = user_id);

-- Allow service role to manage tenant_users
CREATE POLICY "Service role can manage tenant users"
  ON public.tenant_users
  FOR ALL
  USING (true)
  WITH CHECK (true);