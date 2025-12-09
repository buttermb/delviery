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
  layout_config?: any[] | null;
  theme_config?: any | null;
  average_rating?: number;
  total_reviews?: number;
  total_orders?: number;
  created_at?: string;
  updated_at?: string;
};

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
  layout_config?: any[] | null;
  theme_config?: any | null;
  operating_hours?: any | null;
  checkout_settings?: any | null;
  created_at?: string;
  updated_at?: string;
};
