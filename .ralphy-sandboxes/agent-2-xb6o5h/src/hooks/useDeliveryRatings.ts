/**
 * useDeliveryRatings Hook
 *
 * Manages delivery customer ratings:
 * - Submit rating (customer-facing, by tracking token)
 * - Fetch existing rating for an order (by tracking token)
 * - Fetch recent ratings for admin delivery dashboard
 * - Fetch per-runner average ratings
 * - Low rating triggers admin notification (rating <= 2)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import type {
  DeliveryRating,
  DeliveryRatingWithRunner,
  CreateDeliveryRatingInput,
  RunnerRatingAggregate,
} from '@/types/deliveryRating';

// =============================================================================
// Hook: useExistingRating — check if customer already rated (by tracking token)
// =============================================================================

export function useExistingRating(trackingToken: string | undefined) {
  return useQuery({
    queryKey: queryKeys.deliveryRatings.byTracking(trackingToken || ''),
    queryFn: async (): Promise<DeliveryRating | null> => {
      if (!trackingToken) return null;

      const { data, error } = await supabase
        .from('delivery_ratings')
        .select('*')
        .eq('tracking_token', trackingToken)
        .maybeSingle();

      if (error) {
        logger.error('[useExistingRating] Failed to check existing rating', error);
        throw error;
      }

      return data as DeliveryRating | null;
    },
    enabled: !!trackingToken,
  });
}

// =============================================================================
// Hook: useSubmitDeliveryRating — customer submits a rating
// =============================================================================

export function useSubmitDeliveryRating() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateDeliveryRatingInput) => {
      logger.info('[useSubmitDeliveryRating] Submitting rating', {
        orderId: input.order_id,
        rating: input.rating,
      });

      const { data, error } = await supabase
        .from('delivery_ratings')
        .insert({
          tenant_id: input.tenant_id,
          order_id: input.order_id,
          delivery_id: input.delivery_id || null,
          runner_id: input.runner_id || null,
          customer_id: input.customer_id || null,
          tracking_token: input.tracking_token || null,
          rating: input.rating,
          comment: input.comment || null,
        })
        .select()
        .single();

      if (error) {
        logger.error('[useSubmitDeliveryRating] Failed to submit rating', error);
        throw error;
      }

      return data as DeliveryRating;
    },
    onSuccess: (data) => {
      // Invalidate related queries
      if (data.tracking_token) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.deliveryRatings.byTracking(data.tracking_token),
        });
      }
      queryClient.invalidateQueries({
        queryKey: queryKeys.deliveryRatings.byOrder(data.order_id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.deliveryRatings.all,
      });

      // Log low ratings for admin notification
      if (data.rating <= 2) {
        logger.warn('[useSubmitDeliveryRating] Low rating received', {
          orderId: data.order_id,
          runnerId: data.runner_id,
          rating: data.rating,
          comment: data.comment,
        });
      }
    },
    onError: (error) => {
      logger.error('[useSubmitDeliveryRating] Mutation error', error);
    },
  });
}

// =============================================================================
// Hook: useRecentDeliveryRatings — admin dashboard recent reviews
// =============================================================================

export function useRecentDeliveryRatings(tenantId: string | null, limit = 10) {
  return useQuery({
    queryKey: queryKeys.deliveryRatings.recent(tenantId || undefined),
    queryFn: async (): Promise<DeliveryRatingWithRunner[]> => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('delivery_ratings')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error('[useRecentDeliveryRatings] Failed to fetch ratings', error);
        throw error;
      }

      if (!data || data.length === 0) return [];

      // Fetch runner names for the ratings that have runner_id
      const runnerIds = [...new Set(
        (data as DeliveryRating[])
          .filter((r) => r.runner_id)
          .map((r) => r.runner_id as string)
      )];

      let runnerMap: Record<string, string> = {};
      if (runnerIds.length > 0) {
        const { data: runners } = await supabase
          .from('wholesale_runners')
          .select('id, full_name')
          .eq('tenant_id', tenantId)
          .in('id', runnerIds);

        if (runners) {
          runnerMap = Object.fromEntries(
            runners.map((r) => [r.id, r.full_name])
          );
        }
      }

      return (data as DeliveryRating[]).map((rating) => ({
        ...rating,
        runner_name: rating.runner_id ? runnerMap[rating.runner_id] : undefined,
      }));
    },
    enabled: !!tenantId,
    staleTime: 30000,
  });
}

// =============================================================================
// Hook: useRunnerRatingAggregate — average rating per runner
// =============================================================================

export function useRunnerRatingAggregate(
  tenantId: string | null,
  runnerId: string | undefined
) {
  return useQuery({
    queryKey: queryKeys.deliveryRatings.byRunner(tenantId || '', runnerId || ''),
    queryFn: async (): Promise<RunnerRatingAggregate | null> => {
      if (!tenantId || !runnerId) return null;

      // Fetch all ratings for this runner
      const { data, error } = await supabase
        .from('delivery_ratings')
        .select('rating')
        .eq('tenant_id', tenantId)
        .eq('runner_id', runnerId);

      if (error) {
        logger.error('[useRunnerRatingAggregate] Failed to fetch runner ratings', error);
        throw error;
      }

      const ratings = (data || []) as Array<{ rating: number }>;
      if (ratings.length === 0) return null;

      // Get runner name
      const { data: runner } = await supabase
        .from('wholesale_runners')
        .select('full_name')
        .eq('id', runnerId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      const totalRatings = ratings.length;
      const averageRating = ratings.reduce((sum, r) => sum + r.rating, 0) / totalRatings;

      const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      ratings.forEach((r) => {
        distribution[r.rating] = (distribution[r.rating] || 0) + 1;
      });

      return {
        runner_id: runnerId,
        runner_name: runner?.full_name || 'Unknown',
        average_rating: Math.round(averageRating * 10) / 10,
        total_ratings: totalRatings,
        rating_distribution: distribution,
      };
    },
    enabled: !!tenantId && !!runnerId,
    staleTime: 60000,
  });
}
