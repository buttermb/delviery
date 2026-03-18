-- ============================================================================
-- Fix Tenant Credit Grants
-- ============================================================================
-- This migration fixes issues with initial credit granting:
-- 1. Updates auto_create_tenant_credits trigger to NOT create a record
--    (let create_tenant_atomic handle it properly)
-- 2. Updates create_tenant_atomic to use ON CONFLICT DO UPDATE
-- 3. Implements plan-based credit amounts per spec:
--    - Free: 10,000
--    - Starter: 25,000
--    - Pro/Professional: 100,000
--    - Enterprise: 500,000
-- ============================================================================

-- ============================================================================
-- 1. Fix the auto_create_tenant_credits trigger to be a no-op
-- ============================================================================
-- The trigger was creating records with balance=0 BEFORE create_tenant_atomic
-- could insert proper credits. This caused new tenants to get 0 credits.
-- Solution: Remove the trigger entirely and let create_tenant_atomic handle it.

DROP TRIGGER IF EXISTS trigger_auto_create_tenant_credits ON public.tenants;

-- Keep the function but make it a no-op (for backwards compatibility if anything calls it)
CREATE OR REPLACE FUNCTION public.auto_create_tenant_credits()
RETURNS TRIGGER AS $$
BEGIN
  -- NO-OP: Credit creation is now handled by create_tenant_atomic
  -- This trigger was causing race conditions where credits would be
  -- created with balance=0 before the atomic function could set proper amounts
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION public.auto_create_tenant_credits IS
  'Deprecated: Credit creation is now handled by create_tenant_atomic. This function is a no-op for backwards compatibility.';

-- ============================================================================
-- 2. Update create_tenant_atomic with plan-based credit amounts
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_tenant_atomic(
  p_auth_user_id UUID,
  p_email TEXT,
  p_business_name TEXT,
  p_owner_name TEXT,
  p_phone TEXT DEFAULT NULL,
  p_state TEXT DEFAULT NULL,
  p_industry TEXT DEFAULT NULL,
  p_company_size TEXT DEFAULT NULL,
  p_slug TEXT DEFAULT NULL,
  p_plan TEXT DEFAULT 'free'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_tenant_user_id UUID;
  v_subscription_event_id UUID;
  v_result jsonb;
  v_trial_ends_at TIMESTAMPTZ;
  v_is_free_tier BOOLEAN;
  v_subscription_status TEXT;
  v_initial_credits INTEGER;
  v_subscription_plan TEXT;
BEGIN
  -- =========================================================================
  -- Plan-based credit amounts per specification:
  -- Free: 10,000 credits (free tier with credit limits)
  -- Starter: 25,000 credits
  -- Pro/Professional: 100,000 credits
  -- Enterprise: 500,000 credits
  -- Trial: Unlimited (-1) during trial period
  -- =========================================================================

  IF p_plan = 'free' THEN
    v_is_free_tier := true;
    v_subscription_status := 'active';
    v_trial_ends_at := NULL;
    v_initial_credits := 10000;
    v_subscription_plan := 'free';

  ELSIF p_plan = 'starter' THEN
    v_is_free_tier := false;
    v_subscription_status := 'active';
    v_trial_ends_at := NULL;
    v_initial_credits := 25000;
    v_subscription_plan := 'starter';

  ELSIF p_plan IN ('pro', 'professional') THEN
    v_is_free_tier := false;
    v_subscription_status := 'active';
    v_trial_ends_at := NULL;
    v_initial_credits := 100000;
    v_subscription_plan := 'professional';

  ELSIF p_plan = 'enterprise' THEN
    v_is_free_tier := false;
    v_subscription_status := 'active';
    v_trial_ends_at := NULL;
    v_initial_credits := 500000;
    v_subscription_plan := 'enterprise';

  ELSIF p_plan = 'trial' THEN
    -- Trial of a paid plan (14 days with unlimited credits)
    v_is_free_tier := false;
    v_subscription_status := 'trialing';
    v_trial_ends_at := NOW() + INTERVAL '14 days';
    v_initial_credits := -1; -- -1 means unlimited
    v_subscription_plan := 'starter'; -- Default trial is starter plan

  ELSE
    -- Unknown plan - default to free tier for safety
    v_is_free_tier := true;
    v_subscription_status := 'active';
    v_trial_ends_at := NULL;
    v_initial_credits := 10000;
    v_subscription_plan := 'free';
  END IF;

  -- 1. Insert tenant record
  INSERT INTO public.tenants (
    business_name,
    slug,
    owner_email,
    owner_name,
    phone,
    state,
    industry,
    company_size,
    subscription_plan,
    subscription_status,
    trial_ends_at,
    is_free_tier,
    limits,
    usage,
    features,
    mrr
  ) VALUES (
    p_business_name,
    p_slug,
    LOWER(p_email),
    p_owner_name,
    p_phone,
    p_state,
    p_industry,
    p_company_size,
    v_subscription_plan,
    v_subscription_status,
    v_trial_ends_at,
    v_is_free_tier,
    jsonb_build_object(
      'customers', CASE
        WHEN v_subscription_plan = 'free' THEN 50
        WHEN v_subscription_plan = 'starter' THEN 200
        WHEN v_subscription_plan = 'professional' THEN 1000
        WHEN v_subscription_plan = 'enterprise' THEN -1 -- unlimited
        ELSE 50
      END,
      'menus', CASE
        WHEN v_subscription_plan = 'free' THEN 3
        WHEN v_subscription_plan = 'starter' THEN 10
        WHEN v_subscription_plan = 'professional' THEN 50
        WHEN v_subscription_plan = 'enterprise' THEN -1
        ELSE 3
      END,
      'products', CASE
        WHEN v_subscription_plan = 'free' THEN 100
        WHEN v_subscription_plan = 'starter' THEN 500
        WHEN v_subscription_plan = 'professional' THEN 2000
        WHEN v_subscription_plan = 'enterprise' THEN -1
        ELSE 100
      END,
      'locations', CASE
        WHEN v_subscription_plan = 'free' THEN 2
        WHEN v_subscription_plan = 'starter' THEN 5
        WHEN v_subscription_plan = 'professional' THEN 20
        WHEN v_subscription_plan = 'enterprise' THEN -1
        ELSE 2
      END,
      'users', CASE
        WHEN v_subscription_plan = 'free' THEN 3
        WHEN v_subscription_plan = 'starter' THEN 10
        WHEN v_subscription_plan = 'professional' THEN 50
        WHEN v_subscription_plan = 'enterprise' THEN -1
        ELSE 3
      END
    ),
    jsonb_build_object(
      'customers', 0,
      'menus', 0,
      'products', 0,
      'locations', 0,
      'users', 1
    ),
    jsonb_build_object(
      'api_access', v_subscription_plan IN ('professional', 'enterprise'),
      'custom_branding', v_subscription_plan IN ('professional', 'enterprise'),
      'white_label', v_subscription_plan = 'enterprise',
      'advanced_analytics', v_subscription_plan IN ('starter', 'professional', 'enterprise'),
      'sms_enabled', v_subscription_plan IN ('professional', 'enterprise')
    ),
    CASE
      WHEN v_is_free_tier THEN 0
      WHEN v_subscription_plan = 'starter' THEN 99
      WHEN v_subscription_plan = 'professional' THEN 299
      WHEN v_subscription_plan = 'enterprise' THEN 999
      ELSE 0
    END
  )
  RETURNING id INTO v_tenant_id;

  -- 2. Insert tenant_user record (email not verified initially)
  INSERT INTO public.tenant_users (
    tenant_id,
    user_id,
    email,
    name,
    role,
    status,
    invited_at,
    accepted_at,
    email_verified,
    email_verification_token_expires_at
  ) VALUES (
    v_tenant_id,
    p_auth_user_id,
    LOWER(p_email),
    p_owner_name,
    'owner',
    'active',
    NOW(),
    NOW(),
    false,
    NOW() + INTERVAL '7 days'
  )
  RETURNING id INTO v_tenant_user_id;

  -- 3. Insert subscription event
  INSERT INTO public.subscription_events (
    tenant_id,
    event_type,
    from_plan,
    to_plan,
    amount,
    event_data
  ) VALUES (
    v_tenant_id,
    CASE WHEN v_subscription_status = 'trialing' THEN 'trial_started' ELSE 'plan_changed' END,
    NULL,
    v_subscription_plan,
    0,
    jsonb_build_object(
      'trial_days', CASE WHEN v_subscription_status = 'trialing' THEN 14 ELSE 0 END,
      'trial_ends_at', v_trial_ends_at,
      'is_free_tier', v_is_free_tier,
      'initial_credits', v_initial_credits
    )
  )
  RETURNING id INTO v_subscription_event_id;

  -- 4. Initialize Tenant Credits
  -- Use ON CONFLICT DO UPDATE to handle any race conditions with triggers
  INSERT INTO public.tenant_credits (
    tenant_id,
    balance,
    free_credits_balance,
    purchased_credits_balance,
    lifetime_earned,
    lifetime_spent,
    free_credits_expires_at,
    last_free_grant_at,
    next_free_grant_at,
    tier_status
  )
  VALUES (
    v_tenant_id,
    v_initial_credits,
    CASE WHEN v_is_free_tier THEN v_initial_credits ELSE 0 END,
    0,
    CASE WHEN v_initial_credits > 0 THEN v_initial_credits ELSE 0 END,
    0,
    CASE WHEN v_is_free_tier THEN NOW() + INTERVAL '30 days' ELSE NULL END,
    CASE WHEN v_is_free_tier THEN NOW() ELSE NULL END,
    CASE WHEN v_is_free_tier THEN NOW() + INTERVAL '30 days' ELSE NULL END,
    CASE WHEN v_is_free_tier THEN 'free' ELSE 'paid' END
  )
  ON CONFLICT (tenant_id) DO UPDATE SET
    balance = EXCLUDED.balance,
    free_credits_balance = EXCLUDED.free_credits_balance,
    purchased_credits_balance = EXCLUDED.purchased_credits_balance,
    lifetime_earned = EXCLUDED.lifetime_earned,
    free_credits_expires_at = EXCLUDED.free_credits_expires_at,
    last_free_grant_at = EXCLUDED.last_free_grant_at,
    next_free_grant_at = EXCLUDED.next_free_grant_at,
    tier_status = EXCLUDED.tier_status,
    updated_at = NOW();

  -- Log initial credit transaction
  IF v_initial_credits > 0 THEN
    INSERT INTO public.credit_transactions (
      tenant_id,
      amount,
      balance_after,
      transaction_type,
      action_type,
      description,
      reference_id,
      metadata
    ) VALUES (
      v_tenant_id,
      v_initial_credits,
      v_initial_credits,
      'signup_bonus',
      'initial_grant',
      'Welcome credits for new ' || v_subscription_plan || ' account',
      'initial_grant:' || v_tenant_id::text,
      jsonb_build_object(
        'plan', v_subscription_plan,
        'is_free_tier', v_is_free_tier
      )
    )
    ON CONFLICT DO NOTHING; -- Idempotency: don't create duplicate transactions
  END IF;

  -- 5. Build result JSON with all created data
  SELECT jsonb_build_object(
    'tenant_id', v_tenant_id,
    'tenant_user_id', v_tenant_user_id,
    'subscription_event_id', v_subscription_event_id,
    'initial_credits', v_initial_credits,
    'tenant', (
      SELECT row_to_json(t.*)
      FROM public.tenants t
      WHERE t.id = v_tenant_id
    ),
    'tenant_user', (
      SELECT row_to_json(tu.*)
      FROM public.tenant_users tu
      WHERE tu.id = v_tenant_user_id
    )
  ) INTO v_result;

  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error and re-raise
    RAISE EXCEPTION 'Failed to create tenant atomically: %', SQLERRM;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.create_tenant_atomic TO authenticated;

COMMENT ON FUNCTION public.create_tenant_atomic IS
  'Atomically creates tenant, tenant_user, tenant_credits, and subscription_event records.
   Plan-based credit amounts: Free=10K, Starter=25K, Pro=100K, Enterprise=500K.';

-- ============================================================================
-- 3. Fix any existing tenants that got 0 credits due to the bug
-- ============================================================================
-- Update tenants with 0 balance who are on free tier and should have 10K
UPDATE public.tenant_credits tc
SET
  balance = 10000,
  free_credits_balance = 10000,
  lifetime_earned = 10000,
  last_free_grant_at = NOW(),
  next_free_grant_at = NOW() + INTERVAL '30 days',
  free_credits_expires_at = NOW() + INTERVAL '30 days',
  updated_at = NOW()
FROM public.tenants t
WHERE tc.tenant_id = t.id
  AND t.is_free_tier = true
  AND tc.balance = 0
  AND tc.lifetime_earned = 0
  AND NOT EXISTS (
    SELECT 1 FROM public.credit_transactions ct
    WHERE ct.tenant_id = tc.tenant_id
    AND ct.transaction_type = 'signup_bonus'
  );

-- Log the repair for affected tenants
INSERT INTO public.credit_transactions (
  tenant_id,
  amount,
  balance_after,
  transaction_type,
  action_type,
  description,
  reference_id
)
SELECT
  tc.tenant_id,
  10000,
  10000,
  'signup_bonus',
  'repair_grant',
  'Welcome credits (repaired - original grant failed)',
  'repair_grant:' || tc.tenant_id::text
FROM public.tenant_credits tc
JOIN public.tenants t ON t.id = tc.tenant_id
WHERE t.is_free_tier = true
  AND tc.balance = 10000
  AND tc.lifetime_earned = 10000
  AND NOT EXISTS (
    SELECT 1 FROM public.credit_transactions ct
    WHERE ct.tenant_id = tc.tenant_id
    AND ct.transaction_type = 'signup_bonus'
  );

-- ============================================================================
-- 4. Create helper function to get plan-based credit amount
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_plan_credit_amount(p_plan TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN CASE p_plan
    WHEN 'free' THEN 10000
    WHEN 'starter' THEN 25000
    WHEN 'pro' THEN 100000
    WHEN 'professional' THEN 100000
    WHEN 'enterprise' THEN 500000
    WHEN 'trial' THEN -1 -- unlimited
    ELSE 10000 -- default to free tier amount
  END;
END;
$$;

COMMENT ON FUNCTION public.get_plan_credit_amount IS
  'Returns the initial credit amount for a given subscription plan.
   Free=10K, Starter=25K, Pro=100K, Enterprise=500K, Trial=unlimited(-1).';

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- This migration:
-- 1. Removes the auto_create_tenant_credits trigger that was causing race conditions
-- 2. Updates create_tenant_atomic to properly handle credit creation with ON CONFLICT DO UPDATE
-- 3. Implements plan-based credit amounts per specification
-- 4. Repairs any existing tenants that received 0 credits due to the bug
-- 5. Adds get_plan_credit_amount helper function
-- ============================================================================
