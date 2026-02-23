-- 1. Add columns to 'products' (Tenant's internal inventory)
ALTER TABLE products
ADD COLUMN IF NOT EXISTS metrc_retail_id TEXT,
ADD COLUMN IF NOT EXISTS exclude_from_discounts BOOLEAN DEFAULT false;

-- 2. Add columns to 'marketplace_listings' (Public storefront)
-- This was likely mistakenly called marketplace_products in previous attempts
ALTER TABLE marketplace_listings
ADD COLUMN IF NOT EXISTS metrc_retail_id TEXT,
ADD COLUMN IF NOT EXISTS exclude_from_discounts BOOLEAN DEFAULT false;

-- 3. Update Sync Function (Internal -> Public)
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
            base_price = COALESCE(v_product.wholesale_price, v_product.retail_price, 0), -- Prefer wholesale for marketplace
            quantity_available = v_product.available_quantity,
            images = CASE WHEN v_product.image_url IS NOT NULL THEN ARRAY[v_product.image_url] ELSE '{}'::text[] END,
            metrc_retail_id = v_product.metrc_retail_id,
            exclude_from_discounts = v_product.exclude_from_discounts,
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
            product_type,
            metrc_retail_id,
            exclude_from_discounts
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
            COALESCE(v_product.category, 'flower'),
            v_product.metrc_retail_id,
            v_product.exclude_from_discounts
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

-- 4. Update Getter Function (Public -> Frontend)
-- Overloading signature to return new columns
CREATE OR REPLACE FUNCTION get_marketplace_products(p_store_id UUID)
RETURNS TABLE (
  product_id UUID,
  name TEXT,
  description TEXT,
  short_description TEXT,
  category TEXT,
  sku TEXT,
  price NUMERIC,
  display_price NUMERIC,
  compare_at_price NUMERIC,
  image_url TEXT,
  images TEXT[],
  in_stock BOOLEAN,
  is_featured BOOLEAN,
  marketplace_category_id UUID,
  marketplace_category_name TEXT,
  variants JSONB,
  tags TEXT[],
  metrc_retail_id TEXT,
  exclude_from_discounts BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ml.id,
    ml.product_name,
    ml.description,
    substring(ml.description from 1 for 150),
    ml.product_type,
    'SKU-' || substr(ml.id::text, 1, 8),
    ml.base_price,
    ml.base_price, -- Display price (same for now)
    (ml.base_price * 1.2)::numeric(10,2), -- Mock compare price
    COALESCE(ml.images[1], NULL),
    ml.images,
    (ml.quantity_available > 0),
    true, -- Mock featured
    ml.marketplace_category_id,
    mc.name,
    ml.variants,
    ml.tags,
    ml.metrc_retail_id,
    ml.exclude_from_discounts
  FROM public.marketplace_listings ml
  LEFT JOIN public.marketplace_categories mc ON ml.marketplace_category_id = mc.id
  WHERE ml.marketplace_profile_id = p_store_id
  AND ml.status = 'active';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
