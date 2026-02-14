-- ============================================================================
-- handle_user_login: Database function for processing successful user logins
-- Updates user_profiles, creates audit log entry, manages user sessions
-- ============================================================================

-- Ensure prerequisite tables exist (created by parallel migrations)
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    phone TEXT,
    role TEXT DEFAULT 'customer',
    email_verified BOOLEAN DEFAULT false,
    phone_verified BOOLEAN DEFAULT false,
    last_login_at TIMESTAMPTZ,
    login_count INTEGER DEFAULT 0,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.auth_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    tenant_id UUID,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'login_success', 'login_failed', 'logout',
        'password_reset', 'password_change', 'email_change',
        'account_locked', 'account_unlocked', 'session_revoked',
        'signup_started', 'signup_completed'
    )),
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    session_token TEXT UNIQUE NOT NULL,
    refresh_token TEXT UNIQUE,
    device_info JSONB DEFAULT '{}'::jsonb,
    ip_address INET,
    location JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMPTZ NOT NULL,
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Function: handle_user_login
-- Called after successful authentication to update login tracking,
-- create audit entries, and manage session records.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_user_login(
    p_user_id UUID,
    p_session_token TEXT,
    p_refresh_token TEXT DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_device_info JSONB DEFAULT '{}'::jsonb,
    p_tenant_id UUID DEFAULT NULL,
    p_session_expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_profile_exists BOOLEAN;
    v_session_id UUID;
    v_login_count INTEGER;
    v_location JSONB DEFAULT '{}'::jsonb;
BEGIN
    -- Verify user exists in auth.users
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
        RAISE EXCEPTION 'User not found: %', p_user_id;
    END IF;

    -- Check if user profile exists
    SELECT EXISTS(
        SELECT 1 FROM public.user_profiles WHERE user_id = p_user_id
    ) INTO v_profile_exists;

    IF NOT v_profile_exists THEN
        RAISE EXCEPTION 'User profile not found for user: %', p_user_id;
    END IF;

    -- Update user_profiles: set last_login_at, increment login_count, reset failed attempts
    UPDATE public.user_profiles
    SET
        last_login_at = NOW(),
        login_count = login_count + 1,
        failed_login_attempts = 0,
        locked_until = NULL,
        updated_at = NOW()
    WHERE user_id = p_user_id
    RETURNING login_count INTO v_login_count;

    -- Create auth_audit_log entry for login_success
    INSERT INTO public.auth_audit_log (
        user_id,
        tenant_id,
        event_type,
        ip_address,
        user_agent,
        metadata
    ) VALUES (
        p_user_id,
        p_tenant_id,
        'login_success',
        p_ip_address,
        p_user_agent,
        jsonb_build_object(
            'login_count', v_login_count,
            'device_info', p_device_info
        )
    );

    -- Deactivate any existing active sessions for this user with the same device
    -- to prevent session accumulation
    UPDATE public.user_sessions
    SET
        is_active = false,
        last_activity_at = NOW()
    WHERE user_id = p_user_id
      AND is_active = true
      AND device_info = p_device_info
      AND p_device_info != '{}'::jsonb;

    -- Insert or update user_sessions row
    INSERT INTO public.user_sessions (
        user_id,
        tenant_id,
        session_token,
        refresh_token,
        device_info,
        ip_address,
        location,
        is_active,
        expires_at,
        last_activity_at,
        created_at
    ) VALUES (
        p_user_id,
        p_tenant_id,
        p_session_token,
        p_refresh_token,
        p_device_info,
        p_ip_address,
        v_location,
        true,
        p_session_expires_at,
        NOW(),
        NOW()
    )
    ON CONFLICT (session_token) DO UPDATE SET
        refresh_token = EXCLUDED.refresh_token,
        device_info = EXCLUDED.device_info,
        ip_address = EXCLUDED.ip_address,
        is_active = true,
        expires_at = EXCLUDED.expires_at,
        last_activity_at = NOW()
    RETURNING id INTO v_session_id;

    -- Return summary of the login action
    RETURN jsonb_build_object(
        'success', true,
        'user_id', p_user_id,
        'session_id', v_session_id,
        'login_count', v_login_count,
        'logged_at', NOW()
    );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.handle_user_login(UUID, TEXT, TEXT, INET, TEXT, JSONB, UUID, TIMESTAMPTZ) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.handle_user_login IS 'Handles successful user login: updates profile login stats, resets failed attempts, creates audit log entry, and manages session records.';
