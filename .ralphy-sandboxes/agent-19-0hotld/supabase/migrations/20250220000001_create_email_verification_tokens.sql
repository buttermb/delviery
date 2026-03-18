-- ============================================
-- EMAIL VERIFICATION TOKENS TABLE
-- Stores hashed tokens for auth.users email verification
-- ============================================

-- Create email_verification_tokens table
CREATE TABLE IF NOT EXISTS public.email_verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index on token_hash for fast lookups
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_token_hash
  ON public.email_verification_tokens(token_hash);

-- Index on user_id for user-specific queries
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user_id
  ON public.email_verification_tokens(user_id);

-- Enable Row Level Security
ALTER TABLE public.email_verification_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own verification tokens
CREATE POLICY "users_select_own_verification_tokens"
  ON public.email_verification_tokens
  FOR SELECT
  USING (user_id = auth.uid());

-- Policy: Service role can manage all tokens (for edge functions)
CREATE POLICY "service_role_manage_verification_tokens"
  ON public.email_verification_tokens
  FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.email_verification_tokens IS 'Stores hashed email verification tokens for auth.users';
