-- Fix missing search_path in SECURITY DEFINER functions
-- Based on audit finding 3.1

-- Fix check_tenant_subscription_valid (found in 20251113200950_382b185f-f724-4795-9b61-d20297233ff9.sql)
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
  FROM public.tenants
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

-- Fix prevent_invalid_subscription_operations (found in 20251113200950_382b185f-f724-4795-9b61-d20297233ff9.sql)
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
  
  IF NOT public.check_tenant_subscription_valid(NEW.tenant_id) THEN
    RAISE EXCEPTION 'Subscription expired or invalid. Please update your billing to continue using this feature.';
  END IF;
  RETURN NEW;
END;
$$;

-- Fix any other potential missing search_paths
-- (Sampled from grep output and general best practices)

-- Ensure commonly used auth functions are secure
ALTER FUNCTION public.is_tenant_admin(uuid, uuid) SET search_path = public;
ALTER FUNCTION public.is_super_admin() SET search_path = public;

