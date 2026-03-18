-- ============================================================================
-- RPC: get_storefront_page_data
-- Single-query storefront data load replacing 2-3 sequential queries
-- ============================================================================
-- Currently each storefront page makes waterfall queries:
--   1. get_marketplace_store_by_slug → store config
--   2. products query → products list (depends on tenant_id from #1)
--   3. categories aggregation → category counts (depends on tenant_id from #1)
--
-- This RPC returns all data in a single round trip as JSONB.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_storefront_page_data(
  p_slug TEXT,
  p_page_type TEXT DEFAULT 'landing',
  p_product_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store RECORD;
  v_result JSONB;
  v_products JSONB;
  v_categories JSONB;
  v_product_detail JSONB;
  v_related_products JSONB;
  v_product_category TEXT;
BEGIN
  -- 1. Fetch store config
  SELECT
    mp.id,
    mp.tenant_id,
    mp.business_name AS store_name,
    mp.slug,
    mp.tagline,
    mp.logo_url,
    mp.banner_url,
    mp.primary_color,
    mp.secondary_color,
    mp.accent_color,
    (mp.marketplace_status = 'active' AND mp.can_sell = true) AS is_active,
    true AS is_public,
    mp.require_age_verification,
    mp.minimum_age,
    mp.operating_hours,
    mp.free_delivery_threshold,
    mp.default_delivery_fee,
    mp.checkout_settings,
    mp.payment_methods,
    mp.layout_config,
    mp.theme_config,
    mp.nav_links
  INTO v_store
  FROM public.marketplace_profiles mp
  WHERE mp.slug = p_slug;

  -- Store not found
  IF v_store IS NULL THEN
    RETURN jsonb_build_object('store', NULL, 'products', '[]'::jsonb, 'categories', '[]'::jsonb);
  END IF;

  -- Build store JSON
  v_result := jsonb_build_object(
    'store', jsonb_build_object(
      'id', v_store.id,
      'tenant_id', v_store.tenant_id,
      'store_name', v_store.store_name,
      'slug', v_store.slug,
      'tagline', v_store.tagline,
      'logo_url', v_store.logo_url,
      'banner_url', v_store.banner_url,
      'primary_color', v_store.primary_color,
      'secondary_color', v_store.secondary_color,
      'accent_color', v_store.accent_color,
      'is_active', v_store.is_active,
      'is_public', v_store.is_public,
      'require_age_verification', v_store.require_age_verification,
      'minimum_age', v_store.minimum_age,
      'operating_hours', v_store.operating_hours,
      'free_delivery_threshold', v_store.free_delivery_threshold,
      'default_delivery_fee', v_store.default_delivery_fee,
      'checkout_settings', v_store.checkout_settings,
      'payment_methods', v_store.payment_methods,
      'layout_config', v_store.layout_config,
      'theme_config', v_store.theme_config,
      'nav_links', v_store.nav_links
    )
  );

  -- 2. Page-specific data
  IF p_page_type = 'landing' THEN
    -- Featured products (top 8 by display_order)
    SELECT COALESCE(jsonb_agg(row_to_json(p)::jsonb ORDER BY p.display_order ASC), '[]'::jsonb)
    INTO v_products
    FROM (
      SELECT
        product_id, product_name, category, strain_type,
        price, sale_price, image_url, thc_content, cbd_content
      FROM public.products
      WHERE tenant_id = v_store.tenant_id
        AND is_visible = true
      ORDER BY display_order ASC
      LIMIT 8
    ) p;

    -- Categories with counts (server-side aggregation)
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object('category', c.category, 'count', c.cnt)
      ORDER BY c.cnt DESC
    ), '[]'::jsonb)
    INTO v_categories
    FROM (
      SELECT category, COUNT(*) AS cnt
      FROM public.products
      WHERE tenant_id = v_store.tenant_id
        AND is_visible = true
        AND category IS NOT NULL
      GROUP BY category
      ORDER BY cnt DESC
    ) c;

    v_result := v_result || jsonb_build_object(
      'products', v_products,
      'categories', v_categories
    );

  ELSIF p_page_type = 'menu' THEN
    -- All visible products for menu (client handles filtering/sorting/pagination)
    SELECT COALESCE(jsonb_agg(row_to_json(p)::jsonb ORDER BY p.display_order ASC), '[]'::jsonb)
    INTO v_products
    FROM (
      SELECT
        product_id, product_name, category, strain_type,
        price, sale_price, image_url, thc_content, cbd_content,
        description, display_order, created_at
      FROM public.products
      WHERE tenant_id = v_store.tenant_id
        AND is_visible = true
      ORDER BY display_order ASC
    ) p;

    v_result := v_result || jsonb_build_object(
      'products', v_products
    );

  ELSIF p_page_type = 'product_detail' THEN
    -- Single product detail
    IF p_product_id IS NOT NULL THEN
      SELECT row_to_json(p)::jsonb
      INTO v_product_detail
      FROM (
        SELECT
          product_id, product_name, category, strain_type,
          price, sale_price, image_url, images,
          thc_content, cbd_content, thca_percentage,
          description, effects, terpenes,
          consumption_methods, medical_benefits,
          strain_name, strain_lineage, usage_tips,
          lab_results_url, lab_name, test_date,
          coa_url, coa_pdf_url, in_stock, display_order
        FROM public.products
        WHERE tenant_id = v_store.tenant_id
          AND product_id = p_product_id
          AND is_visible = true
      ) p;

      -- Related products (same category, exclude current)
      IF v_product_detail IS NOT NULL THEN
        v_product_category := v_product_detail->>'category';

        SELECT COALESCE(jsonb_agg(row_to_json(rp)::jsonb ORDER BY rp.display_order ASC), '[]'::jsonb)
        INTO v_related_products
        FROM (
          SELECT
            product_id, product_name, category, strain_type,
            price, sale_price, image_url, thc_content, cbd_content,
            display_order
          FROM public.products
          WHERE tenant_id = v_store.tenant_id
            AND is_visible = true
            AND category = v_product_category
            AND product_id != p_product_id
          ORDER BY display_order ASC
          LIMIT 8
        ) rp;
      ELSE
        v_related_products := '[]'::jsonb;
      END IF;

      v_result := v_result || jsonb_build_object(
        'product', v_product_detail,
        'related_products', v_related_products
      );
    ELSE
      v_result := v_result || jsonb_build_object(
        'product', NULL,
        'related_products', '[]'::jsonb
      );
    END IF;
  END IF;

  RETURN v_result;
END;
$$;

-- Grant execute to both anon (public storefront) and authenticated users
GRANT EXECUTE ON FUNCTION public.get_storefront_page_data(TEXT, TEXT, UUID) TO anon, authenticated;
