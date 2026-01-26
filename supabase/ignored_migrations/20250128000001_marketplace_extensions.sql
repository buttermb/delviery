-- ============================================================================
-- MARKETPLACE EXTENSIONS: COUPONS & CATEGORIES
-- ============================================================================

-- ============================================================================
-- MARKETPLACE_CATEGORIES
-- ============================================================================
-- Custom categories for seller storefronts
CREATE TABLE IF NOT EXISTS public.marketplace_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES public.marketplace_categories(id) ON DELETE SET NULL,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  image_url TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(tenant_id, slug)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_marketplace_categories_tenant_id ON public.marketplace_categories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_categories_parent_id ON public.marketplace_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_categories_slug ON public.marketplace_categories(slug);

-- RLS
ALTER TABLE public.marketplace_categories ENABLE ROW LEVEL SECURITY;

-- Sellers manage their own categories
CREATE POLICY "Sellers can manage own categories"
  ON public.marketplace_categories FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM public.tenant_users WHERE id = auth.uid()::text::uuid));

-- Everyone can view active categories
CREATE POLICY "Public can view active categories"
  ON public.marketplace_categories FOR SELECT
  USING (is_active = true);


-- ============================================================================
-- MARKETPLACE_COUPONS
-- ============================================================================
-- Discount codes for marketplace stores
CREATE TABLE IF NOT EXISTS public.marketplace_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  code TEXT NOT NULL,
  description TEXT,
  
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount')),
  discount_value NUMERIC(10,2) NOT NULL,
  
  min_order_amount NUMERIC(10,2) DEFAULT 0,
  max_discount_amount NUMERIC(10,2), -- Cap for percentage discounts
  
  start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_date TIMESTAMPTZ,
  
  usage_limit INTEGER, -- Total times coupon can be used
  used_count INTEGER DEFAULT 0,
  per_user_limit INTEGER, -- Times a single user can use it
  
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_discount CHECK (discount_value > 0),
  UNIQUE(tenant_id, code)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_marketplace_coupons_tenant_id ON public.marketplace_coupons(tenant_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_coupons_code ON public.marketplace_coupons(code);
CREATE INDEX IF NOT EXISTS idx_marketplace_coupons_validity ON public.marketplace_coupons(start_date, end_date, is_active);

-- RLS
ALTER TABLE public.marketplace_coupons ENABLE ROW LEVEL SECURITY;

-- Sellers manage their own coupons
CREATE POLICY "Sellers can manage own coupons"
  ON public.marketplace_coupons FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM public.tenant_users WHERE id = auth.uid()::text::uuid));

-- Buyers can view valid coupons (usually they verify by code, but select access is needed for validation logic)
-- Restrict mostly to explicit code lookup or seller
CREATE POLICY "Buyers can view valid coupons by code"
  ON public.marketplace_coupons FOR SELECT
  USING (true); -- Simplified for now to allow validation queries, typically you'd query by code match

-- Triggers for updated_at
CREATE TRIGGER update_marketplace_categories_updated_at
  BEFORE UPDATE ON public.marketplace_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_marketplace_coupons_updated_at
  BEFORE UPDATE ON public.marketplace_coupons
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
