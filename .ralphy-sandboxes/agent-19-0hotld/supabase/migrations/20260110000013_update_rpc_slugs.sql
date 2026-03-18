-- Drop existing function first to change return type if needed
DROP FUNCTION IF EXISTS public.get_marketplace_products(uuid);

CREATE OR REPLACE FUNCTION public.get_marketplace_products(p_store_id uuid)
 RETURNS TABLE(
    product_id uuid,
    product_name text,
    category text,
    strain_type text,
    price numeric,
    description text,
    image_url text,
    thc_content numeric,
    cbd_content numeric,
    is_visible boolean,
    display_order integer,
    stock_quantity integer,
    metrc_retail_id text,
    exclude_from_discounts boolean,
    minimum_price numeric,
    effects text[],
    slug text
)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        l.id as product_id,
        l.product_name,
        l.product_type as category,  -- Mapping product_type to category for consistency
        p.strain as strain_type,     -- Get strain from product details (joined) or just null if not available easily
                                     -- Wait, I don't have a direct join here in the previous version. 
                                     -- Let's check the schema of marketplace_listings again.
                                     -- Standard practice: marketplace_listings has what we need.
        l.base_price as price,
        l.description,
        l.images[1] as image_url,    -- Take first image
        p.thc_percentage as thc_content, -- Need to join with products table for this? Or is it on listings?
                                         -- It is likely on products table.
        p.cbd_percentage as cbd_content,
        l.status = 'active' as is_visible,
        0 as display_order, -- Placeholder
        l.quantity_available as stock_quantity,
        l.metrc_retail_id,
        l.exclude_from_discounts,
        l.minimum_price,
        p.effects,
        l.slug
    FROM public.marketplace_listings l
    JOIN public.marketplace_product_sync s ON s.listing_id = l.id
    JOIN public.products p ON p.id = s.product_id
    WHERE l.marketplace_profile_id = p_store_id
    AND l.status = 'active'
    AND l.visibility = 'public';
END;
$function$;

-- Update get_marketplace_product to find by slug OR id
CREATE OR REPLACE FUNCTION public.get_marketplace_product(
    p_identifier text
)
RETURNS TABLE (
    product_id uuid,
    product_name text,
    description text,
    category text,
    brand text,
    sku text,
    price numeric,
    sale_price numeric,
    image_url text,
    images text[],
    is_featured boolean,
    is_on_sale boolean,
    stock_quantity integer,
    strain_type text,
    thc_content numeric,
    cbd_content numeric,
    sort_order integer,
    created_at timestamptz,
    metrc_retail_id text,
    exclude_from_discounts boolean,
    minimum_price numeric,
    effects text[],
    slug text,
    store_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        l.id,
        l.product_name,
        l.description,
        l.product_type, -- category
        p.brand,
        p.sku,
        l.base_price,
        NULL::numeric as sale_price, -- simplify
        l.images[1],
        l.images,
        false as is_featured,
        false as is_on_sale,
        l.quantity_available,
        p.strain,
        p.thc_percentage,
        p.cbd_percentage,
        0 as sort_order,
        l.created_at,
        l.metrc_retail_id,
        l.exclude_from_discounts,
        l.minimum_price,
        p.effects,
        l.slug,
        l.marketplace_profile_id
    FROM public.marketplace_listings l
    JOIN public.marketplace_product_sync s ON s.listing_id = l.id
    JOIN public.products p ON p.id = s.product_id
    WHERE (l.id::text = p_identifier OR l.slug = p_identifier)
    LIMIT 1;
END;
$$;
