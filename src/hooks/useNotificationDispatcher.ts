/**
 * Hook that listens to eventBus events and creates in-app notifications
 *
 * This dispatcher:
 * - Listens to order_created → notifies admin
 * - Listens to inventory_changed → notifies if stock is low
 * - Listens to customer_updated → logs the event
 *
 * Stores notifications in Supabase notifications table with tenant isolation.
 */

import { useEffect, useCallback, useRef } from 'react';

import type { EventPayloads } from '@/lib/eventBus';
import { subscribe } from '@/lib/eventBus';
import { supabase } from '@/integrations/supabase/client';
import { useTenantContext } from '@/hooks/useTenantContext';
import { logger } from '@/lib/logger';
import { METRICS_CONSTANTS } from '@/lib/constants/dashboard';

/**
 * Notification type for the notifications table
 */
export type NotificationType = 'info' | 'warning' | 'error' | 'success';

/**
 * Structure for creating a notification
 */
interface CreateNotificationParams {
  tenantId: string;
  userId?: string | null;
  title: string;
  message?: string;
  type: NotificationType;
  entityType?: string;
  entityId?: string;
}

/**
 * Insert a notification into the notifications table
 */
async function createNotification(params: CreateNotificationParams): Promise<void> {
  const { tenantId, userId, title, message, type, entityType, entityId } = params;

  const { error } = await supabase.from('notifications').insert({
    tenant_id: tenantId,
    user_id: userId,
    title,
    message,
    type,
    entity_type: entityType,
    entity_id: entityId,
    read: false,
  });

  if (error) {
    logger.error('[NotificationDispatcher] Failed to create notification', error, {
      title,
      type,
      entityType,
    });
  } else {
    logger.debug('[NotificationDispatcher] Notification created', {
      title,
      type,
      entityType,
      entityId,
    });
  }
}

/**
 * Options for the notification dispatcher hook
 */
export interface UseNotificationDispatcherOptions {
  /** Enable/disable the dispatcher (default: true) */
  enabled?: boolean;
  /** Low stock threshold to trigger inventory warnings */
  lowStockThreshold?: number;
}

/**
 * Return type for the hook
 */
export interface UseNotificationDispatcherResult {
  /** Whether the dispatcher is ready and listening */
  isReady: boolean;
  /** Manually dispatch a notification */
  dispatchNotification: (params: Omit<CreateNotificationParams, 'tenantId'>) => Promise<void>;
}

/**
 * Hook that listens to eventBus events and creates in-app notifications
 *
 * @param options - Configuration options
 * @returns Object with dispatcher state and manual dispatch function
 *
 * @example
 * ```tsx
 * // Basic usage - auto-dispatches notifications based on events
 * const { isReady } = useNotificationDispatcher();
 *
 * // With custom threshold
 * const { isReady } = useNotificationDispatcher({
 *   lowStockThreshold: 5
 * });
 *
 * // Manual notification dispatch
 * const { dispatchNotification } = useNotificationDispatcher();
 * await dispatchNotification({
 *   title: 'Custom Alert',
 *   message: 'Something happened',
 *   type: 'info'
 * });
 * ```
 */
export function useNotificationDispatcher(
  options: UseNotificationDispatcherOptions = {}
): UseNotificationDispatcherResult {
  const {
    enabled = true,
    lowStockThreshold = METRICS_CONSTANTS.DEFAULT_LOW_STOCK_THRESHOLD,
  } = options;

  const { tenantId, userId: _userId, isReady: contextReady } = useTenantContext();
  const mountedRef = useRef(true);

  // Track if dispatcher is ready
  const isReady = contextReady && enabled && !!tenantId;

  /**
   * Handle order_created events
   * Notifies admin when a new order is created
   */
  const handleOrderCreated = useCallback(
    async (payload: EventPayloads['order_created']) => {
      if (!mountedRef.current || !tenantId) return;

      // Only process events for our tenant
      if (payload.tenantId !== tenantId) {
        logger.debug('[NotificationDispatcher] Ignoring order_created from different tenant');
        return;
      }

      logger.debug('[NotificationDispatcher] Processing order_created event', {
        orderId: payload.orderId,
      });

      await createNotification({
        tenantId,
        userId: null, // Notify all admins
        title: 'New Order Received',
        message: `Order ${payload.orderId.slice(0, 8)}... has been created`,
        type: 'success',
        entityType: 'order',
        entityId: payload.orderId,
      });
    },
    [tenantId]
  );

  /**
   * Handle inventory_changed events
   * Notifies inventory manager when stock is low
   */
  const handleInventoryChanged = useCallback(
    async (payload: EventPayloads['inventory_changed']) => {
      if (!mountedRef.current || !tenantId) return;

      // Only process events for our tenant
      if (payload.tenantId !== tenantId) {
        logger.debug('[NotificationDispatcher] Ignoring inventory_changed from different tenant');
        return;
      }

      logger.debug('[NotificationDispatcher] Processing inventory_changed event', {
        productId: payload.productId,
        newQuantity: payload.newQuantity,
        threshold: lowStockThreshold,
      });

      // Check if stock is low
      if (payload.newQuantity <= lowStockThreshold) {
        await createNotification({
          tenantId,
          userId: null, // Notify inventory managers
          title: 'Low Stock Alert',
          message: `Product ${payload.productId.slice(0, 8)}... is running low (${payload.newQuantity} remaining)`,
          type: 'warning',
          entityType: 'inventory',
          entityId: payload.productId,
        });
      }

      // Check for out of stock
      if (payload.newQuantity <= 0) {
        await createNotification({
          tenantId,
          userId: null,
          title: 'Out of Stock',
          message: `Product ${payload.productId.slice(0, 8)}... is now out of stock`,
          type: 'error',
          entityType: 'inventory',
          entityId: payload.productId,
        });
      }
    },
    [tenantId, lowStockThreshold]
  );

  /**
   * Handle customer_updated events
   * Logs the update (no notification, just activity logging)
   */
  const handleCustomerUpdated = useCallback(
    (payload: EventPayloads['customer_updated']) => {
      if (!mountedRef.current || !tenantId) return;

      // Only process events for our tenant
      if (payload.tenantId !== tenantId) {
        logger.debug('[NotificationDispatcher] Ignoring customer_updated from different tenant');
        return;
      }

      // Log the customer update - no notification needed per task spec
      logger.debug('[NotificationDispatcher] Customer updated', {
        customerId: payload.customerId,
        changes: payload.changes,
      });
    },
    [tenantId]
  );

  /**
   * Handle menu_product_hidden events
   * Notifies admin when a product is auto-hidden from menu due to stock
   */
  const handleMenuProductHidden = useCallback(
    async (payload: EventPayloads['menu_product_hidden']) => {
      if (!mountedRef.current || !tenantId) return;

      // Only process events for our tenant
      if (payload.tenantId !== tenantId) {
        logger.debug('[NotificationDispatcher] Ignoring menu_product_hidden from different tenant');
        return;
      }

      logger.debug('[NotificationDispatcher] Processing menu_product_hidden event', {
        menuId: payload.menuId,
        productId: payload.productId,
        productName: payload.productName,
        reason: payload.reason,
      });

      await createNotification({
        tenantId,
        userId: null, // Notify all admins
        title: 'Menu Product Auto-Hidden',
        message: `"${payload.productName}" has been automatically hidden from the menu because it is ${payload.reason === 'out_of_stock' ? 'out of stock' : 'low on stock'}.`,
        type: 'warning',
        entityType: 'menu',
        entityId: payload.menuId,
      });
    },
    [tenantId]
  );

  /**
   * Handle menu_product_restored events
   * Notifies admin when a product is restored to menu after restock
   */
  const handleMenuProductRestored = useCallback(
    async (payload: EventPayloads['menu_product_restored']) => {
      if (!mountedRef.current || !tenantId) return;

      // Only process events for our tenant
      if (payload.tenantId !== tenantId) {
        logger.debug('[NotificationDispatcher] Ignoring menu_product_restored from different tenant');
        return;
      }

      logger.debug('[NotificationDispatcher] Processing menu_product_restored event', {
        menuId: payload.menuId,
        productId: payload.productId,
        productName: payload.productName,
      });

      await createNotification({
        tenantId,
        userId: null, // Notify all admins
        title: 'Menu Product Restored',
        message: `"${payload.productName}" is back in stock and now available on the menu again.`,
        type: 'success',
        entityType: 'menu',
        entityId: payload.menuId,
      });
    },
    [tenantId]
  );

  /**
   * Manual dispatch function for creating notifications
   */
  const dispatchNotification = useCallback(
    async (params: Omit<CreateNotificationParams, 'tenantId'>): Promise<void> => {
      if (!tenantId) {
        logger.warn('[NotificationDispatcher] Cannot dispatch - no tenant context');
        return;
      }

      await createNotification({
        ...params,
        tenantId,
      });
    },
    [tenantId]
  );

  // Set up event subscriptions
  useEffect(() => {
    mountedRef.current = true;

    if (!isReady) {
      logger.debug('[NotificationDispatcher] Not ready, skipping subscriptions', {
        contextReady,
        enabled,
        hasTenantId: !!tenantId,
      });
      return;
    }

    logger.debug('[NotificationDispatcher] Setting up event subscriptions', {
      tenantId,
      lowStockThreshold,
    });

    // Subscribe to events
    const unsubOrderCreated = subscribe('order_created', handleOrderCreated);
    const unsubInventoryChanged = subscribe('inventory_changed', handleInventoryChanged);
    const unsubCustomerUpdated = subscribe('customer_updated', handleCustomerUpdated);
    const unsubMenuProductHidden = subscribe('menu_product_hidden', handleMenuProductHidden);
    const unsubMenuProductRestored = subscribe('menu_product_restored', handleMenuProductRestored);

    // Cleanup on unmount
    return () => {
      mountedRef.current = false;
      logger.debug('[NotificationDispatcher] Cleaning up subscriptions');
      unsubOrderCreated();
      unsubInventoryChanged();
      unsubCustomerUpdated();
      unsubMenuProductHidden();
      unsubMenuProductRestored();
    };
  }, [
    isReady,
    contextReady,
    enabled,
    tenantId,
    lowStockThreshold,
    handleOrderCreated,
    handleInventoryChanged,
    handleCustomerUpdated,
    handleMenuProductHidden,
    handleMenuProductRestored,
  ]);

  return {
    isReady,
    dispatchNotification,
  };
}

export default useNotificationDispatcher;
