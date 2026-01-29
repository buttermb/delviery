-- ============================================
-- INVITATION EXPIRATION SYSTEM
-- Phase 3: UX Improvements
-- ============================================

-- Add expiration to tenant_invitations table
ALTER TABLE public.tenant_invitations 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Set default expiration (7 days) for existing invitations without expiration
UPDATE public.tenant_invitations
SET expires_at = created_at + INTERVAL '7 days'
WHERE expires_at IS NULL
  AND accepted_at IS NULL;

-- Add expiration to invitations table (menu invitations)
ALTER TABLE public.invitations
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Set default expiration (30 days) for existing menu invitations without expiration
UPDATE public.invitations
SET expires_at = sent_at + INTERVAL '30 days'
WHERE expires_at IS NULL
  AND status != 'accessed';

-- Add expiration to menu_access_whitelist (disposable menu access)
ALTER TABLE public.menu_access_whitelist
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Set default expiration (30 days) for existing whitelist entries
UPDATE public.menu_access_whitelist
SET expires_at = created_at + INTERVAL '30 days'
WHERE expires_at IS NULL;

-- Create indexes for expiration queries
CREATE INDEX IF NOT EXISTS idx_tenant_invitations_expires ON public.tenant_invitations(expires_at) WHERE accepted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invitations_expires ON public.invitations(expires_at) WHERE status != 'accessed';
CREATE INDEX IF NOT EXISTS idx_menu_access_whitelist_expires ON public.menu_access_whitelist(expires_at);

-- Function to clean up expired invitations
CREATE OR REPLACE FUNCTION public.cleanup_expired_invitations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Mark expired tenant invitations
  UPDATE public.tenant_invitations
  SET status = 'expired'
  WHERE expires_at < NOW()
    AND accepted_at IS NULL
    AND status != 'expired';

  -- Mark expired menu invitations
  UPDATE public.invitations
  SET status = 'expired'
  WHERE expires_at < NOW()
    AND status NOT IN ('accessed', 'expired');

  -- Mark expired whitelist entries
  UPDATE public.menu_access_whitelist
  SET status = 'expired'
  WHERE expires_at < NOW()
    AND status != 'expired';
END;
$$;

-- Add comments
COMMENT ON COLUMN public.tenant_invitations.expires_at IS 'Invitation expiration date (default 7 days from creation)';
COMMENT ON COLUMN public.invitations.expires_at IS 'Menu invitation expiration date (default 30 days from sent_at)';
COMMENT ON COLUMN public.menu_access_whitelist.expires_at IS 'Menu access expiration date (default 30 days from creation)';
COMMENT ON FUNCTION public.cleanup_expired_invitations IS 'Marks expired invitations as expired (runs periodically)';

