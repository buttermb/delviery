-- ============================================================================
-- Migration: Marketplace Products Sync
-- Description: Creates marketplace_products table and sync RPC functions
-- ============================================================================

-- ============================================================================
-- 1. CREATE MARKETPLACE_PRODUCTS TABLE
-- ============================================================================
-- This table stores products synced to marketplace storefronts with optional
-- display overrides for name, price, and SEO-friendly slugs.

CREATE TABLE IF NOT EXISTS public.marketplace_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Core relationships
    store_id UUID NOT NULL REFERENCES public.marketplace_stores(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    -- Display overrides (NULL means use original product values)
    display_name TEXT,
    display_price NUMERIC(10,2),
    display_description TEXT,

    -- Visibility and featuring
    is_visible BOOLEAN NOT NULL DEFAULT true,
    is_featured BOOLEAN NOT NULL DEFAULT false,
    display_order INTEGER NOT NULL DEFAULT 0,

    -- SEO
    slug TEXT NOT NULL,

    -- Sync metadata
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT unique_store_product_mp UNIQUE (store_id, product_id),
    CONSTRAINT unique_store_slug_mp UNIQUE (store_id, slug)
);

-- ============================================================================
-- 2. INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_marketplace_products_store_id ON public.marketplace_products(store_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_products_product_id ON public.marketplace_products(product_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_products_tenant_id ON public.marketplace_products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_products_slug ON public.marketplace_products(store_id, slug);
CREATE INDEX IF NOT EXISTS idx_marketplace_products_featured ON public.marketplace_products(store_id, is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_marketplace_products_visible ON public.marketplace_products(store_id, is_visible) WHERE is_visible = true;

-- ============================================================================
-- 3. ENABLE RLS
-- ============================================================================
ALTER TABLE public.marketplace_products ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. RLS POLICIES
-- ============================================================================

-- Public can view visible products from active public stores
CREATE POLICY "Public can view visible marketplace products"
    ON public.marketplace_products
    FOR SELECT
    USING (
        is_visible = true AND
        store_id IN (
            SELECT id FROM public.marketplace_stores
            WHERE is_active = true AND is_public = true
        )
    );

-- Tenants can manage their own marketplace products
CREATE POLICY "Tenants can manage their own marketplace products"
    ON public.marketplace_products
    FOR ALL
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.tenant_users
            WHERE user_id = auth.uid()
        )
    );

-- ============================================================================
-- 5. HELPER FUNCTION: Generate unique slug
-- ============================================================================
CREATE OR REPLACE FUNCTION public.generate_marketplace_product_slug(
    p_store_id UUID,
    p_name TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_slug TEXT;
    v_base_slug TEXT;
    v_counter INTEGER := 1;
BEGIN
    -- Convert to lowercase, remove special chars, replace spaces with hyphens
    v_base_slug := lower(regexp_replace(p_name, '[^a-zA-Z0-9\s-]', '', 'g'));
    v_base_slug := regexp_replace(v_base_slug, '\s+', '-', 'g');
    v_base_slug := regexp_replace(v_base_slug, '-+', '-', 'g');
    v_base_slug := trim(both '-' from v_base_slug);

    -- Handle empty slug
    IF v_base_slug = '' OR v_base_slug IS NULL THEN
        v_base_slug := 'product';
    END IF;

    v_slug := v_base_slug;

    -- Ensure uniqueness within the store
    WHILE EXISTS (
        SELECT 1 FROM public.marketplace_products
        WHERE store_id = p_store_id AND slug = v_slug
    ) LOOP
        v_slug := v_base_slug || '-' || v_counter;
        v_counter := v_counter + 1;
    END LOOP;

    RETURN v_slug;
END;
$$;

-- ============================================================================
-- 6. RPC: sync_product_to_marketplace
-- ============================================================================
-- Syncs a single product to the marketplace with optional display overrides

CREATE OR REPLACE FUNCTION public.sync_product_to_marketplace(
    p_product_id UUID,
    p_store_id UUID,
    p_display_name TEXT DEFAULT NULL,
    p_display_price NUMERIC DEFAULT NULL,
    p_is_featured BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tenant_id UUID;
    v_product RECORD;
    v_store RECORD;
    v_marketplace_product_id UUID;
    v_slug TEXT;
BEGIN
    -- 1. Get current user's tenant_id
    SELECT tenant_id INTO v_tenant_id
    FROM public.tenant_users
    WHERE user_id = auth.uid();

    IF v_tenant_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: User not associated with a tenant');
    END IF;

    -- 2. Verify store ownership
    SELECT id, tenant_id INTO v_store
    FROM public.marketplace_stores
    WHERE id = p_store_id;

    IF v_store IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Store not found');
    END IF;

    IF v_store.tenant_id != v_tenant_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Store belongs to different tenant');
    END IF;

    -- 3. Get product details and verify ownership
    SELECT id, name, price, description, in_stock, available_quantity
    INTO v_product
    FROM public.products
    WHERE id = p_product_id AND tenant_id = v_tenant_id;

    IF v_product IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Product not found or unauthorized');
    END IF;

    -- 4. Generate slug from display_name or product name
    v_slug := generate_marketplace_product_slug(
        p_store_id,
        COALESCE(p_display_name, v_product.name)
    );

    -- 5. Upsert into marketplace_products
    INSERT INTO public.marketplace_products (
        store_id,
        product_id,
        tenant_id,
        display_name,
        display_price,
        is_visible,
        is_featured,
        slug,
        last_synced_at
    ) VALUES (
        p_store_id,
        p_product_id,
        v_tenant_id,
        p_display_name,
        p_display_price,
        true,
        COALESCE(p_is_featured, false),
        v_slug,
        NOW()
    )
    ON CONFLICT (store_id, product_id)
    DO UPDATE SET
        display_name = COALESCE(EXCLUDED.display_name, marketplace_products.display_name),
        display_price = COALESCE(EXCLUDED.display_price, marketplace_products.display_price),
        is_featured = COALESCE(EXCLUDED.is_featured, marketplace_products.is_featured),
        -- Only update slug if display_name changed and a new one was provided
        slug = CASE
            WHEN EXCLUDED.display_name IS NOT NULL AND EXCLUDED.display_name != marketplace_products.display_name
            THEN EXCLUDED.slug
            ELSE marketplace_products.slug
        END,
        last_synced_at = NOW(),
        updated_at = NOW()
    RETURNING id INTO v_marketplace_product_id;

    RETURN jsonb_build_object(
        'success', true,
        'marketplace_product_id', v_marketplace_product_id,
        'slug', v_slug,
        'product_name', COALESCE(p_display_name, v_product.name),
        'product_id', p_product_id
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ============================================================================
-- 7. RPC: sync_all_products_to_marketplace
-- ============================================================================
-- Bulk syncs all active products with stock to the marketplace

CREATE OR REPLACE FUNCTION public.sync_all_products_to_marketplace(
    p_store_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tenant_id UUID;
    v_store RECORD;
    v_product RECORD;
    v_synced_count INTEGER := 0;
    v_skipped_count INTEGER := 0;
    v_error_count INTEGER := 0;
    v_slug TEXT;
    v_errors JSONB := '[]'::jsonb;
BEGIN
    -- 1. Get current user's tenant_id
    SELECT tenant_id INTO v_tenant_id
    FROM public.tenant_users
    WHERE user_id = auth.uid();

    IF v_tenant_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: User not associated with a tenant');
    END IF;

    -- 2. Verify store ownership
    SELECT id, tenant_id INTO v_store
    FROM public.marketplace_stores
    WHERE id = p_store_id;

    IF v_store IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Store not found');
    END IF;

    IF v_store.tenant_id != v_tenant_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Store belongs to different tenant');
    END IF;

    -- 3. Loop through all active products with stock
    FOR v_product IN
        SELECT p.id, p.name, p.price, p.description, p.in_stock, p.available_quantity
        FROM public.products p
        WHERE p.tenant_id = v_tenant_id
        AND (p.in_stock = true OR COALESCE(p.available_quantity, 0) > 0)
        AND p.is_active = true
    LOOP
        BEGIN
            -- Generate unique slug for this product
            v_slug := generate_marketplace_product_slug(p_store_id, v_product.name);

            -- Upsert into marketplace_products
            INSERT INTO public.marketplace_products (
                store_id,
                product_id,
                tenant_id,
                is_visible,
                is_featured,
                slug,
                last_synced_at
            ) VALUES (
                p_store_id,
                v_product.id,
                v_tenant_id,
                true,
                false,
                v_slug,
                NOW()
            )
            ON CONFLICT (store_id, product_id)
            DO UPDATE SET
                last_synced_at = NOW(),
                updated_at = NOW();

            v_synced_count := v_synced_count + 1;

        EXCEPTION WHEN OTHERS THEN
            v_error_count := v_error_count + 1;
            v_errors := v_errors || jsonb_build_object(
                'product_id', v_product.id,
                'product_name', v_product.name,
                'error', SQLERRM
            );
        END;
    END LOOP;

    -- Count products that were skipped (no stock or inactive)
    SELECT COUNT(*) INTO v_skipped_count
    FROM public.products p
    WHERE p.tenant_id = v_tenant_id
    AND (p.in_stock = false AND COALESCE(p.available_quantity, 0) <= 0)
    OR p.is_active = false;

    RETURN jsonb_build_object(
        'success', v_error_count = 0,
        'synced_count', v_synced_count,
        'skipped_count', v_skipped_count,
        'error_count', v_error_count,
        'errors', CASE WHEN v_error_count > 0 THEN v_errors ELSE NULL END
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ============================================================================
-- 8. UPDATE TRIGGER
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_marketplace_products_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_marketplace_products_updated ON public.marketplace_products;
CREATE TRIGGER trg_marketplace_products_updated
    BEFORE UPDATE ON public.marketplace_products
    FOR EACH ROW
    EXECUTE FUNCTION public.update_marketplace_products_timestamp();

-- ============================================================================
-- 9. GRANT PERMISSIONS
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.sync_product_to_marketplace(UUID, UUID, TEXT, NUMERIC, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_all_products_to_marketplace(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_marketplace_product_slug(UUID, TEXT) TO authenticated;

-- ============================================================================
-- 10. COMMENTS
-- ============================================================================
COMMENT ON TABLE public.marketplace_products IS
'Stores products synced to marketplace storefronts with optional display overrides for name, price, and SEO-friendly slugs.';

COMMENT ON FUNCTION public.sync_product_to_marketplace IS
'Syncs a single product to the marketplace. Creates/updates marketplace_products record with optional display_name, display_price overrides, is_featured flag, and auto-generated slug.';

COMMENT ON FUNCTION public.sync_all_products_to_marketplace IS
'Bulk syncs all active products with stock to the marketplace. Uses upsert to avoid duplicates.';
