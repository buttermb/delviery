-- Migration: Add Storefront Configuration Columns
-- Description: Adds jsonb columns for storefront layout and theme customization

ALTER TABLE public.marketplace_profiles
ADD COLUMN IF NOT EXISTS layout_config JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS theme_config JSONB DEFAULT '{"colors": {"primary": "#000000", "background": "#ffffff"}}'::jsonb;

COMMENT ON COLUMN public.marketplace_profiles.layout_config IS 'JSON configuration for dynamic storefront sections';
COMMENT ON COLUMN public.marketplace_profiles.theme_config IS 'JSON configuration for storefront theming (colors, fonts)';

-- Update RPC to return new columns
CREATE OR REPLACE FUNCTION get_marketplace_store_by_slug(p_slug TEXT)
RETURNS TABLE (
  id UUID,
  store_name TEXT,
  slug TEXT,
  tagline TEXT,
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
  free_delivery_threshold NUMERIC,
  default_delivery_fee NUMERIC,
  checkout_settings JSONB,
  payment_methods JSONB,
  layout_config JSONB,
  theme_config JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    mp.id,
    mp.business_name,
    mp.slug,
    mp.tagline,
    mp.logo_url,
    mp.banner_url,
    mp.primary_color,
    mp.secondary_color,
    mp.accent_color,
    (mp.marketplace_status = 'active' AND mp.can_sell = true) as is_active,
    true as is_public,
    mp.require_age_verification,
    mp.minimum_age,
    mp.operating_hours,
    mp.free_delivery_threshold,
    mp.default_delivery_fee,
    mp.checkout_settings,
    mp.payment_methods,
    mp.layout_config,
    mp.theme_config
  FROM public.marketplace_profiles mp
  WHERE mp.slug = p_slug;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
