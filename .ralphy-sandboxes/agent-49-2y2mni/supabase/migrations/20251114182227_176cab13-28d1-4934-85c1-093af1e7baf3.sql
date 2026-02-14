-- Create customer_users table for customer authentication
CREATE TABLE IF NOT EXISTS public.customer_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  date_of_birth DATE,
  is_business_buyer BOOLEAN DEFAULT false,
  business_name TEXT,
  business_license_number TEXT,
  email_verified BOOLEAN DEFAULT false,
  email_verification_token TEXT,
  email_verification_sent_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT customer_users_tenant_email_unique UNIQUE (tenant_id, email)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_customer_users_tenant_id ON public.customer_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customer_users_email ON public.customer_users(email);
CREATE INDEX IF NOT EXISTS idx_customer_users_tenant_email ON public.customer_users(tenant_id, email);

-- Enable RLS
ALTER TABLE public.customer_users ENABLE ROW LEVEL SECURITY;

-- RLS Policies for customer_users
CREATE POLICY "Customers can view own record"
  ON public.customer_users
  FOR SELECT
  USING (id = (current_setting('app.customer_id', true))::uuid);

CREATE POLICY "Customers can update own record"
  ON public.customer_users
  FOR UPDATE
  USING (id = (current_setting('app.customer_id', true))::uuid);

CREATE POLICY "System can insert customer records"
  ON public.customer_users
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Tenant admins can view customers in their tenant"
  ON public.customer_users
  FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
  ));

-- Create updated_at trigger
CREATE TRIGGER update_customer_users_updated_at
  BEFORE UPDATE ON public.customer_users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add comment
COMMENT ON TABLE public.customer_users IS 'Customer authentication and profile data for multi-tenant customer portal';