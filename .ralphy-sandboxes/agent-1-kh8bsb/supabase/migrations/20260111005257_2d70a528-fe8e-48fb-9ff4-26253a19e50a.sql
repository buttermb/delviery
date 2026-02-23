-- Add slug column to marketplace_product_settings
ALTER TABLE marketplace_product_settings 
ADD COLUMN IF NOT EXISTS slug TEXT;

-- Create unique index per store (same product name can exist in different stores)
CREATE UNIQUE INDEX IF NOT EXISTS idx_mps_store_slug 
ON marketplace_product_settings(store_id, slug) 
WHERE slug IS NOT NULL;

-- Create slug generation function
CREATE OR REPLACE FUNCTION generate_product_slug(p_name TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN lower(
    regexp_replace(
      regexp_replace(
        trim(COALESCE(p_name, '')),
        '[^a-zA-Z0-9\s-]', '', 'g'
      ),
      '\s+', '-', 'g'
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create trigger function to auto-generate slugs
CREATE OR REPLACE FUNCTION set_product_slug()
RETURNS TRIGGER AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 1;
BEGIN
  -- Get product name from products table
  SELECT generate_product_slug(p.name) INTO base_slug
  FROM products p WHERE p.id = NEW.product_id;
  
  -- If no name found, use product_id
  IF base_slug IS NULL OR base_slug = '' THEN
    base_slug := NEW.product_id::text;
  END IF;
  
  final_slug := base_slug;
  
  -- Handle duplicates by appending counter
  WHILE EXISTS (
    SELECT 1 FROM marketplace_product_settings 
    WHERE store_id = NEW.store_id 
    AND slug = final_slug 
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) LOOP
    final_slug := base_slug || '-' || counter;
    counter := counter + 1;
  END LOOP;
  
  NEW.slug := final_slug;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger
DROP TRIGGER IF EXISTS trg_set_product_slug ON marketplace_product_settings;
CREATE TRIGGER trg_set_product_slug
BEFORE INSERT OR UPDATE ON marketplace_product_settings
FOR EACH ROW
WHEN (NEW.slug IS NULL OR NEW.slug = '')
EXECUTE FUNCTION set_product_slug();

-- Backfill existing products with slugs
UPDATE marketplace_product_settings mps
SET slug = subq.new_slug
FROM (
  SELECT 
    mps.id,
    generate_product_slug(p.name) || 
    CASE 
      WHEN row_number() OVER (PARTITION BY mps.store_id, generate_product_slug(p.name) ORDER BY mps.created_at) > 1
      THEN '-' || (row_number() OVER (PARTITION BY mps.store_id, generate_product_slug(p.name) ORDER BY mps.created_at) - 1)::text
      ELSE ''
    END as new_slug
  FROM marketplace_product_settings mps
  JOIN products p ON p.id = mps.product_id
  WHERE mps.slug IS NULL OR mps.slug = ''
) subq
WHERE mps.id = subq.id;

-- Create RPC to get product by slug
CREATE OR REPLACE FUNCTION get_product_by_slug(
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
    AND COALESCE(mps.is_visible, true) = true;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_product_by_slug(UUID, TEXT) TO anon, authenticated;