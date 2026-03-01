/**
 * Hook for managing delivery cost tracking and P&L data
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import type { DeliveryCost, DeliveryCostInput } from '@/types/deliveryCosts';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { isPostgrestError } from '@/utils/errorHandling/typeGuards';

/**
 * Fetch delivery cost for a specific order
 */
export function useDeliveryCostByOrder(orderId: string | undefined) {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  return useQuery({
    queryKey: queryKeys.deliveryCosts.byOrder(tenantId ?? '', orderId ?? ''),
    queryFn: async (): Promise<DeliveryCost | null> => {
      if (!tenantId || !orderId) return null;

      try {
        const { data, error } = await supabase
          .from('delivery_costs')
          .select('id, tenant_id, order_id, courier_id, runner_pay, fuel_estimate, time_cost, other_costs, total_cost, delivery_fee_collected, tip_amount, total_revenue, profit, distance_miles, delivery_time_minutes, delivery_zone, delivery_borough, notes, created_at, updated_at')
          .eq('tenant_id', tenantId)
          .eq('order_id', orderId)
          .maybeSingle();

        if (error) {
          if (isPostgrestError(error) && error.code === '42P01') return null;
          throw error;
        }

        return data as unknown as DeliveryCost | null;
      } catch (err) {
        if (isPostgrestError(err) && err.code === '42P01') return null;
        logger.error('Error fetching delivery cost', err as Error, { orderId });
        throw err;
      }
    },
    enabled: !!tenantId && !!orderId,
    staleTime: 30_000,
  });
}

/**
 * Fetch all delivery costs for analytics
 */
export function useDeliveryCostAnalytics(dateFrom?: string, dateTo?: string) {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  return useQuery({
    queryKey: queryKeys.deliveryCosts.analytics(tenantId, { dateFrom, dateTo }),
    queryFn: async (): Promise<DeliveryCost[]> => {
      if (!tenantId) return [];

      try {
        let query = supabase
          .from('delivery_costs')
          .select('id, tenant_id, order_id, courier_id, runner_pay, fuel_estimate, time_cost, other_costs, total_cost, delivery_fee_collected, tip_amount, total_revenue, profit, distance_miles, delivery_time_minutes, delivery_zone, delivery_borough, notes, created_at, updated_at')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false });

        if (dateFrom) {
          query = query.gte('created_at', dateFrom);
        }
        if (dateTo) {
          query = query.lte('created_at', dateTo);
        }

        const { data, error } = await query;

        if (error) {
          if (isPostgrestError(error) && error.code === '42P01') return [];
          throw error;
        }

        return (data ?? []) as unknown as DeliveryCost[];
      } catch (err) {
        if (isPostgrestError(err) && err.code === '42P01') return [];
        logger.error('Error fetching delivery cost analytics', err as Error);
        throw err;
      }
    },
    enabled: !!tenantId,
    staleTime: 60_000,
  });
}

/**
 * Save or update delivery cost for an order
 */
export function useSaveDeliveryCost() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: DeliveryCostInput) => {
      if (!tenantId) throw new Error('No tenant context');

      const payload = {
        tenant_id: tenantId,
        order_id: input.order_id,
        courier_id: input.courier_id || null,
        runner_pay: input.runner_pay,
        fuel_estimate: input.fuel_estimate,
        time_cost: input.time_cost,
        other_costs: input.other_costs || 0,
        delivery_fee_collected: input.delivery_fee_collected,
        tip_amount: input.tip_amount || 0,
        distance_miles: input.distance_miles || null,
        delivery_time_minutes: input.delivery_time_minutes || null,
        delivery_zone: input.delivery_zone || null,
        delivery_borough: input.delivery_borough || null,
        notes: input.notes || null,
      };

      const { data, error } = await supabase
        .from('delivery_costs')
        .upsert(payload, {
          onConflict: 'tenant_id,order_id',
        })
        .select()
        .maybeSingle();

      if (error) throw error;
      return data as unknown as DeliveryCost;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.deliveryCosts.byOrder(tenantId ?? '', variables.order_id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.deliveryCosts.analytics(tenantId),
      });
    },
    onError: (error) => {
      logger.error('Error saving delivery cost', error as Error);
    },
  });
}
