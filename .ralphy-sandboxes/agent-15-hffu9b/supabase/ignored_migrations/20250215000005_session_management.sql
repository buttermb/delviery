-- ============================================
-- SESSION MANAGEMENT SYSTEM
-- Phase 2: Enhanced Security
-- ============================================

-- Add session limit settings to customer_users
ALTER TABLE public.customer_users 
ADD COLUMN IF NOT EXISTS max_concurrent_sessions INTEGER DEFAULT 5;

-- Add session management settings to tenants
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS max_customer_sessions INTEGER DEFAULT 5;

-- Create function to enforce session limits
CREATE OR REPLACE FUNCTION public.enforce_session_limit(
  customer_user_id_param UUID,
  tenant_id_param UUID,
  new_token TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  max_sessions INTEGER;
  current_sessions INTEGER;
  oldest_session_id UUID;
BEGIN
  -- Get max sessions (from tenant or default)
  SELECT COALESCE(
    (SELECT max_customer_sessions FROM tenants WHERE id = tenant_id_param),
    5
  ) INTO max_sessions;

  -- Count active sessions
  SELECT COUNT(*) INTO current_sessions
  FROM customer_sessions
  WHERE customer_user_id = customer_user_id_param
    AND expires_at > NOW();

  -- If at limit, revoke oldest session
  IF current_sessions >= max_sessions THEN
    SELECT id INTO oldest_session_id
    FROM customer_sessions
    WHERE customer_user_id = customer_user_id_param
      AND expires_at > NOW()
    ORDER BY created_at ASC
    LIMIT 1;

    IF oldest_session_id IS NOT NULL THEN
      UPDATE customer_sessions
      SET expires_at = NOW()
      WHERE id = oldest_session_id;
    END IF;
  END IF;
END;
$$;

-- Create trigger to enforce session limit on new session creation
CREATE OR REPLACE FUNCTION public.trigger_enforce_session_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM enforce_session_limit(
    NEW.customer_user_id,
    NEW.tenant_id,
    NEW.token
  );
  RETURN NEW;
END;
$$;

-- Add trigger
DROP TRIGGER IF EXISTS trigger_session_limit ON public.customer_sessions;

CREATE TRIGGER trigger_session_limit
  BEFORE INSERT ON public.customer_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_enforce_session_limit();

-- Function to get active sessions for a user
CREATE OR REPLACE FUNCTION public.get_active_sessions(customer_user_id_param UUID)
RETURNS TABLE (
  id UUID,
  token TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_current BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cs.id,
    cs.token,
    cs.ip_address,
    cs.user_agent,
    cs.created_at,
    cs.expires_at,
    FALSE as is_current -- Would need to pass current token to determine
  FROM customer_sessions cs
  WHERE cs.customer_user_id = customer_user_id_param
    AND cs.expires_at > NOW()
  ORDER BY cs.created_at DESC;
END;
$$;

-- Function to revoke all sessions except current
CREATE OR REPLACE FUNCTION public.revoke_all_sessions_except_current(
  customer_user_id_param UUID,
  current_token TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  revoked_count INTEGER;
BEGIN
  UPDATE customer_sessions
  SET expires_at = NOW()
  WHERE customer_user_id = customer_user_id_param
    AND token != current_token
    AND expires_at > NOW();

  GET DIAGNOSTICS revoked_count = ROW_COUNT;
  RETURN revoked_count;
END;
$$;

-- Add comments
COMMENT ON COLUMN public.customer_users.max_concurrent_sessions IS 'Maximum number of concurrent sessions allowed for this customer';
COMMENT ON COLUMN public.tenants.max_customer_sessions IS 'Default maximum concurrent sessions for customers in this tenant';
COMMENT ON FUNCTION public.enforce_session_limit IS 'Enforces session limit by revoking oldest session when limit is reached';
COMMENT ON FUNCTION public.get_active_sessions IS 'Returns all active sessions for a customer user';
COMMENT ON FUNCTION public.revoke_all_sessions_except_current IS 'Revokes all sessions except the current one (for logout all devices)';

