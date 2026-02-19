/**
 * Real-time orders hook for Orders pages
 * Subscribes to regular orders table inserts to show new orders instantly
 * with visual highlights, sounds, and notifications.
 *
 * Simplified version that only targets the Orders pages, not unified views.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { logger } from '@/lib/logger';
import { playNotificationSound } from '@/utils/notificationSound';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * New order event data structure
 */
interface NewOrderEvent {
  id: string;
  orderNumber: string;
  source: OrderSource;
  customerName: string;
  totalAmount: number;
  timestamp: string;
}

/**
 * Order source type
 */
export type OrderSource = 'admin' | 'storefront' | 'pos' | 'menu' | 'api';

/**
 * Hook options
 */
interface UseOrdersRealtimeOptions {
  /** Enable/disable the subscription */
  enabled?: boolean;
  /** Callback when a new order is received */
  onNewOrder?: (event: NewOrderEvent) => void;
}

/**
 * Hook return value
 */
interface UseOrdersRealtimeReturn {
  /** Set of order IDs that are newly created (for highlighting) */
  newOrderIds: Set<string>;
  /** Whether the subscription is active */
  isSubscribed: boolean;
}

/**
 * Real-time subscription hook for Orders pages
 *
 * Features:
 * - Subscribes to orders table INSERT events
 * - Highlights new orders for 10 seconds
 * - Plays notification sound
 * - Shows browser notification
 * - Invalidates React Query cache
 *
 * @example
 * ```tsx
 * const { newOrderIds, isSubscribed } = useOrdersRealtime({
 *   enabled: true,
 *   onNewOrder: (event) => {
 *     logger.debug('New order:', event);
 *   }
 * });
 *
 * // In your table row
 * <tr className={newOrderIds.has(order.id) ? 'bg-primary/5' : ''}>
 * ```
 */
export function useOrdersRealtime({
  enabled = true,
  onNewOrder,
}: UseOrdersRealtimeOptions = {}): UseOrdersRealtimeReturn {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set());
  const notificationPermissionRef = useRef<NotificationPermission>('default');

  // Request notification permission on mount
  useEffect(() => {
    if (!enabled) return;
    if ('Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().then((permission) => {
          notificationPermissionRef.current = permission;
        });
      } else {
        notificationPermissionRef.current = Notification.permission;
      }
    }
  }, [enabled]);

  /**
   * Add order to highlighted set and auto-remove after 10 seconds
   */
  const addHighlightedOrder = useCallback((orderId: string) => {
    setNewOrderIds((prev) => new Set(prev).add(orderId));

    // Remove highlight after 10 seconds
    setTimeout(() => {
      setNewOrderIds((prev) => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    }, 10000);
  }, []);

  /**
   * Show browser notification for new order
   */
  const showBrowserNotification = useCallback((event: NewOrderEvent) => {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const sourceLabel = event.source === 'storefront'
      ? 'Storefront'
      : event.source.toUpperCase();

    const notification = new Notification(`New ${sourceLabel} Order`, {
      body: `#${event.orderNumber} - ${event.customerName} - $${event.totalAmount.toFixed(2)}`,
      icon: '/logo.svg',
      badge: '/logo.svg',
      tag: `new-order-${event.id}`,
      requireInteraction: true,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  }, []);

  /**
   * Handle new order event
   */
  const handleNewOrder = useCallback((event: NewOrderEvent) => {
    // Add highlight animation
    addHighlightedOrder(event.id);

    // Play notification sound
    playNotificationSound(true);

    // Show browser notification
    showBrowserNotification(event);

    // Invalidate queries to refetch orders
    queryClient.invalidateQueries({ queryKey: ['orders'] });

    // Call external handler
    onNewOrder?.(event);

    logger.info('New order received', {
      orderId: event.id,
      orderNumber: event.orderNumber,
      source: event.source,
      component: 'useOrdersRealtime',
    });
  }, [addHighlightedOrder, showBrowserNotification, queryClient, onNewOrder]);

  /**
   * Setup real-time subscription
   */
  useEffect(() => {
    if (!enabled || !tenant?.id) return;

    const setupSubscription = () => {
      // Subscribe to orders table inserts only
      const channel = supabase
        .channel(`orders-realtime-${tenant.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'orders',
            filter: `tenant_id=eq.${tenant.id}`,
          },
          (payload) => {
            const newOrder = payload.new as Record<string, unknown>;

            handleNewOrder({
              id: newOrder.id as string,
              orderNumber: (newOrder.order_number as string) || (newOrder.id as string).slice(0, 8),
              source: (newOrder.order_source as OrderSource) || 'admin',
              customerName: 'Customer', // Will be enriched when the query refetches
              totalAmount: (newOrder.total_amount as number) || 0,
              timestamp: (newOrder.created_at as string) || new Date().toISOString(),
            });
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            logger.debug('Orders realtime subscription active', {
              component: 'useOrdersRealtime',
              tenantId: tenant.id,
            });
          }
        });

      channelRef.current = channel;
    };

    setupSubscription();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current).catch(() => {
          // Silently ignore cleanup errors
        });
        channelRef.current = null;
      }
    };
  }, [enabled, tenant?.id, handleNewOrder]);

  return {
    newOrderIds,
    isSubscribed: channelRef.current !== null,
  };
}
