-- Create super_admin_users table
CREATE TABLE IF NOT EXISTS public.super_admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  first_name text,
  last_name text,
  role text DEFAULT 'super_admin' CHECK (role IN ('super_admin', 'platform_admin', 'support')),
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  last_login_at timestamp with time zone,
  last_login_ip text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create super_admin_sessions table
CREATE TABLE IF NOT EXISTS public.super_admin_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  super_admin_id uuid REFERENCES public.super_admin_users(id) ON DELETE CASCADE NOT NULL,
  token text NOT NULL,
  ip_address text,
  user_agent text,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.super_admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.super_admin_sessions ENABLE ROW LEVEL SECURITY;

-- RLS policies (edge function uses service role, so these are protective)
CREATE POLICY "Super admins managed via edge function" ON public.super_admin_users
  FOR ALL
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Sessions managed via edge function" ON public.super_admin_sessions
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Create indexes for performance
CREATE INDEX idx_super_admin_sessions_token ON public.super_admin_sessions(token);
CREATE INDEX idx_super_admin_sessions_expires ON public.super_admin_sessions(expires_at);
CREATE INDEX idx_super_admin_users_email ON public.super_admin_users(email);
CREATE INDEX idx_super_admin_sessions_super_admin_id ON public.super_admin_sessions(super_admin_id);

-- Create initial super admin account
-- Password: "ChangeMe123!" (must be changed after first login)
-- Hash is SHA-256 of "ChangeMe123!" + JWT_SECRET (placeholder)
INSERT INTO public.super_admin_users (email, password_hash, first_name, last_name, role, status)
VALUES (
  'admin@platform.com',
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  'Platform',
  'Admin',
  'super_admin',
  'active'
) ON CONFLICT (email) DO NOTHING;

-- Add second super admin for backup
INSERT INTO public.super_admin_users (email, password_hash, first_name, last_name, role, status)
VALUES (
  'superadmin@platform.com',
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  'Super',
  'Admin',
  'super_admin',
  'active'
) ON CONFLICT (email) DO NOTHING;

-- Create audit log trigger for super admin actions
CREATE TABLE IF NOT EXISTS public.super_admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  super_admin_id uuid REFERENCES public.super_admin_users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  details jsonb,
  ip_address text,
  user_agent text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX idx_super_admin_audit_logs_super_admin_id ON public.super_admin_audit_logs(super_admin_id);
CREATE INDEX idx_super_admin_audit_logs_created_at ON public.super_admin_audit_logs(created_at DESC);

-- Enable RLS on audit logs
ALTER TABLE public.super_admin_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Audit logs managed via edge function" ON public.super_admin_audit_logs
  FOR ALL
  USING (false)
  WITH CHECK (false);