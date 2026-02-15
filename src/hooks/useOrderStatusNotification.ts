/**
 * Hook for dispatching notifications when order status changes
 *
 * This hook:
 * - Listens to order_updated events from the event bus
 * - Dispatches notifications to relevant parties based on status
 * - Logs status changes to activity_log
 *
 * Notification targets:
 * - Admin: notified on new order (created)
 * - Delivery runner: notified on confirmed
 * - Customer: notified on out_for_delivery and delivered (if contact info exists)
 */

import { useEffect, useCallback, useRef } from 'react';

import type { EventPayloads } from '@/lib/eventBus';
import { subscribe, publish } from '@/lib/eventBus';
import { supabase } from '@/integrations/supabase/client';
import { useTenantContext } from '@/hooks/useTenantContext';
import { logActivity } from '@/lib/activityLog';
import { logger } from '@/lib/logger';

/**
 * Order status types that trigger notifications
 */
export type OrderStatus =
  | 'created'
  | 'pending'
  | 'confirmed'
  | 'payment_received'
  | 'items_picked'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

/**
 * Notification recipient types
 */
export type NotificationRecipient = 'admin' | 'runner' | 'customer';

/**
 * Structure for notification dispatch
 */
interface NotificationPayload {
  tenantId: string;
  orderId: string;
  orderNumber: string | null;
  customerName: string | null;
  newStatus: OrderStatus;
  recipientType: NotificationRecipient;
  recipientId?: string | null;
  recipientContact?: string | null;
}

/**
 * Order data structure for notifications
 */
interface OrderInfo {
  id: string;
  order_number: string | null;
  status: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  runner_id: string | null;
  runner_name: string | null;
}

/**
 * Options for the hook
 */
export interface UseOrderStatusNotificationOptions {
  /** Enable/disable the hook (default: true) */
  enabled?: boolean;
}

/**
 * Return type for the hook
 */
export interface UseOrderStatusNotificationResult {
  /** Whether the hook is ready and listening */
  isReady: boolean;
  /** Manually dispatch notification for a status change */
  dispatchStatusNotification: (
    orderId: string,
    newStatus: OrderStatus,
    previousStatus?: OrderStatus
  ) => Promise<void>;
}

/**
 * Create notification in the notifications table
 */
async function createNotification(
  tenantId: string,
  title: string,
  message: string,
  type: 'info' | 'success' | 'warning' | 'error',
  entityType: string,
  entityId: string,
  userId?: string | null
): Promise<void> {
  const { error } = await (supabase as any).from('notifications').insert({
    tenant_id: tenantId,
    user_id: userId ?? null,
    title,
    message,
    type,
    entity_type: entityType,
    entity_id: entityId,
    read: false,
  });

  if (error) {
    logger.error('[OrderStatusNotification] Failed to create notification', error, {
      title,
      entityType,
      entityId,
    });
  } else {
    logger.debug('[OrderStatusNotification] Notification created', {
      title,
      type,
      entityType,
      entityId,
      userId,
    });
  }
}

/**
 * Fetch order details for notification
 */
async function fetchOrderInfo(
  orderId: string,
  tenantId: string
): Promise<OrderInfo | null> {
  const { data, error } = await (supabase as any)
    .from('unified_orders')
    .select(`
      id,
      order_number,
      status,
      customer_id,
      customer_name,
      customer_email,
      customer_phone,
      runner_id,
      profiles:runner_id (
        full_name
      )
    `)
    .eq('id', orderId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error) {
    logger.error('[OrderStatusNotification] Failed to fetch order info', error, {
      orderId,
      tenantId,
    });
    return null;
  }

  if (!data) {
    logger.warn('[OrderStatusNotification] Order not found', { orderId, tenantId });
    return null;
  }

  // Extract runner name from the joined profile if available
  const runnerName = data.profiles && typeof data.profiles === 'object' && 'full_name' in data.profiles
    ? (data.profiles.full_name as string | null)
    : null;

  return {
    id: data.id,
    order_number: data.order_number,
    status: data.status,
    customer_id: data.customer_id,
    customer_name: data.customer_name,
    customer_email: data.customer_email,
    customer_phone: data.customer_phone,
    runner_id: data.runner_id,
    runner_name: runnerName,
  };
}

/**
 * Get human-readable status label
 */
function getStatusLabel(status: OrderStatus): string {
  const labels: Record<OrderStatus, string> = {
    created: 'Created',
    pending: 'Pending',
    confirmed: 'Confirmed',
    payment_received: 'Payment Received',
    items_picked: 'Items Picked',
    out_for_delivery: 'Out for Delivery',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
    refunded: 'Refunded',
  };
  return labels[status] || status;
}

/**
 * Determine notification type based on status
 */
function getNotificationType(status: OrderStatus): 'info' | 'success' | 'warning' | 'error' {
  switch (status) {
    case 'delivered':
    case 'payment_received':
      return 'success';
    case 'cancelled':
    case 'refunded':
      return 'warning';
    case 'out_for_delivery':
    case 'confirmed':
      return 'info';
    default:
      return 'info';
  }
}

/**
 * Hook that dispatches notifications when order status changes
 *
 * @param options - Configuration options
 * @returns Object with hook state and manual dispatch function
 *
 * @example
 * ```tsx
 * // Basic usage - auto-dispatches notifications based on order_updated events
 * const { isReady } = useOrderStatusNotification();
 *
 * // Manual dispatch
 * const { dispatchStatusNotification } = useOrderStatusNotification();
 * await dispatchStatusNotification(orderId, 'confirmed', 'pending');
 * ```
 */
export function useOrderStatusNotification(
  options: UseOrderStatusNotificationOptions = {}
): UseOrderStatusNotificationResult {
  const { enabled = true } = options;

  const { tenantId, userId, isReady: contextReady } = useTenantContext();
  const mountedRef = useRef(true);

  // Track if hook is ready
  const isReady = contextReady && enabled && !!tenantId;

  /**
   * Dispatch notifications for a status change
   */
  const dispatchStatusNotification = useCallback(
    async (
      orderId: string,
      newStatus: OrderStatus,
      previousStatus?: OrderStatus
    ): Promise<void> => {
      if (!mountedRef.current || !tenantId) {
        logger.warn('[OrderStatusNotification] Cannot dispatch - no tenant context');
        return;
      }

      // Skip if status hasn't actually changed
      if (previousStatus === newStatus) {
        logger.debug('[OrderStatusNotification] Status unchanged, skipping notification', {
          orderId,
          status: newStatus,
        });
        return;
      }

      logger.debug('[OrderStatusNotification] Dispatching notifications for status change', {
        orderId,
        previousStatus,
        newStatus,
      });

      // Fetch order info for notification content
      const orderInfo = await fetchOrderInfo(orderId, tenantId);
      if (!orderInfo) {
        logger.warn('[OrderStatusNotification] Could not fetch order info', { orderId });
        return;
      }

      const orderLabel = orderInfo.order_number || orderId.slice(0, 8);
      const customerLabel = orderInfo.customer_name || 'Customer';
      const statusLabel = getStatusLabel(newStatus);
      const notificationType = getNotificationType(newStatus);

      // Log status change to activity_log
      if (userId) {
        await logActivity(
          tenantId,
          userId,
          'updated',
          'order',
          orderId,
          {
            previousStatus,
            newStatus,
            orderNumber: orderInfo.order_number,
            customerName: orderInfo.customer_name,
            timestamp: new Date().toISOString(),
          }
        );
      }

      // Dispatch notifications based on status
      switch (newStatus) {
        case 'created':
        case 'pending':
          // Notify admin on new order
          await createNotification(
            tenantId,
            'New Order Received',
            `Order #${orderLabel} from ${customerLabel} - Status: ${statusLabel}`,
            notificationType,
            'order',
            orderId,
            null // null = notify all admins
          );
          break;

        case 'confirmed':
          // Notify delivery runner if assigned
          if (orderInfo.runner_id) {
            await createNotification(
              tenantId,
              'Order Ready for Pickup',
              `Order #${orderLabel} has been confirmed and is ready for delivery`,
              notificationType,
              'order',
              orderId,
              orderInfo.runner_id
            );
          }
          // Also notify admin
          await createNotification(
            tenantId,
            'Order Confirmed',
            `Order #${orderLabel} from ${customerLabel} has been confirmed`,
            notificationType,
            'order',
            orderId,
            null
          );
          break;

        case 'out_for_delivery':
          // Notify customer if contact info exists
          if (orderInfo.customer_id && (orderInfo.customer_email || orderInfo.customer_phone)) {
            await createNotification(
              tenantId,
              'Order Out for Delivery',
              `Order #${orderLabel} is on its way to you!`,
              notificationType,
              'order',
              orderId,
              orderInfo.customer_id
            );
            logger.debug('[OrderStatusNotification] Customer notified for out_for_delivery', {
              orderId,
              customerId: orderInfo.customer_id,
            });
          }
          break;

        case 'delivered':
          // Notify customer if contact info exists
          if (orderInfo.customer_id && (orderInfo.customer_email || orderInfo.customer_phone)) {
            await createNotification(
              tenantId,
              'Order Delivered',
              `Order #${orderLabel} has been delivered. Thank you for your order!`,
              'success',
              'order',
              orderId,
              orderInfo.customer_id
            );
            logger.debug('[OrderStatusNotification] Customer notified for delivery', {
              orderId,
              customerId: orderInfo.customer_id,
            });
          }
          // Notify admin
          await createNotification(
            tenantId,
            'Order Delivered',
            `Order #${orderLabel} to ${customerLabel} has been delivered`,
            'success',
            'order',
            orderId,
            null
          );
          break;

        case 'cancelled':
        case 'refunded':
          // Notify admin
          await createNotification(
            tenantId,
            `Order ${statusLabel}`,
            `Order #${orderLabel} from ${customerLabel} has been ${newStatus}`,
            'warning',
            'order',
            orderId,
            null
          );
          break;

        case 'payment_received':
        case 'items_picked':
          // Notify admin
          await createNotification(
            tenantId,
            `Order ${statusLabel}`,
            `Order #${orderLabel} - ${statusLabel}`,
            notificationType,
            'order',
            orderId,
            null
          );
          break;
      }

      // Publish notification_sent event
      publish('notification_sent', {
        notificationId: `order-status-${orderId}-${newStatus}`,
        tenantId,
        userId: userId ?? undefined,
        type: 'order_status_change',
      });
    },
    [tenantId, userId]
  );

  /**
   * Handle order_updated events from event bus
   */
  const handleOrderUpdated = useCallback(
    async (payload: EventPayloads['order_updated']) => {
      if (!mountedRef.current || !tenantId) return;

      // Only process events for our tenant
      if (payload.tenantId !== tenantId) {
        logger.debug('[OrderStatusNotification] Ignoring order_updated from different tenant');
        return;
      }

      // Only process if status changed
      if (!payload.status) {
        logger.debug('[OrderStatusNotification] No status in order_updated payload');
        return;
      }

      // Get previous status from changes if available
      const previousStatus = payload.changes?.previousStatus as OrderStatus | undefined;

      logger.debug('[OrderStatusNotification] Processing order_updated event', {
        orderId: payload.orderId,
        newStatus: payload.status,
        previousStatus,
      });

      await dispatchStatusNotification(
        payload.orderId,
        payload.status as OrderStatus,
        previousStatus
      );
    },
    [tenantId, dispatchStatusNotification]
  );

  /**
   * Handle order_created events from event bus
   */
  const handleOrderCreated = useCallback(
    async (payload: EventPayloads['order_created']) => {
      if (!mountedRef.current || !tenantId) return;

      // Only process events for our tenant
      if (payload.tenantId !== tenantId) {
        logger.debug('[OrderStatusNotification] Ignoring order_created from different tenant');
        return;
      }

      logger.debug('[OrderStatusNotification] Processing order_created event', {
        orderId: payload.orderId,
      });

      // Dispatch notification for new order
      await dispatchStatusNotification(payload.orderId, 'created');
    },
    [tenantId, dispatchStatusNotification]
  );

  // Set up event subscriptions
  useEffect(() => {
    mountedRef.current = true;

    if (!isReady) {
      logger.debug('[OrderStatusNotification] Not ready, skipping subscriptions', {
        contextReady,
        enabled,
        hasTenantId: !!tenantId,
      });
      return;
    }

    logger.debug('[OrderStatusNotification] Setting up event subscriptions', {
      tenantId,
    });

    // Subscribe to order events
    const unsubOrderUpdated = subscribe('order_updated', handleOrderUpdated);
    const unsubOrderCreated = subscribe('order_created', handleOrderCreated);

    // Cleanup on unmount
    return () => {
      mountedRef.current = false;
      logger.debug('[OrderStatusNotification] Cleaning up subscriptions');
      unsubOrderUpdated();
      unsubOrderCreated();
    };
  }, [
    isReady,
    contextReady,
    enabled,
    tenantId,
    handleOrderUpdated,
    handleOrderCreated,
  ]);

  return {
    isReady,
    dispatchStatusNotification,
  };
}

export default useOrderStatusNotification;
