-- ============================================
-- STOREFRONT ENCRYPTED LINKS
-- Add encrypted URL tokens for private shareable links
-- ============================================

-- Add encrypted_url_token to marketplace_stores if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'marketplace_stores'
        AND column_name = 'encrypted_url_token'
    ) THEN
        ALTER TABLE public.marketplace_stores
        ADD COLUMN encrypted_url_token VARCHAR(64) UNIQUE;
        
        COMMENT ON COLUMN public.marketplace_stores.encrypted_url_token IS 'Encrypted token for private shareable store links';
    END IF;
END $$;

-- Create index for fast token lookups
CREATE INDEX IF NOT EXISTS idx_marketplace_stores_encrypted_token 
ON public.marketplace_stores(encrypted_url_token) 
WHERE encrypted_url_token IS NOT NULL;

-- Function to generate encrypted token for a store
CREATE OR REPLACE FUNCTION public.generate_store_token(p_store_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_token TEXT;
BEGIN
    -- Generate a unique token
    v_token := replace(gen_random_uuid()::text, '-', '');
    
    -- Update the store with the new token
    UPDATE public.marketplace_stores
    SET encrypted_url_token = v_token
    WHERE id = p_store_id;
    
    RETURN v_token;
END;
$$;

-- Function to lookup store by encrypted token (public access for redirect)
CREATE OR REPLACE FUNCTION public.lookup_store_by_token(p_token TEXT)
RETURNS TABLE (
    id UUID,
    slug TEXT,
    store_name TEXT,
    is_active BOOLEAN,
    is_public BOOLEAN,
    tenant_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ms.id,
        ms.slug,
        ms.store_name,
        ms.is_active,
        ms.is_public,
        ms.tenant_id
    FROM public.marketplace_stores ms
    WHERE ms.encrypted_url_token = p_token;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.generate_store_token TO authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_store_by_token TO authenticated, anon;

-- Generate tokens for existing stores that don't have one
UPDATE public.marketplace_stores
SET encrypted_url_token = replace(gen_random_uuid()::text, '-', '')
WHERE encrypted_url_token IS NULL;

COMMENT ON FUNCTION public.generate_store_token IS 'Generates a new encrypted URL token for a store';
COMMENT ON FUNCTION public.lookup_store_by_token IS 'Looks up a store by its encrypted URL token';
