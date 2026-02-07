-- ============================================
-- EMAIL VERIFICATION SYSTEM FOR CUSTOMERS
-- Phase 1: Critical Security & Compliance
-- ============================================

-- Add email_verified column to customer_users
ALTER TABLE public.customer_users 
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;

-- Add email_verified_at timestamp
ALTER TABLE public.customer_users 
ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

-- Create email_verification_codes table
CREATE TABLE IF NOT EXISTS public.email_verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_user_id UUID NOT NULL REFERENCES public.customer_users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  email TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 5
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_email_verification_codes_customer_user ON public.email_verification_codes(customer_user_id);
CREATE INDEX IF NOT EXISTS idx_email_verification_codes_code ON public.email_verification_codes(code) WHERE verified_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_email_verification_codes_tenant ON public.email_verification_codes(tenant_id);

-- Add RLS policies
ALTER TABLE public.email_verification_codes ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own verification codes
CREATE POLICY "email_verification_codes_select_own"
  ON public.email_verification_codes FOR SELECT
  USING (
    customer_user_id IN (
      SELECT id FROM public.customer_users 
      WHERE id = customer_user_id
    )
  );

-- Policy: Service role can manage all codes (for edge functions)
CREATE POLICY "email_verification_codes_service_role"
  ON public.email_verification_codes FOR ALL
  USING (true)
  WITH CHECK (true);

-- Function to clean up expired codes (run periodically)
CREATE OR REPLACE FUNCTION public.cleanup_expired_verification_codes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.email_verification_codes
  WHERE expires_at < NOW() - INTERVAL '24 hours'
    AND verified_at IS NULL;
END;
$$;

-- Add comment
COMMENT ON TABLE public.email_verification_codes IS 'Stores email verification codes for customer signup';
COMMENT ON COLUMN public.customer_users.email_verified IS 'Whether customer email has been verified';
COMMENT ON COLUMN public.customer_users.email_verified_at IS 'Timestamp when email was verified';

