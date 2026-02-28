/**
 * Extended Marketplace Listing Type
 * Adds properties from recent database migrations
 */

import { Database } from '@/integrations/supabase/types';

export type MarketplaceListing = Database['public']['Tables']['marketplace_listings']['Row'] & {
  lab_results?: {
    thc_percentage?: number;
    cbd_percentage?: number;
    terpenes?: string[];
    contaminants?: string[];
    batch_number?: string;
    test_date?: string;
  } | null;
  visibility?: 'public' | 'private' | 'hidden';
  tags?: string[];
  unit_type?: 'gram' | 'ounce' | 'pound' | 'unit';
  min_order_quantity?: number;
  max_order_quantity?: number;
  bulk_pricing?: Array<{
    min_quantity: number;
    max_quantity?: number;
    price: number;
    discount_percentage?: number;
  }>;
  strain_type?: 'indica' | 'sativa' | 'hybrid' | 'cbd';
  slug?: string;
  views?: number;
  orders_count?: number;
  favorites_count?: number;
  published_at?: string | null;
};

export type MarketplaceProfile = {
  id: string;
  tenant_id: string;
  business_name: string;
  business_description?: string | null;
  logo_url?: string | null;
  cover_image_url?: string | null;
  license_number?: string | null;
  license_type?: string | null;
  license_state?: string | null;
  license_expiry_date?: string | null;
  license_document_url?: string | null;
  license_verified?: boolean;
  license_verified_at?: string | null;
  marketplace_status: 'pending' | 'active' | 'suspended' | 'rejected';
  can_sell?: boolean;
  verified_badge?: boolean;
  shipping_states?: string[];
  shipping_policy?: string | null;
  return_policy?: string | null;
  layout_config?: SectionConfig[] | null;
  theme_config?: ExtendedThemeConfig | null;
  average_rating?: number;
  total_reviews?: number;
  total_orders?: number;
  created_at?: string;
  updated_at?: string;
};

/**
 * Feature toggles for Easy Mode storefront configuration
 */
export interface FeatureToggles {
  showSaleBadges: boolean;
  showNewBadges: boolean;
  showStrainBadges: boolean;
  showStockWarnings: boolean;
  enableSearch: boolean;
  showCategories: boolean;
  showPremiumFilter: boolean;
  showHero: boolean;
  showFeatures: boolean;
  showTestimonials: boolean;
  showNewsletter: boolean;
  showFAQ: boolean;
}

/**
 * Simple content editable in Easy Mode
 */
export interface SimpleContent {
  announcementBanner?: string;
  heroHeadline: string;
  heroSubheadline: string;
  heroCtaText: string;
  heroCtaLink: string;
}

/**
 * Easy Mode configuration stored in theme_config.easy_mode
 */
export interface EasyModeConfig {
  enabled: boolean;
  preset_id: string | null;
  feature_toggles: FeatureToggles;
  simple_content: SimpleContent;
  custom_modifications: string[];
  last_preset_applied_at?: string;
}

/**
 * Extended theme config with Easy Mode support
 */
export interface ExtendedThemeConfig {
  colors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    text?: string;
  };
  typography?: {
    fontFamily?: string;
  };
  easy_mode?: EasyModeConfig;
}

/**
 * Section configuration for storefront layout
 */
export interface SectionConfig {
  id: string;
  type: string;
  content: Record<string, unknown>;
  styles: Record<string, unknown>;
  visible?: boolean;
  responsive?: {
    mobile?: { padding_y?: string; hidden?: boolean };
    tablet?: { padding_y?: string; hidden?: boolean };
    desktop?: { padding_y?: string; hidden?: boolean };
  };
}

export type MarketplaceStore = {
  id: string;
  tenant_id: string;
  store_name: string;
  slug: string;
  tagline?: string | null;
  description?: string | null;
  logo_url?: string | null;
  banner_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  accent_color?: string | null;
  font_family?: string | null;
  is_active?: boolean;
  is_public?: boolean;
  layout_config?: SectionConfig[] | null;
  theme_config?: ExtendedThemeConfig | null;
  operating_hours?: Record<string, unknown> | null;
  checkout_settings?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
};
