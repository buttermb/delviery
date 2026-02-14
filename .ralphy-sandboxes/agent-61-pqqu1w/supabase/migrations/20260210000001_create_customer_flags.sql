-- ============================================================================
-- Create customer_flags table for flagging and blocking customers
-- Task: Create customer block/flag system
-- ============================================================================

-- Create customer_flags table
CREATE TABLE IF NOT EXISTS public.customer_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  flag_type TEXT NOT NULL CHECK (flag_type IN ('flagged', 'blocked')),
  flag_reason TEXT NOT NULL CHECK (flag_reason IN ('payment_issues', 'compliance', 'fraud', 'abuse', 'other')),
  reason_details TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution_notes TEXT,

  -- Ensure only one active flag per customer per type
  CONSTRAINT unique_active_flag UNIQUE (customer_id, flag_type, is_active)
    DEFERRABLE INITIALLY DEFERRED
);

-- Create indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_customer_flags_tenant_id ON public.customer_flags(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customer_flags_customer_id ON public.customer_flags(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_flags_is_active ON public.customer_flags(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_customer_flags_flag_type ON public.customer_flags(flag_type);
CREATE INDEX IF NOT EXISTS idx_customer_flags_created_at ON public.customer_flags(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.customer_flags ENABLE ROW LEVEL SECURITY;

-- RLS Policies using tenant_users table (consistent with other tables)

-- SELECT: Allow tenant members to view flags for their tenant
CREATE POLICY "customer_flags_tenant_select" ON public.customer_flags FOR SELECT
  USING (tenant_id IN (
    SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()
  ));

-- INSERT: Only tenant members can create flags for their tenant
CREATE POLICY "customer_flags_tenant_insert" ON public.customer_flags FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()
  ));

-- UPDATE: Only tenant members can update flags for their tenant
CREATE POLICY "customer_flags_tenant_update" ON public.customer_flags FOR UPDATE
  USING (tenant_id IN (
    SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()
  ));

-- DELETE: Only tenant members can delete flags for their tenant
CREATE POLICY "customer_flags_tenant_delete" ON public.customer_flags FOR DELETE
  USING (tenant_id IN (
    SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()
  ));

-- Create activity log entries for flag changes
CREATE OR REPLACE FUNCTION public.log_customer_flag_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_logs (
      user_id,
      tenant_id,
      action,
      resource,
      resource_id,
      metadata
    )
    VALUES (
      NEW.created_by,
      NEW.tenant_id,
      'customer_' || NEW.flag_type,
      'customer_flag',
      NEW.id,
      jsonb_build_object(
        'customer_id', NEW.customer_id,
        'flag_type', NEW.flag_type,
        'flag_reason', NEW.flag_reason,
        'reason_details', NEW.reason_details
      )
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.is_active = true AND NEW.is_active = false THEN
    INSERT INTO public.activity_logs (
      user_id,
      tenant_id,
      action,
      resource,
      resource_id,
      metadata
    )
    VALUES (
      NEW.resolved_by,
      NEW.tenant_id,
      'customer_flag_resolved',
      'customer_flag',
      NEW.id,
      jsonb_build_object(
        'customer_id', NEW.customer_id,
        'flag_type', NEW.flag_type,
        'resolution_notes', NEW.resolution_notes
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger for activity logging
DROP TRIGGER IF EXISTS trigger_log_customer_flag_change ON public.customer_flags;
CREATE TRIGGER trigger_log_customer_flag_change
  AFTER INSERT OR UPDATE ON public.customer_flags
  FOR EACH ROW
  EXECUTE FUNCTION public.log_customer_flag_change();

-- Function to check if customer is blocked (for use in storefront)
CREATE OR REPLACE FUNCTION public.is_customer_blocked(p_customer_id UUID, p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.customer_flags
    WHERE customer_id = p_customer_id
    AND tenant_id = p_tenant_id
    AND flag_type = 'blocked'
    AND is_active = true
  );
END;
$$;

-- Function to get active flags for a customer
CREATE OR REPLACE FUNCTION public.get_customer_flags(p_customer_id UUID, p_tenant_id UUID)
RETURNS TABLE (
  id UUID,
  flag_type TEXT,
  flag_reason TEXT,
  reason_details TEXT,
  created_at TIMESTAMPTZ,
  created_by UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cf.id,
    cf.flag_type,
    cf.flag_reason,
    cf.reason_details,
    cf.created_at,
    cf.created_by
  FROM public.customer_flags cf
  WHERE cf.customer_id = p_customer_id
  AND cf.tenant_id = p_tenant_id
  AND cf.is_active = true
  ORDER BY cf.created_at DESC;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.is_customer_blocked(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_customer_blocked(UUID, UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_customer_flags(UUID, UUID) TO authenticated;

-- Add comments
COMMENT ON TABLE public.customer_flags IS 'Flags and blocks for customers (payment issues, compliance, fraud, abuse)';
COMMENT ON COLUMN public.customer_flags.flag_type IS 'Type of flag: flagged (warning only) or blocked (prevents ordering)';
COMMENT ON COLUMN public.customer_flags.flag_reason IS 'Reason category: payment_issues, compliance, fraud, abuse, other';
COMMENT ON COLUMN public.customer_flags.is_active IS 'Whether the flag is currently active';
COMMENT ON FUNCTION public.is_customer_blocked IS 'Check if a customer is blocked from ordering';
COMMENT ON FUNCTION public.get_customer_flags IS 'Get all active flags for a customer';
