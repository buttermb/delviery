-- ============================================
-- USER SESSIONS TABLE
-- Tracks authenticated user sessions with device info,
-- location, and expiration for security management
-- ============================================

-- Create user_sessions table
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  session_token text UNIQUE NOT NULL,
  refresh_token text UNIQUE,
  device_info jsonb DEFAULT '{}'::jsonb,
  ip_address inet,
  location jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  expires_at timestamptz NOT NULL,
  last_activity_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Add comments for documentation
COMMENT ON TABLE public.user_sessions IS 'Tracks authenticated user sessions with device and location info';
COMMENT ON COLUMN public.user_sessions.user_id IS 'References auth.users - the session owner';
COMMENT ON COLUMN public.user_sessions.tenant_id IS 'Optional tenant context for the session';
COMMENT ON COLUMN public.user_sessions.session_token IS 'Unique token identifying this session';
COMMENT ON COLUMN public.user_sessions.refresh_token IS 'Optional refresh token for session renewal';
COMMENT ON COLUMN public.user_sessions.device_info IS 'JSON with user_agent, browser, os, device_type';
COMMENT ON COLUMN public.user_sessions.ip_address IS 'Client IP address (inet type for IPv4/IPv6)';
COMMENT ON COLUMN public.user_sessions.location IS 'JSON with city, country from IP geolocation';
COMMENT ON COLUMN public.user_sessions.is_active IS 'Whether session is currently active';
COMMENT ON COLUMN public.user_sessions.expires_at IS 'When the session expires';
COMMENT ON COLUMN public.user_sessions.last_activity_at IS 'Last time session was used';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_token ON public.user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_tenant_id ON public.user_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON public.user_sessions(expires_at)
  WHERE is_active = true;

-- Enable Row Level Security
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only view their own sessions
CREATE POLICY "Users can view own sessions"
  ON public.user_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Users can insert their own sessions
CREATE POLICY "Users can insert own sessions"
  ON public.user_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can update their own sessions (e.g., deactivate)
CREATE POLICY "Users can update own sessions"
  ON public.user_sessions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can delete their own sessions
CREATE POLICY "Users can delete own sessions"
  ON public.user_sessions
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add constraint to validate device_info structure
ALTER TABLE public.user_sessions
  ADD CONSTRAINT check_device_info_structure CHECK (
    device_info IS NULL OR (
      device_info = '{}'::jsonb OR (
        device_info ? 'user_agent' OR
        device_info ? 'browser' OR
        device_info ? 'os' OR
        device_info ? 'device_type'
      )
    )
  );

-- Add constraint to validate location structure
ALTER TABLE public.user_sessions
  ADD CONSTRAINT check_location_structure CHECK (
    location IS NULL OR (
      location = '{}'::jsonb OR (
        location ? 'city' OR
        location ? 'country'
      )
    )
  );
