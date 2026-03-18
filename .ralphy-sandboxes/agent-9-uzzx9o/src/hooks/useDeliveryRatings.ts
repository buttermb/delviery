/**
 * Hooks for delivery rating CRUD operations
 *
 * - useExistingRating: check if a tracking token already has a rating
 * - useSubmitDeliveryRating: mutation to create a new rating
 * - useRecentDeliveryRatings: admin list of recent ratings for a tenant
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import type {
  DeliveryRating,
  DeliveryRatingWithRunner,
  CreateDeliveryRatingInput,
} from '@/types/deliveryRating';

import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { humanizeError } from '@/lib/humanizeError';

/**
 * Check whether a rating already exists for a given tracking token.
 */
export function useExistingRating(trackingToken: string | undefined) {
  return useQuery({
    queryKey: queryKeys.deliveryRatings.byToken(trackingToken ?? ''),
    queryFn: async (): Promise<DeliveryRating | null> => {
      if (!trackingToken) return null;

      const result = await supabase
        .from('delivery_ratings')
        .select('id, tenant_id, order_id, delivery_id, runner_id, customer_id, tracking_token, rating, comment, created_at, updated_at')
        .eq('tracking_token', trackingToken)
        .maybeSingle();

      if (result.error) {
        logger.error('Error checking existing rating', result.error as Error, {
          trackingToken,
        });
        throw result.error;
      }

      return result.data as DeliveryRating | null;
    },
    enabled: !!trackingToken,
    staleTime: 60_000,
  });
}

/**
 * Submit a new delivery rating.
 */
export function useSubmitDeliveryRating() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateDeliveryRatingInput): Promise<DeliveryRating> => {
      const { data, error } = await supabase
        .from('delivery_ratings')
        .insert(input)
        .select('id, tenant_id, order_id, delivery_id, runner_id, customer_id, tracking_token, rating, comment, created_at, updated_at')
        .maybeSingle();

      if (error) {
        logger.error('Error submitting delivery rating', error as Error, {
          orderId: input.order_id,
        });
        throw error;
      }

      return data as DeliveryRating;
    },
    onSuccess: (_data: DeliveryRating, variables: CreateDeliveryRatingInput) => {
      toast.success('Rating submitted successfully');
      if (variables.tracking_token) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.deliveryRatings.byToken(variables.tracking_token),
        });
      }
      queryClient.invalidateQueries({
        queryKey: queryKeys.deliveryRatings.all,
      });
    },
    onError: (error) => {
      toast.error(humanizeError(error, 'Failed to submit rating'));
    },
  });
}

/**
 * Fetch the most recent delivery ratings for a tenant (admin view).
 */
export function useRecentDeliveryRatings(
  tenantId: string | null,
  limit = 10,
) {
  return useQuery({
    queryKey: queryKeys.deliveryRatings.recent(tenantId ?? '', limit),
    queryFn: async (): Promise<DeliveryRatingWithRunner[]> => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('delivery_ratings')
        .select('id, tenant_id, order_id, delivery_id, runner_id, customer_id, tracking_token, rating, comment, created_at, updated_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error('Error fetching recent delivery ratings', error as Error, {
          tenantId,
        });
        throw error;
      }

      return (data ?? []) as DeliveryRatingWithRunner[];
    },
    enabled: !!tenantId,
    staleTime: 30_000,
  });
}
