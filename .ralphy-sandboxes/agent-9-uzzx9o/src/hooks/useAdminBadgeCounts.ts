/**
 * Admin Badge Counts Hook
 * Provides real-time badge counts for admin navigation
 * Subscribes to Supabase realtime for orders, alerts, and messages
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface BadgeCounts {
  pendingOrders: number;
  lowStockItems: number;
  unreadMessages: number;
  pendingShipments: number;
  overduePayments: number;
  inventoryAlerts: number;
}

interface SubscriptionStatus {
  wholesaleOrders: boolean;
  menuOrders: boolean;
  inventoryAlerts: boolean;
  conversations: boolean;
  deliveries: boolean;
  products: boolean;
}

export function useAdminBadgeCounts() {
  const { tenant } = useTenantAdminAuth();
  const [counts, setCounts] = useState<BadgeCounts>({
    pendingOrders: 0,
    lowStockItems: 0,
    unreadMessages: 0,
    pendingShipments: 0,
    overduePayments: 0,
    inventoryAlerts: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>({
    wholesaleOrders: false,
    menuOrders: false,
    inventoryAlerts: false,
    conversations: false,
    deliveries: false,
    products: false,
  });

  const channelsRef = useRef<RealtimeChannel[]>([]);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced fetch to prevent rapid-fire requests on multiple realtime events
  const debouncedFetch = useCallback((fetchFn: () => Promise<void>) => {
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }
    fetchTimeoutRef.current = setTimeout(() => {
      fetchFn();
    }, 100);
  }, []);

  const fetchCounts = useCallback(async () => {
    if (!tenant?.id) return;

    try {
      const [
        ordersResult,
        menuOrdersResult,
        stockResult,
        messagesResult,
        shipmentsResult,
        alertsResult,
      ] = await Promise.all([
        // Pending wholesale orders (count only, no data transfer)
        supabase
          .from('wholesale_orders')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id)
          .or('status.eq.pending,status.eq.assigned'),

        // Pending menu orders (count only)
        supabase
          .from('menu_orders')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id)
          .in('status', ['pending', 'confirmed', 'processing', 'preparing']),

        // Low stock items (count only)
        supabase
          .from('products')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id)
          .lt('stock_quantity', 10),

        // Unread messages (count only)
        supabase
          .from('conversations')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id)
          .eq('status', 'open'),

        // Pending shipments (count only)
        supabase
          .from('wholesale_deliveries')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id)
          .or('status.eq.assigned,status.eq.picked_up'),

        // Active inventory alerts (not resolved, not dismissed, not snoozed)
        supabase
          .from('inventory_alerts')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id)
          .is('is_resolved', false)
          .is('dismissed_at', null)
          .or('snoozed_until.is.null,snoozed_until.lt.now()'),
      ]);

      const wholesaleCount = ordersResult.count ?? 0;
      const menuCount = menuOrdersResult.count ?? 0;
      const alertsCount = alertsResult.count ?? 0;

      setCounts({
        pendingOrders: wholesaleCount + menuCount,
        lowStockItems: stockResult.count ?? 0,
        unreadMessages: messagesResult.count ?? 0,
        pendingShipments: shipmentsResult.count ?? 0,
        overduePayments: 0,
        inventoryAlerts: alertsCount,
      });

      logger.debug('Badge counts fetched', {
        pendingOrders: wholesaleCount + menuCount,
        lowStockItems: stockResult.count,
        inventoryAlerts: alertsCount,
        component: 'useAdminBadgeCounts',
      });
    } catch (error) {
      logger.error('Error fetching badge counts', error);
    } finally {
      setIsLoading(false);
    }
  }, [tenant?.id]);

  useEffect(() => {
    if (!tenant?.id) {
      setIsLoading(false);
      return;
    }

    // Initial fetch
    fetchCounts();

    // Helper to update subscription status
    const updateStatus = (key: keyof SubscriptionStatus, value: boolean) => {
      setSubscriptionStatus(prev => ({ ...prev, [key]: value }));
    };

    // Channel 1: Wholesale Orders
    const wholesaleOrdersChannel = supabase
      .channel(`badge-wholesale-orders-${tenant.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'wholesale_orders',
          filter: `tenant_id=eq.${tenant.id}`,
        },
        (payload) => {
          logger.debug('Wholesale order change detected', {
            event: payload.eventType,
            component: 'useAdminBadgeCounts'
          });
          debouncedFetch(fetchCounts);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          updateStatus('wholesaleOrders', true);
          logger.debug('Subscribed to wholesale orders', { component: 'useAdminBadgeCounts' });
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          updateStatus('wholesaleOrders', false);
          logger.warn('Wholesale orders subscription error', { status, component: 'useAdminBadgeCounts' });
        }
      });
    channelsRef.current.push(wholesaleOrdersChannel);

    // Channel 2: Menu Orders
    const menuOrdersChannel = supabase
      .channel(`badge-menu-orders-${tenant.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'menu_orders',
          filter: `tenant_id=eq.${tenant.id}`,
        },
        (payload) => {
          logger.debug('Menu order change detected', {
            event: payload.eventType,
            component: 'useAdminBadgeCounts'
          });
          debouncedFetch(fetchCounts);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          updateStatus('menuOrders', true);
          logger.debug('Subscribed to menu orders', { component: 'useAdminBadgeCounts' });
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          updateStatus('menuOrders', false);
          logger.warn('Menu orders subscription error', { status, component: 'useAdminBadgeCounts' });
        }
      });
    channelsRef.current.push(menuOrdersChannel);

    // Channel 3: Inventory Alerts
    const inventoryAlertsChannel = supabase
      .channel(`badge-inventory-alerts-${tenant.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inventory_alerts',
          filter: `tenant_id=eq.${tenant.id}`,
        },
        (payload) => {
          logger.debug('Inventory alert change detected', {
            event: payload.eventType,
            component: 'useAdminBadgeCounts'
          });
          debouncedFetch(fetchCounts);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          updateStatus('inventoryAlerts', true);
          logger.debug('Subscribed to inventory alerts', { component: 'useAdminBadgeCounts' });
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          updateStatus('inventoryAlerts', false);
          logger.warn('Inventory alerts subscription error', { status, component: 'useAdminBadgeCounts' });
        }
      });
    channelsRef.current.push(inventoryAlertsChannel);

    // Channel 4: Conversations (Unread Messages)
    const conversationsChannel = supabase
      .channel(`badge-conversations-${tenant.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `tenant_id=eq.${tenant.id}`,
        },
        (payload) => {
          logger.debug('Conversation change detected', {
            event: payload.eventType,
            component: 'useAdminBadgeCounts'
          });
          debouncedFetch(fetchCounts);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          updateStatus('conversations', true);
          logger.debug('Subscribed to conversations', { component: 'useAdminBadgeCounts' });
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          updateStatus('conversations', false);
          logger.warn('Conversations subscription error', { status, component: 'useAdminBadgeCounts' });
        }
      });
    channelsRef.current.push(conversationsChannel);

    // Channel 5: Wholesale Deliveries (Pending Shipments)
    const deliveriesChannel = supabase
      .channel(`badge-deliveries-${tenant.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'wholesale_deliveries',
          filter: `tenant_id=eq.${tenant.id}`,
        },
        (payload) => {
          logger.debug('Delivery change detected', {
            event: payload.eventType,
            component: 'useAdminBadgeCounts'
          });
          debouncedFetch(fetchCounts);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          updateStatus('deliveries', true);
          logger.debug('Subscribed to deliveries', { component: 'useAdminBadgeCounts' });
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          updateStatus('deliveries', false);
          logger.warn('Deliveries subscription error', { status, component: 'useAdminBadgeCounts' });
        }
      });
    channelsRef.current.push(deliveriesChannel);

    // Channel 6: Products (Low Stock)
    const productsChannel = supabase
      .channel(`badge-products-${tenant.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'products',
          filter: `tenant_id=eq.${tenant.id}`,
        },
        (payload) => {
          // Only refetch if stock_quantity changed
          const newRecord = payload.new as Record<string, unknown>;
          const oldRecord = payload.old as Record<string, unknown>;
          if (newRecord.stock_quantity !== oldRecord.stock_quantity) {
            logger.debug('Product stock change detected', {
              productId: newRecord.id,
              component: 'useAdminBadgeCounts'
            });
            debouncedFetch(fetchCounts);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          updateStatus('products', true);
          logger.debug('Subscribed to products', { component: 'useAdminBadgeCounts' });
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          updateStatus('products', false);
          logger.warn('Products subscription error', { status, component: 'useAdminBadgeCounts' });
        }
      });
    channelsRef.current.push(productsChannel);

    // Fallback polling every 60 seconds (increased from 30s since we have realtime)
    const interval = setInterval(fetchCounts, 60000);

    return () => {
      // Clear debounce timeout
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }

      // Cleanup all channels
      channelsRef.current.forEach((channel) => {
        supabase.removeChannel(channel).catch((err) => {
          logger.warn('Error removing realtime channel', { error: err, component: 'useAdminBadgeCounts' });
        });
      });
      channelsRef.current = [];

      clearInterval(interval);

      logger.debug('Badge counts subscriptions cleaned up', { component: 'useAdminBadgeCounts' });
    };
  }, [tenant?.id, fetchCounts, debouncedFetch]);

  const getBadgeLevel = useCallback((type: keyof BadgeCounts): 'critical' | 'warning' | 'success' | 'info' => {
    const count = counts[type];

    switch (type) {
      case 'pendingOrders':
        if (count >= 10) return 'critical';
        if (count >= 5) return 'warning';
        return 'info';
      case 'lowStockItems':
        if (count >= 5) return 'critical';
        if (count >= 2) return 'warning';
        return 'info';
      case 'inventoryAlerts':
        if (count >= 5) return 'critical';
        if (count >= 2) return 'warning';
        return 'info';
      case 'unreadMessages':
        if (count >= 5) return 'critical';
        return 'warning';
      case 'pendingShipments':
        if (count >= 10) return 'warning';
        return 'info';
      case 'overduePayments':
        if (count > 0) return 'critical';
        return 'info';
      default:
        return 'info';
    }
  }, [counts]);

  const isSubscribed = Object.values(subscriptionStatus).some(Boolean);

  return {
    counts,
    isLoading,
    getBadgeLevel,
    refresh: fetchCounts,
    hasCritical: counts.pendingOrders >= 10 || counts.lowStockItems >= 5 || counts.unreadMessages >= 5 || counts.inventoryAlerts >= 5,
    hasWarning: counts.pendingOrders >= 5 || counts.lowStockItems >= 2 || counts.inventoryAlerts >= 2,
    totalPending: counts.pendingOrders + counts.lowStockItems + counts.unreadMessages + counts.inventoryAlerts,
    subscriptionStatus,
    isSubscribed,
  };
}
