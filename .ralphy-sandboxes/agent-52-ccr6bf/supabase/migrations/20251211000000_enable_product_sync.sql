-- Migration: Enable Product Sync to Marketplace
-- Description: Links marketplace_listings to products and adds sync RPC

-- 1. Add Foreign Key if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'marketplace_listings' AND column_name = 'product_id') THEN
    ALTER TABLE public.marketplace_listings 
    ADD COLUMN product_id UUID REFERENCES public.products(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 2. Add Unique Constraint to prevent duplicates (One listing per product per store)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'idx_listings_unique_product_per_store'
  ) THEN
    ALTER TABLE public.marketplace_listings 
    ADD CONSTRAINT idx_listings_unique_product_per_store UNIQUE (marketplace_profile_id, product_id);
  END IF;
END $$;

-- 3. Create Sync RPC
CREATE OR REPLACE FUNCTION sync_product_to_marketplace(
    p_product_id UUID,
    p_store_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_product RECORD;
    v_listing_id UUID;
    v_tenant_id UUID;
BEGIN
    -- Get product data
    SELECT * INTO v_product FROM products WHERE id = p_product_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Product not found');
    END IF;

    -- Get tenant_id from store profile
    SELECT tenant_id INTO v_tenant_id FROM marketplace_profiles WHERE id = p_store_id;

    IF v_tenant_id IS NULL THEN
         RETURN jsonb_build_object('success', false, 'error', 'Store not found');
    END IF;

    -- Upsert into listings
    INSERT INTO public.marketplace_listings (
        marketplace_profile_id,
        tenant_id,
        product_id,
        product_name,
        description,
        base_price,
        quantity_available,
        images,
        category,
        status,
        product_type -- Map category to product_type default
    )
    VALUES (
        p_store_id,
        v_tenant_id,
        p_product_id,
        v_product.name,
        COALESCE(v_product.description, ''),
        v_product.price,
        CASE WHEN v_product.in_stock THEN 100 ELSE 0 END, -- Mock quantity based on stock boolean
        CASE 
            WHEN v_product.image_url IS NOT NULL THEN ARRAY[v_product.image_url] 
            ELSE '{}'::TEXT[] 
        END,
        v_product.category, -- Assuming simple mapping for now
        'active',
        v_product.category -- Default product_type to category name
    )
    ON CONFLICT (marketplace_profile_id, product_id)
    DO UPDATE SET
        base_price = EXCLUDED.base_price,
        -- Don't overwrite description/name if they have been customized (optional, but for now we sync price/stock)
        quantity_available = EXCLUDED.quantity_available,
        -- Update images if the product image changed
        images = EXCLUDED.images, 
        updated_at = NOW()
    RETURNING id INTO v_listing_id;

    RETURN jsonb_build_object('success', true, 'listing_id', v_listing_id);
END;
$$;
