-- Drop and recreate get_marketplace_store_by_slug with correct types
DROP FUNCTION IF EXISTS public.get_marketplace_store_by_slug(TEXT);

CREATE OR REPLACE FUNCTION public.get_marketplace_store_by_slug(p_slug TEXT)
RETURNS TABLE (
  id UUID,
  tenant_id UUID,
  store_name TEXT,
  slug TEXT,
  tagline TEXT,
  description TEXT,
  logo_url TEXT,
  banner_url TEXT,
  primary_color TEXT,
  secondary_color TEXT,
  accent_color TEXT,
  is_active BOOLEAN,
  is_public BOOLEAN,
  require_age_verification BOOLEAN,
  minimum_age INTEGER,
  operating_hours JSONB,
  theme_config JSONB,
  layout_config JSONB,
  checkout_settings JSONB,
  payment_methods JSONB,
  free_delivery_threshold NUMERIC,
  default_delivery_fee NUMERIC,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ms.id, ms.tenant_id, ms.store_name, ms.slug, ms.tagline, ms.description,
    ms.logo_url, ms.banner_url, ms.primary_color, ms.secondary_color, 
    ms.accent_color, ms.is_active, ms.is_public, ms.require_age_verification,
    ms.minimum_age, ms.operating_hours, ms.theme_config, ms.layout_config,
    ms.checkout_settings, ms.payment_methods, ms.free_delivery_threshold,
    ms.default_delivery_fee, ms.created_at, ms.updated_at
  FROM public.marketplace_stores ms
  WHERE ms.slug = p_slug
    AND (ms.is_public = true 
      OR ms.tenant_id IN (SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()));
END;
$$;

-- Grant execute permissions to all roles
GRANT EXECUTE ON FUNCTION public.get_marketplace_store_by_slug(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_marketplace_store_by_slug(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_marketplace_store_by_slug(TEXT) TO service_role;