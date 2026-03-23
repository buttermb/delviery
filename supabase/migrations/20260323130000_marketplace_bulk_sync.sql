-- Optimization and fixes for Marketplace Product Sync

-- 1. Update the single sync function to properly update the product_type category
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

    -- 4. Check if already synced
    SELECT listing_id INTO v_existing_listing_id
    FROM public.marketplace_product_sync
    WHERE product_id = p_product_id;

    IF v_existing_listing_id IS NOT NULL THEN
        -- Update existing listing
        UPDATE public.marketplace_listings
        SET
            product_name = v_product.name,
            description = v_product.description,
            base_price = COALESCE(v_product.wholesale_price, v_product.retail_price, 0),
            quantity_available = v_product.available_quantity,
            images = CASE WHEN v_product.image_url IS NOT NULL THEN ARRAY[v_product.image_url] ELSE '{}'::text[] END,
            product_type = COALESCE(v_product.category, 'flower'), -- ADDED CATEGORY SYNC
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
            'active',
            'public',
            COALESCE(v_product.category, 'flower')
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
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;


-- 2. Create the Bulk Sync function using the single sync function to re-use validation logic
CREATE OR REPLACE FUNCTION public.sync_products_to_marketplace_bulk(
    p_product_ids UUID[],
    p_store_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_success_count INT := 0;
    v_error_count INT := 0;
    v_product_id UUID;
    v_result JSONB;
    v_errors JSONB[] := ARRAY[]::JSONB[];
BEGIN
    -- We'll just loop through the array and call the single sync function
    -- Since it's entirely server-side in PL/pgSQL, there's no network overhead per product.
    -- And it runs in a single transaction so it is atomic and consistent.
    
    FOREACH v_product_id IN ARRAY p_product_ids
    LOOP
        v_result := public.sync_product_to_marketplace(v_product_id, p_store_id);
        
        IF (v_result->>'success')::BOOLEAN = true THEN
            v_success_count := v_success_count + 1;
        ELSE
            v_error_count := v_error_count + 1;
            v_errors := array_append(v_errors, jsonb_build_object(
                'product_id', v_product_id,
                'error', v_result->>'error'
            ));
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'synced', v_success_count,
        'failed', v_error_count,
        'errors', array_to_json(v_errors)
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
