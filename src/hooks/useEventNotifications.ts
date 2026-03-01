/**
 * useEventNotifications Hook
 *
 * Connects real-time database events to the notification system.
 * Monitors orders (new orders, status changes) and stock levels (low stock alerts).
 * Respects user notification preferences from the notification_preferences table.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { toast } from 'sonner';
import { playNotificationSound } from '@/utils/notificationSound';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import { formatCurrency } from '@/lib/formatters';

export interface EventNotificationOptions {
  enabled?: boolean;
  playSound?: boolean;
  showBrowserNotification?: boolean;
  onNewOrder?: (order: OrderEventPayload) => void;
  onStockAlert?: (product: StockAlertPayload) => void;
}

export interface OrderEventPayload {
  id: string;
  order_number?: string;
  total_amount?: number;
  status: string;
  source?: string;
  customer_name?: string;
  created_at: string;
}

export interface StockAlertPayload {
  id: string;
  name: string;
  stock_quantity: number;
  available_quantity?: number;
  low_stock_alert?: number;
  alertLevel: 'out_of_stock' | 'critical' | 'warning';
}

interface NotificationPreferences {
  email_enabled: boolean;
  sms_enabled: boolean;
  push_enabled: boolean;
  email_all_updates: boolean;
  sms_all_updates: boolean;
  push_all_updates: boolean;
}

const DEFAULT_LOW_STOCK_THRESHOLD = 10;

function getStockAlertLevel(
  available: number,
  threshold: number
): StockAlertPayload['alertLevel'] {
  if (available <= 0) return 'out_of_stock';
  if (available <= threshold * 0.25) return 'critical';
  return 'warning';
}

export function useEventNotifications({
  enabled = true,
  playSound = true,
  showBrowserNotification = true,
  onNewOrder,
  onStockAlert,
}: EventNotificationOptions = {}) {
  const { tenant, admin } = useTenantAdminAuth();
  const channelsRef = useRef<RealtimeChannel[]>([]);
  const previousStockRef = useRef<Map<string, number>>(new Map());

  // Fetch user notification preferences
  const { data: preferences } = useQuery<NotificationPreferences | null>({
    queryKey: queryKeys.notificationPreferences.byUser(admin?.id),
    queryFn: async () => {
      if (!admin?.id) return null;

      const { data, error } = await supabase
        .from('notification_preferences')
        .select('email_enabled, sms_enabled, push_enabled, email_all_updates, sms_all_updates, push_all_updates')
        .eq('user_id', admin.id)
        .maybeSingle();

      if (error) {
        logger.warn('Failed to fetch notification preferences', { error });
        return null;
      }

      return data as NotificationPreferences | null;
    },
    enabled: !!admin?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Check if notifications are enabled for a specific type
  const isNotificationEnabled = useCallback(
    (type: 'orders' | 'inventory'): boolean => {
      if (!preferences) return true; // Default to enabled if no preferences set

      // If push notifications are disabled globally, don't show in-app notifications
      if (!preferences.push_enabled) return false;

      // For orders, check if all_updates is enabled
      if (type === 'orders') {
        return preferences.push_all_updates;
      }

      // For inventory, always show if push is enabled (critical for operations)
      return true;
    },
    [preferences]
  );

  // Request browser notification permission
  useEffect(() => {
    if (enabled && showBrowserNotification && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().catch((err) => {
          logger.warn('Failed to request notification permission', { error: err });
        });
      }
    }
  }, [enabled, showBrowserNotification]);

  // Show browser notification
  const showBrowserNotificationFn = useCallback(
    (title: string, body: string, tag?: string) => {
      if (!showBrowserNotification) return;
      if (!('Notification' in window)) return;
      if (Notification.permission !== 'granted') return;

      try {
        const notification = new Notification(title, {
          body,
          icon: '/logo.svg',
          badge: '/logo.svg',
          tag: tag || `event-${Date.now()}`,
          requireInteraction: true,
        });

        notification.onclick = () => {
          window.focus();
          notification.close();
        };
      } catch (err) {
        logger.warn('Failed to show browser notification', { error: err });
      }
    },
    [showBrowserNotification]
  );

  // Handle new order event
  const handleNewOrder = useCallback(
    (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      if (!isNotificationEnabled('orders')) return;

      const newOrder = payload.new as Record<string, unknown>;
      const orderPayload: OrderEventPayload = {
        id: String(newOrder.id || ''),
        order_number: newOrder.order_number as string | undefined,
        total_amount: newOrder.total_amount as number | undefined,
        status: String(newOrder.status || 'pending'),
        source: newOrder.source as string | undefined,
        customer_name: newOrder.customer_name as string | undefined,
        created_at: String(newOrder.created_at || new Date().toISOString()),
      };

      // Play notification sound
      if (playSound) {
        playNotificationSound(true);
      }

      // Vibrate if supported
      if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200]);
      }

      // Show toast notification
      const orderNum = orderPayload.order_number || orderPayload.id.slice(0, 8);
      const amount = orderPayload.total_amount
        ? formatCurrency(orderPayload.total_amount)
        : '';
      const source = orderPayload.source
        ? ` from ${orderPayload.source.charAt(0).toUpperCase() + orderPayload.source.slice(1)}`
        : '';

      toast.success(`Order #${orderNum}${source} ${amount}`.trim(), {
        duration: 8000,
      });

      // Show browser notification
      showBrowserNotificationFn(
        '🛒 New Order Received!',
        `Order #${orderNum}${source} ${amount}`.trim(),
        `order-${orderPayload.id}`
      );

      // Call callback
      onNewOrder?.(orderPayload);

      logger.info('New order notification triggered', {
        orderId: orderPayload.id,
        orderNumber: orderPayload.order_number,
        source: orderPayload.source,
        component: 'useEventNotifications',
      });
    },
    [isNotificationEnabled, playSound, showBrowserNotificationFn, onNewOrder]
  );

  // Handle stock update event
  const handleStockUpdate = useCallback(
    (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      if (!isNotificationEnabled('inventory')) return;

      const product = payload.new as Record<string, unknown>;
      const productId = String(product.id || '');
      const productName = String(product.name || 'Unknown Product');
      const stockQty = Number(product.stock_quantity || 0);
      const availableQty = Number(product.available_quantity ?? stockQty);
      const threshold = Number(product.low_stock_alert || DEFAULT_LOW_STOCK_THRESHOLD);

      // Get previous stock level
      const previousStock = previousStockRef.current.get(productId);
      previousStockRef.current.set(productId, availableQty);

      // Only alert if stock dropped below threshold (not if it was already below)
      if (previousStock !== undefined && previousStock > threshold && availableQty <= threshold) {
        const alertLevel = getStockAlertLevel(availableQty, threshold);
        const alertPayload: StockAlertPayload = {
          id: productId,
          name: productName,
          stock_quantity: stockQty,
          available_quantity: availableQty,
          low_stock_alert: threshold,
          alertLevel,
        };

        // Play sound for critical alerts
        if (playSound && (alertLevel === 'out_of_stock' || alertLevel === 'critical')) {
          playNotificationSound(true);
        }

        // Determine notification severity
        let title: string;
        let description: string;

        switch (alertLevel) {
          case 'out_of_stock':
            title = '⚠️ Out of Stock Alert!';
            description = `${productName} is now out of stock`;
            break;
          case 'critical':
            title = '🔴 Critical Stock Level!';
            description = `${productName} has only ${availableQty} units left`;
            break;
          default:
            title = '📦 Low Stock Warning';
            description = `${productName} is running low (${availableQty} units)`;
        }

        // Show toast notification
        if (alertLevel === 'out_of_stock') {
          toast.error(description, { duration: 10000 });
        } else {
          toast.warning(description, { duration: 6000 });
        }

        // Show browser notification for critical alerts
        if (alertLevel === 'out_of_stock' || alertLevel === 'critical') {
          showBrowserNotificationFn(title, description, `stock-${productId}`);
        }

        // Call callback
        onStockAlert?.(alertPayload);

        logger.info('Stock alert notification triggered', {
          productId,
          productName,
          alertLevel,
          availableQty,
          threshold,
          component: 'useEventNotifications',
        });
      }
    },
    [isNotificationEnabled, playSound, showBrowserNotificationFn, onStockAlert]
  );

  // Subscribe to realtime events
  useEffect(() => {
    if (!enabled || !tenant?.id) return;

    // Clean up existing channels
    channelsRef.current.forEach((channel) => {
      supabase.removeChannel(channel).catch((err) => logger.warn('Error removing channel', { error: err, component: 'useEventNotifications' }));
    });
    channelsRef.current = [];

    // Subscribe to orders table (multiple order tables)
    const orderTables = ['orders', 'menu_orders', 'storefront_orders', 'wholesale_orders'];

    orderTables.forEach((tableName) => {
      const channel = supabase
        .channel(`event-notif-${tableName}-${tenant.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: tableName,
            filter: `tenant_id=eq.${tenant.id}`,
          },
          handleNewOrder
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            logger.debug(`Subscribed to ${tableName} events`, {
              tenantId: tenant.id,
              component: 'useEventNotifications',
            });
          }
        });

      channelsRef.current.push(channel);
    });

    // Subscribe to marketplace_orders (storefront checkout uses seller_tenant_id)
    const marketplaceOrdersChannel = supabase
      .channel(`event-notif-marketplace-orders-${tenant.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'marketplace_orders',
          filter: `seller_tenant_id=eq.${tenant.id}`,
        },
        handleNewOrder
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.debug('Subscribed to marketplace_orders events', {
            tenantId: tenant.id,
            component: 'useEventNotifications',
          });
        }
      });

    channelsRef.current.push(marketplaceOrdersChannel);

    // Subscribe to products table for stock changes
    const productsChannel = supabase
      .channel(`event-notif-products-${tenant.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'products',
          filter: `tenant_id=eq.${tenant.id}`,
        },
        handleStockUpdate
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.debug('Subscribed to products stock events', {
            tenantId: tenant.id,
            component: 'useEventNotifications',
          });
        }
      });

    channelsRef.current.push(productsChannel);

    // Initialize stock levels cache
    const initializeStockCache = async () => {
      const { data: products } = await supabase
        .from('products')
        .select('id, available_quantity, stock_quantity')
        .eq('tenant_id', tenant.id);

      if (products) {
        products.forEach((p) => {
          const available = p.available_quantity ?? p.stock_quantity ?? 0;
          previousStockRef.current.set(p.id, available);
        });
      }
    };

    initializeStockCache();

    logger.info('Event notifications initialized', {
      tenantId: tenant.id,
      orderTables,
      component: 'useEventNotifications',
    });

    // Capture ref values for cleanup
    const channels = channelsRef.current;
    const stockCache = previousStockRef.current;

    // Cleanup
    return () => {
      channels.forEach((channel) => {
        supabase.removeChannel(channel).catch((err) => logger.warn('Error removing channel', { error: err, component: 'useEventNotifications' }));
      });
      channelsRef.current = [];
      stockCache.clear();
    };
  }, [enabled, tenant?.id, handleNewOrder, handleStockUpdate]);

  return {
    isActive: channelsRef.current.length > 0,
    preferences,
  };
}
