/**
 * useEventNotifications Hook
 *
 * Connects eventBus events to the notification system.
 * Monitors orders (new orders) and stock levels (low stock alerts).
 * Respects user notification preferences from the notification_preferences table.
 *
 * Phase 2: Replaced 6 Supabase realtime channels with eventBus subscriptions.
 * Events flow: DB → useRealtimeSync → eventBus → this hook.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { toast } from 'sonner';
import { playNotificationSound } from '@/utils/notificationSound';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import { formatCurrency } from '@/lib/formatters';
import { eventBus } from '@/lib/eventBus';

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
  const tenantId = tenant?.id;
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
    retry: 2,
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

  // Subscribe to eventBus events (replaces 6 Supabase realtime channels)
  useEffect(() => {
    if (!enabled || !tenantId) return;

    const unsubscribers: Array<() => void> = [];

    // --- New orders (replaces orders, menu_orders, storefront_orders, wholesale_orders channels) ---
    const handleOrderEvent = (orderId: string, source?: string) => {
      if (!isNotificationEnabled('orders')) return;

      const orderPayload: OrderEventPayload = {
        id: orderId,
        status: 'pending',
        source,
        created_at: new Date().toISOString(),
      };

      if (playSound) {
        playNotificationSound(true);
      }

      if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200]);
      }

      const orderNum = orderId.slice(0, 8);
      const sourceStr = source
        ? ` from ${source.charAt(0).toUpperCase() + source.slice(1)}`
        : '';

      toast.success(`Order #${orderNum}${sourceStr}`, { duration: 8000 });

      showBrowserNotificationFn(
        'New Order Received!',
        `Order #${orderNum}${sourceStr}`,
        `order-${orderId}`
      );

      onNewOrder?.(orderPayload);

      logger.info('New order notification triggered', {
        orderId,
        source,
        component: 'useEventNotifications',
      });
    };

    unsubscribers.push(
      eventBus.subscribe('order_created', (payload) => {
        if (payload.tenantId !== tenantId) return;
        handleOrderEvent(payload.orderId, 'order');
      })
    );

    unsubscribers.push(
      eventBus.subscribe('menu_order_created', (payload) => {
        if (payload.tenantId !== tenantId) return;
        handleOrderEvent(payload.orderId, 'menu');
      })
    );

    // --- Stock alerts (replaces products channel) ---
    unsubscribers.push(
      eventBus.subscribe('inventory_changed', (payload) => {
        if (payload.tenantId !== tenantId) return;
        if (!isNotificationEnabled('inventory')) return;

        const productId = payload.productId;
        const availableQty = payload.newQuantity;
        const threshold = DEFAULT_LOW_STOCK_THRESHOLD;

        // Get previous stock level
        const previousStock = previousStockRef.current.get(productId);
        previousStockRef.current.set(productId, availableQty);

        // Only alert if stock dropped below threshold (not if it was already below)
        if (previousStock !== undefined && previousStock > threshold && availableQty <= threshold) {
          const alertLevel = getStockAlertLevel(availableQty, threshold);
          const alertPayload: StockAlertPayload = {
            id: productId,
            name: 'Product', // Name not available in eventBus payload
            stock_quantity: availableQty,
            available_quantity: availableQty,
            low_stock_alert: threshold,
            alertLevel,
          };

          // Play sound for critical alerts
          if (playSound && (alertLevel === 'out_of_stock' || alertLevel === 'critical')) {
            playNotificationSound(true);
          }

          let description: string;
          switch (alertLevel) {
            case 'out_of_stock':
              description = `Product is now out of stock`;
              break;
            case 'critical':
              description = `Product has only ${availableQty} units left`;
              break;
            default:
              description = `Product is running low (${availableQty} units)`;
          }

          if (alertLevel === 'out_of_stock') {
            toast.error(description, { duration: 10000 });
          } else {
            toast.warning(description, { duration: 6000 });
          }

          if (alertLevel === 'out_of_stock' || alertLevel === 'critical') {
            showBrowserNotificationFn(
              alertLevel === 'out_of_stock' ? 'Out of Stock Alert!' : 'Critical Stock Level!',
              description,
              `stock-${productId}`
            );
          }

          onStockAlert?.(alertPayload);

          logger.info('Stock alert notification triggered', {
            productId,
            alertLevel,
            availableQty,
            threshold,
            component: 'useEventNotifications',
          });
        }
      })
    );

    // Initialize stock levels cache
    const initializeStockCache = async () => {
      const { data: products } = await supabase
        .from('products')
        .select('id, available_quantity, stock_quantity')
        .eq('tenant_id', tenantId);

      if (products) {
        products.forEach((p) => {
          const available = p.available_quantity ?? p.stock_quantity ?? 0;
          previousStockRef.current.set(p.id, available);
        });
      }
    };

    initializeStockCache();

    logger.info('Event notifications initialized (eventBus mode)', {
      tenantId,
      subscriptionCount: unsubscribers.length,
      component: 'useEventNotifications',
    });

    const stockCache = previousStockRef.current;

    return () => {
      unsubscribers.forEach((unsub) => unsub());
      stockCache.clear();
    };
  }, [enabled, tenantId, isNotificationEnabled, playSound, showBrowserNotificationFn, onNewOrder, onStockAlert]);

  return {
    preferences,
  };
}
