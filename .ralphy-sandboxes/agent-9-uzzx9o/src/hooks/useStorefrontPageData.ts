/**
 * Single-query storefront data hook
 * Replaces 2-3 sequential queries with one RPC call via get_storefront_page_data
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';

// ── Types ───────────────────────────────────────────────────────────────────

export interface StorefrontStoreData {
  id: string;
  tenant_id: string;
  store_name: string;
  slug: string;
  tagline: string | null;
  logo_url: string | null;
  banner_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  is_active: boolean;
  is_public: boolean;
  require_age_verification: boolean;
  minimum_age: number;
  operating_hours: Record<string, { open: string; close: string; closed: boolean }> | null;
  free_delivery_threshold: number | null;
  default_delivery_fee: number | null;
  checkout_settings: Record<string, unknown> | null;
  payment_methods: unknown[] | null;
  layout_config: unknown[] | null;
  theme_config: {
    theme?: string;
    colors?: {
      primary?: string;
      secondary?: string;
      accent?: string;
      background?: string;
    };
  } | null;
  nav_links: Array<{ label: string; url: string }> | null;
}

export interface StorefrontProduct {
  product_id: string;
  product_name: string;
  category: string;
  strain_type: string | null;
  price: number;
  sale_price: number | null;
  image_url: string | null;
  thc_content: number | null;
  cbd_content: number | null;
}

export interface StorefrontMenuProduct extends StorefrontProduct {
  description: string | null;
  display_order: number;
  created_at: string;
}

export interface StorefrontProductDetail extends StorefrontProduct {
  images: string[] | null;
  thca_percentage: number | null;
  description: string | null;
  effects: string[] | null;
  terpenes: unknown;
  consumption_methods: string[] | null;
  medical_benefits: string[] | null;
  strain_name: string | null;
  strain_lineage: string | null;
  usage_tips: string | null;
  lab_results_url: string | null;
  lab_name: string | null;
  test_date: string | null;
  coa_url: string | null;
  coa_pdf_url: string | null;
  in_stock: boolean | null;
  display_order: number;
}

export interface StorefrontCategory {
  category: string;
  count: number;
}

export interface StorefrontRelatedProduct extends StorefrontProduct {
  display_order: number;
}

// ── Page-specific response types ────────────────────────────────────────────

interface LandingPageData {
  store: StorefrontStoreData | null;
  products: StorefrontProduct[];
  categories: StorefrontCategory[];
}

interface MenuPageData {
  store: StorefrontStoreData | null;
  products: StorefrontMenuProduct[];
}

interface ProductDetailPageData {
  store: StorefrontStoreData | null;
  product: StorefrontProductDetail | null;
  related_products: StorefrontRelatedProduct[];
}

type PageType = 'landing' | 'menu' | 'product_detail';

// ── Hook ────────────────────────────────────────────────────────────────────

export function useStorefrontPageData<T extends PageType>(
  slug: string | undefined,
  pageType: T,
  productId?: string
) {
  type ResponseData = T extends 'landing'
    ? LandingPageData
    : T extends 'menu'
      ? MenuPageData
      : ProductDetailPageData;

  return useQuery({
    queryKey: queryKeys.storePages.pageData(slug, pageType, productId),
    queryFn: async (): Promise<ResponseData> => {
      if (!slug) {
        return { store: null, products: [], categories: [] } as ResponseData;
      }

      const { data, error } = await supabase.rpc(
        'get_storefront_page_data' as never,
        {
          p_slug: slug,
          p_page_type: pageType,
          ...(productId ? { p_product_id: productId } : {}),
        } as never
      );

      if (error) {
        logger.error('Failed to fetch storefront page data', error, {
          component: 'useStorefrontPageData',
          slug,
          pageType,
        });
        throw error;
      }

      return (data as unknown as ResponseData) ?? ({ store: null } as ResponseData);
    },
    enabled: !!slug && (pageType !== 'product_detail' || !!productId),
    retry: false,
    staleTime: 60_000,
  });
}
