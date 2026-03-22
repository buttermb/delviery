-- Fix create_tenant_atomic free tier limits
--
-- Issues fixed:
-- 1. Free tier initial credits: 10,000 -> 500 (must match FREE_TIER_MONTHLY_CREDITS)
-- 2. Free tier products limit: 100 -> 25 (must match FREE_TIER_LIMITS.max_products)
-- 3. Free tier locations limit: 2 -> 1 (must match FREE_TIER_LIMITS.max_locations)
-- 4. Free tier users limit: 3 -> 1 (must match FREE_TIER_LIMITS.max_team_members)
-- 5. Starter advanced_analytics: true -> false (featureConfig.ts says enterprise-only)
-- 6. Unknown plan fallback limits: match free tier values
--
-- Sources of truth:
--   FREE_TIER_MONTHLY_CREDITS = 500 (src/lib/credits/creditCosts.ts)
--   FREE_TIER_LIMITS (src/lib/credits/creditCosts.ts)
--   FEATURES['advanced-analytics'].tier = 'enterprise' (src/lib/featureConfig.ts)
--   grant_free_credits SQL: v_max_monthly_grant = 500

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
  -- Plan-based credit amounts:
  -- Free: 500 credits (matches FREE_TIER_MONTHLY_CREDITS and grant_free_credits cap)
  -- Starter: 25,000 credits
  -- Pro/Professional: 100,000 credits
  -- Enterprise: 500,000 credits
  -- Trial: Unlimited (-1) during trial period
  -- =========================================================================

  IF p_plan = 'free' THEN
    v_is_free_tier := true;
    v_subscription_status := 'active';
    v_trial_ends_at := NULL;
    v_initial_credits := 500;
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
    v_initial_credits := 500;
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
        WHEN v_subscription_plan = 'free' THEN 25
        WHEN v_subscription_plan = 'starter' THEN 500
        WHEN v_subscription_plan = 'professional' THEN 2000
        WHEN v_subscription_plan = 'enterprise' THEN -1
        ELSE 25
      END,
      'locations', CASE
        WHEN v_subscription_plan = 'free' THEN 1
        WHEN v_subscription_plan = 'starter' THEN 5
        WHEN v_subscription_plan = 'professional' THEN 20
        WHEN v_subscription_plan = 'enterprise' THEN -1
        ELSE 1
      END,
      'users', CASE
        WHEN v_subscription_plan = 'free' THEN 1
        WHEN v_subscription_plan = 'starter' THEN 10
        WHEN v_subscription_plan = 'professional' THEN 50
        WHEN v_subscription_plan = 'enterprise' THEN -1
        ELSE 1
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
      'advanced_analytics', v_subscription_plan = 'enterprise',
      'sms_enabled', v_subscription_plan IN ('professional', 'enterprise')
    ),
    CASE
      WHEN v_is_free_tier THEN 0
      WHEN v_subscription_plan = 'starter' THEN 79
      WHEN v_subscription_plan = 'professional' THEN 150
      WHEN v_subscription_plan = 'enterprise' THEN 499
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
      'bonus',
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

-- Fix existing free tier tenants with old inflated limits
UPDATE public.tenants
SET limits = jsonb_set(
  jsonb_set(
    jsonb_set(limits, '{products}', '25'),
    '{locations}', '1'
  ),
  '{users}', '1'
)
WHERE subscription_plan = 'free'
  AND is_free_tier = true
  AND (
    (limits->>'products')::int > 25
    OR (limits->>'locations')::int > 1
    OR (limits->>'users')::int > 1
  );

-- Fix existing starter tenants with incorrect advanced_analytics feature
UPDATE public.tenants
SET features = jsonb_set(features, '{advanced_analytics}', 'false')
WHERE subscription_plan = 'starter'
  AND (features->>'advanced_analytics')::boolean = true;
