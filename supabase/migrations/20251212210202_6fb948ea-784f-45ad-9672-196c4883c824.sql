-- Create sync_product_to_marketplace RPC function
CREATE OR REPLACE FUNCTION sync_product_to_marketplace(
  p_product_id UUID,
  p_store_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product products%ROWTYPE;
  v_listing_id UUID;
  v_result JSONB;
BEGIN
  -- Fetch the product
  SELECT * INTO v_product
  FROM products
  WHERE id = p_product_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Product not found');
  END IF;
  
  -- Verify store exists
  IF NOT EXISTS (SELECT 1 FROM marketplace_stores WHERE id = p_store_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Store not found');
  END IF;
  
  -- Check if listing already exists
  SELECT id INTO v_listing_id
  FROM marketplace_listings
  WHERE product_id = p_product_id AND store_id = p_store_id;
  
  IF v_listing_id IS NOT NULL THEN
    -- Update existing listing
    UPDATE marketplace_listings
    SET 
      product_name = v_product.name,
      description = v_product.description,
      category = v_product.category,
      base_price = COALESCE(v_product.retail_price, v_product.wholesale_price, 0),
      quantity_available = COALESCE(v_product.available_quantity, 0),
      images = CASE WHEN v_product.image_url IS NOT NULL THEN ARRAY[v_product.image_url]::text[] ELSE ARRAY[]::text[] END,
      status = 'active',
      updated_at = NOW()
    WHERE id = v_listing_id;
    
    v_result := jsonb_build_object('success', true, 'action', 'updated', 'listing_id', v_listing_id);
  ELSE
    -- Create new listing
    INSERT INTO marketplace_listings (
      store_id, product_id, product_name, description, category,
      base_price, quantity_available, images, status, visibility
    ) VALUES (
      p_store_id, p_product_id, v_product.name, v_product.description, v_product.category,
      COALESCE(v_product.retail_price, v_product.wholesale_price, 0),
      COALESCE(v_product.available_quantity, 0),
      CASE WHEN v_product.image_url IS NOT NULL THEN ARRAY[v_product.image_url]::text[] ELSE ARRAY[]::text[] END,
      'active',
      'public'
    )
    RETURNING id INTO v_listing_id;
    
    v_result := jsonb_build_object('success', true, 'action', 'created', 'listing_id', v_listing_id);
  END IF;
  
  RETURN v_result;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION sync_product_to_marketplace(UUID, UUID) TO authenticated;