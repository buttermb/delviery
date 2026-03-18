/**
 * Event-Based Query Invalidation System
 *
 * Provides consistent cache invalidation patterns across the application.
 * When data changes ANYWHERE, it reflects EVERYWHERE that data is displayed.
 *
 * Usage:
 *   import { invalidateOnEvent } from '@/lib/invalidation';
 *
 *   // In mutation onSuccess:
 *   onSuccess: () => {
 *     invalidateOnEvent(queryClient, 'ORDER_CREATED', tenantId, { customerId: data.customer_id });
 *   }
 */

import { QueryClient } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';
import { logger } from './logger';

// Event types that trigger cross-panel invalidation
export type InvalidationEvent =
  | 'ORDER_CREATED'
  | 'ORDER_UPDATED'
  | 'ORDER_STATUS_CHANGED'
  | 'ORDER_DELETED'
  | 'POS_SALE_COMPLETED'
  | 'INVENTORY_ADJUSTED'
  | 'INVENTORY_TRANSFER_COMPLETED'
  | 'PRODUCT_CREATED'
  | 'PRODUCT_UPDATED'
  | 'PRODUCT_DELETED'
  | 'CUSTOMER_CREATED'
  | 'CUSTOMER_UPDATED'
  | 'CUSTOMER_DELETED'
  | 'PAYMENT_RECEIVED'
  | 'REFUND_PROCESSED'
  | 'MENU_PUBLISHED'
  | 'MENU_UPDATED'
  | 'MENU_BURNED'
  | 'DRIVER_ASSIGNED'
  | 'DELIVERY_STATUS_CHANGED'
  | 'INVOICE_CREATED'
  | 'INVOICE_PAID'
  | 'EXPENSE_CREATED'
  | 'EXPENSE_UPDATED'
  | 'EXPENSE_DELETED'
  | 'WHOLESALE_CLIENT_UPDATED'
  | 'WHOLESALE_ORDER_CREATED'
  | 'WHOLESALE_ORDER_UPDATED'
  | 'COURIER_STATUS_CHANGED'
  | 'SHIFT_STARTED'
  | 'SHIFT_ENDED'
  | 'STOREFRONT_ORDER';

// Metadata that can be passed with events for targeted invalidation
export interface InvalidationMetadata {
  customerId?: string;
  orderId?: string;
  productId?: string;
  invoiceId?: string;
  courierId?: string;
  menuId?: string;
  shiftId?: string;
  [key: string]: string | undefined;
}

/**
 * Invalidate queries based on an event type
 * This is the central function for cross-panel data synchronization
 */
export function invalidateOnEvent(
  queryClient: QueryClient,
  event: InvalidationEvent,
  tenantId: string,
  metadata?: InvalidationMetadata
): void {
  if (!tenantId) {
    logger.warn('invalidateOnEvent called without tenantId', { event });
    return;
  }

  logger.debug('Invalidating queries for event', { event, tenantId, metadata });

  const invalidations: Record<InvalidationEvent, () => void> = {
    // ============================================================================
    // ORDER EVENTS
    // ============================================================================

    ORDER_CREATED: () => {
      // Orders
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.liveOrders.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.pendingOrders.all });

      // Dashboard & Analytics
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.badgeCounts.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });

      // Customers
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });

      // Fulfillment
      queryClient.invalidateQueries({ queryKey: queryKeys.deliveries.all });

      // Customer detail (if provided)
      if (metadata?.customerId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.customers.detail(tenantId, metadata.customerId),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.customers.stats(tenantId, metadata.customerId),
        });
      }
    },

    ORDER_UPDATED: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.liveOrders.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });

      if (metadata?.orderId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.orders.detail(tenantId, metadata.orderId),
        });
      }
    },

    ORDER_STATUS_CHANGED: () => {
      // Orders - all views
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.liveOrders.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.pendingOrders.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.orderKanban.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.orderPipeline.all });

      // Dashboard
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.badgeCounts.all });

      // Fulfillment
      queryClient.invalidateQueries({ queryKey: queryKeys.fulfillment.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.deliveries.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.fulfillmentQueue.all });

      // Analytics
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });

      // Customers
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });

      // Customer detail (if provided)
      if (metadata?.customerId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.customers.detail(tenantId, metadata.customerId),
        });
      }
    },

    ORDER_DELETED: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.badgeCounts.all });
    },

    // ============================================================================
    // POS EVENTS (Most Critical - Affects Everything)
    // ============================================================================

    POS_SALE_COMPLETED: () => {
      // Orders
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.liveOrders.all });

      // Inventory - stock levels changed
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.stockAlerts.all });

      // Finance
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.payments.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.financeSummary.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.revenueToday.all });

      // Customers
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });

      // Dashboard
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.badgeCounts.all });

      // Analytics
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });

      // POS specific
      queryClient.invalidateQueries({ queryKey: queryKeys.pos.all });

      // Customer (if provided)
      if (metadata?.customerId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.customers.detail(tenantId, metadata.customerId),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.customers.stats(tenantId, metadata.customerId),
        });
      }

      // Shift (if active)
      if (metadata?.shiftId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.pos.shifts.detail(metadata.shiftId),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.pos.shifts.transactions(metadata.shiftId),
        });
      }
    },

    // ============================================================================
    // INVENTORY EVENTS
    // ============================================================================

    INVENTORY_ADJUSTED: () => {
      // Inventory
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.stockAlerts.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.inventoryValuation.all });

      // Products
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });

      // Dashboard
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats.all });

      // Storefront (availability)
      queryClient.invalidateQueries({ queryKey: queryKeys.storefront.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.shopProducts.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.menus.all });

      // POS
      queryClient.invalidateQueries({ queryKey: queryKeys.pos.products(tenantId) });

      // Analytics
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });

      // Specific product
      if (metadata?.productId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.products.detail(tenantId, metadata.productId),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.inventory.movements(metadata.productId),
        });
      }
    },

    INVENTORY_TRANSFER_COMPLETED: () => {
      // Inventory (both locations affected)
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.transfers() });
      queryClient.invalidateQueries({ queryKey: queryKeys.stockAlerts.all });

      // Dashboard
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });

      // Analytics
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });
    },

    // ============================================================================
    // PRODUCT EVENTS
    // ============================================================================

    PRODUCT_CREATED: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.shopProducts.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.storefront.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.pos.products(tenantId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.menus.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },

    PRODUCT_UPDATED: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.shopProducts.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.storefront.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.pos.products(tenantId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.menus.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });

      if (metadata?.productId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.products.detail(tenantId, metadata.productId),
        });
      }
    },

    PRODUCT_DELETED: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.shopProducts.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.pos.products(tenantId) });
    },

    // ============================================================================
    // CUSTOMER EVENTS
    // ============================================================================

    CUSTOMER_CREATED: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.clients.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.customers() });
    },

    CUSTOMER_UPDATED: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.clients.all() });

      if (metadata?.customerId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.customers.detail(tenantId, metadata.customerId),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.crm.clients.detail(metadata.customerId),
        });
      }
    },

    CUSTOMER_DELETED: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.clients.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.customers() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats.all });
    },

    // ============================================================================
    // PAYMENT & FINANCE EVENTS
    // ============================================================================

    PAYMENT_RECEIVED: () => {
      // Finance
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.payments.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.financeSummary.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.revenueToday.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.accountsReceivable.all });

      // Orders
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });

      // Customers
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });

      // CRM
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.invoices.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.collections.all });

      // Dashboard
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats.all });

      // Analytics
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });

      // Customer detail (if provided)
      if (metadata?.customerId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.customers.detail(tenantId, metadata.customerId),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.payments.byClient(tenantId, metadata.customerId),
        });
      }
    },

    REFUND_PROCESSED: () => {
      // Finance - negative revenue
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.payments.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.financeSummary.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.revenueToday.all });

      // Orders
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.returns.all });

      // Inventory - stock returned
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.stockAlerts.all });

      // Customer
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });

      // Dashboard
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats.all });

      // Analytics
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });
    },

    // ============================================================================
    // MENU & STOREFRONT EVENTS
    // ============================================================================

    MENU_PUBLISHED: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.menus.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.shopProducts.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.storefrontSettings.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });
    },

    MENU_UPDATED: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.menus.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.shopProducts.all });

      if (metadata?.menuId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.menus.detail(tenantId, metadata.menuId),
        });
      }
    },

    MENU_BURNED: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.menus.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.shopProducts.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });

      if (metadata?.menuId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.menus.detail(tenantId, metadata.menuId),
        });
      }
    },

    STOREFRONT_ORDER: () => {
      // Storefront
      queryClient.invalidateQueries({ queryKey: queryKeys.storefront.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.storefront.liveOrders(tenantId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.shopProducts.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.storefrontSettings.all });

      // Orders
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.liveOrders.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.pendingOrders.all });

      // Inventory - stock decremented
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.stockAlerts.all });

      // Dashboard
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.badgeCounts.all });

      // Analytics
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });
    },

    // ============================================================================
    // DELIVERY & FULFILLMENT EVENTS
    // ============================================================================

    DRIVER_ASSIGNED: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.fulfillment.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.deliveries.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.liveOrders.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.fulfillmentQueue.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.couriers.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });

      if (metadata?.courierId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.couriers.detail(metadata.courierId),
        });
      }
    },

    DELIVERY_STATUS_CHANGED: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.deliveries.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.liveOrders.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.deliveryMap.all });
    },

    // ============================================================================
    // INVOICE & B2B EVENTS
    // ============================================================================

    INVOICE_CREATED: () => {
      // Finance
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.financeSummary.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.revenueToday.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.invoices.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.customerInvoices.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.collections.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.accountsReceivable.all });

      // Customers
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });

      // Dashboard
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.badgeCounts.all });

      if (metadata?.customerId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.crm.invoices.byClient(metadata.customerId),
        });
      }
    },

    INVOICE_PAID: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.invoices.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.payments.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.collections.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.accountsReceivable.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.revenue() });

      if (metadata?.invoiceId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.crm.invoices.detail(metadata.invoiceId),
        });
      }
    },

    EXPENSE_CREATED: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses.byTenant(tenantId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.financeSummary.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.revenueReports.byTenant(tenantId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.taxManagement.summary(tenantId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });
    },

    EXPENSE_UPDATED: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses.byTenant(tenantId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.financeSummary.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.revenueReports.byTenant(tenantId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.taxManagement.summary(tenantId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });
    },

    EXPENSE_DELETED: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses.byTenant(tenantId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.financeSummary.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.revenueReports.byTenant(tenantId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.taxManagement.summary(tenantId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });
    },

    WHOLESALE_CLIENT_UPDATED: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.wholesaleClients.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.clients.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.customers() });

      if (metadata?.customerId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.wholesaleClients.detail(metadata.customerId),
        });
      }
    },

    WHOLESALE_ORDER_CREATED: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.wholesaleOrders.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.preOrders.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.badgeCounts.all });
    },

    WHOLESALE_ORDER_UPDATED: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.wholesaleOrders.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.preOrders.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
    },

    // ============================================================================
    // COURIER EVENTS
    // ============================================================================

    COURIER_STATUS_CHANGED: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.couriers.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.deliveries.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.fulfillmentQueue.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.deliveryMap.all });

      if (metadata?.courierId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.couriers.detail(metadata.courierId),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.couriers.location(metadata.courierId),
        });
      }
    },

    // ============================================================================
    // POS SHIFT EVENTS
    // ============================================================================

    SHIFT_STARTED: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pos.shifts.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.pos.shifts.active(tenantId) });
    },

    SHIFT_ENDED: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pos.shifts.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.pos.shifts.active(tenantId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.pos.shifts.recent(tenantId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.financeSummary.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });
    },

    // (MENU_BURNED and STOREFRONT_ORDER handlers are defined above in the
    //  MENU & STOREFRONT EVENTS section to avoid duplicate property keys)
  };

  try {
    invalidations[event]();
  } catch (error) {
    logger.error('Error during query invalidation', error as Error, { event, tenantId });
  }
}

/**
 * Batch invalidate multiple events at once
 * Useful after complex operations that affect multiple domains
 */
export function invalidateMultipleEvents(
  queryClient: QueryClient,
  events: Array<{ event: InvalidationEvent; metadata?: InvalidationMetadata }>,
  tenantId: string
): void {
  events.forEach(({ event, metadata }) => {
    invalidateOnEvent(queryClient, event, tenantId, metadata);
  });
}

/**
 * Invalidate all data for a tenant (use sparingly - expensive operation)
 * Useful after major operations like data import
 */
export function invalidateAllTenantData(
  queryClient: QueryClient,
  tenantId: string
): void {
  logger.info('Invalidating all tenant data', { tenantId });

  queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.payments.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.deliveries.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.fulfillment.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.couriers.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.menus.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.crm.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.pos.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.wholesaleOrders.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.storefront.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.stockAlerts.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.vendors.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.badgeCounts.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats.all });
}
