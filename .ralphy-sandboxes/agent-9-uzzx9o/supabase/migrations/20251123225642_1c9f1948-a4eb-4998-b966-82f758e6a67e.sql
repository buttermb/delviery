-- Update subscription_plans with Stripe Price IDs
UPDATE subscription_plans 
SET stripe_price_id = 'price_XXX' 
WHERE name = 'Starter';

UPDATE subscription_plans 
SET stripe_price_id = 'price_YYY' 
WHERE name = 'Professional';

UPDATE subscription_plans 
SET stripe_price_id = 'price_ZZZ' 
WHERE name = 'Enterprise';

-- Add trial tracking columns to tenants
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS trial_days INTEGER DEFAULT 14,
ADD COLUMN IF NOT EXISTS trial_reminder_12_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS trial_reminder_13_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS trial_reminder_14_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS trial_converted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS trial_cancelled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS grace_period_ends_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS payment_method_added BOOLEAN DEFAULT FALSE;

-- Create trial_events table for audit trail
CREATE TABLE IF NOT EXISTS trial_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on trial_events
ALTER TABLE trial_events ENABLE ROW LEVEL SECURITY;

-- RLS policies for trial_events
CREATE POLICY "Tenants can view own trial events"
  ON trial_events FOR SELECT
  USING (auth.uid() IN (
    SELECT user_id FROM tenant_users WHERE tenant_id = trial_events.tenant_id
  ));

CREATE POLICY "Super admins can view all trial events"
  ON trial_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );

-- Helper function: Check if trial is active
CREATE OR REPLACE FUNCTION is_trial_active(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trial_ends_at TIMESTAMPTZ;
  v_status TEXT;
BEGIN
  SELECT trial_ends_at, subscription_status
  INTO v_trial_ends_at, v_status
  FROM tenants
  WHERE id = p_tenant_id;
  
  RETURN v_status = 'trial' AND v_trial_ends_at > NOW();
END;
$$;

-- Helper function: Get trial days remaining
CREATE OR REPLACE FUNCTION get_trial_days_remaining(p_tenant_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trial_ends_at TIMESTAMPTZ;
BEGIN
  SELECT trial_ends_at INTO v_trial_ends_at
  FROM tenants
  WHERE id = p_tenant_id;
  
  IF v_trial_ends_at IS NULL OR v_trial_ends_at < NOW() THEN
    RETURN 0;
  END IF;
  
  RETURN EXTRACT(DAY FROM v_trial_ends_at - NOW())::INTEGER;
END;
$$;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_trial_events_tenant_id ON trial_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_trial_events_created_at ON trial_events(created_at);
CREATE INDEX IF NOT EXISTS idx_tenants_trial_ends_at ON tenants(trial_ends_at) WHERE subscription_status = 'trial';