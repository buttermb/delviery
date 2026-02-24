/**
 * Hook to calculate and track delivery ETAs for orders in transit.
 *
 * Fetches active deliveries for a tenant, joins runner location data,
 * and computes estimated arrival times based on:
 * - Time already elapsed since pickup
 * - Historical average delivery duration for the tenant
 * - Number of remaining stops for the runner (if multi-stop route)
 *
 * Subscribes to real-time updates on wholesale_deliveries and wholesale_runners
 * tables so ETAs refresh automatically as runners move or delivery statuses change.
 */

import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';

/** ETA information for a single order */
export interface DeliveryETA {
  orderId: string;
  deliveryId: string;
  runnerId: string;
  runnerName: string;
  runnerPhone: string | null;
  deliveryStatus: string;
  pickedUpAt: string | null;
  assignedAt: string;
  /** Estimated minutes remaining until delivery */
  estimatedMinutesRemaining: number;
  /** Absolute ETA timestamp */
  estimatedArrival: Date;
  /** Whether the delivery is overdue (past expected time) */
  isOverdue: boolean;
  /** Number of remaining stops before this delivery (0 = next stop) */
  remainingStopsBefore: number;
}

/** Map of order ID -> DeliveryETA */
export type DeliveryETAMap = Record<string, DeliveryETA>;

/** Default average delivery duration in minutes when no historical data exists */
const DEFAULT_AVG_DELIVERY_MINUTES = 45;
/** Extra minutes per additional stop ahead in the route */
const MINUTES_PER_EXTRA_STOP = 12;

interface DeliveryRow {
  id: string;
  order_id: string;
  runner_id: string;
  status: string;
  assigned_at: string;
  picked_up_at: string | null;
  delivered_at: string | null;
  tenant_id: string;
  runner: {
    full_name: string;
    phone: string | null;
  } | null;
}

export function useDeliveryETA(orderIds: string[]) {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  // Only look up ETAs for orders that are potentially in delivery
  const hasOrderIds = orderIds.length > 0;

  // Fetch active deliveries for these orders
  const { data: deliveries = [], isLoading } = useQuery({
    queryKey: queryKeys.deliveryEtas.byTenantOrders(tenant?.id, orderIds),
    queryFn: async (): Promise<DeliveryRow[]> => {
      if (!tenant?.id || orderIds.length === 0) return [];

      const { data, error } = await supabase
        .from('wholesale_deliveries')
        .select(`
          id, order_id, runner_id, status, assigned_at, picked_up_at, delivered_at, tenant_id,
          runner:wholesale_runners(full_name, phone)
        `)
        .eq('tenant_id', tenant.id)
        .in('order_id', orderIds)
        .in('status', ['assigned', 'picked_up', 'in_transit']);

      if (error) {
        logger.error('Failed to fetch delivery ETAs', error, { component: 'useDeliveryETA' });
        throw error;
      }

      return (data ?? []) as unknown as DeliveryRow[];
    },
    enabled: !!tenant?.id && hasOrderIds,
    staleTime: 10_000,
    gcTime: 60_000,
    refetchInterval: 30_000, // Refresh every 30 seconds
  });

  // Fetch historical average delivery time for this tenant
  const { data: avgDeliveryMinutes = DEFAULT_AVG_DELIVERY_MINUTES } = useQuery({
    queryKey: queryKeys.deliveryEtas.avgTime(tenant?.id),
    queryFn: async () => {
      if (!tenant?.id) return DEFAULT_AVG_DELIVERY_MINUTES;

      // Look at completed deliveries from the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from('wholesale_deliveries')
        .select('picked_up_at, delivered_at')
        .eq('tenant_id', tenant.id)
        .eq('status', 'delivered')
        .not('picked_up_at', 'is', null)
        .not('delivered_at', 'is', null)
        .gte('delivered_at', thirtyDaysAgo.toISOString())
        .limit(100);

      if (error) {
        logger.warn('Failed to fetch historical delivery times', { error: error.message });
        return DEFAULT_AVG_DELIVERY_MINUTES;
      }

      if (!data || data.length === 0) return DEFAULT_AVG_DELIVERY_MINUTES;

      // Calculate average duration in minutes
      const durations = data
        .map((d) => {
          const pickup = new Date(d.picked_up_at!).getTime();
          const delivered = new Date(d.delivered_at!).getTime();
          return (delivered - pickup) / 60_000; // convert ms to minutes
        })
        .filter((mins) => mins > 0 && mins < 480); // Exclude outliers > 8 hours

      if (durations.length === 0) return DEFAULT_AVG_DELIVERY_MINUTES;

      const avg = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      return Math.round(avg);
    },
    enabled: !!tenant?.id,
    staleTime: 300_000, // Cache for 5 minutes
    gcTime: 600_000,
  });

  // Fetch runner stop counts (how many active deliveries each runner has ahead)
  const runnerIds = useMemo(
    () => [...new Set(deliveries.map((d) => d.runner_id).filter(Boolean))],
    [deliveries]
  );

  const { data: runnerStopCounts = {} } = useQuery({
    queryKey: queryKeys.deliveryEtas.runnerStopCounts(tenant?.id, runnerIds),
    queryFn: async (): Promise<Record<string, number>> => {
      if (!tenant?.id || runnerIds.length === 0) return {};

      const { data, error } = await supabase
        .from('wholesale_deliveries')
        .select('id, runner_id, assigned_at')
        .eq('tenant_id', tenant.id)
        .in('runner_id', runnerIds)
        .in('status', ['assigned', 'picked_up', 'in_transit'])
        .order('assigned_at', { ascending: true });

      if (error) {
        logger.warn('Failed to fetch runner stop counts', { error: error.message });
        return {};
      }

      // Count active deliveries per runner
      const counts: Record<string, number> = {};
      for (const d of data ?? []) {
        counts[d.runner_id] = (counts[d.runner_id] || 0) + 1;
      }
      return counts;
    },
    enabled: !!tenant?.id && runnerIds.length > 0,
    staleTime: 15_000,
    gcTime: 60_000,
  });

  // Real-time subscription for delivery and runner updates
  useEffect(() => {
    if (!tenant?.id || !hasOrderIds) return;

    const channel = supabase
      .channel(`delivery-eta-${tenant.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'wholesale_deliveries',
          filter: `tenant_id=eq.${tenant.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.deliveryEtas.byTenantOrders(tenant.id) });
          queryClient.invalidateQueries({ queryKey: queryKeys.deliveryEtas.runnerStopCounts(tenant.id) });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'wholesale_runners',
          filter: `tenant_id=eq.${tenant.id}`,
        },
        () => {
          // Runner location updated - refresh ETAs
          queryClient.invalidateQueries({ queryKey: queryKeys.deliveryEtas.byTenantOrders(tenant.id) });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenant?.id, hasOrderIds, queryClient]);

  // Calculate ETA map
  const etaMap: DeliveryETAMap = useMemo(() => {
    const map: DeliveryETAMap = {};
    const now = Date.now();

    for (const delivery of deliveries) {
      const pickedUpAt = delivery.picked_up_at
        ? new Date(delivery.picked_up_at).getTime()
        : null;
      const assignedAt = new Date(delivery.assigned_at).getTime();

      // Time elapsed since pickup (or assignment if not yet picked up)
      const startTime = pickedUpAt || assignedAt;
      const elapsedMinutes = (now - startTime) / 60_000;

      // Calculate stops ahead for this runner
      const totalRunnerStops = runnerStopCounts[delivery.runner_id] || 1;
      // Rough estimate: this order's position based on assignment order
      // Simplification: assume equal distribution, so stops before = (total - 1) / 2
      const stopsBefore = Math.max(0, Math.floor((totalRunnerStops - 1) / 2));

      // Estimated total delivery time = base avg + extra time per stop
      const estimatedTotalMinutes =
        avgDeliveryMinutes + stopsBefore * MINUTES_PER_EXTRA_STOP;

      // Remaining time = estimated total - elapsed
      const estimatedMinutesRemaining = Math.max(
        0,
        Math.round(estimatedTotalMinutes - elapsedMinutes)
      );

      const estimatedArrival = new Date(now + estimatedMinutesRemaining * 60_000);
      const isOverdue = estimatedMinutesRemaining === 0 && elapsedMinutes > estimatedTotalMinutes;

      map[delivery.order_id] = {
        orderId: delivery.order_id,
        deliveryId: delivery.id,
        runnerId: delivery.runner_id,
        runnerName: delivery.runner?.full_name || 'Unknown',
        runnerPhone: delivery.runner?.phone || null,
        deliveryStatus: delivery.status,
        pickedUpAt: delivery.picked_up_at,
        assignedAt: delivery.assigned_at,
        estimatedMinutesRemaining,
        estimatedArrival,
        isOverdue,
        remainingStopsBefore: stopsBefore,
      };
    }

    return map;
  }, [deliveries, avgDeliveryMinutes, runnerStopCounts]);

  return {
    etaMap,
    isLoading,
  };
}
