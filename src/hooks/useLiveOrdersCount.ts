/**
 * Live Orders Count Hook
 * Provides real-time count of active (non-completed) orders with new order detection.
 * Integrates with useAdminOrdersRealtime for instant updates.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import type { RealtimeChannel } from '@supabase/supabase-js';

// Active order statuses (orders that haven't been completed/delivered)
const ACTIVE_STATUSES = [
  'pending',
  'confirmed',
  'processing',
  'preparing',
  'ready_for_pickup',
  'in_transit',
] as const;

interface UseLiveOrdersCountOptions {
  /** Enable/disable the hook */
  enabled?: boolean;
  /** Duration to show pulse animation after new order (ms) */
  pulseDuration?: number;
}

interface LiveOrdersCountResult {
  /** Current count of active orders */
  count: number;
  /** Whether data is currently loading */
  isLoading: boolean;
  /** Whether there was an error fetching data */
  isError: boolean;
  /** Whether a new order was recently received (triggers pulse) */
  hasNewOrder: boolean;
  /** Whether realtime subscription is active */
  isSubscribed: boolean;
  /** Manually refetch counts */
  refetch: () => void;
}

export function useLiveOrdersCount({
  enabled = true,
  pulseDuration = 3000,
}: UseLiveOrdersCountOptions = {}): LiveOrdersCountResult {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [hasNewOrder, setHasNewOrder] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const channelsRef = useRef<RealtimeChannel[]>([]);
  const pulseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previousCountRef = useRef<number | null>(null);

  // Fetch active orders count
  const {
    data: count = 0,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: queryKeys.orders.live(tenant?.id),
    queryFn: async () => {
      if (!tenant?.id) return 0;

      // Count from multiple order tables
      const [ordersResult, menuOrdersResult, wholesaleOrdersResult] = await Promise.all([
        // Regular orders
        supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id)
          .in('status', ACTIVE_STATUSES),
        // Menu orders
        supabase
          .from('menu_orders')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id)
          .in('status', ACTIVE_STATUSES),
        // Wholesale orders
        supabase
          .from('wholesale_orders')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id)
          .in('status', ACTIVE_STATUSES),
      ]);

      const totalCount =
        (ordersResult.count || 0) +
        (menuOrdersResult.count || 0) +
        (wholesaleOrdersResult.count || 0);

      return totalCount;
    },
    enabled: enabled && !!tenant?.id,
    staleTime: 10000, // Consider data stale after 10s
    refetchInterval: 60000, // Fallback polling every 60s
  });

  // Trigger pulse animation
  const triggerPulse = useCallback(() => {
    // Clear any existing timeout
    if (pulseTimeoutRef.current) {
      clearTimeout(pulseTimeoutRef.current);
    }

    setHasNewOrder(true);

    // Remove pulse after duration
    pulseTimeoutRef.current = setTimeout(() => {
      setHasNewOrder(false);
    }, pulseDuration);
  }, [pulseDuration]);

  // Detect count increases and trigger pulse
  useEffect(() => {
    if (previousCountRef.current !== null && count > previousCountRef.current) {
      triggerPulse();
      logger.debug('Live orders count increased, triggering pulse', {
        previousCount: previousCountRef.current,
        newCount: count,
        component: 'useLiveOrdersCount',
      });
    }
    previousCountRef.current = count;
  }, [count, triggerPulse]);

  // Setup realtime subscriptions
  useEffect(() => {
    if (!enabled || !tenant?.id) return;

    const setupSubscriptions = () => {
      // Subscribe to orders table changes
      const ordersChannel = supabase
        .channel(`live-orders-count-orders-${tenant.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders',
            filter: `tenant_id=eq.${tenant.id}`,
          },
          (payload) => {
            // If it's an INSERT, trigger pulse immediately
            if (payload.eventType === 'INSERT') {
              triggerPulse();
            }
            // Refetch counts on any change
            queryClient.invalidateQueries({
              queryKey: queryKeys.orders.live(tenant.id),
            });
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setIsSubscribed(true);
            logger.debug('Live orders count subscribed to orders', {
              component: 'useLiveOrdersCount',
            });
          }
        });

      channelsRef.current.push(ordersChannel);

      // Subscribe to menu_orders table
      const menuOrdersChannel = supabase
        .channel(`live-orders-count-menu-${tenant.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'menu_orders',
            filter: `tenant_id=eq.${tenant.id}`,
          },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              triggerPulse();
            }
            queryClient.invalidateQueries({
              queryKey: queryKeys.orders.live(tenant.id),
            });
          }
        )
        .subscribe();

      channelsRef.current.push(menuOrdersChannel);

      // Subscribe to wholesale_orders table
      const wholesaleOrdersChannel = supabase
        .channel(`live-orders-count-wholesale-${tenant.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'wholesale_orders',
            filter: `tenant_id=eq.${tenant.id}`,
          },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              triggerPulse();
            }
            queryClient.invalidateQueries({
              queryKey: queryKeys.orders.live(tenant.id),
            });
          }
        )
        .subscribe();

      channelsRef.current.push(wholesaleOrdersChannel);
    };

    setupSubscriptions();

    return () => {
      // Cleanup subscriptions
      channelsRef.current.forEach((channel) => {
        supabase.removeChannel(channel).catch((err) => {
          logger.warn('Error removing realtime channel', { error: err, component: 'useLiveOrdersCount' });
        });
      });
      channelsRef.current = [];
      setIsSubscribed(false);

      // Clear pulse timeout
      if (pulseTimeoutRef.current) {
        clearTimeout(pulseTimeoutRef.current);
      }
    };
  }, [enabled, tenant?.id, queryClient, triggerPulse]);

  return {
    count,
    isLoading,
    isError,
    hasNewOrder,
    isSubscribed,
    refetch,
  };
}
