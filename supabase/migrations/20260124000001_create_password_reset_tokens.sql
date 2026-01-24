-- ============================================
-- PASSWORD RESET TOKENS TABLE
-- Secure token storage for auth.users password resets
-- with automatic cleanup via pg_cron
-- ============================================

-- Drop existing password_reset_tokens table if it exists (old schema referenced customer_users)
DROP TABLE IF EXISTS public.password_reset_tokens CASCADE;

-- Create password_reset_tokens table
CREATE TABLE public.password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on token_hash for fast lookups
CREATE INDEX idx_password_reset_tokens_token_hash
  ON public.password_reset_tokens(token_hash)
  WHERE used_at IS NULL;

-- Additional index on user_id for user-scoped queries
CREATE INDEX idx_password_reset_tokens_user_id
  ON public.password_reset_tokens(user_id);

-- Index on expires_at for cleanup queries
CREATE INDEX idx_password_reset_tokens_expires_at
  ON public.password_reset_tokens(expires_at)
  WHERE used_at IS NULL;

-- Enable RLS
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only service role can manage tokens (used by edge functions)
-- No direct user access - tokens are validated server-side only
CREATE POLICY "password_reset_tokens_service_role_all"
  ON public.password_reset_tokens
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to clean up expired and used tokens
CREATE OR REPLACE FUNCTION public.cleanup_expired_reset_tokens()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.password_reset_tokens
  WHERE expires_at < NOW()
    OR used_at IS NOT NULL;
END;
$$;

-- Grant execute to service_role
GRANT EXECUTE ON FUNCTION public.cleanup_expired_reset_tokens() TO service_role;

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule automatic cleanup every hour
SELECT cron.schedule(
  'cleanup-expired-reset-tokens',
  '0 * * * *',
  'SELECT public.cleanup_expired_reset_tokens()'
);

-- Comments
COMMENT ON TABLE public.password_reset_tokens IS 'Stores hashed password reset tokens for auth.users with automatic expiration cleanup';
COMMENT ON COLUMN public.password_reset_tokens.user_id IS 'References auth.users - the user requesting password reset';
COMMENT ON COLUMN public.password_reset_tokens.token_hash IS 'SHA-256 hash of the reset token (plain token is never stored)';
COMMENT ON COLUMN public.password_reset_tokens.expires_at IS 'Token expiration timestamp';
COMMENT ON COLUMN public.password_reset_tokens.used_at IS 'Timestamp when token was consumed (prevents reuse)';
