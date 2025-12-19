-- ============================================
-- PASSWORD RESET SYSTEM FOR CUSTOMERS
-- Phase 1: Critical Security & Compliance
-- ============================================

-- Create password_reset_tokens table
CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_user_id UUID NOT NULL REFERENCES public.customer_users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON public.password_reset_tokens(token) WHERE used_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_customer_user ON public.password_reset_tokens(customer_user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_tenant ON public.password_reset_tokens(tenant_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires ON public.password_reset_tokens(expires_at) WHERE used_at IS NULL;

-- Add RLS policies
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can manage all tokens (for edge functions)
CREATE POLICY "password_reset_tokens_service_role"
  ON public.password_reset_tokens FOR ALL
  USING (true)
  WITH CHECK (true);

-- Function to clean up expired tokens (run periodically)
CREATE OR REPLACE FUNCTION public.cleanup_expired_password_tokens()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.password_reset_tokens
  WHERE expires_at < NOW() - INTERVAL '24 hours'
    OR used_at IS NOT NULL;
END;
$$;

-- Add comment
COMMENT ON TABLE public.password_reset_tokens IS 'Stores password reset tokens for customer password recovery';
COMMENT ON COLUMN public.password_reset_tokens.token IS 'Unique token for password reset (URL-safe)';
COMMENT ON COLUMN public.password_reset_tokens.expires_at IS 'Token expiration time (default 24 hours)';
COMMENT ON COLUMN public.password_reset_tokens.used_at IS 'Timestamp when token was used (prevents reuse)';

