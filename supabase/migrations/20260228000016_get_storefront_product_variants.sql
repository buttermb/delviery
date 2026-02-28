-- RPC to fetch active product variants for a storefront listing
-- SECURITY DEFINER so anonymous storefront visitors can read variant data
-- Bridges from marketplace_listings.id → products.id → product_variants

CREATE OR REPLACE FUNCTION public.get_storefront_product_variants(p_listing_id uuid)
RETURNS TABLE(
  id uuid,
  name text,
  variant_type text,
  price numeric,
  retail_price numeric,
  available_quantity integer,
  is_active boolean,
  display_order integer,
  weight_grams numeric,
  thc_percent numeric,
  cbd_percent numeric,
  strain_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pv.id,
    pv.name,
    pv.variant_type,
    pv.price,
    pv.retail_price,
    pv.available_quantity,
    pv.is_active,
    pv.display_order,
    pv.weight_grams,
    pv.thc_percent,
    pv.cbd_percent,
    pv.strain_type
  FROM public.product_variants pv
  JOIN public.marketplace_product_sync mps ON mps.product_id = pv.product_id
  WHERE mps.listing_id = p_listing_id
    AND pv.is_active = true
  ORDER BY pv.display_order ASC, pv.name ASC;
END;
$$;

-- Grant execute to anon and authenticated for storefront access
GRANT EXECUTE ON FUNCTION public.get_storefront_product_variants(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_storefront_product_variants(uuid) TO authenticated;
