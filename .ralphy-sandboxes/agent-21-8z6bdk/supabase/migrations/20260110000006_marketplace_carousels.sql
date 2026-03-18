-- Dynamic Carousels Builder for Storefront
-- Allows stores to create custom product carousels like "Best Sellers", "Staff Picks", etc.

CREATE TABLE IF NOT EXISTS public.marketplace_carousels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.marketplace_stores(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subtitle TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  
  -- Filtering options
  filter_type TEXT DEFAULT 'manual', -- 'manual', 'bestselling', 'newest', 'category', 'tag', 'price_low', 'price_high'
  filter_category TEXT, -- Category name for category filtering
  filter_tag TEXT, -- Tag for tag-based filtering
  filter_brand TEXT, -- Brand filter
  
  -- Product IDs for manual selection
  product_ids UUID[] DEFAULT '{}',
  
  -- Display settings
  max_items INTEGER DEFAULT 8,
  show_on_homepage BOOLEAN DEFAULT true,
  show_on_category_pages BOOLEAN DEFAULT false,
  
  -- Style options
  card_style TEXT DEFAULT 'default', -- 'default', 'compact', 'featured'
  background_color TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for quick store lookup
CREATE INDEX IF NOT EXISTS idx_marketplace_carousels_store
ON public.marketplace_carousels(store_id, is_active, sort_order);

-- RLS
ALTER TABLE public.marketplace_carousels ENABLE ROW LEVEL SECURITY;

-- Anyone can read active carousels (for storefront display)
CREATE POLICY "Anyone can read active carousels"
ON public.marketplace_carousels FOR SELECT
USING (is_active = true);

-- Store owners can manage their carousels
CREATE POLICY "Store owners can manage carousels"
ON public.marketplace_carousels FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.marketplace_stores ms
    INNER JOIN public.tenant_users tu ON ms.tenant_id = tu.tenant_id
    WHERE ms.id = marketplace_carousels.store_id
    AND tu.id = auth.uid()::text::uuid
  )
);

-- RPC: Get active carousels with products for a store
CREATE OR REPLACE FUNCTION get_marketplace_carousels(p_store_id UUID)
RETURNS TABLE (
  id UUID,
  title TEXT,
  subtitle TEXT,
  filter_type TEXT,
  product_ids UUID[],
  max_items INTEGER,
  card_style TEXT,
  background_color TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mc.id,
    mc.title,
    mc.subtitle,
    mc.filter_type,
    mc.product_ids,
    mc.max_items,
    mc.card_style,
    mc.background_color
  FROM public.marketplace_carousels mc
  WHERE mc.store_id = p_store_id
  AND mc.is_active = true
  AND mc.show_on_homepage = true
  ORDER BY mc.sort_order ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE public.marketplace_carousels IS 'Custom product carousels for storefront homepage';
