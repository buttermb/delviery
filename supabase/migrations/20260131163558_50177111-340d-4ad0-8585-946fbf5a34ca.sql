-- Global Product Catalog
-- Centralized, brand-verified product database for cross-store imports

-- 1. Global Products Table (Platform-wide)
CREATE TABLE IF NOT EXISTS public.global_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    brand TEXT,
    category TEXT NOT NULL,
    description TEXT,
    short_description TEXT,
    images TEXT[] DEFAULT '{}',
    
    -- Lab Data
    thc_percent NUMERIC(5,2),
    cbd_percent NUMERIC(5,2),
    terpenes JSONB DEFAULT '{}'::jsonb,
    
    -- Strain Data
    strain_type TEXT,
    effects TEXT[] DEFAULT '{}',
    
    -- Additional Metadata
    weight_grams NUMERIC(10,2),
    unit_type TEXT DEFAULT 'unit',
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Verification
    is_verified BOOLEAN DEFAULT false,
    verified_by UUID REFERENCES auth.users(id),
    verified_at TIMESTAMPTZ,
    
    -- Submission
    submitted_by_tenant_id UUID REFERENCES public.tenants(id),
    submission_notes TEXT,
    
    -- Status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected', 'archived')),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Global Product Imports (Track which stores imported which products)
CREATE TABLE IF NOT EXISTS public.global_product_imports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    global_product_id UUID NOT NULL REFERENCES public.global_products(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    listing_id UUID,
    
    -- Sync Settings
    auto_sync_enabled BOOLEAN DEFAULT false,
    last_synced_at TIMESTAMPTZ,
    
    -- Timestamps
    imported_at TIMESTAMPTZ DEFAULT now(),
    
    -- Unique constraint
    UNIQUE(global_product_id, tenant_id)
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_global_products_sku ON public.global_products(sku);
CREATE INDEX IF NOT EXISTS idx_global_products_brand ON public.global_products(brand);
CREATE INDEX IF NOT EXISTS idx_global_products_category ON public.global_products(category);
CREATE INDEX IF NOT EXISTS idx_global_products_status ON public.global_products(status);
CREATE INDEX IF NOT EXISTS idx_global_products_verified ON public.global_products(is_verified);
CREATE INDEX IF NOT EXISTS idx_global_products_search ON public.global_products 
    USING gin(to_tsvector('english', coalesce(name, '') || ' ' || coalesce(brand, '') || ' ' || coalesce(description, '')));

CREATE INDEX IF NOT EXISTS idx_global_product_imports_tenant ON public.global_product_imports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_global_product_imports_listing ON public.global_product_imports(listing_id);

-- 4. RLS Policies
ALTER TABLE public.global_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_product_imports ENABLE ROW LEVEL SECURITY;

-- Global products: Anyone can view verified products
CREATE POLICY "Anyone can view verified global products"
ON public.global_products FOR SELECT
USING (status = 'verified' AND is_verified = true);

-- Authenticated users with tenant_users can manage their submissions
CREATE POLICY "Tenant users can manage own submissions"
ON public.global_products FOR ALL
USING (
    submitted_by_tenant_id IN (
        SELECT tenant_id FROM public.tenant_users 
        WHERE user_id = auth.uid()
    )
);

-- Imports: Tenant users can manage their imports
CREATE POLICY "Tenant users can view own imports"
ON public.global_product_imports FOR SELECT
USING (
    tenant_id IN (
        SELECT tenant_id FROM public.tenant_users 
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Tenant users can insert imports"
ON public.global_product_imports FOR INSERT
WITH CHECK (
    tenant_id IN (
        SELECT tenant_id FROM public.tenant_users 
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Tenant users can delete imports"
ON public.global_product_imports FOR DELETE
USING (
    tenant_id IN (
        SELECT tenant_id FROM public.tenant_users 
        WHERE user_id = auth.uid()
    )
);

-- 5. RPC: Search Global Products
CREATE OR REPLACE FUNCTION public.search_global_products(
    p_query TEXT DEFAULT NULL,
    p_category TEXT DEFAULT NULL,
    p_brand TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    sku TEXT,
    name TEXT,
    brand TEXT,
    category TEXT,
    description TEXT,
    images TEXT[],
    thc_percent NUMERIC,
    cbd_percent NUMERIC,
    strain_type TEXT,
    effects TEXT[],
    is_verified BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        gp.id,
        gp.sku,
        gp.name,
        gp.brand,
        gp.category,
        gp.description,
        gp.images,
        gp.thc_percent,
        gp.cbd_percent,
        gp.strain_type,
        gp.effects,
        gp.is_verified
    FROM public.global_products gp
    WHERE gp.status = 'verified'
    AND gp.is_verified = true
    AND (p_query IS NULL OR to_tsvector('english', coalesce(gp.name, '') || ' ' || coalesce(gp.brand, '') || ' ' || coalesce(gp.description, '')) @@ plainto_tsquery('english', p_query))
    AND (p_category IS NULL OR gp.category = p_category)
    AND (p_brand IS NULL OR gp.brand = p_brand)
    ORDER BY gp.name
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- 6. Trigger for updated_at
CREATE OR REPLACE FUNCTION update_global_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS global_products_updated_at ON public.global_products;
CREATE TRIGGER global_products_updated_at
    BEFORE UPDATE ON public.global_products
    FOR EACH ROW
    EXECUTE FUNCTION update_global_products_updated_at();

-- 7. Grant Permissions
GRANT EXECUTE ON FUNCTION public.search_global_products TO anon, authenticated;