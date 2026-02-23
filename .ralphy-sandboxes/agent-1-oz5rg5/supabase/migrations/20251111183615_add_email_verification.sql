-- Add Email Verification Fields to tenant_users
-- Supports hybrid approach: immediate access with 7-day verification deadline

-- Add email verification columns
ALTER TABLE public.tenant_users
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS email_verification_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS email_verification_token_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS verification_reminder_sent BOOLEAN DEFAULT false;

-- Add index for faster queries on verification status
CREATE INDEX IF NOT EXISTS idx_tenant_users_email_verified 
ON public.tenant_users(email_verified) 
WHERE email_verified = false;

-- Add index for reminder queries
CREATE INDEX IF NOT EXISTS idx_tenant_users_verification_reminder 
ON public.tenant_users(verification_reminder_sent, email_verified, created_at) 
WHERE email_verified = false AND verification_reminder_sent = false;

-- Add comment for documentation
COMMENT ON COLUMN public.tenant_users.email_verified IS 'Whether the user has verified their email address';
COMMENT ON COLUMN public.tenant_users.email_verification_sent_at IS 'Timestamp when verification email was sent';
COMMENT ON COLUMN public.tenant_users.email_verification_token_expires_at IS 'Timestamp when verification token expires (7 days from signup)';
COMMENT ON COLUMN public.tenant_users.verification_reminder_sent IS 'Whether a verification reminder email has been sent';

