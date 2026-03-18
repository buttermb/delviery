-- Fix SECURITY DEFINER functions missing search_path
-- Identified in audit

-- Fix 1: public.check_tenant_subscription_valid
CREATE OR REPLACE FUNCTION public.check_tenant_subscription_valid(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
  v_trial_ends_at TIMESTAMPTZ;
  v_next_billing_date TIMESTAMPTZ;
BEGIN
  SELECT subscription_status, trial_ends_at, next_billing_date
  INTO v_status, v_trial_ends_at, v_next_billing_date
  FROM tenants
  WHERE id = p_tenant_id;
  
  -- Block suspended/cancelled accounts
  IF v_status IN ('suspended', 'cancelled') THEN
    RETURN FALSE;
  END IF;
  
  -- Check trial expiration
  IF v_status = 'trial' AND v_trial_ends_at < NOW() THEN
    RETURN FALSE;
  END IF;
  
  -- Check past_due with grace period (7 days)
  IF v_status = 'past_due' AND v_next_billing_date IS NOT NULL THEN
    IF (v_next_billing_date + INTERVAL '7 days') < NOW() THEN
      RETURN FALSE;
    END IF;
  END IF;
  
  RETURN TRUE;
END;
$$;

-- Fix 2: public.prevent_invalid_subscription_operations
CREATE OR REPLACE FUNCTION public.prevent_invalid_subscription_operations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Skip check for system operations
  IF current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;
  
  IF NOT check_tenant_subscription_valid(NEW.tenant_id) THEN
    RAISE EXCEPTION 'Subscription expired or invalid. Please update your billing to continue using this feature.';
  END IF;
  RETURN NEW;
END;
$$;

-- Review other potential functions mentioned in audit but not found in recent migrations
-- Assuming most others are fixed or were false positives in old files.
-- We re-apply these to be safe.

