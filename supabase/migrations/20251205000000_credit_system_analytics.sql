-- Credit System Analytics Enhancement Migration
-- Adds columns for tracking daily usage and upgrade triggers

-- ============================================================================
-- Add analytics columns to tenant_credits
-- ============================================================================

-- Add credits_used_today column for daily tracking
ALTER TABLE public.tenant_credits 
ADD COLUMN IF NOT EXISTS credits_used_today INTEGER DEFAULT 0;

-- Add last activity timestamp
ALTER TABLE public.tenant_credits 
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ;

-- Add upgrade trigger tracking
ALTER TABLE public.tenant_credits 
ADD COLUMN IF NOT EXISTS upgrade_trigger_shown BOOLEAN DEFAULT FALSE;

-- Add upgrade trigger shown at timestamp
ALTER TABLE public.tenant_credits 
ADD COLUMN IF NOT EXISTS upgrade_trigger_shown_at TIMESTAMPTZ;

-- ============================================================================
-- Add index for daily usage queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_tenant_credits_last_activity 
ON public.tenant_credits(last_activity_at);

-- ============================================================================
-- Create credit_daily_usage table for historical daily tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.credit_daily_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL,
  credits_used INTEGER NOT NULL DEFAULT 0,
  action_counts JSONB DEFAULT '{}', -- e.g., {"create_order": 5, "add_product": 10}
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, usage_date)
);

-- Add index for efficient date queries
CREATE INDEX IF NOT EXISTS idx_credit_daily_usage_date 
ON public.credit_daily_usage(tenant_id, usage_date DESC);

-- Enable RLS
ALTER TABLE public.credit_daily_usage ENABLE ROW LEVEL SECURITY;

-- RLS policies for credit_daily_usage
CREATE POLICY "Tenants can view own daily usage"
  ON public.credit_daily_usage FOR SELECT
  USING (tenant_id IN (
    SELECT id FROM public.tenants 
    WHERE id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  ));

-- ============================================================================
-- Add upgrade_triggers table for tracking when triggers were shown
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.credit_upgrade_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL, -- 'low_balance', 'menus_milestone', 'orders_milestone', etc.
  credits_at_trigger INTEGER,
  was_dismissed BOOLEAN DEFAULT FALSE,
  dismissed_at TIMESTAMPTZ,
  converted_to_paid BOOLEAN DEFAULT FALSE,
  converted_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for trigger queries
CREATE INDEX IF NOT EXISTS idx_credit_upgrade_triggers_tenant 
ON public.credit_upgrade_triggers(tenant_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.credit_upgrade_triggers ENABLE ROW LEVEL SECURITY;

-- RLS policies for credit_upgrade_triggers
CREATE POLICY "Tenants can view own triggers"
  ON public.credit_upgrade_triggers FOR SELECT
  USING (tenant_id IN (
    SELECT id FROM public.tenants 
    WHERE id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  ));

CREATE POLICY "System can insert triggers"
  ON public.credit_upgrade_triggers FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- Function to reset daily credits counter
-- Called by cron job at midnight
-- ============================================================================

CREATE OR REPLACE FUNCTION reset_daily_credit_counters()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- First, archive yesterday's usage to credit_daily_usage
  INSERT INTO credit_daily_usage (tenant_id, usage_date, credits_used, action_counts)
  SELECT 
    tenant_id,
    CURRENT_DATE - INTERVAL '1 day',
    credits_used_today,
    '{}'::jsonb -- TODO: Could be populated from credit_transactions
  FROM tenant_credits
  WHERE credits_used_today > 0
  ON CONFLICT (tenant_id, usage_date) 
  DO UPDATE SET credits_used = EXCLUDED.credits_used;

  -- Then reset today's counter
  UPDATE tenant_credits 
  SET credits_used_today = 0;
END;
$$;

-- ============================================================================
-- Function to track credit usage for daily stats
-- Called after each credit consumption
-- ============================================================================

CREATE OR REPLACE FUNCTION track_credit_usage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only track usage transactions (negative amounts)
  IF NEW.transaction_type = 'usage' AND NEW.amount < 0 THEN
    UPDATE tenant_credits
    SET 
      credits_used_today = credits_used_today + ABS(NEW.amount),
      last_activity_at = NOW()
    WHERE tenant_id = NEW.tenant_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for credit transaction tracking
DROP TRIGGER IF EXISTS track_credit_usage_trigger ON credit_transactions;
CREATE TRIGGER track_credit_usage_trigger
  AFTER INSERT ON credit_transactions
  FOR EACH ROW
  EXECUTE FUNCTION track_credit_usage();

-- ============================================================================
-- Function to log upgrade trigger events
-- ============================================================================

CREATE OR REPLACE FUNCTION log_upgrade_trigger(
  p_tenant_id UUID,
  p_trigger_type TEXT,
  p_credits_at_trigger INTEGER,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trigger_id UUID;
BEGIN
  INSERT INTO credit_upgrade_triggers (
    tenant_id,
    trigger_type,
    credits_at_trigger,
    metadata
  ) VALUES (
    p_tenant_id,
    p_trigger_type,
    p_credits_at_trigger,
    p_metadata
  )
  RETURNING id INTO v_trigger_id;

  -- Also update the upgrade_trigger_shown flag on tenant_credits
  UPDATE tenant_credits
  SET 
    upgrade_trigger_shown = TRUE,
    upgrade_trigger_shown_at = NOW()
  WHERE tenant_id = p_tenant_id;

  RETURN v_trigger_id;
END;
$$;

-- ============================================================================
-- Grant permissions
-- ============================================================================

GRANT SELECT ON public.credit_daily_usage TO authenticated;
GRANT SELECT ON public.credit_upgrade_triggers TO authenticated;
GRANT EXECUTE ON FUNCTION log_upgrade_trigger TO authenticated;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE public.credit_daily_usage IS 'Historical daily credit usage for analytics';
COMMENT ON TABLE public.credit_upgrade_triggers IS 'Tracks when upgrade prompts were shown and user responses';
COMMENT ON FUNCTION reset_daily_credit_counters IS 'Resets daily credit counters and archives to credit_daily_usage';
COMMENT ON FUNCTION log_upgrade_trigger IS 'Logs when an upgrade trigger is shown to a user';







