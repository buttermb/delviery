/**
 * Bridge between eventBus and query invalidation system
 *
 * When eventBus fires domain events (product_updated, price_changed, etc.),
 * this bridge also triggers the corresponding invalidateOnEvent() call
 * so that ALL panels refresh — not just eventBus subscribers.
 *
 * Usage: call initEventBusInvalidationBridge(queryClient, tenantId) once
 * from the admin layout or app root. Call the returned cleanup function
 * on unmount.
 */

import { QueryClient } from '@tanstack/react-query';

import { eventBus } from '@/lib/eventBus';
import { invalidateOnEvent } from '@/lib/invalidation';
import { logger } from '@/lib/logger';

export function initEventBusInvalidationBridge(
  queryClient: QueryClient,
  tenantId: string,
): () => void {
  const unsubscribers: Array<() => void> = [];

  // product_updated → PRODUCT_UPDATED
  unsubscribers.push(
    eventBus.subscribe('product_updated', (payload) => {
      logger.debug('[EventBridge] product_updated → PRODUCT_UPDATED', { productId: payload.productId });
      invalidateOnEvent(queryClient, 'PRODUCT_UPDATED', payload.tenantId || tenantId, {
        productId: payload.productId,
      });
    }),
  );

  // price_changed → PRODUCT_UPDATED (price is a product attribute)
  unsubscribers.push(
    eventBus.subscribe('price_changed', (payload) => {
      logger.debug('[EventBridge] price_changed → PRODUCT_UPDATED', { productId: payload.productId });
      invalidateOnEvent(queryClient, 'PRODUCT_UPDATED', payload.tenantId || tenantId, {
        productId: payload.productId,
      });
    }),
  );

  // inventory_changed → INVENTORY_ADJUSTED
  unsubscribers.push(
    eventBus.subscribe('inventory_changed', (payload) => {
      logger.debug('[EventBridge] inventory_changed → INVENTORY_ADJUSTED', { productId: payload.productId });
      invalidateOnEvent(queryClient, 'INVENTORY_ADJUSTED', payload.tenantId || tenantId, {
        productId: payload.productId,
      });
    }),
  );

  // order_created → ORDER_CREATED
  unsubscribers.push(
    eventBus.subscribe('order_created', (payload) => {
      logger.debug('[EventBridge] order_created → ORDER_CREATED', { orderId: payload.orderId });
      invalidateOnEvent(queryClient, 'ORDER_CREATED', payload.tenantId || tenantId, {
        orderId: payload.orderId,
        customerId: payload.customerId,
      });
    }),
  );

  // order_updated → ORDER_UPDATED
  unsubscribers.push(
    eventBus.subscribe('order_updated', (payload) => {
      logger.debug('[EventBridge] order_updated → ORDER_UPDATED', { orderId: payload.orderId });
      invalidateOnEvent(queryClient, 'ORDER_UPDATED', payload.tenantId || tenantId, {
        orderId: payload.orderId,
      });
    }),
  );

  // order_completed → ORDER_STATUS_CHANGED + PAYMENT_RECEIVED
  unsubscribers.push(
    eventBus.subscribe('order_completed', (payload) => {
      logger.debug('[EventBridge] order_completed → ORDER_STATUS_CHANGED', { orderId: payload.orderId });
      invalidateOnEvent(queryClient, 'ORDER_STATUS_CHANGED', payload.tenantId || tenantId, {
        orderId: payload.orderId,
        customerId: payload.customerId,
      });
      invalidateOnEvent(queryClient, 'PAYMENT_RECEIVED', payload.tenantId || tenantId, {
        orderId: payload.orderId,
        customerId: payload.customerId,
      });
    }),
  );

  // order_cancelled → ORDER_STATUS_CHANGED
  unsubscribers.push(
    eventBus.subscribe('order_cancelled', (payload) => {
      logger.debug('[EventBridge] order_cancelled → ORDER_STATUS_CHANGED', { orderId: payload.orderId });
      invalidateOnEvent(queryClient, 'ORDER_STATUS_CHANGED', payload.tenantId || tenantId, {
        orderId: payload.orderId,
      });
    }),
  );

  // customer_updated → CUSTOMER_UPDATED
  unsubscribers.push(
    eventBus.subscribe('customer_updated', (payload) => {
      logger.debug('[EventBridge] customer_updated → CUSTOMER_UPDATED', { customerId: payload.customerId });
      invalidateOnEvent(queryClient, 'CUSTOMER_UPDATED', payload.tenantId || tenantId, {
        customerId: payload.customerId,
      });
    }),
  );

  // menu_published → MENU_PUBLISHED
  unsubscribers.push(
    eventBus.subscribe('menu_published', (payload) => {
      logger.debug('[EventBridge] menu_published → MENU_PUBLISHED', { menuId: payload.menuId });
      invalidateOnEvent(queryClient, 'MENU_PUBLISHED', payload.tenantId || tenantId, {
        menuId: payload.menuId,
      });
    }),
  );

  // menu_order_created → STOREFRONT_ORDER
  unsubscribers.push(
    eventBus.subscribe('menu_order_created', (payload) => {
      logger.debug('[EventBridge] menu_order_created → STOREFRONT_ORDER', { orderId: payload.orderId });
      invalidateOnEvent(queryClient, 'STOREFRONT_ORDER', payload.tenantId || tenantId, {
        orderId: payload.orderId,
      });
    }),
  );

  // menu_product_hidden → INVENTORY_ADJUSTED
  unsubscribers.push(
    eventBus.subscribe('menu_product_hidden', (payload) => {
      logger.debug('[EventBridge] menu_product_hidden → INVENTORY_ADJUSTED', { productId: payload.productId });
      invalidateOnEvent(queryClient, 'INVENTORY_ADJUSTED', payload.tenantId || tenantId, {
        productId: payload.productId,
        menuId: payload.menuId,
      });
    }),
  );

  // menu_product_restored → INVENTORY_ADJUSTED
  unsubscribers.push(
    eventBus.subscribe('menu_product_restored', (payload) => {
      logger.debug('[EventBridge] menu_product_restored → INVENTORY_ADJUSTED', { productId: payload.productId });
      invalidateOnEvent(queryClient, 'INVENTORY_ADJUSTED', payload.tenantId || tenantId, {
        productId: payload.productId,
        menuId: payload.menuId,
      });
    }),
  );

  // menu_archived → MENU_BURNED
  unsubscribers.push(
    eventBus.subscribe('menu_archived', (payload) => {
      logger.debug('[EventBridge] menu_archived → MENU_BURNED', { menuId: payload.menuId });
      invalidateOnEvent(queryClient, 'MENU_BURNED', payload.tenantId || tenantId, {
        menuId: payload.menuId,
      });
    }),
  );

  // menu_reactivated → MENU_PUBLISHED
  unsubscribers.push(
    eventBus.subscribe('menu_reactivated', (payload) => {
      logger.debug('[EventBridge] menu_reactivated → MENU_PUBLISHED', { menuId: payload.menuId });
      invalidateOnEvent(queryClient, 'MENU_PUBLISHED', payload.tenantId || tenantId, {
        menuId: payload.menuId,
      });
    }),
  );

  // storefront_synced → MENU_UPDATED
  unsubscribers.push(
    eventBus.subscribe('storefront_synced', (payload) => {
      logger.debug('[EventBridge] storefront_synced → MENU_UPDATED', { storefrontId: payload.storefrontId });
      invalidateOnEvent(queryClient, 'MENU_UPDATED', payload.tenantId || tenantId);
    }),
  );

  // delivery_status_changed → DELIVERY_STATUS_CHANGED
  unsubscribers.push(
    eventBus.subscribe('delivery_status_changed', (payload) => {
      logger.debug('[EventBridge] delivery_status_changed → DELIVERY_STATUS_CHANGED', { deliveryId: payload.deliveryId });
      invalidateOnEvent(queryClient, 'DELIVERY_STATUS_CHANGED', payload.tenantId || tenantId, {
        orderId: payload.orderId,
        courierId: payload.runnerId,
      });
    }),
  );

  logger.info('[EventBridge] Initialized eventBus ↔ invalidation bridge');

  return () => {
    unsubscribers.forEach((unsub) => unsub());
    logger.info('[EventBridge] Cleaned up eventBus ↔ invalidation bridge');
  };
}
