-- ============================================================================
-- HANDLE_NEW_USER TRIGGER FUNCTION
-- ============================================================================
-- Fires on auth.users INSERT to bootstrap a new user's account:
--   1. Creates user_profiles row with id, email, and default values
--   2. Creates credits row with zero balance
--   3. Logs signup_completed event to auth_audit_log
--   4. Sends welcome email via edge function (async, non-blocking)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_user_email TEXT;
  v_user_name TEXT;
  v_supabase_url TEXT;
  v_service_role_key TEXT;
BEGIN
  -- Extract user info from the NEW auth.users record
  v_user_email := COALESCE(NEW.email, '');
  v_user_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'display_name',
    ''
  );

  -- Resolve tenant_id from tenant_users (created by handle_new_user_tenant_creation trigger)
  SELECT tenant_id INTO v_tenant_id
  FROM public.tenant_users
  WHERE user_id = NEW.id
  LIMIT 1;

  -- 1. Create user_profiles row with default values
  INSERT INTO public.user_profiles (
    id,
    tenant_id,
    email,
    full_name,
    role,
    email_verified,
    phone_verified,
    login_count,
    failed_login_attempts,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    v_tenant_id,
    v_user_email,
    v_user_name,
    'customer',
    COALESCE(NEW.email_confirmed_at IS NOT NULL, false),
    false,
    0,
    0,
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;

  -- 2. Create credits row with zero balance
  INSERT INTO public.credits (
    user_id,
    tenant_id,
    balance,
    lifetime_purchased,
    lifetime_used,
    lifetime_expired,
    lifetime_refunded,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    COALESCE(v_tenant_id, '00000000-0000-0000-0000-000000000000'::uuid),
    0,
    0,
    0,
    0,
    0,
    now(),
    now()
  )
  ON CONFLICT (user_id, tenant_id) DO NOTHING;

  -- 3. Log signup_completed event to auth_audit_log
  INSERT INTO public.auth_audit_log (
    user_id,
    tenant_id,
    event_type,
    metadata,
    created_at
  ) VALUES (
    NEW.id,
    v_tenant_id,
    'signup_completed',
    jsonb_build_object(
      'email', v_user_email,
      'provider', COALESCE(NEW.raw_app_meta_data->>'provider', 'email'),
      'full_name', v_user_name
    ),
    now()
  );

  -- 4. Send welcome email via edge function (async, non-blocking)
  -- Uses pg_net for async HTTP call - does not block the trigger
  BEGIN
    v_supabase_url := current_setting('app.settings.supabase_url', true);
    v_service_role_key := current_setting('app.settings.service_role_key', true);

    -- Only attempt if configuration is available
    IF v_supabase_url IS NOT NULL AND v_service_role_key IS NOT NULL THEN
      PERFORM net.http_post(
        url := v_supabase_url || '/functions/v1/send-welcome-email',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_service_role_key
        ),
        body := jsonb_build_object(
          'user_id', NEW.id,
          'email', v_user_email,
          'full_name', v_user_name,
          'tenant_id', v_tenant_id
        )
      );
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      -- Welcome email failure should never block user creation
      -- The error is silently caught; monitoring should pick this up via pg_net logs
      NULL;
  END;

  RETURN NEW;
END;
$$;

-- Grant execute permission to postgres (trigger runs as definer)
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres;

-- Drop existing trigger if present to avoid conflicts
DROP TRIGGER IF EXISTS on_auth_user_created_handle_new_user ON auth.users;

-- Create trigger on auth.users AFTER INSERT
-- Uses a lower priority name to ensure it fires after handle_new_user_tenant_creation
CREATE TRIGGER on_auth_user_created_handle_new_user
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

COMMENT ON FUNCTION public.handle_new_user() IS 'Bootstraps new user account: creates user_profiles, credits (zero balance), auth_audit_log entry, and sends welcome email via edge function';
