-- Create PHI access audit trail table (HIPAA compliance requirement)
-- This table logs all access to Protected Health Information

CREATE TABLE IF NOT EXISTS public.phi_access_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('view', 'create', 'update', 'decrypt', 'search')),
  fields_accessed TEXT[], -- Array of field names that were accessed/decrypted
  ip_address TEXT,
  user_agent TEXT,
  session_id TEXT,
  purpose TEXT, -- Reason for access (e.g., 'customer_service', 'prescription_verification')
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_phi_audit_tenant_id ON public.phi_access_audit(tenant_id);
CREATE INDEX IF NOT EXISTS idx_phi_audit_user_id ON public.phi_access_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_phi_audit_customer_id ON public.phi_access_audit(customer_id);
CREATE INDEX IF NOT EXISTS idx_phi_audit_created_at ON public.phi_access_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_phi_audit_action ON public.phi_access_audit(action);

-- Add comments
COMMENT ON TABLE public.phi_access_audit IS 'HIPAA-compliant audit trail for all PHI access';
COMMENT ON COLUMN public.phi_access_audit.action IS 'Type of access: view, create, update, decrypt, search';
COMMENT ON COLUMN public.phi_access_audit.fields_accessed IS 'Array of PHI field names that were accessed';
COMMENT ON COLUMN public.phi_access_audit.purpose IS 'Business justification for PHI access';

-- Enable RLS
ALTER TABLE public.phi_access_audit ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Tenant isolation
CREATE POLICY "Tenant isolation for PHI audit"
  ON public.phi_access_audit
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
    )
    OR
    has_role(auth.uid(), 'super_admin')
  );

-- RLS Policy: Only system can insert audit logs
CREATE POLICY "System can insert PHI audit logs"
  ON public.phi_access_audit
  FOR INSERT
  WITH CHECK (true); -- Allow inserts from authenticated contexts

-- RLS Policy: No updates or deletes (immutable audit trail)
CREATE POLICY "PHI audit logs are immutable"
  ON public.phi_access_audit
  FOR UPDATE
  USING (false);

CREATE POLICY "PHI audit logs cannot be deleted"
  ON public.phi_access_audit
  FOR DELETE
  USING (false);

-- Function to log PHI access
CREATE OR REPLACE FUNCTION public.log_phi_access(
  p_customer_id UUID,
  p_action TEXT,
  p_fields_accessed TEXT[],
  p_purpose TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_audit_id UUID;
BEGIN
  -- Get tenant_id from customer
  SELECT tenant_id INTO v_tenant_id
  FROM public.customers
  WHERE id = p_customer_id;

  -- Insert audit log
  INSERT INTO public.phi_access_audit (
    tenant_id,
    user_id,
    customer_id,
    action,
    fields_accessed,
    ip_address,
    user_agent,
    purpose
  ) VALUES (
    v_tenant_id,
    auth.uid(),
    p_customer_id,
    p_action,
    p_fields_accessed,
    current_setting('request.headers', true)::json->>'x-real-ip',
    current_setting('request.headers', true)::json->>'user-agent',
    p_purpose
  )
  RETURNING id INTO v_audit_id;

  RETURN v_audit_id;
END;
$$;

COMMENT ON FUNCTION public.log_phi_access IS 'HIPAA-compliant function to log all PHI access';