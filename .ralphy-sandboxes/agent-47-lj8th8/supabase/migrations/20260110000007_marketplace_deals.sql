-- Marketplace Deals System
-- Supports "Munchie Monday", "Token Tuesday", product-specific, and future-dated deals

CREATE TABLE IF NOT EXISTS public.marketplace_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.marketplace_stores(id) ON DELETE CASCADE,
  
  -- Deal Info
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  
  -- Discount Configuration
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC NOT NULL,
  
  -- Targeting
  applies_to TEXT NOT NULL CHECK (applies_to IN ('order', 'category', 'brand', 'collection', 'product')),
  target_value TEXT, -- The category name, brand name, collection ID, or product ID
  
  -- Validation Limits
  min_order_amount NUMERIC DEFAULT 0,
  max_discount_amount NUMERIC,
  uses_count INTEGER DEFAULT 0,
  
  -- Scheduling & Status
  is_active BOOLEAN DEFAULT true,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  active_days INTEGER[] DEFAULT '{0,1,2,3,4,5,6}', -- Array of days (0=Sunday, 6=Saturday)
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for lookup
CREATE INDEX IF NOT EXISTS idx_marketplace_deals_store 
ON public.marketplace_deals(store_id, is_active);

-- RLS
ALTER TABLE public.marketplace_deals ENABLE ROW LEVEL SECURITY;

-- Public read access for active deals
CREATE POLICY "Anyone can read active deals"
ON public.marketplace_deals FOR SELECT
USING (
  is_active = true 
  AND (start_date IS NULL OR start_date <= now())
  AND (end_date IS NULL OR end_date >= now())
);

-- Store owners management
CREATE POLICY "Store owners can manage deals"
ON public.marketplace_deals FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.marketplace_stores ms
    INNER JOIN public.tenant_users tu ON ms.tenant_id = tu.tenant_id
    WHERE ms.id = marketplace_deals.store_id
    AND tu.id = auth.uid()::text::uuid
  )
);

-- RPC: Get active deals for a store
CREATE OR REPLACE FUNCTION get_active_store_deals(p_store_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  image_url TEXT,
  discount_type TEXT,
  discount_value NUMERIC,
  applies_to TEXT,
  target_value TEXT,
  min_order_amount NUMERIC,
  max_discount_amount NUMERIC,
  active_days INTEGER[],
  end_date TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    md.id,
    md.name,
    md.description,
    md.image_url,
    md.discount_type,
    md.discount_value,
    md.applies_to,
    md.target_value,
    md.min_order_amount,
    md.max_discount_amount,
    md.active_days,
    md.end_date
  FROM public.marketplace_deals md
  WHERE md.store_id = p_store_id
  AND md.is_active = true
  AND (md.start_date IS NULL OR md.start_date <= now())
  AND (md.end_date IS NULL OR md.end_date >= now());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE public.marketplace_deals IS 'Scheduled and targeted promotions for the storefront';
