-- Create get_marketplace_products RPC function
CREATE OR REPLACE FUNCTION public.get_marketplace_products(p_store_id uuid)
RETURNS TABLE (
  product_id uuid,
  name text,
  description text,
  short_description text,
  category text,
  price numeric,
  display_price numeric,
  compare_at_price numeric,
  image_url text,
  images text[],
  in_stock boolean,
  is_featured boolean,
  marketplace_category_id uuid,
  marketplace_category_name text,
  tags text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    mps.product_id,
    p.name,
    p.description,
    p.description as short_description,
    p.category,
    COALESCE(mps.custom_price, p.price, 0) as price,
    COALESCE(mps.custom_price, p.price, 0) as display_price,
    p.sale_price as compare_at_price,
    p.image_url,
    COALESCE(p.images, ARRAY[]::text[]) as images,
    COALESCE(p.in_stock, true) as in_stock,
    COALESCE(mps.featured, false) as is_featured,
    mc.id as marketplace_category_id,
    mc.name as marketplace_category_name,
    ARRAY[]::text[] as tags
  FROM marketplace_product_settings mps
  JOIN products p ON p.id = mps.product_id
  LEFT JOIN marketplace_categories mc ON mc.store_id = mps.store_id
  WHERE mps.store_id = p_store_id
    AND mps.is_visible = true
  ORDER BY COALESCE(mps.featured, false) DESC, mps.display_order ASC NULLS LAST, p.name ASC;
END;
$function$;

-- Grant execute permission to anon and authenticated
GRANT EXECUTE ON FUNCTION public.get_marketplace_products(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_marketplace_products(uuid) TO authenticated;