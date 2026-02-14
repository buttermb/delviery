-- Add customization columns to marketplace_profiles
ALTER TABLE public.marketplace_profiles
ADD COLUMN IF NOT EXISTS layout_config JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS theme_config JSONB DEFAULT '{
  "colors": {
    "primary": "#000000",
    "secondary": "#ffffff",
    "accent": "#3b82f6",
    "background": "#f3f4f6",
    "text": "#1f2937"
  },
  "typography": {
    "fontFamily": "Inter, sans-serif",
    "headingFont": "Inter, sans-serif"
  },
  "borderRadius": "0.5rem"
}'::jsonb,
ADD COLUMN IF NOT EXISTS nav_links JSONB DEFAULT '[
  {"label": "Home", "url": "/"},
  {"label": "Shop", "url": "/shop"},
  {"label": "Contact", "url": "/contact"}
]'::jsonb;

-- Comment on columns
COMMENT ON COLUMN public.marketplace_profiles.layout_config IS 'JSON array of sections (hero, featured keys, etc) defining the homepage layout';
COMMENT ON COLUMN public.marketplace_profiles.theme_config IS 'Theme settings including custom colors, fonts, and spacing';
COMMENT ON COLUMN public.marketplace_profiles.nav_links IS 'Custom navigation links for the storefront header';

-- Update RPC to included new columns
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
  theme_config JSONB,
  nav_links JSONB
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
    mp.theme_config,
    mp.nav_links
  FROM public.marketplace_profiles mp
  WHERE mp.slug = p_slug;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
