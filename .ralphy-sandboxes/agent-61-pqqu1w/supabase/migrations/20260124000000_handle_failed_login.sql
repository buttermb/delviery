-- Migration: handle_failed_login
-- Adds failed login tracking columns to profiles and creates the handle_failed_login function
-- that increments attempts, locks accounts after 5 failures, and logs to audit_logs

-- 1. Add failed login tracking columns to profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS failed_login_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until timestamptz;

-- 2. Create index for locked account lookups
CREATE INDEX IF NOT EXISTS idx_profiles_locked_until
  ON public.profiles(locked_until)
  WHERE locked_until IS NOT NULL;

-- 3. Create the handle_failed_login function
CREATE OR REPLACE FUNCTION public.handle_failed_login(
  p_user_id uuid,
  p_ip_address text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempts integer;
  v_locked boolean := false;
  v_ip text;
  v_ua text;
BEGIN
  -- Resolve IP and user agent from parameters or request headers
  v_ip := COALESCE(p_ip_address, current_setting('request.header.x-real-ip', true));
  v_ua := COALESCE(p_user_agent, current_setting('request.header.user-agent', true));

  -- Increment failed_login_attempts and get the new count
  UPDATE public.profiles
  SET failed_login_attempts = failed_login_attempts + 1
  WHERE user_id = p_user_id
  RETURNING failed_login_attempts INTO v_attempts;

  -- If no profile found, still log the event and return
  IF v_attempts IS NULL THEN
    INSERT INTO public.audit_logs (
      actor_id,
      actor_type,
      action,
      resource_type,
      resource_id,
      changes,
      ip_address,
      user_agent
    ) VALUES (
      p_user_id,
      'system',
      'login_failed',
      'user',
      p_user_id,
      jsonb_build_object(
        'ip', v_ip,
        'user_agent', v_ua,
        'reason', 'profile_not_found'
      ),
      v_ip,
      v_ua
    );

    RETURN jsonb_build_object(
      'locked', false,
      'attempts', 0,
      'error', 'profile_not_found'
    );
  END IF;

  -- If attempts >= 5, lock the account for 30 minutes
  IF v_attempts >= 5 THEN
    UPDATE public.profiles
    SET locked_until = now() + interval '30 minutes'
    WHERE user_id = p_user_id;

    v_locked := true;

    -- Log account_locked event to audit_logs
    INSERT INTO public.audit_logs (
      actor_id,
      actor_type,
      action,
      resource_type,
      resource_id,
      changes,
      ip_address,
      user_agent
    ) VALUES (
      p_user_id,
      'system',
      'account_locked',
      'user',
      p_user_id,
      jsonb_build_object(
        'ip', v_ip,
        'user_agent', v_ua,
        'attempts', v_attempts,
        'locked_until', (now() + interval '30 minutes')::text,
        'reason', 'too_many_failed_attempts'
      ),
      v_ip,
      v_ua
    );
  END IF;

  -- Always log login_failed event to audit_logs
  INSERT INTO public.audit_logs (
    actor_id,
    actor_type,
    action,
    resource_type,
    resource_id,
    changes,
    ip_address,
    user_agent
  ) VALUES (
    p_user_id,
    'system',
    'login_failed',
    'user',
    p_user_id,
    jsonb_build_object(
      'ip', v_ip,
      'user_agent', v_ua,
      'attempts', v_attempts
    ),
    v_ip,
    v_ua
  );

  RETURN jsonb_build_object(
    'locked', v_locked,
    'attempts', v_attempts,
    'locked_until', CASE WHEN v_locked THEN (now() + interval '30 minutes')::text ELSE NULL END
  );
END;
$$;

COMMENT ON FUNCTION public.handle_failed_login IS 'Increments failed login attempts, locks account after 5 failures for 30 minutes, and logs all events to audit_logs';
