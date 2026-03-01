/**
 * Real-time admin orders hook
 * Subscribes to multiple order tables for instant admin panel updates:
 * - orders: Regular orders with order_source tracking
 * - unified_orders: POS transactions
 * - storefront_orders: Direct storefront orders (tenant-filtered)
 * - marketplace_orders: Marketplace store orders
 *
 * Features:
 * - Highlight animation for new orders (10 second duration)
 * - Browser notifications with Web API
 * - Notification sound + haptic vibration
 * - Cross-panel query invalidation
 * - Toast notifications with source labels
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { logger } from '@/lib/logger';
import { formatCurrency } from '@/lib/formatters';
import { playNotificationSound } from '@/utils/notificationSound';
import { invalidateOnEvent } from '@/lib/invalidation';
import { queryKeys } from '@/lib/queryKeys';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface NewOrderEvent {
  id: string;
  orderNumber: string;
  source: OrderSource;
  customerName: string;
  totalAmount: number;
  timestamp: string;
}

export type OrderSource = 'admin' | 'storefront' | 'pos' | 'menu' | 'api';

interface UseAdminOrdersRealtimeOptions {
  enabled?: boolean;
  onNewOrder?: (event: NewOrderEvent) => void;
}

export function useAdminOrdersRealtime({
  enabled = true,
  onNewOrder,
}: UseAdminOrdersRealtimeOptions = {}) {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const channelsRef = useRef<RealtimeChannel[]>([]);
  const storeIdsRef = useRef<string[]>([]);
  const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set());
  const notificationPermissionRef = useRef<NotificationPermission>('default');

  // Request notification permission
  useEffect(() => {
    if (!enabled) return;
    if ('Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().then((permission) => {
          notificationPermissionRef.current = permission;
        }).catch((err) => {
          logger.warn('Failed to request notification permission', { error: err });
        });
      } else {
        notificationPermissionRef.current = Notification.permission;
      }
    }
  }, [enabled]);

  // Clear highlight after timeout
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

  const showBrowserNotification = useCallback((event: NewOrderEvent) => {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const sourceLabel = event.source === 'storefront' ? 'Storefront' : event.source.toUpperCase();
    const notification = new Notification(`New ${sourceLabel} Order`, {
      body: `#${event.orderNumber} - ${event.customerName} - ${formatCurrency(event.totalAmount)}`,
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

  const handleNewOrder = useCallback((event: NewOrderEvent) => {
    // Add highlight animation
    addHighlightedOrder(event.id);

    // Play notification sound
    playNotificationSound(true);

    // Show browser notification
    showBrowserNotification(event);

    // Invalidate queries to refetch orders
    queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });

    // Cross-panel invalidation: new order affects orders, dashboard, inventory, activity feed
    if (tenant?.id) {
      invalidateOnEvent(queryClient, 'ORDER_CREATED', tenant.id);
      // Dashboard and activity feed should update
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.activityFeed.all });

      // If storefront order, fire additional storefront event
      if (event.source === 'storefront') {
        invalidateOnEvent(queryClient, 'STOREFRONT_ORDER', tenant.id);
      }

      // If POS order, fire POS event
      if (event.source === 'pos') {
        invalidateOnEvent(queryClient, 'POS_SALE_COMPLETED', tenant.id);
      }
    }

    // Call external handler
    onNewOrder?.(event);

    logger.info('New order received in admin', {
      orderId: event.id,
      source: event.source,
      component: 'useAdminOrdersRealtime',
    });
  }, [addHighlightedOrder, showBrowserNotification, queryClient, onNewOrder, tenant?.id]);

  useEffect(() => {
    if (!enabled || !tenant?.id) return;
    let cancelled = false;

    const setupSubscriptions = async () => {
      if (cancelled) return;
      // 1. Subscribe to regular orders table inserts
      const ordersChannel = supabase
        .channel(`admin-orders-realtime-${tenant.id}`)
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
              customerName: 'Customer',
              totalAmount: (newOrder.total_amount as number) ?? 0,
              timestamp: (newOrder.created_at as string) || new Date().toISOString(),
            });
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            logger.debug('Admin orders realtime subscription active', { component: 'useAdminOrdersRealtime' });
          }
        });

      if (!cancelled) channelsRef.current.push(ordersChannel);

      // 2. Subscribe to unified_orders for POS transactions
      const unifiedOrdersChannel = supabase
        .channel(`admin-unified-orders-realtime-${tenant.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'unified_orders',
            filter: `tenant_id=eq.${tenant.id}`,
          },
          (payload) => {
            const newOrder = payload.new as Record<string, unknown>;
            // Only handle POS orders - other order types are handled by their respective channels
            if (newOrder.order_type !== 'pos') return;

            handleNewOrder({
              id: newOrder.id as string,
              orderNumber: (newOrder.order_number as string) || (newOrder.id as string).slice(0, 8),
              source: 'pos',
              customerName: 'POS Sale',
              totalAmount: (newOrder.total_amount as number) ?? 0,
              timestamp: (newOrder.created_at as string) || new Date().toISOString(),
            });

            // Also invalidate unified orders queries
            queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            logger.debug('Unified orders realtime subscription active (POS)', { component: 'useAdminOrdersRealtime' });
          }
        });

      if (!cancelled) channelsRef.current.push(unifiedOrdersChannel);

      // 3. Subscribe to storefront_orders table for direct storefront orders
      const storefrontOrdersChannel = supabase
        .channel(`admin-storefront-orders-direct-${tenant.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'storefront_orders',
            filter: `tenant_id=eq.${tenant.id}`,
          },
          (payload) => {
            const order = payload.new as Record<string, unknown>;
            handleNewOrder({
              id: order.id as string,
              orderNumber: (order.order_number as string) || (order.id as string).slice(0, 8),
              source: 'storefront',
              customerName: (order.customer_name as string) || (order.customer_email as string) || 'Storefront Customer',
              totalAmount: (order.total as number) ?? (order.total_amount as number) ?? 0,
              timestamp: (order.created_at as string) || new Date().toISOString(),
            });

            // Invalidate storefront-specific queries
            queryClient.invalidateQueries({ queryKey: queryKeys.storefront.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            logger.debug('Storefront orders (direct) realtime subscription active', { component: 'useAdminOrdersRealtime' });
          }
        });

      if (!cancelled) channelsRef.current.push(storefrontOrdersChannel);

      // 4. Fetch stores for this tenant and subscribe to marketplace_orders
      const { data: stores } = await supabase
        .from('marketplace_stores')
        .select('id, store_name')
        .eq('tenant_id', tenant.id);

      if (!cancelled && stores && stores.length > 0) {
        storeIdsRef.current = stores.map((s) => s.id);
        const storeNameMap = Object.fromEntries(stores.map((s) => [s.id, s.store_name]));

        const storefrontChannel = supabase
          .channel(`admin-storefront-orders-${tenant.id}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'marketplace_orders',
              filter: `seller_tenant_id=eq.${tenant.id}`,
            },
            (payload) => {
              const order = payload.new as Record<string, unknown>;
              const storeId = order.store_id as string || order.seller_profile_id as string;

              // Only process orders for our stores (secondary client-side check)
              if (!storeIdsRef.current.includes(storeId)) return;

              const storeName = storeNameMap[storeId] || 'Storefront';
              handleNewOrder({
                id: order.id as string,
                orderNumber: (order.order_number as string) || (order.id as string).slice(0, 8),
                source: 'storefront',
                customerName: (order.customer_name as string) || storeName,
                totalAmount: (order.total_amount as number) ?? (order.total as number) ?? 0,
                timestamp: (order.created_at as string) || new Date().toISOString(),
              });

              // Also invalidate storefront-specific queries
              queryClient.invalidateQueries({ queryKey: queryKeys.storefront.all });
              queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              logger.debug('Storefront orders realtime subscription active', { component: 'useAdminOrdersRealtime' });
            }
          });

        if (!cancelled) channelsRef.current.push(storefrontChannel);
      }
    };

    setupSubscriptions();

    return () => {
      cancelled = true;
      channelsRef.current.forEach((channel) => {
        supabase.removeChannel(channel).catch((err) => {
          logger.warn('Error removing realtime channel', { error: err, component: 'useAdminOrdersRealtime' });
        });
      });
      channelsRef.current = [];
    };
  }, [enabled, tenant?.id, handleNewOrder, queryClient]);

  return {
    newOrderIds,
    isSubscribed: channelsRef.current.length > 0,
  };
}
