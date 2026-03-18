-- Create tenant_invitations table
CREATE TABLE IF NOT EXISTS public.tenant_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'manager', 'staff', 'viewer')),
  token VARCHAR(500) NOT NULL UNIQUE,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'cancelled', 'expired')),
  invited_by UUID REFERENCES auth.users(id),
  accepted_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tenant_invitations_tenant_id ON public.tenant_invitations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_invitations_email ON public.tenant_invitations(email);
CREATE INDEX IF NOT EXISTS idx_tenant_invitations_token ON public.tenant_invitations(token);
CREATE INDEX IF NOT EXISTS idx_tenant_invitations_status ON public.tenant_invitations(status);

-- Enable RLS
ALTER TABLE public.tenant_invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Tenant members can view invitations for their tenant
CREATE POLICY "Tenant members can view invitations" ON public.tenant_invitations
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users 
      WHERE user_id = auth.uid()
    )
  );

-- Tenant admins can create invitations
CREATE POLICY "Tenant admins can create invitations" ON public.tenant_invitations
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users 
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- Tenant admins can update invitations (cancel)
CREATE POLICY "Tenant admins can update invitations" ON public.tenant_invitations
  FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users 
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- Anyone can view invitation by token (for accepting)
CREATE POLICY "Anyone can view invitation by token" ON public.tenant_invitations
  FOR SELECT
  USING (true);

-- Updated at trigger
CREATE TRIGGER update_tenant_invitations_updated_at
  BEFORE UPDATE ON public.tenant_invitations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();