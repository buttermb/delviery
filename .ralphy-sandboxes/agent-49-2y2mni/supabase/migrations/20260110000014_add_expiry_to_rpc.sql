-- Update get_marketplace_products to include min_expiry_days
-- This is needed for "Expiring Inventory Auto-Discounts" feature

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
    slug text,
    min_expiry_days integer
)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        l.id as product_id,
        l.product_name,
        l.product_type as category,
        p.strain as strain_type,
        l.base_price as price,
        l.description,
        l.images[1] as image_url,
        p.thc_percentage as thc_content,
        p.cbd_percentage as cbd_content,
        l.status = 'active' as is_visible,
        0 as display_order,
        l.quantity_available as stock_quantity,
        l.metrc_retail_id,
        l.exclude_from_discounts,
        l.minimum_price,
        p.effects,
        l.slug,
        -- Calculate minimum days until expiration across all batches for this product
        -- We return NULL if no expiration date is found or no batches exist
        (
            SELECT MIN(DATE_PART('day', b.expiration_date - NOW())::integer)
            FROM public.inventory_batches b 
            WHERE b.product_id = p.id 
            AND b.tenant_id = (SELECT tenant_id FROM public.marketplace_profiles WHERE id = p_store_id)
            AND b.expiration_date IS NOT NULL
            AND b.quantity_lbs > 0 -- Only count batches with stock
            AND b.expiration_date > NOW() -- Only count future expirations (or should we include expired? Plan says "expiring soon", so negative days might be useful but let's stick to positive for now or let logic handle it. Let's return raw diff.)
            -- Actually, let's just return the raw difference even if negative, so UI can decide to show "Expired" if needed.
            -- But the subquery `b.expiration_date > NOW()` filters out already expired. 
            -- Let's keep it simple: Just get the soonest expiration date.
        ) as min_expiry_days
    FROM public.marketplace_listings l
    JOIN public.marketplace_product_sync s ON s.listing_id = l.id
    JOIN public.products p ON p.id = s.product_id
    WHERE l.marketplace_profile_id = p_store_id
    AND l.status = 'active'
    AND l.visibility = 'public';
END;
$function$;
