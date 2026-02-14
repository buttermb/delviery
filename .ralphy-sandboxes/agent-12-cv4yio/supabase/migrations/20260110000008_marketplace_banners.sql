-- Marketplace Banners System
-- Supports rotating hero banners with text, buttons, and links

CREATE TABLE IF NOT EXISTS public.marketplace_banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.marketplace_stores(id) ON DELETE CASCADE,
  
  -- Banner Content
  heading TEXT,
  subheading TEXT,
  button_text TEXT,
  button_link TEXT,
  image_url TEXT NOT NULL,
  
  -- Configuration
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for lookup
CREATE INDEX IF NOT EXISTS idx_marketplace_banners_store 
ON public.marketplace_banners(store_id, is_active, display_order);

-- RLS
ALTER TABLE public.marketplace_banners ENABLE ROW LEVEL SECURITY;

-- Public read access for active banners
CREATE POLICY "Anyone can read active banners"
ON public.marketplace_banners FOR SELECT
USING (is_active = true);

-- Store owners management
CREATE POLICY "Store owners can manage banners"
ON public.marketplace_banners FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.marketplace_stores ms
    INNER JOIN public.tenant_users tu ON ms.tenant_id = tu.tenant_id
    WHERE ms.id = marketplace_banners.store_id
    AND tu.id = auth.uid()::text::uuid
  )
);

-- RPC: Get active store banners
CREATE OR REPLACE FUNCTION get_marketplace_banners(p_store_id UUID)
RETURNS TABLE (
  id UUID,
  heading TEXT,
  subheading TEXT,
  button_text TEXT,
  button_link TEXT,
  image_url TEXT,
  display_order INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mb.id,
    mb.heading,
    mb.subheading,
    mb.button_text,
    mb.button_link,
    mb.image_url,
    mb.display_order
  FROM public.marketplace_banners mb
  WHERE mb.store_id = p_store_id
  AND mb.is_active = true
  ORDER BY mb.display_order ASC, mb.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE public.marketplace_banners IS 'Rotating hero banners for the storefront homepage';
