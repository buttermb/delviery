-- Fix check_tenant_subscription_valid function to use correct columns
CREATE OR REPLACE FUNCTION public.check_tenant_subscription_valid(p_tenant_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_status TEXT;
  v_trial_ends_at TIMESTAMPTZ;
BEGIN
  SELECT subscription_status, trial_ends_at
  INTO v_status, v_trial_ends_at
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
  
  -- Allow all other statuses (active, past_due with grace period handled elsewhere)
  RETURN TRUE;
END;
$$;