-- ============================================================================
-- ADD MFA AND OAUTH SETTINGS TO TENANTS TABLE
-- ============================================================================

-- Add MFA requirement column to tenants
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS mfa_required boolean DEFAULT false;

-- Add allowed auth providers column to tenants
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS allowed_auth_providers text[] DEFAULT ARRAY['email'];

-- Add MFA enrollment tracking to tenant_users
ALTER TABLE public.tenant_users ADD COLUMN IF NOT EXISTS mfa_enabled boolean DEFAULT false;
ALTER TABLE public.tenant_users ADD COLUMN IF NOT EXISTS mfa_enrolled_at timestamptz;

-- Add comments for documentation
COMMENT ON COLUMN public.tenants.mfa_required IS 'Whether MFA is required for all users in this tenant';
COMMENT ON COLUMN public.tenants.allowed_auth_providers IS 'List of allowed auth providers (email, google, etc.)';
COMMENT ON COLUMN public.tenant_users.mfa_enabled IS 'Whether MFA is enabled for this user';
COMMENT ON COLUMN public.tenant_users.mfa_enrolled_at IS 'Timestamp when MFA was enrolled';

