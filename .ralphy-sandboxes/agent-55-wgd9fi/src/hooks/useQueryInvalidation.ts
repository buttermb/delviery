/**
 * Centralized TanStack Query invalidation hook
 * Provides methods to invalidate related queries across modules
 * Use this hook instead of manual queryClient.invalidateQueries calls
 */

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';

/**
 * Hook that centralizes TanStack Query invalidation logic
 * Handles cross-module query invalidation to keep data consistent
 */
export function useQueryInvalidation() {
  const queryClient = useQueryClient();

  /**
   * Invalidate order-related queries including related entities
   */
  const invalidateOrder = useCallback(
    async (tenantId: string, orderId: string) => {
      logger.debug('[useQueryInvalidation] Invalidating order queries', { tenantId, orderId });

      await Promise.all([
        // Order detail and list
        queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(tenantId, orderId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.orders.lists() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.orders.byTenant(tenantId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.orders.kanban(tenantId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.orders.pipeline(tenantId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.orders.live(tenantId) }),

        // Dashboard stats affected by orders
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats(tenantId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.recentOrders(tenantId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.ordersByStatus(tenantId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.activity(tenantId) }),

        // Analytics affected by orders
        queryClient.invalidateQueries({ queryKey: queryKeys.analytics.orders(tenantId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.analytics.revenue(tenantId) }),

        // Finance affected by orders
        queryClient.invalidateQueries({ queryKey: queryKeys.finance.completedOrders(tenantId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.finance.revenue(tenantId) }),

        // Inventory may be affected by order status changes
        queryClient.invalidateQueries({ queryKey: queryKeys.inventory.byTenant(tenantId) }),

        // Order audit log
        queryClient.invalidateQueries({ queryKey: queryKeys.orderAuditLog.byOrder(orderId) }),
      ]);
    },
    [queryClient]
  );

  /**
   * Invalidate order list queries (without specific order detail)
   */
  const invalidateOrderList = useCallback(
    async (tenantId: string) => {
      logger.debug('[useQueryInvalidation] Invalidating order list queries', { tenantId });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.orders.lists() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.orders.byTenant(tenantId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.orders.kanban(tenantId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.orders.pipeline(tenantId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.orders.live(tenantId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.recentOrders(tenantId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.ordersByStatus(tenantId) }),
      ]);
    },
    [queryClient]
  );

  /**
   * Invalidate product-related queries including related entities
   */
  const invalidateProduct = useCallback(
    async (tenantId: string, productId: string) => {
      logger.debug('[useQueryInvalidation] Invalidating product queries', { tenantId, productId });

      await Promise.all([
        // Product detail and list
        queryClient.invalidateQueries({ queryKey: queryKeys.products.detail(tenantId, productId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.products.lists() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.products.byTenant(tenantId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.products.related(tenantId, productId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.products.posGrid(tenantId) }),

        // Inventory related to product
        queryClient.invalidateQueries({ queryKey: queryKeys.inventory.byTenant(tenantId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.inventory.movements(productId) }),

        // Dashboard stats
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.topProducts(tenantId) }),

        // Analytics
        queryClient.invalidateQueries({ queryKey: queryKeys.analytics.products(tenantId) }),

        // Stock alerts
        queryClient.invalidateQueries({ queryKey: queryKeys.stockAlerts.byProduct(productId) }),
      ]);
    },
    [queryClient]
  );

  /**
   * Invalidate product list queries (without specific product detail)
   */
  const invalidateProductList = useCallback(
    async (tenantId: string) => {
      logger.debug('[useQueryInvalidation] Invalidating product list queries', { tenantId });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.products.lists() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.products.byTenant(tenantId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.products.posGrid(tenantId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.topProducts(tenantId) }),
      ]);
    },
    [queryClient]
  );

  /**
   * Invalidate inventory-related queries
   */
  const invalidateInventory = useCallback(
    async (tenantId: string, inventoryId?: string) => {
      logger.debug('[useQueryInvalidation] Invalidating inventory queries', { tenantId, inventoryId });

      const invalidations = [
        queryClient.invalidateQueries({ queryKey: queryKeys.inventory.lists() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.inventory.byTenant(tenantId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.inventory.alerts() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.inventory.lowStockAlerts(tenantId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.inventory.summary(tenantId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.inventory.transfers(tenantId) }),

        // Dashboard alerts may show low stock
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.alerts(tenantId) }),

        // Stock alerts
        queryClient.invalidateQueries({ queryKey: queryKeys.stockAlerts.active(tenantId) }),
      ];

      if (inventoryId) {
        invalidations.push(
          queryClient.invalidateQueries({ queryKey: queryKeys.inventory.detail(tenantId, inventoryId) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.inventory.related(tenantId, inventoryId) })
        );
      }

      await Promise.all(invalidations);
    },
    [queryClient]
  );

  /**
   * Invalidate customer-related queries
   */
  const invalidateCustomer = useCallback(
    async (tenantId: string, customerId: string) => {
      logger.debug('[useQueryInvalidation] Invalidating customer queries', { tenantId, customerId });

      await Promise.all([
        // Customer detail and list
        queryClient.invalidateQueries({ queryKey: queryKeys.customers.detail(tenantId, customerId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.customers.lists() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.customers.byTenant(tenantId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.customers.related(tenantId, customerId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.customers.analytics(tenantId, customerId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.customers.stats(tenantId, customerId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.customers.dropdown(tenantId) }),

        // CRM related
        queryClient.invalidateQueries({ queryKey: queryKeys.crm.clients.all() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.crm.activity.byClient(customerId) }),

        // Customer tags
        queryClient.invalidateQueries({ queryKey: queryKeys.customerTags.byContact(customerId) }),

        // Analytics
        queryClient.invalidateQueries({ queryKey: queryKeys.analytics.customers(tenantId) }),

        // Dashboard stats
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats(tenantId) }),
      ]);
    },
    [queryClient]
  );

  /**
   * Invalidate customer list queries (without specific customer detail)
   */
  const invalidateCustomerList = useCallback(
    async (tenantId: string) => {
      logger.debug('[useQueryInvalidation] Invalidating customer list queries', { tenantId });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.customers.lists() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.customers.byTenant(tenantId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.customers.dropdown(tenantId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.crm.clients.all() }),
      ]);
    },
    [queryClient]
  );

  /**
   * Invalidate vendor-related queries
   */
  const invalidateVendor = useCallback(
    async (tenantId: string, vendorId: string) => {
      logger.debug('[useQueryInvalidation] Invalidating vendor queries', { tenantId, vendorId });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.vendors.detail(tenantId, vendorId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.vendors.lists() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.vendors.byTenant(tenantId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.vendors.related(tenantId, vendorId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.vendors.orders(tenantId, vendorId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.vendors.products(tenantId, vendorId) }),
      ]);
    },
    [queryClient]
  );

  /**
   * Invalidate vendor list queries
   */
  const invalidateVendorList = useCallback(
    async (tenantId: string) => {
      logger.debug('[useQueryInvalidation] Invalidating vendor list queries', { tenantId });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.vendors.lists() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.vendors.byTenant(tenantId) }),
      ]);
    },
    [queryClient]
  );

  /**
   * Invalidate menu-related queries
   */
  const invalidateMenu = useCallback(
    async (tenantId: string, menuId: string) => {
      logger.debug('[useQueryInvalidation] Invalidating menu queries', { tenantId, menuId });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.menus.detail(tenantId, menuId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.menus.lists() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.menus.byTenant(tenantId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.menus.related(tenantId, menuId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.menus.analytics(tenantId, menuId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.menus.products(tenantId, menuId) }),
      ]);
    },
    [queryClient]
  );

  /**
   * Invalidate menu list queries
   */
  const invalidateMenuList = useCallback(
    async (tenantId: string) => {
      logger.debug('[useQueryInvalidation] Invalidating menu list queries', { tenantId });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.menus.lists() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.menus.byTenant(tenantId) }),
      ]);
    },
    [queryClient]
  );

  /**
   * Invalidate storefront-related queries
   */
  const invalidateStorefront = useCallback(
    async (tenantId: string, storeId?: string) => {
      logger.debug('[useQueryInvalidation] Invalidating storefront queries', { tenantId, storeId });

      const invalidations = [
        queryClient.invalidateQueries({ queryKey: queryKeys.storefront.lists() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.storefront.byTenant(tenantId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.storefront.config(tenantId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.storefront.liveOrders(tenantId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.storefrontSettings.byTenant(tenantId) }),
      ];

      if (storeId) {
        invalidations.push(
          queryClient.invalidateQueries({ queryKey: queryKeys.storefront.detail(tenantId, storeId) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.storefront.related(tenantId, storeId) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.storefront.products(tenantId, storeId) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.storefront.categories(tenantId, storeId) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.storefront.banners(storeId) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.storefront.deals(storeId) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.storefrontSettings.detail(storeId) })
        );
      }

      await Promise.all(invalidations);
    },
    [queryClient]
  );

  /**
   * Invalidate analytics queries
   */
  const invalidateAnalytics = useCallback(
    async (tenantId: string) => {
      logger.debug('[useQueryInvalidation] Invalidating analytics queries', { tenantId });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.analytics.byTenant(tenantId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.analytics.overview(tenantId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.analytics.revenue(tenantId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.analytics.orders(tenantId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.analytics.customers(tenantId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.analytics.products(tenantId) }),
      ]);
    },
    [queryClient]
  );

  /**
   * Invalidate notification queries
   */
  const invalidateNotifications = useCallback(
    async (tenantId: string, userId?: string) => {
      logger.debug('[useQueryInvalidation] Invalidating notification queries', { tenantId, userId });

      const invalidations = [
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications.lists() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications.byTenant(tenantId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unread(tenantId) }),
      ];

      if (userId) {
        invalidations.push(
          queryClient.invalidateQueries({ queryKey: queryKeys.notifications.byUser(tenantId, userId) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.notifications.preferences(tenantId, userId) })
        );
      }

      await Promise.all(invalidations);
    },
    [queryClient]
  );

  /**
   * Invalidate message queries
   */
  const invalidateMessages = useCallback(
    async (tenantId: string, threadId?: string) => {
      logger.debug('[useQueryInvalidation] Invalidating message queries', { tenantId, threadId });

      const invalidations = [
        queryClient.invalidateQueries({ queryKey: queryKeys.messages.lists() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.messages.byTenant(tenantId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.messages.threads(tenantId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.messages.unread(tenantId) }),
      ];

      if (threadId) {
        invalidations.push(
          queryClient.invalidateQueries({ queryKey: queryKeys.messages.thread(tenantId, threadId) })
        );
      }

      await Promise.all(invalidations);
    },
    [queryClient]
  );

  /**
   * Invalidate delivery queries
   */
  const invalidateDelivery = useCallback(
    async (tenantId: string, deliveryId?: string) => {
      logger.debug('[useQueryInvalidation] Invalidating delivery queries', { tenantId, deliveryId });

      const invalidations = [
        queryClient.invalidateQueries({ queryKey: queryKeys.deliveries.lists() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.deliveries.byTenant(tenantId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.deliveries.active(tenantId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.fulfillment.activeDeliveries(tenantId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.fulfillment.queue(tenantId) }),
      ];

      if (deliveryId) {
        invalidations.push(
          queryClient.invalidateQueries({ queryKey: queryKeys.deliveries.detail(tenantId, deliveryId) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.deliveries.related(tenantId, deliveryId) })
        );
      }

      await Promise.all(invalidations);
    },
    [queryClient]
  );

  /**
   * Invalidate compliance queries
   */
  const invalidateCompliance = useCallback(
    async (tenantId: string, complianceId?: string) => {
      logger.debug('[useQueryInvalidation] Invalidating compliance queries', { tenantId, complianceId });

      const invalidations = [
        queryClient.invalidateQueries({ queryKey: queryKeys.compliance.lists() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.compliance.byTenant(tenantId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.compliance.documents(tenantId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.compliance.audits(tenantId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.compliance.licenses(tenantId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.compliance.reports(tenantId) }),
      ];

      if (complianceId) {
        invalidations.push(
          queryClient.invalidateQueries({ queryKey: queryKeys.compliance.detail(tenantId, complianceId) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.compliance.related(tenantId, complianceId) })
        );
      }

      await Promise.all(invalidations);
    },
    [queryClient]
  );

  /**
   * Invalidate payment queries
   */
  const invalidatePayments = useCallback(
    async (tenantId: string, paymentId?: string) => {
      logger.debug('[useQueryInvalidation] Invalidating payment queries', { tenantId, paymentId });

      const invalidations = [
        queryClient.invalidateQueries({ queryKey: queryKeys.payments.lists() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.payments.byTenant(tenantId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.payments.pending(tenantId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.payments.refunds(tenantId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.finance.payments(tenantId) }),
      ];

      if (paymentId) {
        invalidations.push(
          queryClient.invalidateQueries({ queryKey: queryKeys.payments.detail(tenantId, paymentId) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.payments.related(tenantId, paymentId) })
        );
      }

      await Promise.all(invalidations);
    },
    [queryClient]
  );

  /**
   * Invalidate dashboard queries
   */
  const invalidateDashboard = useCallback(
    async (tenantId: string) => {
      logger.debug('[useQueryInvalidation] Invalidating dashboard queries', { tenantId });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats(tenantId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.recentOrders(tenantId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.alerts(tenantId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.activity(tenantId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.revenueChart(tenantId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.ordersByStatus(tenantId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.topProducts(tenantId) }),
      ]);
    },
    [queryClient]
  );

  /**
   * Invalidate all queries for a tenant
   * Use sparingly as this is expensive
   */
  const invalidateAll = useCallback(
    async (tenantId: string) => {
      logger.debug('[useQueryInvalidation] Invalidating all tenant queries', { tenantId });

      await Promise.all([
        invalidateOrderList(tenantId),
        invalidateProductList(tenantId),
        invalidateInventory(tenantId),
        invalidateCustomerList(tenantId),
        invalidateVendorList(tenantId),
        invalidateMenuList(tenantId),
        invalidateStorefront(tenantId),
        invalidateAnalytics(tenantId),
        invalidateDashboard(tenantId),
      ]);
    },
    [
      invalidateOrderList,
      invalidateProductList,
      invalidateInventory,
      invalidateCustomerList,
      invalidateVendorList,
      invalidateMenuList,
      invalidateStorefront,
      invalidateAnalytics,
      invalidateDashboard,
    ]
  );

  /**
   * Invalidate sidebar badge counts
   */
  const invalidateSidebarBadges = useCallback(
    async (tenantId: string) => {
      logger.debug('[useQueryInvalidation] Invalidating sidebar badge counts', { tenantId });

      await queryClient.invalidateQueries({ queryKey: queryKeys.sidebarBadges.counts(tenantId) });
    },
    [queryClient]
  );

  /**
   * Invalidate team queries
   */
  const invalidateTeam = useCallback(
    async (tenantId: string) => {
      logger.debug('[useQueryInvalidation] Invalidating team queries', { tenantId });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.team.members(tenantId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.team.invitations(tenantId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.team.activity(tenantId) }),
      ]);
    },
    [queryClient]
  );

  /**
   * Invalidate activity feed queries
   */
  const invalidateActivityFeed = useCallback(
    async (tenantId: string) => {
      logger.debug('[useQueryInvalidation] Invalidating activity feed queries', { tenantId });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.activityFeed.lists() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.activityFeed.byTenant(tenantId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.activity(tenantId) }),
      ]);
    },
    [queryClient]
  );

  return {
    // Order invalidation
    invalidateOrder,
    invalidateOrderList,

    // Product invalidation
    invalidateProduct,
    invalidateProductList,

    // Inventory invalidation
    invalidateInventory,

    // Customer invalidation
    invalidateCustomer,
    invalidateCustomerList,

    // Vendor invalidation
    invalidateVendor,
    invalidateVendorList,

    // Menu invalidation
    invalidateMenu,
    invalidateMenuList,

    // Storefront invalidation
    invalidateStorefront,

    // Analytics invalidation
    invalidateAnalytics,

    // Notification invalidation
    invalidateNotifications,

    // Message invalidation
    invalidateMessages,

    // Delivery invalidation
    invalidateDelivery,

    // Compliance invalidation
    invalidateCompliance,

    // Payment invalidation
    invalidatePayments,

    // Dashboard invalidation
    invalidateDashboard,

    // Team invalidation
    invalidateTeam,

    // Activity feed invalidation
    invalidateActivityFeed,

    // Sidebar badge invalidation
    invalidateSidebarBadges,

    // Full tenant invalidation
    invalidateAll,

    // Direct access to queryClient for edge cases
    queryClient,
  };
}

export default useQueryInvalidation;
