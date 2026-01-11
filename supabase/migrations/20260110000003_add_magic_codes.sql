-- Add magic codes table for passwordless authentication
-- Enables "Sign in with Magic Code" feature like Flowhub

CREATE TABLE IF NOT EXISTS public.marketplace_magic_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.marketplace_stores(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- One code per email per store at a time
  CONSTRAINT marketplace_magic_codes_store_email_key UNIQUE (store_id, email)
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_magic_codes_lookup 
  ON public.marketplace_magic_codes(store_id, email, code);

-- Index for cleanup of expired codes
CREATE INDEX IF NOT EXISTS idx_magic_codes_expires 
  ON public.marketplace_magic_codes(expires_at);

-- Enable RLS
ALTER TABLE public.marketplace_magic_codes ENABLE ROW LEVEL SECURITY;

-- Policy: Allow insert from authenticated or anon (for guest checkout flow)
CREATE POLICY "Allow magic code insert" ON public.marketplace_magic_codes
  FOR INSERT WITH CHECK (true);

-- Policy: Allow select/delete for code verification
CREATE POLICY "Allow magic code verification" ON public.marketplace_magic_codes
  FOR SELECT USING (true);

CREATE POLICY "Allow magic code deletion" ON public.marketplace_magic_codes
  FOR DELETE USING (true);

-- Function to clean up expired codes (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_magic_codes()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.marketplace_magic_codes
  WHERE expires_at < now();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

COMMENT ON TABLE public.marketplace_magic_codes IS 'Temporary magic codes for passwordless customer authentication';
