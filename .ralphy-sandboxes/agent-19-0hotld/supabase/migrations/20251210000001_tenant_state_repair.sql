-- ============================================================================
-- Tenant State Validation and Repair Functions
-- ============================================================================
-- These functions ensure tenant state consistency and can repair invalid states
-- Based on the spec: Every user must be able to access admin after signup

-- Function to validate tenant state
CREATE OR REPLACE FUNCTION public.validate_tenant_state(p_tenant_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant RECORD;
  v_credits RECORD;
  v_issues jsonb := '[]'::jsonb;
  v_valid BOOLEAN := true;
BEGIN
  -- Get tenant
  SELECT * INTO v_tenant FROM tenants WHERE id = p_tenant_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Tenant not found');
  END IF;

  -- Get credits
  SELECT * INTO v_credits FROM tenant_credits WHERE tenant_id = p_tenant_id;

  -- Validate subscription_status
  IF v_tenant.subscription_status IS NULL OR 
     v_tenant.subscription_status NOT IN ('free', 'active', 'trialing', 'past_due', 'cancelled', 'suspended') THEN
    v_valid := false;
    v_issues := v_issues || jsonb_build_object(
      'field', 'subscription_status',
      'issue', 'Invalid status: ' || COALESCE(v_tenant.subscription_status, 'NULL'),
      'fix', 'Set to "active" for free tier'
    );
  END IF;

  -- Validate is_free_tier matches subscription_status
  IF v_tenant.subscription_status = 'free' AND NOT COALESCE(v_tenant.is_free_tier, false) THEN
    v_valid := false;
    v_issues := v_issues || jsonb_build_object(
      'field', 'is_free_tier',
      'issue', 'Status is "free" but is_free_tier is FALSE',
      'fix', 'Set is_free_tier to TRUE'
    );
  END IF;

  IF v_tenant.subscription_status IN ('active', 'trialing') AND 
     v_tenant.subscription_plan IS NOT NULL AND 
     v_tenant.subscription_plan != 'free' AND 
     COALESCE(v_tenant.is_free_tier, true) THEN
    v_valid := false;
    v_issues := v_issues || jsonb_build_object(
      'field', 'is_free_tier',
      'issue', 'Status is paid but is_free_tier is TRUE',
      'fix', 'Set is_free_tier to FALSE'
    );
  END IF;

  -- Check credits record exists
  IF v_credits IS NULL THEN
    v_valid := false;
    v_issues := v_issues || jsonb_build_object(
      'field', 'tenant_credits',
      'issue', 'No credit record found',
      'fix', 'Create credit record'
    );
  ELSE
    -- Check credits match tier
    IF COALESCE(v_tenant.is_free_tier, true) AND v_credits.balance = -1 THEN
      v_valid := false;
      v_issues := v_issues || jsonb_build_object(
        'field', 'credits.balance',
        'issue', 'Free tier has unlimited credits (-1)',
        'fix', 'Set balance to 10000'
      );
    END IF;

    IF NOT COALESCE(v_tenant.is_free_tier, true) AND v_credits.balance != -1 AND v_credits.balance >= 0 THEN
      v_valid := false;
      v_issues := v_issues || jsonb_build_object(
        'field', 'credits.balance',
        'issue', 'Paid tier should have unlimited credits',
        'fix', 'Set balance to -1'
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'valid', v_valid,
    'issues', v_issues,
    'tenant_id', p_tenant_id,
    'current_state', jsonb_build_object(
      'subscription_status', v_tenant.subscription_status,
      'subscription_plan', v_tenant.subscription_plan,
      'is_free_tier', v_tenant.is_free_tier,
      'credit_balance', v_credits.balance
    )
  );
END;
$$;

-- Function to repair tenant state
CREATE OR REPLACE FUNCTION public.repair_tenant_state(p_tenant_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant RECORD;
  v_credits RECORD;
  v_repairs jsonb := '[]'::jsonb;
  v_should_be_free BOOLEAN;
  v_target_credits INTEGER;
BEGIN
  -- Get tenant
  SELECT * INTO v_tenant FROM tenants WHERE id = p_tenant_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tenant not found');
  END IF;

  -- Get credits
  SELECT * INTO v_credits FROM tenant_credits WHERE tenant_id = p_tenant_id;

  -- Determine what the tenant SHOULD be
  -- If they have a valid paid subscription in Stripe, they're paid
  -- Otherwise, they're free tier
  v_should_be_free := COALESCE(v_tenant.stripe_subscription_id IS NULL OR v_tenant.stripe_subscription_id = '', true);
  
  -- If trialing but trial ended, convert to free
  IF v_tenant.subscription_status = 'trialing' AND 
     v_tenant.trial_ends_at IS NOT NULL AND 
     v_tenant.trial_ends_at < NOW() THEN
    v_should_be_free := true;
  END IF;

  -- Fix subscription_status if invalid
  IF v_tenant.subscription_status IS NULL OR 
     v_tenant.subscription_status NOT IN ('free', 'active', 'trialing', 'past_due', 'cancelled', 'suspended') THEN
    UPDATE tenants SET subscription_status = CASE WHEN v_should_be_free THEN 'active' ELSE 'active' END
    WHERE id = p_tenant_id;
    v_repairs := v_repairs || jsonb_build_object('field', 'subscription_status', 'action', 'set_to_active');
  END IF;

  -- Fix is_free_tier
  IF COALESCE(v_tenant.is_free_tier, false) != v_should_be_free THEN
    UPDATE tenants SET is_free_tier = v_should_be_free WHERE id = p_tenant_id;
    v_repairs := v_repairs || jsonb_build_object('field', 'is_free_tier', 'action', 'set_to_' || v_should_be_free::text);
  END IF;

  -- Determine target credits
  v_target_credits := CASE WHEN v_should_be_free THEN 10000 ELSE -1 END;

  -- Create or fix credits record
  IF v_credits IS NULL THEN
    INSERT INTO tenant_credits (
      tenant_id, 
      balance, 
      free_credits_balance,
      purchased_credits_balance,
      lifetime_earned,
      free_credits_expires_at,
      last_free_grant_at,
      next_free_grant_at
    ) VALUES (
      p_tenant_id, 
      v_target_credits,
      CASE WHEN v_should_be_free THEN 10000 ELSE 0 END,
      0,
      CASE WHEN v_should_be_free THEN 10000 ELSE 0 END,
      CASE WHEN v_should_be_free THEN NOW() + INTERVAL '30 days' ELSE NULL END,
      CASE WHEN v_should_be_free THEN NOW() ELSE NULL END,
      CASE WHEN v_should_be_free THEN NOW() + INTERVAL '30 days' ELSE NULL END
    );
    v_repairs := v_repairs || jsonb_build_object('field', 'tenant_credits', 'action', 'created_with_balance_' || v_target_credits::text);
    
    -- Log the repair grant
    IF v_should_be_free THEN
      INSERT INTO credit_transactions (
        tenant_id, amount, balance_after, transaction_type, description
      ) VALUES (
        p_tenant_id, 10000, 10000, 'repair_grant', 'Credits restored during state repair'
      );
    END IF;
  ELSE
    -- Fix balance if wrong
    IF (v_should_be_free AND v_credits.balance = -1) OR 
       (NOT v_should_be_free AND v_credits.balance != -1) THEN
      UPDATE tenant_credits SET 
        balance = v_target_credits,
        free_credits_balance = CASE WHEN v_should_be_free THEN 10000 ELSE 0 END,
        free_credits_expires_at = CASE WHEN v_should_be_free THEN NOW() + INTERVAL '30 days' ELSE NULL END
      WHERE tenant_id = p_tenant_id;
      v_repairs := v_repairs || jsonb_build_object('field', 'credits.balance', 'action', 'set_to_' || v_target_credits::text);
      
      -- Log the repair
      INSERT INTO credit_transactions (
        tenant_id, amount, balance_after, transaction_type, description
      ) VALUES (
        p_tenant_id, 
        CASE WHEN v_should_be_free THEN 10000 - GREATEST(v_credits.balance, 0) ELSE 0 END, 
        v_target_credits, 
        'repair_adjustment', 
        'Balance adjusted during state repair'
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'repairs', v_repairs,
    'tenant_id', p_tenant_id,
    'new_state', jsonb_build_object(
      'is_free_tier', v_should_be_free,
      'credit_balance', v_target_credits
    )
  );
END;
$$;

-- Function to find all tenants with invalid state
CREATE OR REPLACE FUNCTION public.find_invalid_tenant_states()
RETURNS TABLE (
  tenant_id UUID,
  tenant_slug TEXT,
  issues jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id AS tenant_id,
    t.slug AS tenant_slug,
    public.validate_tenant_state(t.id) AS issues
  FROM tenants t
  WHERE (public.validate_tenant_state(t.id))->>'valid' = 'false';
END;
$$;

-- Function to repair all invalid tenant states
CREATE OR REPLACE FUNCTION public.repair_all_invalid_tenant_states()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant RECORD;
  v_results jsonb := '[]'::jsonb;
  v_repair_result jsonb;
BEGIN
  FOR v_tenant IN 
    SELECT id FROM tenants 
    WHERE (public.validate_tenant_state(id))->>'valid' = 'false'
  LOOP
    v_repair_result := public.repair_tenant_state(v_tenant.id);
    v_results := v_results || v_repair_result;
  END LOOP;

  RETURN jsonb_build_object(
    'repaired_count', jsonb_array_length(v_results),
    'results', v_results
  );
END;
$$;

-- ============================================================================
-- Fix existing tenants that are in invalid state
-- ============================================================================

-- First, ensure all tenants have a credit record
INSERT INTO tenant_credits (tenant_id, balance, free_credits_balance, purchased_credits_balance, lifetime_earned)
SELECT 
  t.id,
  CASE 
    WHEN COALESCE(t.is_free_tier, true) THEN 10000 
    ELSE -1 
  END AS balance,
  CASE WHEN COALESCE(t.is_free_tier, true) THEN 10000 ELSE 0 END,
  0,
  CASE WHEN COALESCE(t.is_free_tier, true) THEN 10000 ELSE 0 END
FROM tenants t
LEFT JOIN tenant_credits tc ON tc.tenant_id = t.id
WHERE tc.id IS NULL;

-- Fix tenants with NULL subscription_status
UPDATE tenants SET 
  subscription_status = 'active',
  is_free_tier = true
WHERE subscription_status IS NULL;

-- Fix tenants where is_free_tier doesn't match reality
UPDATE tenants SET is_free_tier = true
WHERE subscription_status = 'active' 
  AND subscription_plan IN ('free', NULL)
  AND stripe_subscription_id IS NULL
  AND COALESCE(is_free_tier, false) = false;

-- Fix free tier tenants with wrong credit balance (-1)
UPDATE tenant_credits SET 
  balance = 10000,
  free_credits_balance = 10000
FROM tenants t
WHERE tenant_credits.tenant_id = t.id
  AND COALESCE(t.is_free_tier, true) = true
  AND tenant_credits.balance = -1;

-- Fix paid tier tenants missing unlimited credits
UPDATE tenant_credits SET balance = -1
FROM tenants t
WHERE tenant_credits.tenant_id = t.id
  AND COALESCE(t.is_free_tier, false) = false
  AND t.subscription_status IN ('active', 'trialing')
  AND tenant_credits.balance != -1;

-- Grant RLS access for the functions
GRANT EXECUTE ON FUNCTION public.validate_tenant_state(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.repair_tenant_state(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.find_invalid_tenant_states() TO service_role;
GRANT EXECUTE ON FUNCTION public.repair_all_invalid_tenant_states() TO service_role;
