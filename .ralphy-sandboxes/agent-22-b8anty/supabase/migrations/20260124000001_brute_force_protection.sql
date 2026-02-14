-- ============================================================================
-- Brute Force Protection Migration
-- Generated: 2026-01-24
-- Purpose: Track failed logins by IP in auth_audit_log, block IP after 10
--          failed attempts across any account within 1 hour, implement IP
--          allowlist for known good IPs
-- ============================================================================

-- ============================================================================
-- PHASE 1: Create auth_audit_log table for tracking login attempts by IP
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.auth_audit_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type text NOT NULL,
    ip_address text NOT NULL,
    email text,
    user_agent text,
    success boolean NOT NULL DEFAULT false,
    failure_reason text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast IP-based lookups within time windows
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_ip_created
    ON public.auth_audit_log (ip_address, created_at DESC);

-- Index for event type filtering
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_event_type
    ON public.auth_audit_log (event_type, created_at DESC);

-- Index for email-based lookups
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_email
    ON public.auth_audit_log (email, created_at DESC);

-- Enable RLS
ALTER TABLE public.auth_audit_log ENABLE ROW LEVEL SECURITY;

-- Only service_role can access this table
CREATE POLICY "service_role_full_access" ON public.auth_audit_log
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Block all other access
CREATE POLICY "block_anon_access" ON public.auth_audit_log
    FOR ALL
    TO anon
    USING (false);

CREATE POLICY "block_authenticated_access" ON public.auth_audit_log
    FOR ALL
    TO authenticated
    USING (false);

-- ============================================================================
-- PHASE 2: Create IP allowlist table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ip_allowlist (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address text NOT NULL,
    description text,
    added_by uuid,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ip_allowlist_ip_address_unique UNIQUE (ip_address)
);

-- Enable RLS
ALTER TABLE public.ip_allowlist ENABLE ROW LEVEL SECURITY;

-- Only service_role can manage allowlist
CREATE POLICY "service_role_full_access" ON public.ip_allowlist
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Block all other access
CREATE POLICY "block_anon_access" ON public.ip_allowlist
    FOR ALL
    TO anon
    USING (false);

CREATE POLICY "block_authenticated_access" ON public.ip_allowlist
    FOR ALL
    TO authenticated
    USING (false);

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION public.update_ip_allowlist_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_ip_allowlist_updated_at_trigger ON public.ip_allowlist;
CREATE TRIGGER update_ip_allowlist_updated_at_trigger
    BEFORE UPDATE ON public.ip_allowlist
    FOR EACH ROW EXECUTE FUNCTION public.update_ip_allowlist_updated_at();

-- ============================================================================
-- PHASE 3: Create function to log auth events
-- ============================================================================

CREATE OR REPLACE FUNCTION public.log_auth_audit_event(
    p_event_type text,
    p_ip_address text,
    p_email text DEFAULT NULL,
    p_success boolean DEFAULT false,
    p_failure_reason text DEFAULT NULL,
    p_user_agent text DEFAULT NULL,
    p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event_id uuid;
BEGIN
    INSERT INTO public.auth_audit_log (
        event_type,
        ip_address,
        email,
        success,
        failure_reason,
        user_agent,
        metadata
    ) VALUES (
        p_event_type,
        p_ip_address,
        p_email,
        p_success,
        p_failure_reason,
        p_user_agent,
        p_metadata
    )
    RETURNING id INTO v_event_id;

    RETURN v_event_id;
END;
$$;

-- ============================================================================
-- PHASE 4: Create function to check if IP is blocked (brute force detection)
-- Blocks IP after 10 failed attempts across ANY account within 1 hour
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_ip_brute_force(
    p_ip_address text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_is_allowlisted boolean;
    v_failed_count int;
    v_is_blocked boolean;
BEGIN
    -- Check if IP is in the allowlist (bypass brute force check)
    SELECT EXISTS (
        SELECT 1 FROM public.ip_allowlist
        WHERE ip_address = p_ip_address
        AND is_active = true
    ) INTO v_is_allowlisted;

    IF v_is_allowlisted THEN
        RETURN jsonb_build_object(
            'blocked', false,
            'allowlisted', true,
            'failed_attempts', 0
        );
    END IF;

    -- Count failed login attempts from this IP in the last hour
    SELECT COUNT(*) INTO v_failed_count
    FROM public.auth_audit_log
    WHERE ip_address = p_ip_address
    AND event_type = 'login_attempt'
    AND success = false
    AND created_at > now() - interval '1 hour';

    v_is_blocked := v_failed_count >= 10;

    -- If newly blocked, log a security event
    IF v_is_blocked THEN
        INSERT INTO public.security_events (
            event_type,
            severity,
            details,
            ip_address,
            created_at
        ) VALUES (
            'ip_brute_force_blocked',
            'critical',
            jsonb_build_object(
                'ip_address', p_ip_address,
                'failed_attempts', v_failed_count,
                'window', '1 hour',
                'threshold', 10
            ),
            p_ip_address,
            now()
        )
        ON CONFLICT DO NOTHING;
    END IF;

    RETURN jsonb_build_object(
        'blocked', v_is_blocked,
        'allowlisted', false,
        'failed_attempts', v_failed_count
    );
END;
$$;

-- ============================================================================
-- PHASE 5: Permissions
-- ============================================================================

-- Revoke public access to security functions
REVOKE ALL ON FUNCTION public.log_auth_audit_event FROM public;
REVOKE ALL ON FUNCTION public.check_ip_brute_force FROM public;
REVOKE ALL ON FUNCTION public.update_ip_allowlist_updated_at FROM public;

-- Grant to service_role only (edge functions use service_role)
GRANT EXECUTE ON FUNCTION public.log_auth_audit_event TO service_role;
GRANT EXECUTE ON FUNCTION public.check_ip_brute_force TO service_role;

-- ============================================================================
-- PHASE 6: Retention policy for auth_audit_log (keep 90 days)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_auth_audit_log()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM public.auth_audit_log
    WHERE created_at < now() - interval '90 days';
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_auth_audit_log FROM public;
GRANT EXECUTE ON FUNCTION public.cleanup_auth_audit_log TO service_role;

-- ============================================================================
-- PHASE 7: Seed common private network IPs as allowlisted
-- These are safe internal IPs that should never be blocked
-- ============================================================================

INSERT INTO public.ip_allowlist (ip_address, description) VALUES
    ('127.0.0.1', 'Localhost IPv4'),
    ('::1', 'Localhost IPv6')
ON CONFLICT (ip_address) DO NOTHING;

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- This migration implements:
-- 1. auth_audit_log table - Tracks all login attempts by IP with indexes
-- 2. ip_allowlist table - Maintains trusted IPs that bypass brute force checks
-- 3. log_auth_audit_event() - RPC to log login attempts
-- 4. check_ip_brute_force() - RPC to check if IP is blocked (10 failures/hour)
-- 5. cleanup_auth_audit_log() - Retention policy (90 days)
-- 6. Proper RLS and permissions (service_role only)
-- ============================================================================
