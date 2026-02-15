/**
 * useDeliveryRatings Hook
 * Fetches recent delivery ratings for admin dashboard display.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import type { DeliveryRatingWithRunner } from '@/types/deliveryRating';

export function useRecentDeliveryRatings(tenantId: string | null, limit = 10) {
  return useQuery<DeliveryRatingWithRunner[]>({
    queryKey: ['delivery-ratings', 'recent', tenantId, limit],
    queryFn: async (): Promise<DeliveryRatingWithRunner[]> => {
      if (!tenantId) return [];

      const { data, error } = await (supabase as any)
        .from('delivery_ratings')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error('Failed to fetch delivery ratings', error, { component: 'useDeliveryRatings' });
        throw error;
      }

      return (data || []) as DeliveryRatingWithRunner[];
    },
    enabled: !!tenantId,
    staleTime: 30000,
  });
}
