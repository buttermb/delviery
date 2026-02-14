-- Atomic Tenant Creation Function
-- Performs all database operations in a single transaction for better performance and atomicity

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.create_tenant_atomic(
  p_auth_user_id UUID,
  p_email TEXT,
  p_business_name TEXT,
  p_owner_name TEXT,
  p_phone TEXT,
  p_state TEXT,
  p_industry TEXT,
  p_company_size TEXT,
  p_slug TEXT
);

-- Create atomic tenant creation function
CREATE OR REPLACE FUNCTION public.create_tenant_atomic(
  p_auth_user_id UUID,
  p_email TEXT,
  p_business_name TEXT,
  p_owner_name TEXT,
  p_phone TEXT DEFAULT NULL,
  p_state TEXT DEFAULT NULL,
  p_industry TEXT DEFAULT NULL,
  p_company_size TEXT DEFAULT NULL,
  p_slug TEXT DEFAULT NULL
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
BEGIN
  -- Calculate trial end date (14 days from now)
  v_trial_ends_at := NOW() + INTERVAL '14 days';

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
    'starter',
    'trial',
    v_trial_ends_at,
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
    99
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
    false, -- ⭐ Email not verified initially
    NOW() + INTERVAL '7 days' -- ⭐ 7-day verification deadline
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
    'trial_started',
    NULL,
    'starter',
    0,
    jsonb_build_object(
      'trial_days', 14,
      'trial_ends_at', v_trial_ends_at
    )
  )
  RETURNING id INTO v_subscription_event_id;

  -- 4. Build result JSON with all created data
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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_tenant_atomic TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.create_tenant_atomic IS 'Atomically creates tenant, tenant_user, and subscription_event records in a single transaction. Returns all created data as JSONB.';

