-- Migration: Create delivery_compliance_checks table
-- For cannabis delivery compliance enforcement including age verification,
-- ID checks, zone validation, time restrictions, and quantity limits

-- Create compliance check type enum
DO $$ BEGIN
  CREATE TYPE compliance_check_type AS ENUM (
    'age_verification',
    'id_on_file',
    'licensed_zone',
    'time_restriction',
    'quantity_limit',
    'customer_status'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create compliance check status enum
DO $$ BEGIN
  CREATE TYPE compliance_check_status AS ENUM (
    'pending',
    'passed',
    'failed',
    'skipped',
    'override'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create delivery_compliance_checks table
CREATE TABLE IF NOT EXISTS public.delivery_compliance_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  delivery_id UUID,
  order_id UUID NOT NULL,
  customer_id UUID,
  courier_id UUID,

  -- Check details
  check_type compliance_check_type NOT NULL,
  status compliance_check_status NOT NULL DEFAULT 'pending',

  -- Verification data
  verified_by UUID,
  verified_at TIMESTAMPTZ,
  verification_method TEXT, -- 'manual', 'system', 'override'
  verification_notes TEXT,

  -- Check-specific data (JSON for flexibility)
  check_data JSONB DEFAULT '{}',
  -- Examples:
  -- age_verification: {"customer_age": 25, "minimum_age": 21, "id_type": "drivers_license", "id_expiry": "2025-12-31"}
  -- licensed_zone: {"zone_id": "uuid", "zone_name": "Downtown", "customer_lat": 40.7128, "customer_lng": -74.0060}
  -- time_restriction: {"delivery_time": "14:30", "allowed_start": "09:00", "allowed_end": "21:00"}
  -- quantity_limit: {"product_quantities": {...}, "total_thc_mg": 1000, "max_allowed_mg": 2800}

  -- Override tracking
  override_reason TEXT,
  overridden_by UUID,
  overridden_at TIMESTAMPTZ,

  -- Result
  failure_reason TEXT,
  blocks_delivery BOOLEAN NOT NULL DEFAULT false,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create audit log table for compliance
CREATE TABLE IF NOT EXISTS public.delivery_compliance_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  compliance_check_id UUID REFERENCES delivery_compliance_checks(id) ON DELETE CASCADE,
  delivery_id UUID,
  order_id UUID,

  action TEXT NOT NULL, -- 'check_created', 'check_passed', 'check_failed', 'override_applied', 'delivery_blocked', 'delivery_allowed'
  actor_id UUID,
  actor_type TEXT, -- 'system', 'courier', 'admin'

  details JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_compliance_checks_tenant_id
  ON public.delivery_compliance_checks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_compliance_checks_delivery_id
  ON public.delivery_compliance_checks(delivery_id);
CREATE INDEX IF NOT EXISTS idx_compliance_checks_order_id
  ON public.delivery_compliance_checks(order_id);
CREATE INDEX IF NOT EXISTS idx_compliance_checks_customer_id
  ON public.delivery_compliance_checks(customer_id);
CREATE INDEX IF NOT EXISTS idx_compliance_checks_status
  ON public.delivery_compliance_checks(status);
CREATE INDEX IF NOT EXISTS idx_compliance_checks_check_type
  ON public.delivery_compliance_checks(check_type);
CREATE INDEX IF NOT EXISTS idx_compliance_checks_blocks_delivery
  ON public.delivery_compliance_checks(blocks_delivery) WHERE blocks_delivery = true;
CREATE INDEX IF NOT EXISTS idx_compliance_checks_created_at
  ON public.delivery_compliance_checks(created_at);

CREATE INDEX IF NOT EXISTS idx_compliance_audit_tenant_id
  ON public.delivery_compliance_audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_compliance_audit_compliance_check_id
  ON public.delivery_compliance_audit_log(compliance_check_id);
CREATE INDEX IF NOT EXISTS idx_compliance_audit_delivery_id
  ON public.delivery_compliance_audit_log(delivery_id);
CREATE INDEX IF NOT EXISTS idx_compliance_audit_order_id
  ON public.delivery_compliance_audit_log(order_id);
CREATE INDEX IF NOT EXISTS idx_compliance_audit_action
  ON public.delivery_compliance_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_compliance_audit_created_at
  ON public.delivery_compliance_audit_log(created_at);

-- Enable RLS
ALTER TABLE public.delivery_compliance_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_compliance_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for delivery_compliance_checks

-- Policy: Tenants can view their own compliance checks
CREATE POLICY "Tenants can view own compliance checks"
ON public.delivery_compliance_checks
FOR SELECT
USING (
  tenant_id IN (
    SELECT tu.tenant_id FROM tenant_users tu WHERE tu.user_id = auth.uid()
  )
);

-- Policy: Tenants can insert compliance checks for their tenant
CREATE POLICY "Tenants can insert compliance checks"
ON public.delivery_compliance_checks
FOR INSERT
WITH CHECK (
  tenant_id IN (
    SELECT tu.tenant_id FROM tenant_users tu WHERE tu.user_id = auth.uid()
  )
);

-- Policy: Tenants can update their own compliance checks
CREATE POLICY "Tenants can update own compliance checks"
ON public.delivery_compliance_checks
FOR UPDATE
USING (
  tenant_id IN (
    SELECT tu.tenant_id FROM tenant_users tu WHERE tu.user_id = auth.uid()
  )
);

-- RLS Policies for delivery_compliance_audit_log

-- Policy: Tenants can view their own audit logs
CREATE POLICY "Tenants can view own compliance audit logs"
ON public.delivery_compliance_audit_log
FOR SELECT
USING (
  tenant_id IN (
    SELECT tu.tenant_id FROM tenant_users tu WHERE tu.user_id = auth.uid()
  )
);

-- Policy: Tenants can insert audit logs for their tenant
CREATE POLICY "Tenants can insert compliance audit logs"
ON public.delivery_compliance_audit_log
FOR INSERT
WITH CHECK (
  tenant_id IN (
    SELECT tu.tenant_id FROM tenant_users tu WHERE tu.user_id = auth.uid()
  )
);

-- Function to automatically log compliance check status changes
CREATE OR REPLACE FUNCTION public.log_compliance_check_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Log status changes
  IF TG_OP = 'INSERT' THEN
    INSERT INTO delivery_compliance_audit_log (
      tenant_id,
      compliance_check_id,
      delivery_id,
      order_id,
      action,
      actor_id,
      actor_type,
      details
    ) VALUES (
      NEW.tenant_id,
      NEW.id,
      NEW.delivery_id,
      NEW.order_id,
      'check_created',
      auth.uid(),
      CASE WHEN NEW.verification_method = 'system' THEN 'system' ELSE 'courier' END,
      jsonb_build_object(
        'check_type', NEW.check_type,
        'status', NEW.status,
        'check_data', NEW.check_data
      )
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    INSERT INTO delivery_compliance_audit_log (
      tenant_id,
      compliance_check_id,
      delivery_id,
      order_id,
      action,
      actor_id,
      actor_type,
      details
    ) VALUES (
      NEW.tenant_id,
      NEW.id,
      NEW.delivery_id,
      NEW.order_id,
      CASE
        WHEN NEW.status = 'passed' THEN 'check_passed'
        WHEN NEW.status = 'failed' THEN 'check_failed'
        WHEN NEW.status = 'override' THEN 'override_applied'
        ELSE 'status_changed'
      END,
      COALESCE(NEW.verified_by, auth.uid()),
      CASE
        WHEN NEW.verification_method = 'system' THEN 'system'
        WHEN NEW.verification_method = 'override' THEN 'admin'
        ELSE 'courier'
      END,
      jsonb_build_object(
        'check_type', NEW.check_type,
        'old_status', OLD.status,
        'new_status', NEW.status,
        'failure_reason', NEW.failure_reason,
        'override_reason', NEW.override_reason,
        'blocks_delivery', NEW.blocks_delivery
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for audit logging
DROP TRIGGER IF EXISTS trigger_log_compliance_check_change ON delivery_compliance_checks;
CREATE TRIGGER trigger_log_compliance_check_change
  AFTER INSERT OR UPDATE ON delivery_compliance_checks
  FOR EACH ROW
  EXECUTE FUNCTION log_compliance_check_change();

-- Function to check if all compliance checks pass for a delivery
CREATE OR REPLACE FUNCTION public.can_complete_delivery(p_tenant_id UUID, p_order_id UUID)
RETURNS TABLE(
  can_complete BOOLEAN,
  blocking_checks JSONB,
  all_passed BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_blocking_checks JSONB;
  v_all_passed BOOLEAN;
BEGIN
  -- Get all blocking checks that haven't passed
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id,
      'check_type', check_type,
      'status', status,
      'failure_reason', failure_reason
    )
  )
  INTO v_blocking_checks
  FROM delivery_compliance_checks
  WHERE tenant_id = p_tenant_id
    AND order_id = p_order_id
    AND blocks_delivery = true
    AND status NOT IN ('passed', 'override');

  -- Check if all checks have passed
  SELECT NOT EXISTS (
    SELECT 1
    FROM delivery_compliance_checks
    WHERE tenant_id = p_tenant_id
      AND order_id = p_order_id
      AND status NOT IN ('passed', 'override', 'skipped')
  ) INTO v_all_passed;

  RETURN QUERY SELECT
    (v_blocking_checks IS NULL OR v_blocking_checks = '[]'::jsonb) AS can_complete,
    COALESCE(v_blocking_checks, '[]'::jsonb) AS blocking_checks,
    v_all_passed AS all_passed;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.can_complete_delivery(UUID, UUID) TO authenticated;
