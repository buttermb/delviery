-- Add is_free_tier to tenants table
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS is_free_tier BOOLEAN DEFAULT false;

-- Update the atomic tenant creation function to accept plan and handle free tier
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
  p_plan TEXT DEFAULT 'starter' -- New parameter
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
BEGIN
  -- Logic for plan types (following spec: new signups = free with credits)
  IF p_plan = 'free' THEN
    v_is_free_tier := true;
    v_subscription_status := 'active'; -- Free tier is active immediately
    v_trial_ends_at := NULL; -- No trial for free tier
    v_initial_credits := 10000; -- Welcome credits for new accounts (per spec)
  ELSIF p_plan IN ('starter', 'professional', 'enterprise') THEN
    -- Paid plan selected at signup (via Stripe checkout)
    v_is_free_tier := false;
    v_subscription_status := 'active'; -- Paid plans are active immediately
    v_trial_ends_at := NULL;
    v_initial_credits := -1; -- -1 means unlimited (per spec for paid tiers)
  ELSIF p_plan = 'trial' THEN
    -- Trial of a paid plan (14 days)
    v_is_free_tier := false;
    v_subscription_status := 'trialing';
    v_trial_ends_at := NOW() + INTERVAL '14 days';
    v_initial_credits := -1; -- Unlimited during trial (per spec)
  ELSE
    -- Unknown plan - default to free tier for safety
    v_is_free_tier := true;
    v_subscription_status := 'active';
    v_trial_ends_at := NULL;
    v_initial_credits := 10000;
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
    is_free_tier, -- Insert new column
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
    p_plan, -- Use passed plan
    v_subscription_status,
    v_trial_ends_at,
    v_is_free_tier,
    jsonb_build_object(
      'customers', 50,
      'menus', 3,
      'products', 100,
      'locations', 2,
      'users', 3
    ),
    jsonb_build_object(
      'customers', 0,
      'menus', 0,
      'products', 0,
      'locations', 0,
      'users', 1
    ),
    jsonb_build_object(
      'api_access', false,
      'custom_branding', false,
      'white_label', false,
      'advanced_analytics', false,
      'sms_enabled', false
    ),
    CASE WHEN v_is_free_tier THEN 0 ELSE 99 END -- Simple MRR logic
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
    CASE WHEN v_is_free_tier THEN 'plan_changed' ELSE 'trial_started' END,
    NULL,
    p_plan,
    0,
    jsonb_build_object(
      'trial_days', CASE WHEN v_is_free_tier THEN 0 ELSE 14 END,
      'trial_ends_at', v_trial_ends_at,
      'is_free_tier', v_is_free_tier
    )
  )
  RETURNING id INTO v_subscription_event_id;

  -- 4. Initialize Tenant Credits (ALWAYS - both free and paid tiers)
  INSERT INTO public.tenant_credits (
    tenant_id, 
    balance, 
    free_credits_balance,
    purchased_credits_balance,
    lifetime_earned,
    lifetime_spent,
    free_credits_expires_at,
    last_free_grant_at,
    next_free_grant_at
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
    CASE WHEN v_is_free_tier THEN NOW() + INTERVAL '30 days' ELSE NULL END
  )
  ON CONFLICT (tenant_id) DO NOTHING;
  
  -- Log initial credit transaction for free tier
  IF v_is_free_tier AND v_initial_credits > 0 THEN
    INSERT INTO public.credit_transactions (
      tenant_id,
      amount,
      balance_after,
      transaction_type,
      description
    ) VALUES (
      v_tenant_id,
      v_initial_credits,
      v_initial_credits,
      'signup_bonus',
      'Welcome credits for new account'
    );
  END IF;

  -- 5. Build result JSON with all created data
  SELECT jsonb_build_object(
    'tenant_id', v_tenant_id,
    'tenant_user_id', v_tenant_user_id,
    'subscription_event_id', v_subscription_event_id,
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
