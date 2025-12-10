-- Grant permissions for storefront RPC functions
-- Fixes 400/403 errors when accessing storefront

GRANT EXECUTE ON FUNCTION get_marketplace_store_by_slug(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_marketplace_products(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION validate_marketplace_coupon(UUID, TEXT, NUMERIC) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION create_marketplace_order(UUID, JSONB, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_marketplace_order_by_token(TEXT) TO anon, authenticated, service_role;

-- Grant access to public tables needed for storefront
GRANT SELECT ON public.marketplace_profiles TO anon, authenticated;
GRANT SELECT ON public.marketplace_listings TO anon, authenticated;
GRANT SELECT ON public.marketplace_categories TO anon, authenticated;
GRANT SELECT ON public.marketplace_store_front_settings TO anon, authenticated;
