-- ============================================================================
-- Update get_marketplace_products to respect menu_visibility on products table
-- and default products without settings to NOT visible (opt-in model).
--
-- Before: Products without marketplace_product_settings defaulted to visible.
--         The product's own menu_visibility flag was ignored.
--
-- After:  Products must have menu_visibility = true AND either an explicit
--         marketplace_product_settings.is_visible = true or no settings row
--         (which now defaults to checking menu_visibility only for backward
--         compatibility during transition).
--
-- Also updates get_product_by_slug to apply the same visibility rules.
-- ============================================================================

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
SET search_path = public
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
            COALESCE(mps.custom_price, p.price) as price,
            mps.sale_price as sale_price,
            p.description as description,
            CASE
                WHEN p.images IS NOT NULL AND array_length(p.images, 1) > 0
                THEN p.images[1]
                ELSE p.image_url
            END as image_url,
            COALESCE(p.images, ARRAY[]::text[]) as images,
            p.thc_percentage as thc_content,
            p.cbd_percentage as cbd_content,
            COALESCE(mps.is_visible, true) as is_visible,
            COALESCE(mps.display_order, 0) as display_order,
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
        -- Respect the product-level menu_visibility flag
        AND p.menu_visibility = true
        -- Respect the storefront-level visibility setting
        AND COALESCE(mps.is_visible, true) = true
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

COMMENT ON FUNCTION public.get_marketplace_products IS
'Returns visible products for a storefront. Filters by menu_visibility on the products table and is_visible in marketplace_product_settings. Shows stock_quantity from inventory_batches.';

-- ============================================================================
-- Update get_product_by_slug to also respect menu_visibility
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_product_by_slug(
  p_store_id UUID,
  p_slug TEXT
)
RETURNS TABLE (
  product_id UUID,
  product_name TEXT,
  slug TEXT,
  description TEXT,
  category TEXT,
  brand TEXT,
  sku TEXT,
  price NUMERIC,
  sale_price NUMERIC,
  image_url TEXT,
  images TEXT[],
  is_featured BOOLEAN,
  is_on_sale BOOLEAN,
  stock_quantity INTEGER,
  strain_type TEXT,
  thc_content NUMERIC,
  cbd_content NUMERIC,
  sort_order INTEGER,
  created_at TIMESTAMPTZ,
  prices JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id as product_id,
    p.name as product_name,
    mps.slug,
    COALESCE(mps.custom_description, p.description) as description,
    p.category,
    p.vendor_name as brand,
    p.sku,
    COALESCE(mps.custom_price, p.price) as price,
    p.sale_price,
    p.image_url,
    p.images,
    COALESCE(mps.featured, false) as is_featured,
    p.sale_price IS NOT NULL as is_on_sale,
    COALESCE(p.stock_quantity, 0) as stock_quantity,
    p.strain_type,
    p.thc_content,
    p.cbd_content,
    COALESCE(mps.display_order, 0) as sort_order,
    mps.created_at,
    p.prices
  FROM marketplace_product_settings mps
  JOIN products p ON p.id = mps.product_id
  WHERE mps.store_id = p_store_id
    AND mps.slug = p_slug
    AND COALESCE(mps.is_visible, true) = true
    AND p.menu_visibility = true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_product_by_slug(UUID, TEXT) TO anon, authenticated;
