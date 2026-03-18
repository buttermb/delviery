-- Fix get_marketplace_products RPC to respect marketplace_product_settings
-- This ensures admin-configured visibility, custom prices, and display order are honored
-- Migration: 20260112000001_fix_rpc_product_settings.sql

-- First, check if the images column in settings table exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'marketplace_product_settings' 
        AND column_name = 'sale_price'
    ) THEN
        ALTER TABLE public.marketplace_product_settings ADD COLUMN sale_price NUMERIC(10,2);
    END IF;
END $$;

-- Drop and recreate the function
DROP FUNCTION IF EXISTS public.get_marketplace_products(uuid);

CREATE OR REPLACE FUNCTION public.get_marketplace_products(p_store_id uuid)
RETURNS TABLE(
    product_id uuid,
    product_name text,
    category text,
    strain_type text,
    price numeric,
    sale_price numeric,
    description text,
    image_url text,
    images text[],
    thc_content numeric,
    cbd_content numeric,
    is_visible boolean,
    display_order integer,
    stock_quantity integer,
    metrc_retail_id text,
    exclude_from_discounts boolean,
    minimum_price numeric,
    effects text[],
    slug text,
    min_expiry_days integer,
    unit_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_tenant_id uuid;
BEGIN
    -- Get tenant_id from the store
    SELECT tenant_id INTO v_tenant_id
    FROM public.marketplace_stores
    WHERE id = p_store_id;

    -- If using marketplace_stores (D2C storefront)
    IF v_tenant_id IS NOT NULL THEN
        RETURN QUERY
        SELECT 
            p.id as product_id,
            p.name as product_name,
            p.category as category,
            p.strain as strain_type,
            -- Use admin-set custom_price if available, otherwise base product price
            COALESCE(mps.custom_price, p.price) as price,
            -- Sale price from settings
            mps.sale_price as sale_price,
            p.description as description,
            -- Primary image for backwards compatibility
            CASE 
                WHEN p.images IS NOT NULL AND array_length(p.images, 1) > 0 
                THEN p.images[1] 
                ELSE p.image_url 
            END as image_url,
            -- Full images array for hover effects
            COALESCE(p.images, ARRAY[]::text[]) as images,
            p.thc_percentage as thc_content,
            p.cbd_percentage as cbd_content,
            -- Use admin visibility setting, default to true if not set
            COALESCE(mps.is_visible, true) as is_visible,
            -- Use admin display order, default to 0
            COALESCE(mps.display_order, 0) as display_order,
            -- Stock from inventory or product table
            COALESCE(
                (SELECT COALESCE(SUM(ib.current_quantity)::integer, 0) 
                 FROM public.inventory_batches ib 
                 WHERE ib.product_id = p.id AND ib.tenant_id = v_tenant_id),
                CASE WHEN p.in_stock THEN 100 ELSE 0 END
            ) as stock_quantity,
            p.metrc_retail_id as metrc_retail_id,
            COALESCE(mps.exclude_from_discounts, false) as exclude_from_discounts,
            mps.minimum_price as minimum_price,
            p.effects as effects,
            p.slug as slug,
            -- Min expiry days from batches
            (
                SELECT MIN(DATE_PART('day', ib.expiration_date - NOW())::integer)
                FROM public.inventory_batches ib 
                WHERE ib.product_id = p.id 
                AND ib.tenant_id = v_tenant_id
                AND ib.expiration_date IS NOT NULL
                AND ib.current_quantity > 0
            ) as min_expiry_days,
            p.unit_type as unit_type
        FROM public.products p
        LEFT JOIN public.marketplace_product_settings mps 
            ON mps.product_id = p.id AND mps.store_id = p_store_id
        WHERE p.tenant_id = v_tenant_id
        -- Only return products that are visible (either explicitly set or default)
        AND COALESCE(mps.is_visible, true) = true
        -- Order by admin-set display order, then by name
        ORDER BY COALESCE(mps.display_order, 999999) ASC, p.name ASC;
    ELSE
        -- Fallback: Try marketplace_profiles (B2B marketplace)
        RETURN QUERY
        SELECT 
            l.id as product_id,
            l.product_name,
            l.product_type as category,
            p.strain as strain_type,
            l.base_price as price,
            NULL::numeric as sale_price,
            l.description,
            l.images[1] as image_url,
            l.images as images,
            p.thc_percentage as thc_content,
            p.cbd_percentage as cbd_content,
            l.status = 'active' as is_visible,
            0 as display_order,
            l.quantity_available::integer as stock_quantity,
            l.metrc_retail_id,
            l.exclude_from_discounts,
            l.minimum_price,
            p.effects,
            l.slug,
            NULL::integer as min_expiry_days,
            l.unit_type
        FROM public.marketplace_listings l
        LEFT JOIN public.marketplace_product_sync s ON s.listing_id = l.id
        LEFT JOIN public.products p ON p.id = s.product_id
        WHERE l.marketplace_profile_id = p_store_id
        AND l.status = 'active'
        AND l.visibility = 'public'
        ORDER BY l.product_name ASC;
    END IF;
END;
$function$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_marketplace_products(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_marketplace_products(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_marketplace_products(uuid) TO service_role;

-- Add comment
COMMENT ON FUNCTION public.get_marketplace_products IS 
'Returns visible products for a storefront, respecting admin-configured visibility, custom prices, and display order from marketplace_product_settings.';
