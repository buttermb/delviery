/**
 * Real-time analytics ticker hook
 * Fetches lightweight metrics every 10 seconds and subscribes to
 * realtime table changes for instant updates.
 */

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useTenantContext } from '@/hooks/useTenantContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';

export interface TickerMetrics {
  ordersLastHour: number;
  revenueToday: number;
  activeDeliveries: number;
  menuViewsNow: number;
}

const TICKER_QUERY_KEY = 'realtime-ticker';

function tickerKey(tenantId?: string | null) {
  return [...queryKeys.dashboard.all, TICKER_QUERY_KEY, tenantId] as const;
}

async function fetchTickerMetrics(tenantId: string): Promise<TickerMetrics> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const [ordersResult, revenueResult, deliveriesResult, menuViewsResult] =
    await Promise.allSettled([
      // Orders in last hour
      supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .gte('created_at', oneHourAgo)
        .not('status', 'in', '("cancelled","rejected","refunded")'),

      // Revenue today (completed/delivered)
      supabase
        .from('orders')
        .select('total_amount')
        .eq('tenant_id', tenantId)
        .gte('created_at', todayStart.toISOString())
        .in('status', ['completed', 'delivered']),

      // Active deliveries
      supabase
        .from('wholesale_deliveries')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .in('status', ['assigned', 'picked_up', 'in_transit']),

      // Menu views right now (active menus viewed in last 15 min)
      supabase
        .from('disposable_menus')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .gte('last_viewed_at', fifteenMinAgo),
    ]);

  let ordersLastHour = 0;
  if (ordersResult.status === 'fulfilled') {
    const { count, error } = ordersResult.value;
    if (!error) {
      ordersLastHour = count ?? 0;
    } else {
      logger.warn('Ticker: failed to fetch orders last hour', error, {
        component: 'useRealtimeTicker',
      });
    }
  }

  let revenueToday = 0;
  if (revenueResult.status === 'fulfilled') {
    const { data, error } = revenueResult.value;
    if (!error && data) {
      revenueToday = data.reduce(
        (sum, row) => sum + (Number(row.total_amount) || 0),
        0
      );
    } else if (error) {
      logger.warn('Ticker: failed to fetch revenue today', error, {
        component: 'useRealtimeTicker',
      });
    }
  }

  let activeDeliveries = 0;
  if (deliveriesResult.status === 'fulfilled') {
    const { count, error } = deliveriesResult.value;
    if (!error) {
      activeDeliveries = count ?? 0;
    } else {
      logger.warn('Ticker: failed to fetch active deliveries', error, {
        component: 'useRealtimeTicker',
      });
    }
  }

  let menuViewsNow = 0;
  if (menuViewsResult.status === 'fulfilled') {
    const { count, error } = menuViewsResult.value;
    if (!error) {
      menuViewsNow = count ?? 0;
    } else {
      // last_viewed_at column may not exist — fail gracefully
      logger.debug('Ticker: menu views query returned error (column may not exist)', {
        component: 'useRealtimeTicker',
      });
    }
  }

  return { ordersLastHour, revenueToday, activeDeliveries, menuViewsNow };
}

export function useRealtimeTicker() {
  const { tenantId } = useTenantContext();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: tickerKey(tenantId),
    queryFn: () => {
      if (!tenantId) {
        return { ordersLastHour: 0, revenueToday: 0, activeDeliveries: 0, menuViewsNow: 0 };
      }
      return fetchTickerMetrics(tenantId);
    },
    enabled: !!tenantId,
    refetchInterval: 10_000,
    staleTime: 10_000,
  });

  // Subscribe to realtime changes for instant invalidation
  useEffect(() => {
    if (!tenantId) return;

    const channels: RealtimeChannel[] = [];

    const ordersChannel = supabase
      .channel(`ticker-orders-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          logger.debug('Ticker: new order detected, invalidating', {
            component: 'useRealtimeTicker',
          });
          queryClient.invalidateQueries({ queryKey: tickerKey(tenantId) });
        }
      )
      .subscribe();

    channels.push(ordersChannel);

    const deliveriesChannel = supabase
      .channel(`ticker-deliveries-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'wholesale_deliveries',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          logger.debug('Ticker: delivery change detected, invalidating', {
            component: 'useRealtimeTicker',
          });
          queryClient.invalidateQueries({ queryKey: tickerKey(tenantId) });
        }
      )
      .subscribe();

    channels.push(deliveriesChannel);

    return () => {
      channels.forEach((ch) => {
        supabase.removeChannel(ch).catch(() => {
          // Silently ignore cleanup errors
        });
      });
    };
  }, [tenantId, queryClient]);

  return {
    metrics: query.data ?? {
      ordersLastHour: 0,
      revenueToday: 0,
      activeDeliveries: 0,
      menuViewsNow: 0,
    },
    isLoading: query.isLoading,
    error: query.error,
  };
}
