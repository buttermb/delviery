-- Create table to track product synchronization status
CREATE TABLE IF NOT EXISTS public.marketplace_product_sync (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    listing_id UUID REFERENCES public.marketplace_listings(id) ON DELETE SET NULL,
    
    sync_status TEXT NOT NULL CHECK (sync_status IN ('pending', 'synced', 'error')),
    sync_errors JSONB,
    
    last_synced_at TIMESTAMPTZ,
    last_attempt_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(product_id) -- One sync record per product
);

-- Enable RLS
ALTER TABLE public.marketplace_product_sync ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Tenants can view own sync records"
    ON public.marketplace_product_sync
    FOR SELECT
    USING (tenant_id = (SELECT tenant_id FROM public.tenant_users WHERE id = auth.uid()::text::uuid));

CREATE POLICY "Tenants can manage own sync records"
    ON public.marketplace_product_sync
    FOR ALL
    USING (tenant_id = (SELECT tenant_id FROM public.tenant_users WHERE id = auth.uid()::text::uuid));

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_marketplace_product_sync_tenant_id ON public.marketplace_product_sync(tenant_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_product_sync_status ON public.marketplace_product_sync(sync_status);

-- Function to sync a B2B product to Marketplace Listing
CREATE OR REPLACE FUNCTION public.sync_product_to_marketplace(
    p_product_id UUID,
    p_store_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tenant_id UUID;
    v_product RECORD;
    v_listing_id UUID;
    v_existing_listing_id UUID;
    v_store_tenant_id UUID;
BEGIN
    -- 1. Get current user's tenant_id
    SELECT tenant_id INTO v_tenant_id 
    FROM public.tenant_users 
    WHERE id = auth.uid()::text::uuid;

    IF v_tenant_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    -- 2. Verify store ownership
    SELECT tenant_id INTO v_store_tenant_id
    FROM public.marketplace_profiles
    WHERE id = p_store_id;

    IF v_store_tenant_id != v_tenant_id THEN
         RETURN jsonb_build_object('success', false, 'error', 'Invalid store profile');
    END IF;

    -- 3. Get Product Details
    SELECT * INTO v_product
    FROM public.products
    WHERE id = p_product_id AND tenant_id = v_tenant_id;

    IF v_product IS NULL THEN
         RETURN jsonb_build_object('success', false, 'error', 'Product not found');
    END IF;

    -- 4. Check if already synced (via sync table or existing listing with same name? Prefer sync table)
    SELECT listing_id INTO v_existing_listing_id
    FROM public.marketplace_product_sync
    WHERE product_id = p_product_id;

    -- If no sync record, check if we have a listing with metadata pointing to this product?
    -- For now, let's just create a new one or update if we have the ID.

    IF v_existing_listing_id IS NOT NULL THEN
        -- Update existing listing
        UPDATE public.marketplace_listings
        SET
            product_name = v_product.name,
            description = v_product.description,
            base_price = COALESCE(v_product.wholesale_price, v_product.retail_price, 0), -- Prefer wholesale for marketplace
            quantity_available = v_product.available_quantity,
            images = CASE WHEN v_product.image_url IS NOT NULL THEN ARRAY[v_product.image_url] ELSE '{}'::text[] END,
            updated_at = NOW()
        WHERE id = v_existing_listing_id
        RETURNING id INTO v_listing_id;
    ELSE
        -- Insert new listing
        INSERT INTO public.marketplace_listings (
            tenant_id,
            marketplace_profile_id,
            product_name,
            description,
            base_price,
            quantity_available,
            images,
            status,
            visibility,
            product_type
        ) VALUES (
            v_tenant_id,
            p_store_id,
            v_product.name,
            v_product.description,
            COALESCE(v_product.wholesale_price, v_product.retail_price, 0),
            COALESCE(v_product.available_quantity, 0),
            CASE WHEN v_product.image_url IS NOT NULL THEN ARRAY[v_product.image_url] ELSE '{}'::text[] END,
            'active', -- Default to active? Or draft? Let's say active for "Publish" action.
            'public',
            COALESCE(v_product.category, 'flower') -- Map category if possible, fallback to flower
        )
        RETURNING id INTO v_listing_id;
    END IF;

    -- 5. Update/Insert Sync Record
    INSERT INTO public.marketplace_product_sync (
        tenant_id,
        product_id,
        listing_id,
        sync_status,
        last_synced_at,
        last_attempt_at
    ) VALUES (
        v_tenant_id,
        p_product_id,
        v_listing_id,
        'synced',
        NOW(),
        NOW()
    )
    ON CONFLICT (product_id) DO UPDATE SET
        listing_id = EXCLUDED.listing_id,
        sync_status = 'synced',
        last_synced_at = NOW(),
        last_attempt_at = NOW(),
        sync_errors = NULL;

    RETURN jsonb_build_object('success', true, 'listing_id', v_listing_id);

EXCEPTION WHEN OTHERS THEN
    -- Log error in sync table if possible
    -- Note: This might fail if the exception implies transaction rollback, 
    -- but usually we can try. For now just return error.
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
