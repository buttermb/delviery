-- ============================================
-- MARKETPLACE STORES TABLE (Main Storefront Configuration)
-- ============================================
CREATE TABLE IF NOT EXISTS public.marketplace_stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Basic Info
  store_name TEXT NOT NULL,
  slug TEXT NOT NULL,
  tagline TEXT,
  description TEXT,
  
  -- Branding
  logo_url TEXT,
  banner_url TEXT,
  favicon_url TEXT,
  primary_color TEXT DEFAULT '#10b981',
  secondary_color TEXT DEFAULT '#059669',
  accent_color TEXT DEFAULT '#34d399',
  font_family TEXT DEFAULT 'Inter',
  
  -- SEO
  meta_title TEXT,
  meta_description TEXT,
  og_image_url TEXT,
  custom_domain TEXT,
  
  -- Settings
  is_active BOOLEAN DEFAULT true,
  is_public BOOLEAN DEFAULT true,
  require_account BOOLEAN DEFAULT false,
  require_age_verification BOOLEAN DEFAULT false,
  minimum_age INTEGER DEFAULT 21,
  
  -- Delivery & Payment
  delivery_zones JSONB DEFAULT '[]'::jsonb,
  payment_methods JSONB DEFAULT '["cash", "card"]'::jsonb,
  free_delivery_threshold NUMERIC(10,2),
  default_delivery_fee NUMERIC(10,2) DEFAULT 0,
  
  -- Checkout & Operations
  checkout_settings JSONB DEFAULT '{}'::jsonb,
  operating_hours JSONB DEFAULT '{}'::jsonb,
  
  -- Metrics (denormalized for performance)
  total_orders INTEGER DEFAULT 0,
  total_revenue NUMERIC(12,2) DEFAULT 0,
  total_customers INTEGER DEFAULT 0,
  
  -- Encrypted URL for private stores
  encrypted_url_token TEXT UNIQUE,
  
  -- Layout & Theme
  layout_config JSONB DEFAULT '{}'::jsonb,
  theme_config JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraints
  CONSTRAINT unique_tenant_store UNIQUE (tenant_id),
  CONSTRAINT unique_store_slug UNIQUE (slug)
);

-- ============================================
-- MARKETPLACE PRODUCT SETTINGS (Product visibility per store)
-- ============================================
CREATE TABLE IF NOT EXISTS public.marketplace_product_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.marketplace_stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  
  is_visible BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  featured BOOLEAN DEFAULT false,
  custom_price NUMERIC(10,2),
  custom_description TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT unique_store_product UNIQUE (store_id, product_id)
);

-- ============================================
-- MARKETPLACE CATEGORIES (Storefront categories)
-- ============================================
CREATE TABLE IF NOT EXISTS public.marketplace_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.marketplace_stores(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  parent_id UUID REFERENCES public.marketplace_categories(id) ON DELETE SET NULL,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT unique_store_category_slug UNIQUE (store_id, slug)
);

-- ============================================
-- MARKETPLACE COUPONS (Discount codes)
-- ============================================
CREATE TABLE IF NOT EXISTS public.marketplace_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.marketplace_stores(id) ON DELETE CASCADE,
  
  code TEXT NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC(10,2) NOT NULL,
  min_order_amount NUMERIC(10,2),
  max_discount_amount NUMERIC(10,2),
  usage_limit INTEGER,
  used_count INTEGER DEFAULT 0,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT unique_store_coupon_code UNIQUE (store_id, code)
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_marketplace_stores_tenant ON public.marketplace_stores(tenant_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_stores_slug ON public.marketplace_stores(slug);
CREATE INDEX IF NOT EXISTS idx_marketplace_stores_active ON public.marketplace_stores(is_active, is_public);
CREATE INDEX IF NOT EXISTS idx_marketplace_product_settings_store ON public.marketplace_product_settings(store_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_categories_store ON public.marketplace_categories(store_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_coupons_store ON public.marketplace_coupons(store_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_coupons_code ON public.marketplace_coupons(code);

-- ============================================
-- RLS POLICIES
-- ============================================

-- Enable RLS
ALTER TABLE public.marketplace_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_product_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_coupons ENABLE ROW LEVEL SECURITY;

-- marketplace_stores policies
CREATE POLICY "Public can view active public stores"
  ON public.marketplace_stores FOR SELECT
  USING (is_active = true AND is_public = true);

CREATE POLICY "Tenant members can manage their store"
  ON public.marketplace_stores FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

-- marketplace_product_settings policies
CREATE POLICY "Public can view visible product settings"
  ON public.marketplace_product_settings FOR SELECT
  USING (
    is_visible = true AND
    store_id IN (SELECT id FROM public.marketplace_stores WHERE is_active = true AND is_public = true)
  );

CREATE POLICY "Tenant members can manage product settings"
  ON public.marketplace_product_settings FOR ALL
  USING (
    store_id IN (
      SELECT ms.id FROM public.marketplace_stores ms
      JOIN public.tenant_users tu ON ms.tenant_id = tu.tenant_id
      WHERE tu.user_id = auth.uid()
    )
  );

-- marketplace_categories policies
CREATE POLICY "Public can view active categories"
  ON public.marketplace_categories FOR SELECT
  USING (
    is_active = true AND
    store_id IN (SELECT id FROM public.marketplace_stores WHERE is_active = true AND is_public = true)
  );

CREATE POLICY "Tenant members can manage categories"
  ON public.marketplace_categories FOR ALL
  USING (
    store_id IN (
      SELECT ms.id FROM public.marketplace_stores ms
      JOIN public.tenant_users tu ON ms.tenant_id = tu.tenant_id
      WHERE tu.user_id = auth.uid()
    )
  );

-- marketplace_coupons policies
CREATE POLICY "Tenant members can manage coupons"
  ON public.marketplace_coupons FOR ALL
  USING (
    store_id IN (
      SELECT ms.id FROM public.marketplace_stores ms
      JOIN public.tenant_users tu ON ms.tenant_id = tu.tenant_id
      WHERE tu.user_id = auth.uid()
    )
  );

-- ============================================
-- RPC FUNCTIONS
-- ============================================

-- Get store by slug (for customer-facing shop)
CREATE OR REPLACE FUNCTION public.get_marketplace_store_by_slug(p_slug TEXT)
RETURNS SETOF public.marketplace_stores
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.marketplace_stores
  WHERE slug = p_slug
    AND is_active = true;
END;
$$;

-- Get store by encrypted token (for private store links)
CREATE OR REPLACE FUNCTION public.get_store_by_encrypted_token(p_token TEXT)
RETURNS SETOF public.marketplace_stores
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.marketplace_stores
  WHERE encrypted_url_token = p_token
    AND is_active = true;
END;
$$;

-- Generate unique encrypted token for store
CREATE OR REPLACE FUNCTION public.generate_store_token()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.encrypted_url_token IS NULL THEN
    NEW.encrypted_url_token := encode(gen_random_bytes(32), 'hex');
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger to auto-generate token
DROP TRIGGER IF EXISTS trg_generate_store_token ON public.marketplace_stores;
CREATE TRIGGER trg_generate_store_token
  BEFORE INSERT ON public.marketplace_stores
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_store_token();

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_marketplace_store_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_marketplace_stores_updated ON public.marketplace_stores;
CREATE TRIGGER trg_marketplace_stores_updated
  BEFORE UPDATE ON public.marketplace_stores
  FOR EACH ROW
  EXECUTE FUNCTION public.update_marketplace_store_timestamp();