/**
 * useDeliveryOrderSync Hook
 *
 * Provides bidirectional synchronization between delivery and order statuses:
 * - When delivery status changes → order status updates accordingly
 * - When order is cancelled → linked delivery is auto-cancelled
 *
 * Status mappings:
 * - delivery: in_transit → order: out_for_delivery
 * - delivery: delivered/completed → order: delivered
 * - order: cancelled → delivery: cancelled
 *
 * Uses eventBus for loose coupling between modules.
 */

import { useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import type { EventPayloads } from '@/lib/eventBus';
import { subscribe, publish } from '@/lib/eventBus';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';

/** Delivery status values */
export type DeliveryStatus =
  | 'pending'
  | 'assigned'
  | 'picked_up'
  | 'in_transit'
  | 'delivered'
  | 'completed'
  | 'failed'
  | 'cancelled';

/** Order status values that relate to delivery */
export type OrderDeliveryStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

/** Options for the hook */
export interface UseDeliveryOrderSyncOptions {
  /** Enable/disable the hook (default: true) */
  enabled?: boolean;
  /** Auto-update order status when delivery changes (default: true) */
  autoSyncOrderStatus?: boolean;
  /** Auto-cancel delivery when order is cancelled (default: true) */
  autoCancelDelivery?: boolean;
}

/** Return type for the hook */
export interface UseDeliveryOrderSyncResult {
  /** Whether the sync is active and listening */
  isActive: boolean;
  /** Manually sync delivery status to order */
  syncDeliveryToOrder: (
    deliveryId: string,
    orderId: string,
    newDeliveryStatus: DeliveryStatus
  ) => Promise<boolean>;
  /** Manually sync order cancellation to delivery */
  syncOrderCancellationToDelivery: (
    orderId: string,
    reason?: string
  ) => Promise<boolean>;
  /** Publish a delivery status change event */
  publishDeliveryStatusChange: (
    deliveryId: string,
    orderId: string,
    previousStatus: string | null,
    newStatus: string,
    runnerId?: string
  ) => void;
  /** Publish an order cancelled event */
  publishOrderCancelled: (
    orderId: string,
    reason?: string
  ) => void;
}

/**
 * Map delivery status to corresponding order status
 */
function mapDeliveryStatusToOrderStatus(
  deliveryStatus: DeliveryStatus
): OrderDeliveryStatus | null {
  switch (deliveryStatus) {
    case 'in_transit':
      return 'out_for_delivery';
    case 'delivered':
    case 'completed':
      return 'delivered';
    case 'cancelled':
      return 'cancelled';
    default:
      // Other statuses don't require order status update
      return null;
  }
}

/**
 * Hook for bidirectional delivery-order status synchronization
 *
 * @param options - Configuration options
 * @returns Object with sync state and manual sync functions
 *
 * @example
 * ```tsx
 * // Basic usage - auto-syncs based on eventBus events
 * const { isActive } = useDeliveryOrderSync();
 *
 * // Manual sync
 * const { syncDeliveryToOrder, publishDeliveryStatusChange } = useDeliveryOrderSync();
 *
 * // When delivery status changes
 * publishDeliveryStatusChange(deliveryId, orderId, 'picked_up', 'in_transit');
 *
 * // Manual sync for specific cases
 * await syncDeliveryToOrder(deliveryId, orderId, 'delivered');
 * ```
 */
export function useDeliveryOrderSync(
  options: UseDeliveryOrderSyncOptions = {}
): UseDeliveryOrderSyncResult {
  const {
    enabled = true,
    autoSyncOrderStatus = true,
    autoCancelDelivery = true,
  } = options;

  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const mountedRef = useRef(true);

  const isActive = enabled && !!tenant?.id;

  /**
   * Update order status in the database
   */
  const updateOrderStatus = useCallback(
    async (
      orderId: string,
      newStatus: OrderDeliveryStatus,
      additionalFields?: Record<string, unknown>
    ): Promise<boolean> => {
      if (!tenant?.id) {
        logger.warn('[DeliveryOrderSync] Cannot update order - no tenant context');
        return false;
      }

      const updateData: Record<string, unknown> = {
        status: newStatus,
        updated_at: new Date().toISOString(),
        ...additionalFields,
      };

      // Add delivered_at timestamp when marking as delivered
      if (newStatus === 'delivered') {
        updateData.delivered_at = new Date().toISOString();
      }

      // Add cancelled_at timestamp when marking as cancelled
      if (newStatus === 'cancelled') {
        updateData.cancelled_at = new Date().toISOString();
      }

      // Try unified_orders first
      const { error: unifiedError } = await supabase
        .from('unified_orders')
        .update(updateData)
        .eq('id', orderId)
        .eq('tenant_id', tenant.id);

      if (!unifiedError) {
        logger.debug('[DeliveryOrderSync] Updated order status in unified_orders', {
          orderId,
          newStatus,
          tenantId: tenant.id,
        });
        return true;
      }

      logger.warn('[DeliveryOrderSync] unified_orders update failed, falling back to orders table', {
        component: 'useDeliveryOrderSync',
        orderId,
        error: unifiedError,
      });

      // Fallback to orders table
      const { error: ordersError } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId)
        .eq('tenant_id', tenant.id);

      if (ordersError) {
        logger.error('[DeliveryOrderSync] Failed to update order status', ordersError, {
          orderId,
          newStatus,
          tenantId: tenant.id,
        });
        return false;
      }

      logger.debug('[DeliveryOrderSync] Updated order status in orders table', {
        orderId,
        newStatus,
        tenantId: tenant.id,
      });
      return true;
    },
    [tenant?.id]
  );

  /**
   * Update delivery status in the database
   */
  const updateDeliveryStatus = useCallback(
    async (
      orderId: string,
      newStatus: DeliveryStatus,
      reason?: string
    ): Promise<boolean> => {
      if (!tenant?.id) {
        logger.warn('[DeliveryOrderSync] Cannot update delivery - no tenant context');
        return false;
      }

      const updateData: Record<string, unknown> = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      if (reason) {
        updateData.notes = reason;
      }

      if (newStatus === 'delivered' || newStatus === 'completed') {
        updateData.actual_delivery_time = new Date().toISOString();
      }

      const { error } = await supabase
        .from('deliveries')
        .update(updateData)
        .eq('order_id', orderId)
        .eq('tenant_id', tenant.id);

      if (error) {
        // Table may not exist
        if (error.code === '42P01') {
          logger.debug('[DeliveryOrderSync] Deliveries table does not exist', {
            orderId,
            tenantId: tenant.id,
          });
          return false;
        }

        logger.error('[DeliveryOrderSync] Failed to update delivery status', error, {
          orderId,
          newStatus,
          tenantId: tenant.id,
        });
        return false;
      }

      logger.debug('[DeliveryOrderSync] Updated delivery status', {
        orderId,
        newStatus,
        tenantId: tenant.id,
      });
      return true;
    },
    [tenant?.id]
  );

  /**
   * Sync delivery status change to order
   */
  const syncDeliveryToOrder = useCallback(
    async (
      deliveryId: string,
      orderId: string,
      newDeliveryStatus: DeliveryStatus
    ): Promise<boolean> => {
      if (!mountedRef.current || !tenant?.id) {
        return false;
      }

      logger.debug('[DeliveryOrderSync] Syncing delivery status to order', {
        deliveryId,
        orderId,
        newDeliveryStatus,
        tenantId: tenant.id,
      });

      // Map delivery status to order status
      const mappedOrderStatus = mapDeliveryStatusToOrderStatus(newDeliveryStatus);

      if (!mappedOrderStatus) {
        logger.debug('[DeliveryOrderSync] No order status mapping for delivery status', {
          newDeliveryStatus,
        });
        return true; // Not a failure, just no mapping needed
      }

      const success = await updateOrderStatus(orderId, mappedOrderStatus);

      if (success) {
        // Publish order_updated event for other listeners
        publish('order_updated', {
          orderId,
          tenantId: tenant.id,
          status: mappedOrderStatus,
          changes: {
            previousStatus: undefined,
            syncSource: 'delivery',
            deliveryId,
          },
        });

        // Invalidate related queries
        queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(tenant.id, orderId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.orders.lists() });
        queryClient.invalidateQueries({ queryKey: queryKeys.deliveries.byOrder(tenant.id, orderId) });
      }

      return success;
    },
    [tenant?.id, updateOrderStatus, queryClient]
  );

  /**
   * Sync order cancellation to delivery
   */
  const syncOrderCancellationToDelivery = useCallback(
    async (orderId: string, reason?: string): Promise<boolean> => {
      if (!mountedRef.current || !tenant?.id) {
        return false;
      }

      logger.debug('[DeliveryOrderSync] Syncing order cancellation to delivery', {
        orderId,
        reason,
        tenantId: tenant.id,
      });

      const success = await updateDeliveryStatus(
        orderId,
        'cancelled',
        reason || 'Order was cancelled'
      );

      if (success) {
        // Publish delivery_status_changed event
        publish('delivery_status_changed', {
          deliveryId: '', // Will be filled by the actual delivery record
          orderId,
          tenantId: tenant.id,
          previousStatus: null,
          newStatus: 'cancelled',
          changedAt: new Date().toISOString(),
        });

        // Invalidate related queries
        queryClient.invalidateQueries({ queryKey: queryKeys.deliveries.byOrder(tenant.id, orderId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.deliveries.lists() });
      }

      return success;
    },
    [tenant?.id, updateDeliveryStatus, queryClient]
  );

  /**
   * Publish a delivery status change event
   */
  const publishDeliveryStatusChange = useCallback(
    (
      deliveryId: string,
      orderId: string,
      previousStatus: string | null,
      newStatus: string,
      runnerId?: string
    ) => {
      if (!tenant?.id) {
        logger.warn('[DeliveryOrderSync] Cannot publish - no tenant context');
        return;
      }

      logger.debug('[DeliveryOrderSync] Publishing delivery_status_changed event', {
        deliveryId,
        orderId,
        previousStatus,
        newStatus,
        runnerId,
      });

      publish('delivery_status_changed', {
        deliveryId,
        orderId,
        tenantId: tenant.id,
        previousStatus,
        newStatus,
        runnerId,
        changedAt: new Date().toISOString(),
      });
    },
    [tenant?.id]
  );

  /**
   * Publish an order cancelled event
   */
  const publishOrderCancelled = useCallback(
    (orderId: string, reason?: string) => {
      if (!tenant?.id) {
        logger.warn('[DeliveryOrderSync] Cannot publish - no tenant context');
        return;
      }

      logger.debug('[DeliveryOrderSync] Publishing order_cancelled event', {
        orderId,
        reason,
      });

      publish('order_cancelled', {
        orderId,
        tenantId: tenant.id,
        reason,
        cancelledAt: new Date().toISOString(),
      });
    },
    [tenant?.id]
  );

  /**
   * Handle delivery_status_changed events
   */
  const handleDeliveryStatusChanged = useCallback(
    async (payload: EventPayloads['delivery_status_changed']) => {
      if (!mountedRef.current || !tenant?.id) return;

      // Only process events for our tenant
      if (payload.tenantId !== tenant.id) {
        return;
      }

      // Skip if auto-sync is disabled
      if (!autoSyncOrderStatus) {
        logger.debug('[DeliveryOrderSync] Auto-sync disabled, skipping order update');
        return;
      }

      logger.debug('[DeliveryOrderSync] Handling delivery_status_changed event', {
        deliveryId: payload.deliveryId,
        orderId: payload.orderId,
        newStatus: payload.newStatus,
      });

      await syncDeliveryToOrder(
        payload.deliveryId,
        payload.orderId,
        payload.newStatus as DeliveryStatus
      );
    },
    [tenant?.id, autoSyncOrderStatus, syncDeliveryToOrder]
  );

  /**
   * Handle order_cancelled events
   */
  const handleOrderCancelled = useCallback(
    async (payload: EventPayloads['order_cancelled']) => {
      if (!mountedRef.current || !tenant?.id) return;

      // Only process events for our tenant
      if (payload.tenantId !== tenant.id) {
        return;
      }

      // Skip if auto-cancel is disabled
      if (!autoCancelDelivery) {
        logger.debug('[DeliveryOrderSync] Auto-cancel disabled, skipping delivery cancellation');
        return;
      }

      logger.debug('[DeliveryOrderSync] Handling order_cancelled event', {
        orderId: payload.orderId,
        reason: payload.reason,
      });

      await syncOrderCancellationToDelivery(payload.orderId, payload.reason);
    },
    [tenant?.id, autoCancelDelivery, syncOrderCancellationToDelivery]
  );

  // Set up event subscriptions
  useEffect(() => {
    mountedRef.current = true;

    if (!isActive) {
      logger.debug('[DeliveryOrderSync] Not active, skipping subscriptions', {
        enabled,
        hasTenantId: !!tenant?.id,
      });
      return;
    }

    logger.debug('[DeliveryOrderSync] Setting up event subscriptions', {
      tenantId: tenant?.id,
      autoSyncOrderStatus,
      autoCancelDelivery,
    });

    // Subscribe to events
    const unsubDeliveryStatus = subscribe(
      'delivery_status_changed',
      handleDeliveryStatusChanged
    );
    const unsubOrderCancelled = subscribe(
      'order_cancelled',
      handleOrderCancelled
    );

    // Cleanup on unmount
    return () => {
      mountedRef.current = false;
      logger.debug('[DeliveryOrderSync] Cleaning up subscriptions');
      unsubDeliveryStatus();
      unsubOrderCancelled();
    };
  }, [
    isActive,
    enabled,
    tenant?.id,
    autoSyncOrderStatus,
    autoCancelDelivery,
    handleDeliveryStatusChanged,
    handleOrderCancelled,
  ]);

  return {
    isActive,
    syncDeliveryToOrder,
    syncOrderCancellationToDelivery,
    publishDeliveryStatusChange,
    publishOrderCancelled,
  };
}

export default useDeliveryOrderSync;
