-- Global Product Catalog
-- Centralized, brand-verified product database for cross-store imports

-- 1. Global Products Table (Platform-wide)
CREATE TABLE IF NOT EXISTS public.global_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    brand TEXT,
    category TEXT NOT NULL, -- flower, vape, edible, concentrate, etc.
    description TEXT,
    short_description TEXT,
    images TEXT[] DEFAULT '{}',
    
    -- Lab Data
    thc_percent NUMERIC(5,2),
    cbd_percent NUMERIC(5,2),
    terpenes JSONB DEFAULT '{}'::jsonb, -- {limonene: 0.5, myrcene: 0.3, ...}
    
    -- Strain Data
    strain_type TEXT, -- indica, sativa, hybrid
    effects TEXT[] DEFAULT '{}', -- relaxed, uplifted, creative, etc.
    
    -- Additional Metadata
    weight_grams NUMERIC(10,2),
    unit_type TEXT DEFAULT 'unit', -- lb, oz, g, unit
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
    listing_id UUID REFERENCES public.marketplace_listings(id) ON DELETE SET NULL,
    
    -- Sync Settings
    auto_sync_enabled BOOLEAN DEFAULT false,
    last_synced_at TIMESTAMPTZ,
    
    -- Timestamps
    imported_at TIMESTAMPTZ DEFAULT now(),
    
    -- Unique constraint: one import per tenant per global product
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

-- Global products: Anyone can view verified, admins can manage all
CREATE POLICY "Anyone can view verified global products"
ON public.global_products FOR SELECT
USING (status = 'verified' AND is_verified = true);

CREATE POLICY "Platform admins can manage global products"
ON public.global_products FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
    )
);

-- Imports: Tenant admins can manage their imports
CREATE POLICY "Tenant admins can view own imports"
ON public.global_product_imports FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
        AND ur.tenant_id = global_product_imports.tenant_id
    )
);

CREATE POLICY "Tenant admins can insert imports"
ON public.global_product_imports FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
        AND ur.tenant_id = global_product_imports.tenant_id
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

-- 6. RPC: Import Global Product to Store
CREATE OR REPLACE FUNCTION public.import_global_product(
    p_tenant_id UUID,
    p_global_product_id UUID,
    p_price NUMERIC,
    p_marketplace_profile_id UUID,
    p_auto_sync BOOLEAN DEFAULT false
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_global RECORD;
    v_listing_id UUID;
    v_import_id UUID;
BEGIN
    -- Check admin permission
    IF NOT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid()
        AND role = 'admin'
        AND tenant_id = p_tenant_id
    ) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    -- Get global product
    SELECT * INTO v_global
    FROM public.global_products
    WHERE id = p_global_product_id
    AND status = 'verified'
    AND is_verified = true;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Global product not found or not verified';
    END IF;

    -- Check if already imported
    IF EXISTS (
        SELECT 1 FROM public.global_product_imports
        WHERE global_product_id = p_global_product_id
        AND tenant_id = p_tenant_id
    ) THEN
        RAISE EXCEPTION 'Product already imported to this store';
    END IF;

    -- Create marketplace listing
    INSERT INTO public.marketplace_listings (
        tenant_id,
        marketplace_profile_id,
        product_name,
        product_type,
        strain_type,
        description,
        base_price,
        images,
        status,
        visibility,
        tags
    ) VALUES (
        p_tenant_id,
        p_marketplace_profile_id,
        v_global.name,
        v_global.category,
        v_global.strain_type,
        v_global.description,
        p_price,
        v_global.images,
        'draft', -- Start as draft so admin can review
        'public',
        ARRAY[v_global.brand, 'imported']
    ) RETURNING id INTO v_listing_id;

    -- Record import
    INSERT INTO public.global_product_imports (
        global_product_id,
        tenant_id,
        listing_id,
        auto_sync_enabled
    ) VALUES (
        p_global_product_id,
        p_tenant_id,
        v_listing_id,
        p_auto_sync
    ) RETURNING id INTO v_import_id;

    RETURN v_listing_id;
END;
$$;

-- 7. RPC: Sync Imported Products
CREATE OR REPLACE FUNCTION public.sync_imported_products(
    p_tenant_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_import RECORD;
    v_global RECORD;
    v_count INTEGER := 0;
BEGIN
    -- Check admin permission
    IF NOT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid()
        AND role = 'admin'
        AND tenant_id = p_tenant_id
    ) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    -- Loop through imports with auto_sync enabled
    FOR v_import IN 
        SELECT * FROM public.global_product_imports
        WHERE tenant_id = p_tenant_id
        AND auto_sync_enabled = true
        AND listing_id IS NOT NULL
    LOOP
        -- Get latest global data
        SELECT * INTO v_global
        FROM public.global_products
        WHERE id = v_import.global_product_id
        AND status = 'verified';

        IF FOUND THEN
            -- Update listing with global data (preserve local price)
            UPDATE public.marketplace_listings
            SET 
                product_name = v_global.name,
                description = v_global.description,
                images = v_global.images,
                strain_type = v_global.strain_type,
                product_type = v_global.category,
                updated_at = now()
            WHERE id = v_import.listing_id;

            -- Update sync timestamp
            UPDATE public.global_product_imports
            SET last_synced_at = now()
            WHERE id = v_import.id;

            v_count := v_count + 1;
        END IF;
    END LOOP;

    RETURN v_count;
END;
$$;

-- 8. Trigger for updated_at
CREATE OR REPLACE FUNCTION update_global_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER global_products_updated_at
    BEFORE UPDATE ON public.global_products
    FOR EACH ROW
    EXECUTE FUNCTION update_global_products_updated_at();

-- 9. Grant Permissions
GRANT EXECUTE ON FUNCTION public.search_global_products TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.import_global_product TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_imported_products TO authenticated;
