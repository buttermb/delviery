/**
 * useStorefrontProductVariants Hook
 *
 * Fetches active product variants for the public storefront.
 * Uses a SECURITY DEFINER RPC so anonymous visitors can read variant data.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';

export interface StorefrontVariant {
  id: string;
  name: string;
  variant_type: string;
  price: number | null;
  retail_price: number | null;
  available_quantity: number;
  is_active: boolean;
  display_order: number;
  weight_grams: number | null;
  thc_percent: number | null;
  cbd_percent: number | null;
  strain_type: string | null;
}

/**
 * Fetch active variants for a product listing on the storefront
 */
export function useStorefrontProductVariants(listingId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.shopProducts.variants(listingId),
    queryFn: async (): Promise<StorefrontVariant[]> => {
      if (!listingId) return [];

      const { data, error } = await (supabase.rpc as unknown as (
        name: string,
        params: Record<string, unknown>
      ) => Promise<{ data: unknown; error: unknown }>)(
        'get_storefront_product_variants',
        { p_listing_id: listingId }
      );

      if (error) {
        logger.error('Failed to fetch storefront product variants', { error, listingId });
        return [];
      }

      return (data as StorefrontVariant[]) ?? [];
    },
    enabled: !!listingId,
  });
}
