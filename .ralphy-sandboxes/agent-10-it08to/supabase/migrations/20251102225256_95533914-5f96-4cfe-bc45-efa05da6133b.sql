-- Enable RLS on tenants if not already enabled
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own tenant
CREATE POLICY "Users can view own tenant"
  ON public.tenants
  FOR SELECT
  USING (
    id IN (
      SELECT tenant_id 
      FROM tenant_users 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );