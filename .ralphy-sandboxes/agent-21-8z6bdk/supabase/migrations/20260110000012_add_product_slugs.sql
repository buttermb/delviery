-- Add slug column to marketplace_listings
ALTER TABLE public.marketplace_listings
ADD COLUMN IF NOT EXISTS slug TEXT;

-- Create a function to generate slugs from product names
CREATE OR REPLACE FUNCTION generate_slug(name TEXT)
RETURNS TEXT AS $$
DECLARE
    slug TEXT;
    base_slug TEXT;
    counter INTEGER := 1;
BEGIN
    -- Convert to lowercase, remove special chars, replace spaces with hyphens
    base_slug := lower(regexp_replace(name, '[^a-zA-Z0-9\s-]', '', 'g')); -- remove non-alphanumeric except spaces and hyphens
    base_slug := regexp_replace(base_slug, '\s+', '-', 'g'); -- replace spaces with hyphens
    base_slug := regexp_replace(base_slug, '-+', '-', 'g'); -- coalesce hyphens
    base_slug := trim(both '-' from base_slug); -- trim leading/trailing hyphens

    slug := base_slug;

    -- Ensure uniqueness
    WHILE EXISTS (SELECT 1 FROM public.marketplace_listings WHERE slug = slug) LOOP
        slug := base_slug || '-' || counter;
        counter := counter + 1;
    END LOOP;

    RETURN slug;
END;
$$ LANGUAGE plpgsql;

-- Backfill existing listings with slugs
UPDATE public.marketplace_listings
SET slug = generate_slug(product_name)
WHERE slug IS NULL;

-- Make slug required and unique
ALTER TABLE public.marketplace_listings
ALTER COLUMN slug SET NOT NULL;

ALTER TABLE public.marketplace_listings
ADD CONSTRAINT marketplace_listings_slug_key UNIQUE (slug);

-- Update sync_product_to_marketplace to handle slug generation
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
    v_slug TEXT;
BEGIN
    -- Ensure the user is authenticated and authorized for the store
    SELECT tenant_id INTO v_tenant_id FROM public.tenant_users WHERE id = auth.uid()::text::uuid;
    IF v_tenant_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    SELECT tenant_id INTO v_store_tenant_id FROM public.marketplace_profiles WHERE id = p_store_id;
    IF v_store_tenant_id != v_tenant_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid store profile');
    END IF;

    -- Fetch the product details
    SELECT * INTO v_product FROM public.products WHERE id = p_product_id AND tenant_id = v_tenant_id;
    IF v_product IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Product not found');
    END IF;

    -- Check if a marketplace listing already exists for this product
    SELECT listing_id INTO v_existing_listing_id FROM public.marketplace_product_sync WHERE product_id = p_product_id;

    IF v_existing_listing_id IS NOT NULL THEN
        -- Update existing listing
        UPDATE public.marketplace_listings
        SET
            product_name = v_product.name,
            description = v_product.description,
            base_price = COALESCE(v_product.wholesale_price, v_product.retail_price, 0),
            quantity_available = v_product.available_quantity,
            images = CASE WHEN v_product.image_url IS NOT NULL THEN ARRAY[v_product.image_url] ELSE '{}'::text[] END,
            metrc_retail_id = v_product.metrc_retail_id,
            exclude_from_discounts = v_product.exclude_from_discounts,
            minimum_price = v_product.minimum_price,
            updated_at = NOW()
        WHERE id = v_existing_listing_id
        RETURNING id, slug INTO v_listing_id, v_slug;
        
        -- If slug happens to be null (shouldn't be), generate it
        IF v_slug IS NULL THEN
            UPDATE public.marketplace_listings
            SET slug = generate_slug(v_product.name)
            WHERE id = v_listing_id;
        END IF;
    ELSE
        -- Insert new listing (generate slug automatically/helper needed inside insert or trigger? 
        -- Simpler to generate first using the helper function logic or just let the backfill logic be reused via function
        
        v_slug := generate_slug(v_product.name);
        
        INSERT INTO public.marketplace_listings (
            tenant_id, marketplace_profile_id, product_name, description, base_price, quantity_available, images, status, visibility, product_type, metrc_retail_id, exclude_from_discounts, minimum_price, slug
        ) VALUES (
            v_tenant_id, p_store_id, v_product.name, v_product.description, COALESCE(v_product.wholesale_price, v_product.retail_price, 0), COALESCE(v_product.available_quantity, 0), CASE WHEN v_product.image_url IS NOT NULL THEN ARRAY[v_product.image_url] ELSE '{}'::text[] END, 'active', 'public', COALESCE(v_product.category, 'flower'), v_product.metrc_retail_id, v_product.exclude_from_discounts, v_product.minimum_price, v_slug
        )
        RETURNING id INTO v_listing_id;
    END IF;

    -- Update sync record
    INSERT INTO public.marketplace_product_sync (tenant_id, product_id, listing_id, sync_status, last_synced_at)
    VALUES (v_tenant_id, p_product_id, v_listing_id, 'synced', NOW())
    ON CONFLICT (product_id) DO UPDATE
    SET listing_id = EXCLUDED.listing_id, sync_status = 'synced', last_synced_at = NOW();

    RETURN jsonb_build_object('success', true, 'listing_id', v_listing_id, 'slug', v_slug);
END;
$$;
