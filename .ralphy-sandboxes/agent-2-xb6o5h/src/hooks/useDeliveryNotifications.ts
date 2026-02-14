/**
 * useDeliveryNotifications Hook
 *
 * Automated notification chain for deliveries:
 * - On assignment → notify runner
 * - On pickup → notify customer "Your order is on its way"
 * - On nearby (geo-proximity) → notify customer "Your delivery is almost there"
 * - On delivered → notify customer and admin
 *
 * Uses useNotificationDispatcher for in-app notifications.
 * SMS option for customer notifications via Edge Function.
 */

import { useEffect, useCallback, useRef } from 'react';

import type { EventPayloads } from '@/lib/eventBus';
import { subscribe, publish } from '@/lib/eventBus';
import { supabase } from '@/integrations/supabase/client';
import { useTenantContext } from '@/hooks/useTenantContext';
import { logger } from '@/lib/logger';

/**
 * Delivery status types that trigger notifications
 */
export type DeliveryNotificationStatus =
  | 'assigned'
  | 'picked_up'
  | 'in_transit'
  | 'nearby'
  | 'delivered'
  | 'failed'
  | 'cancelled';

/**
 * Notification recipient types
 */
export type NotificationRecipient = 'runner' | 'customer' | 'admin';

/**
 * Delivery info for notifications
 */
interface DeliveryInfo {
  id: string;
  orderId: string;
  orderNumber: string | null;
  runnerId: string | null;
  runnerName: string | null;
  customerId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  deliveryAddress: string | null;
  status: string;
}

/**
 * Options for the hook
 */
export interface UseDeliveryNotificationsOptions {
  /** Enable/disable the hook (default: true) */
  enabled?: boolean;
  /** Enable SMS notifications for customers (default: false) */
  smsEnabled?: boolean;
  /** Distance in meters to trigger "nearby" notification (default: 500) */
  nearbyThresholdMeters?: number;
}

/**
 * Return type for the hook
 */
export interface UseDeliveryNotificationsResult {
  /** Whether the hook is ready and listening */
  isReady: boolean;
  /** Manually dispatch a delivery notification */
  dispatchDeliveryNotification: (
    deliveryId: string,
    orderId: string,
    newStatus: DeliveryNotificationStatus
  ) => Promise<void>;
  /** Check if runner is nearby customer and trigger notification */
  checkNearbyAndNotify: (
    deliveryId: string,
    orderId: string,
    runnerLat: number,
    runnerLng: number,
    customerLat: number,
    customerLng: number
  ) => Promise<boolean>;
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
  const { error } = await supabase.from('notifications').insert({
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
    logger.error('[DeliveryNotifications] Failed to create notification', error, {
      title,
      entityType,
      entityId,
    });
  } else {
    logger.debug('[DeliveryNotifications] Notification created', {
      title,
      type,
      entityType,
      entityId,
      userId,
    });
  }
}

/**
 * Send SMS notification via Edge Function
 */
async function sendSmsNotification(
  to: string,
  message: string,
  tenantId: string,
  customerId?: string | null
): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke('send-sms', {
      body: {
        to,
        message,
        accountId: tenantId,
        customerId,
      },
    });

    if (error) {
      logger.error('[DeliveryNotifications] SMS send failed', error);
      return false;
    }

    if (data?.error) {
      logger.warn('[DeliveryNotifications] SMS service error', { error: data.error });
      return false;
    }

    logger.debug('[DeliveryNotifications] SMS sent successfully', { to });
    return true;
  } catch (err) {
    logger.error('[DeliveryNotifications] SMS exception', err as Error);
    return false;
  }
}

/**
 * Fetch delivery details for notification
 */
async function fetchDeliveryInfo(
  orderId: string,
  tenantId: string
): Promise<DeliveryInfo | null> {
  // Try unified_orders first (covers most order types)
  const { data: orderData, error: orderError } = await supabase
    .from('unified_orders')
    .select(`
      id,
      order_number,
      status,
      customer_id,
      customer_name,
      customer_email,
      customer_phone,
      delivery_address,
      runner_id,
      profiles:runner_id (
        full_name
      )
    `)
    .eq('id', orderId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (orderError) {
    logger.error('[DeliveryNotifications] Failed to fetch order info', orderError, {
      orderId,
      tenantId,
    });
  }

  if (orderData) {
    const runnerName =
      orderData.profiles && typeof orderData.profiles === 'object' && 'full_name' in orderData.profiles
        ? (orderData.profiles.full_name as string | null)
        : null;

    return {
      id: orderData.id,
      orderId: orderData.id,
      orderNumber: orderData.order_number,
      runnerId: orderData.runner_id,
      runnerName,
      customerId: orderData.customer_id,
      customerName: orderData.customer_name,
      customerEmail: orderData.customer_email,
      customerPhone: orderData.customer_phone,
      deliveryAddress: orderData.delivery_address,
      status: orderData.status,
    };
  }

  // Fallback to orders table
  const { data: fallbackData, error: fallbackError } = await supabase
    .from('orders')
    .select(`
      id,
      order_number,
      status,
      customer_id,
      customer_name,
      customer_email,
      customer_phone,
      delivery_address,
      courier_id
    `)
    .eq('id', orderId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (fallbackError) {
    logger.error('[DeliveryNotifications] Failed to fetch fallback order info', fallbackError);
    return null;
  }

  if (!fallbackData) {
    logger.warn('[DeliveryNotifications] Order not found', { orderId, tenantId });
    return null;
  }

  return {
    id: fallbackData.id,
    orderId: fallbackData.id,
    orderNumber: fallbackData.order_number,
    runnerId: fallbackData.courier_id,
    runnerName: null,
    customerId: fallbackData.customer_id,
    customerName: fallbackData.customer_name,
    customerEmail: fallbackData.customer_email,
    customerPhone: fallbackData.customer_phone,
    deliveryAddress: fallbackData.delivery_address,
    status: fallbackData.status,
  };
}

/**
 * Calculate distance between two points in meters (Haversine formula)
 */
function calculateDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Hook that dispatches notifications for delivery status changes
 *
 * @param options - Configuration options
 * @returns Object with hook state and dispatch functions
 *
 * @example
 * ```tsx
 * // Basic usage - auto-dispatches notifications based on delivery_status_changed events
 * const { isReady } = useDeliveryNotifications();
 *
 * // With SMS enabled
 * const { isReady } = useDeliveryNotifications({ smsEnabled: true });
 *
 * // Manual dispatch
 * const { dispatchDeliveryNotification } = useDeliveryNotifications();
 * await dispatchDeliveryNotification(deliveryId, orderId, 'picked_up');
 *
 * // Check nearby and notify
 * const { checkNearbyAndNotify } = useDeliveryNotifications();
 * await checkNearbyAndNotify(deliveryId, orderId, runnerLat, runnerLng, customerLat, customerLng);
 * ```
 */
export function useDeliveryNotifications(
  options: UseDeliveryNotificationsOptions = {}
): UseDeliveryNotificationsResult {
  const {
    enabled = true,
    smsEnabled = false,
    nearbyThresholdMeters = 500,
  } = options;

  const { tenantId, userId, isReady: contextReady } = useTenantContext();
  const mountedRef = useRef(true);
  const nearbyNotifiedRef = useRef<Set<string>>(new Set()); // Track deliveries with nearby notification sent

  const isReady = contextReady && enabled && !!tenantId;

  /**
   * Dispatch notifications for a delivery status change
   */
  const dispatchDeliveryNotification = useCallback(
    async (
      deliveryId: string,
      orderId: string,
      newStatus: DeliveryNotificationStatus
    ): Promise<void> => {
      if (!mountedRef.current || !tenantId) {
        logger.warn('[DeliveryNotifications] Cannot dispatch - no tenant context');
        return;
      }

      logger.debug('[DeliveryNotifications] Dispatching notification', {
        deliveryId,
        orderId,
        newStatus,
      });

      // Fetch delivery info
      const deliveryInfo = await fetchDeliveryInfo(orderId, tenantId);
      if (!deliveryInfo) {
        logger.warn('[DeliveryNotifications] Could not fetch delivery info', { orderId });
        return;
      }

      const orderLabel = deliveryInfo.orderNumber || orderId.slice(0, 8);
      const customerLabel = deliveryInfo.customerName || 'Customer';

      // Dispatch notifications based on status
      switch (newStatus) {
        case 'assigned': {
          // Notify runner when delivery is assigned to them
          if (deliveryInfo.runnerId) {
            await createNotification(
              tenantId,
              'New Delivery Assigned',
              `Order #${orderLabel} has been assigned to you. Customer: ${customerLabel}`,
              'info',
              'delivery',
              deliveryId,
              deliveryInfo.runnerId
            );
            logger.debug('[DeliveryNotifications] Runner notified of assignment', {
              runnerId: deliveryInfo.runnerId,
              orderId,
            });
          }
          break;
        }

        case 'picked_up': {
          // Notify customer that order is on the way
          if (deliveryInfo.customerId) {
            await createNotification(
              tenantId,
              'Your order is on its way!',
              `Order #${orderLabel} has been picked up and is heading your way.`,
              'success',
              'delivery',
              deliveryId,
              deliveryInfo.customerId
            );
          }

          // Send SMS if enabled and phone available
          if (smsEnabled && deliveryInfo.customerPhone) {
            const smsMessage = `Your order #${orderLabel} is on its way! Track your delivery in the app.`;
            await sendSmsNotification(
              deliveryInfo.customerPhone,
              smsMessage,
              tenantId,
              deliveryInfo.customerId
            );
          }
          break;
        }

        case 'nearby': {
          // Notify customer that delivery is almost there
          if (deliveryInfo.customerId) {
            await createNotification(
              tenantId,
              'Your delivery is almost there!',
              `Order #${orderLabel} is nearby. Please be ready to receive your delivery.`,
              'info',
              'delivery',
              deliveryId,
              deliveryInfo.customerId
            );
          }

          // Send SMS if enabled
          if (smsEnabled && deliveryInfo.customerPhone) {
            const smsMessage = `Your order #${orderLabel} is almost there! Please be ready to receive your delivery.`;
            await sendSmsNotification(
              deliveryInfo.customerPhone,
              smsMessage,
              tenantId,
              deliveryInfo.customerId
            );
          }
          break;
        }

        case 'delivered': {
          // Notify customer of successful delivery
          if (deliveryInfo.customerId) {
            await createNotification(
              tenantId,
              'Order Delivered!',
              `Order #${orderLabel} has been delivered. Thank you for your order!`,
              'success',
              'delivery',
              deliveryId,
              deliveryInfo.customerId
            );
          }

          // Send SMS if enabled
          if (smsEnabled && deliveryInfo.customerPhone) {
            const smsMessage = `Your order #${orderLabel} has been delivered! Thank you for your order.`;
            await sendSmsNotification(
              deliveryInfo.customerPhone,
              smsMessage,
              tenantId,
              deliveryInfo.customerId
            );
          }

          // Notify admin of completed delivery
          await createNotification(
            tenantId,
            'Delivery Completed',
            `Order #${orderLabel} to ${customerLabel} has been delivered.`,
            'success',
            'delivery',
            deliveryId,
            null // null = notify all admins
          );
          break;
        }

        case 'failed':
        case 'cancelled': {
          // Notify admin of failed/cancelled delivery
          await createNotification(
            tenantId,
            `Delivery ${newStatus === 'failed' ? 'Failed' : 'Cancelled'}`,
            `Order #${orderLabel} delivery has been ${newStatus}.`,
            'warning',
            'delivery',
            deliveryId,
            null
          );

          // Notify customer if cancelled
          if (newStatus === 'cancelled' && deliveryInfo.customerId) {
            await createNotification(
              tenantId,
              'Delivery Cancelled',
              `Your order #${orderLabel} delivery has been cancelled. Please contact support.`,
              'warning',
              'delivery',
              deliveryId,
              deliveryInfo.customerId
            );
          }
          break;
        }

        case 'in_transit':
          // No specific notification for in_transit (pickup already notified)
          break;
      }

      // Publish notification_sent event
      publish('notification_sent', {
        notificationId: `delivery-${deliveryId}-${newStatus}`,
        tenantId,
        userId: userId ?? undefined,
        type: 'delivery_status_change',
      });
    },
    [tenantId, userId, smsEnabled]
  );

  /**
   * Check if runner is nearby customer and trigger notification
   */
  const checkNearbyAndNotify = useCallback(
    async (
      deliveryId: string,
      orderId: string,
      runnerLat: number,
      runnerLng: number,
      customerLat: number,
      customerLng: number
    ): Promise<boolean> => {
      if (!mountedRef.current || !tenantId) return false;

      // Check if already notified for this delivery
      if (nearbyNotifiedRef.current.has(deliveryId)) {
        return false;
      }

      const distance = calculateDistanceMeters(
        runnerLat,
        runnerLng,
        customerLat,
        customerLng
      );

      logger.debug('[DeliveryNotifications] Checking nearby distance', {
        deliveryId,
        distance,
        threshold: nearbyThresholdMeters,
      });

      if (distance <= nearbyThresholdMeters) {
        // Mark as notified to prevent duplicate notifications
        nearbyNotifiedRef.current.add(deliveryId);

        // Dispatch nearby notification
        await dispatchDeliveryNotification(deliveryId, orderId, 'nearby');
        return true;
      }

      return false;
    },
    [tenantId, nearbyThresholdMeters, dispatchDeliveryNotification]
  );

  /**
   * Handle delivery_status_changed events from event bus
   */
  const handleDeliveryStatusChanged = useCallback(
    async (payload: EventPayloads['delivery_status_changed']) => {
      if (!mountedRef.current || !tenantId) return;

      // Only process events for our tenant
      if (payload.tenantId !== tenantId) {
        logger.debug('[DeliveryNotifications] Ignoring event from different tenant');
        return;
      }

      logger.debug('[DeliveryNotifications] Processing delivery_status_changed', {
        deliveryId: payload.deliveryId,
        orderId: payload.orderId,
        previousStatus: payload.previousStatus,
        newStatus: payload.newStatus,
      });

      // Map status to notification status
      const notificationStatus = mapToNotificationStatus(payload.newStatus);
      if (notificationStatus) {
        await dispatchDeliveryNotification(
          payload.deliveryId,
          payload.orderId,
          notificationStatus
        );
      }
    },
    [tenantId, dispatchDeliveryNotification]
  );

  // Set up event subscriptions
  useEffect(() => {
    mountedRef.current = true;
    // Copy ref value for cleanup function
    const nearbyNotifiedSet = nearbyNotifiedRef.current;

    if (!isReady) {
      logger.debug('[DeliveryNotifications] Not ready, skipping subscriptions', {
        contextReady,
        enabled,
        hasTenantId: !!tenantId,
      });
      return;
    }

    logger.debug('[DeliveryNotifications] Setting up event subscriptions', {
      tenantId,
      smsEnabled,
      nearbyThresholdMeters,
    });

    // Subscribe to delivery status changes
    const unsubDeliveryStatus = subscribe(
      'delivery_status_changed',
      handleDeliveryStatusChanged
    );

    // Cleanup on unmount
    return () => {
      mountedRef.current = false;
      nearbyNotifiedSet.clear();
      logger.debug('[DeliveryNotifications] Cleaning up subscriptions');
      unsubDeliveryStatus();
    };
  }, [
    isReady,
    contextReady,
    enabled,
    tenantId,
    smsEnabled,
    nearbyThresholdMeters,
    handleDeliveryStatusChanged,
  ]);

  return {
    isReady,
    dispatchDeliveryNotification,
    checkNearbyAndNotify,
  };
}

/**
 * Map delivery status to notification status
 */
function mapToNotificationStatus(
  status: string
): DeliveryNotificationStatus | null {
  const mapping: Record<string, DeliveryNotificationStatus> = {
    assigned: 'assigned',
    picked_up: 'picked_up',
    in_transit: 'in_transit',
    out_for_delivery: 'in_transit',
    nearby: 'nearby',
    delivered: 'delivered',
    failed: 'failed',
    cancelled: 'cancelled',
  };
  return mapping[status] ?? null;
}

export default useDeliveryNotifications;
