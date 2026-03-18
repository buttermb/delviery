-- Fix get_marketplace_products RPC to return product_name and add missing luxury theme columns
DROP FUNCTION IF EXISTS public.get_marketplace_products(UUID);

CREATE OR REPLACE FUNCTION public.get_marketplace_products(p_store_id UUID)
RETURNS TABLE (
  product_id UUID,
  product_name TEXT,
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
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mps.product_id,
    p.name as product_name,
    p.description,
    COALESCE(c.name, p.category) as category,
    p.brand,
    p.sku,
    COALESCE(mps.custom_price, p.price) as price,
    mps.sale_price,
    p.image_url,
    p.images,
    mps.is_featured,
    mps.is_on_sale,
    COALESCE(p.stock_quantity, 0) as stock_quantity,
    p.strain_type,
    p.thc_content,
    p.cbd_content,
    mps.sort_order,
    mps.created_at
  FROM public.marketplace_product_settings mps
  JOIN public.products p ON p.id = mps.product_id
  LEFT JOIN public.categories c ON c.id = p.category_id
  JOIN public.marketplace_stores ms ON ms.id = mps.store_id
  WHERE mps.store_id = p_store_id
    AND mps.is_visible = true
    AND (ms.is_public = true 
      OR ms.tenant_id IN (SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()))
  ORDER BY mps.sort_order ASC, mps.created_at DESC;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_marketplace_products(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_marketplace_products(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_marketplace_products(UUID) TO service_role;