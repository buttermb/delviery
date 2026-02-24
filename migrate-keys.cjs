const fs = require('fs');
const path = require('path');

const rules = [
  // Most specific patterns first to avoid partial replacements
  // Credits
  ["['credits', 'recent-transactions', tenantId]", "queryKeys.creditWidgets.recentTransactions(tenantId)"],
  ["['credits', tenantId]", "queryKeys.credits.balance(tenantId)"],
  ["['credits', tenant?.id]", "queryKeys.credits.balance(tenant?.id)"],
  ["['credits']", "queryKeys.credits.all"],

  // Webhooks
  ["['webhook-logs', tenantId, webhookId, limit]", "queryKeys.webhooks.logs(tenantId, webhookId, limit)"],
  ["['integration-webhooks', tenantId, integrationId]", "queryKeys.integrationWebhooks.byIntegration(tenantId, integrationId)"],
  ["['webhooks', tenant?.id]", "queryKeys.webhooks.byTenant(tenant?.id)"],
  ["['webhooks', tenantId]", "queryKeys.webhooks.byTenant(tenantId)"],

  // Home
  ["['quick-stats']", "queryKeys.home.quickStats()"],
  ["['home-reviews', page]", "queryKeys.home.reviews(page)"],
  ["['home-reviews']", "queryKeys.home.reviews()"],

  // Mobile Dashboard
  ["['mobile-dashboard-kpi', tenantId]", "queryKeys.mobileDashboard.kpi(tenantId)"],
  ["['mobile-dashboard-low-stock', tenantId]", "queryKeys.mobileDashboard.lowStock(tenantId)"],
  ["['mobile-dashboard']", "queryKeys.mobileDashboard.all"],

  // Reviews
  ["['product-reviews', storeId, productId]", "queryKeys.reviews.byStoreProduct(storeId, productId)"],
  ["['product-reviews', productId]", "queryKeys.reviews.byProduct(productId)"],
  ["['reviews', tenantId, storeId, statusFilter, ratingFilter]", "queryKeys.reviews.list(tenantId, storeId, statusFilter, ratingFilter)"],
  ["['reviews']", "queryKeys.reviews.all"],

  // Custom Reports
  ["['custom-reports', tenantId]", "queryKeys.customReports.byTenant(tenantId)"],

  // Tenant Admin Widgets
  ["['storefront-performance', tenantId]", "queryKeys.tenantWidgets.storefrontPerformance(tenantId)"],
  ["['smart-notifications', tenantId, readNotificationIds.length]", "queryKeys.tenantWidgets.smartNotifications(tenantId, readNotificationIds.length)"],
  ["['revenue-forecast', tenantId]", "queryKeys.tenantWidgets.revenueForecast(tenantId)"],
  ["['realtime-sales', tenantId]", "queryKeys.tenantWidgets.realtimeSales(tenantId)"],
  ["['realtime-sales']", "queryKeys.tenantWidgets.realtimeSales()"],
  ["['quick-actions-counts', tenantId]", "queryKeys.tenantWidgets.quickActionsCounts(tenantId)"],
  ["['pipeline-orders', tenantId]", "queryKeys.tenantWidgets.pipelineOrders(tenantId)"],
  ["['pipeline-orders']", "queryKeys.tenantWidgets.pipelineOrders()"],
  ["['multi-channel-orders', tenantId, channelFilter]", "queryKeys.tenantWidgets.multiChannelOrders(tenantId, channelFilter)"],
  ["['multi-channel-orders']", "queryKeys.tenantWidgets.multiChannelOrders()"],
  ["['inventory-forecast', tenantId]", "queryKeys.tenantWidgets.inventoryForecast(tenantId)"],

  // Wholesale Inventory
  ["['wholesale-inventory']", "queryKeys.wholesaleInventory.all"],
  ["['wholesale-top-movers', tenant?.id]", "queryKeys.wholesaleInventory.topMovers(tenant?.id)"],

  // Sidebar
  ["['sidebar-preferences', tenant?.id, admin?.userId]", "queryKeys.sidebarPreferences.byUser(tenant?.id, admin?.userId)"],
  ["['sidebar-preferences', tenant.id]", "queryKeys.sidebarPreferences.byUser(tenant.id)"],
  ["['sidebar-config']", "queryKeys.sidebarPreferences.config()"],

  // Referrals
  ["['referral-code', tenantId]", "queryKeys.referrals.code(tenantId)"],
  ["['referral-stats', tenantId]", "queryKeys.referrals.stats(tenantId)"],

  // Credit Widgets
  ["['credit-usage-stats', tenantId]", "queryKeys.creditWidgets.usageStats(tenantId)"],
  ["['credit-projection', tenantId, balance]", "queryKeys.creditWidgets.projection(tenantId, balance)"],
  ["['credit-usage-quick', tenant?.id]", "queryKeys.creditWidgets.usageQuick(tenant?.id)"],
  ["['credit-activity', tenantId, limit]", "queryKeys.creditWidgets.activity(tenantId, limit)"],
  ["['credit-activity', tenantId]", "queryKeys.creditWidgets.activity(tenantId)"],
  ["['auto-topup-config', tenantId]", "queryKeys.creditWidgets.autoTopupConfig(tenantId)"],
  ["['credit-usage-data', tenantId]", "queryKeys.creditWidgets.usageData(tenantId)"],
  ["['credit-projection-nudge', tenantId, balance]", "queryKeys.creditWidgets.projectionNudge(tenantId, balance)"],
  ["['credit-analytics', tenantId]", "queryKeys.creditWidgets.analytics(tenantId)"],
  ["['credit-purchases', tenantId]", "queryKeys.creditWidgets.purchases(tenantId)"],
  ["['tenant-credits']", "queryKeys.tenantCredits.all"],

  // Platform Admin
  ["['platform-admin-check']", "queryKeys.platformAdmin.check()"],

  // Closed Shifts
  ["['closed-shifts', tenantId]", "queryKeys.closedShifts.byTenant(tenantId)"],

  // Store Age Settings
  ["['store-age-settings', storeId]", "queryKeys.storeAgeSettings.byStore(storeId)"],

  // Marketplace Product Settings
  ["['marketplace-product-settings']", "queryKeys.marketplaceProductSettings.all"],
  ["['products-sync', tenantId]", "queryKeys.marketplaceProductSettings.sync(tenantId)"],
  ["['products-sync', tenant?.id]", "queryKeys.marketplaceProductSettings.sync(tenant?.id)"],
  ["['products-sync']", "queryKeys.marketplaceProductSettings.sync()"],
  ["['marketplace-product-stats']", "queryKeys.marketplaceProductSettings.stats()"],
  ["['marketplace-product', productId]", "queryKeys.marketplaceProduct.byProduct(productId)"],

  // Email Verification
  ["['email-verification-status', admin?.id]", "queryKeys.emailVerification.byAdmin(admin?.id)"],
  ["['menu-payment-settings', menuId]", "queryKeys.menuPaymentSettings(menuId)"],
  ["['products-for-wholesale']", "queryKeys.productsForWholesale.all"],

  // Super Admin Tools
  ["['all-tenants-for-notification']", "queryKeys.allTenantsForNotification.all"],
  ["['all-tenants']", "queryKeys.superAdminTools.allTenants()"],
  ["['tenants-list']", "queryKeys.superAdminTools.tenantsList()"],
  ["['system-health']", "queryKeys.superAdminTools.systemHealth()"],
  ["['super-admin-growth-metrics']", "queryKeys.superAdminTools.growthMetrics()"],
  ["['revenue-forecast']", "queryKeys.superAdminTools.revenueForecast()"],
  ["['ltv-calculator', customChurnRate, customARPU]", "queryKeys.superAdminTools.ltvCalculator(customChurnRate, customARPU)"],
  ["['cohort-analysis']", "queryKeys.superAdminTools.cohortAnalysis()"],
  ["['churn-analysis']", "queryKeys.superAdminTools.churnAnalysis()"],
  ["['mrr-breakdown']", "queryKeys.superAdminTools.mrrBreakdown()"],
  ["['expansion-revenue']", "queryKeys.superAdminTools.expansionRevenue()"],
  ["['tenant-credit-detail-form', tenantId]", "queryKeys.superAdminTools.creditAdjustmentForm(tenantId)"],
  ["['super-admin-platform-stats']", "queryKeys.superAdminTools.platformStats()"],
  ["['super-admin-at-risk-tenants']", "queryKeys.superAdminTools.atRiskTenants()"],
  ["['super-admin-active-trials']", "queryKeys.superAdminTools.activeTrials()"],
  ["['super-admin-revenue-history', timeRange]", "queryKeys.superAdminTools.revenueHistory(timeRange)"],
  ["['super-admin-recent-activity']", "queryKeys.superAdminTools.recentActivity()"],
  ["['super-admin-trial-conversion']", "queryKeys.superAdminTools.trialConversion()"],
  ["['super-admin-tenant', newData?.id]", "queryKeys.superAdminTools.tenantDetail(newData?.id)"],
  ["['super-admin-tenants-list', debouncedSearch, statusFilter, planFilter]", "queryKeys.superAdminTools.tenantsListPage(debouncedSearch, statusFilter, planFilter)"],
  ["['super-admin-tenants-list']", "queryKeys.superAdminTools.tenantsListPage()"],
  ["['executive-metrics']", "queryKeys.superAdminTools.executiveMetrics()"],
  ["['platform-credit-stats-analytics']", "queryKeys.superAdminTools.creditPlatformStats()"],
  ["['platform-credit-stats']", "queryKeys.superAdminTools.platformCreditStats()"],
  ["['critical-tenants']", "queryKeys.superAdminTools.criticalTenants()"],
  ["['super-admin-audit-logs', actionFilter]", "queryKeys.superAdminTools.auditLogs(actionFilter)"],
  ["['audit-logs-tenants', tenantIds]", "queryKeys.superAdminTools.auditLogsTenants(tenantIds)"],
  ["['audit-logs-actors', actorIds]", "queryKeys.superAdminTools.auditLogsActors(actorIds)"],
  ["['super-admin-api-logs']", "queryKeys.superAdminTools.apiUsageLogs()"],
  ["['admin-users']", "queryKeys.superAdminTools.adminUsers()"],
  ["['super-admin-feature-flags']", "queryKeys.superAdminTools.featureFlags()"],
  ["['admin-referral-stats']", "queryKeys.superAdminTools.referralStats()"],
  ["['data-explorer-query', queryToRun]", "queryKeys.superAdminTools.dataExplorer(queryToRun)"],
  ["['super-admin-campaigns']", "queryKeys.superAdminTools.campaigns()"],
  ["['credit-analytics', startDate, endDate]", "queryKeys.superAdminTools.creditAnalytics(startDate, endDate)"],
  ["['admin-tenants-credits', statusFilter, search]", "queryKeys.superAdminTools.tenantCredits(statusFilter, search)"],
  ["['admin-tenants-credits']", "queryKeys.superAdminTools.tenantCredits()"],
  ["['admin-tenant-credit-detail', detailTenantId]", "queryKeys.superAdminTools.tenantCreditDetail(detailTenantId)"],
  ["['admin-credit-packages']", "queryKeys.superAdminTools.creditPackages()"],
  ["['credit-audit-log', typeFilter, dateFrom, dateTo, page]", "queryKeys.superAdminTools.creditAuditLog(typeFilter, dateFrom, dateTo, page)"],
  ["['forum-approvals', activeTab]", "queryKeys.superAdminTools.forumApprovals(activeTab)"],
  ["['forum-approvals']", "queryKeys.superAdminTools.forumApprovals()"],
  ["['marketplace-profiles-moderation', statusFilter]", "queryKeys.superAdminTools.marketplaceModeration(statusFilter)"],
  ["['marketplace-profiles-moderation']", "queryKeys.superAdminTools.marketplaceModeration()"],
  ["['admin-promo-codes']", "queryKeys.superAdminTools.promoCodes()"],
  ["['promo-code-redemptions', selectedCode?.id]", "queryKeys.superAdminTools.promoRedemptions(selectedCode?.id)"],
  ["['admin-all-tenants']", "queryKeys.superAdminTools.allTenantsPage()"],
  ["['platform-metrics']", "queryKeys.superAdminTools.platformMetrics()"],
  ["['super-admin-stats']", "queryKeys.superAdminTools.superAdminStats()"],
  ["['super-admin-tenants', searchTerm, statusFilter, planFilter]", "queryKeys.superAdminTools.superAdminTenants(searchTerm, statusFilter, planFilter)"],
  ["['super-admin-tenants']", "queryKeys.superAdminTools.superAdminTenants()"],
  ["['at-risk-tenants']", "queryKeys.superAdminTools.atRiskTenantsSimple()"],
  ["['tenant-detail', tenantId]", "queryKeys.superAdminTools.tenantDetailById(tenantId)"],
  ["['tenant-usage', tenant.id]", "queryKeys.superAdminTools.tenantUsage(tenant.id)"],
  ["['tenant-activity', tenantId]", "queryKeys.superAdminTools.tenantActivity(tenantId)"],
  ["['platform-stats']", "queryKeys.superAdminTools.platformStatsSimple()"],
  ["['platform-analytics', timeRange]", "queryKeys.superAdminTools.platformAnalytics(timeRange)"],
  ["['automation-events']", "queryKeys.superAdminTools.automationEvents()"],
  ["['scheduled-jobs']", "queryKeys.superAdminTools.scheduledJobs()"],

  // Orgs
  ["['customer-organizations', tenantId, customerId]", "queryKeys.customerOrganizations.byCustomer(tenantId, customerId)"],

  // Dashboard prefetch
  ["['tenant-dashboard-today', tenantId]", "queryKeys.tenantDashboard.today(tenantId)"],
  ["['recent-orders', tenantId]", "queryKeys.tenantDashboard.recentOrders(tenantId)"],
  ["['usage-stats', tenantId]", "queryKeys.tenantDashboard.usageStats(tenantId)"],
  ["['usage-stats', tenant?.id]", "queryKeys.tenantDashboard.usageStats(tenant?.id)"],

  // Various
  ["['upsell-products', storeId]", "queryKeys.upsellProducts.byStore(storeId)"],
  ["['setup-checklist', tenantId]", "queryKeys.setupChecklist.byTenant(tenantId)"],
  ["['cart-stock-check', cartItems.map(i => `${i.productId}:${i.quantity}`).join(',')]", "queryKeys.cartStockCheck.byItems(cartItems.map(i => `${i.productId}:${i.quantity}`).join(','))"],
  ["['product-stock', productId]", "queryKeys.productStock.byProduct(productId)"],
  ["['product-stock', newProduct.id]", "queryKeys.productStock.byProduct(newProduct.id)"],
  ["['product-stock', newBatch.product_id]", "queryKeys.productStock.byProduct(newBatch.product_id)"],
  ["['admin-sessions', admin?.id]", "queryKeys.adminSessions.byAdmin(admin?.id)"],
  ["['recently-viewed-products', store?.id, productIds]", "queryKeys.recentlyViewed.byStore(store?.id, productIds)"],
  ["['recently-viewed-products', storeId, recentIds]", "queryKeys.recentlyViewed.byStoreIds(storeId, recentIds)"],
  ["['search-autocomplete', storeId, debouncedQuery]", "queryKeys.searchAutocomplete.results(storeId, debouncedQuery)"],
  ["['search-categories', storeId]", "queryKeys.searchAutocomplete.categories(storeId)"],
  ["['notification-preferences', admin?.id]", "queryKeys.notificationPreferences.byUser(admin?.id)"],
  ["['stripe-health']", "queryKeys.stripeHealth.all"],
  ["['tenant-invoices', tenantId]", "queryKeys.tenantInvoices.byTenant(tenantId)"],
  ["['subscription-plans']", "queryKeys.subscriptionPlans.all"],

  // Tenant
  ["['tenant', tenant.id]", "queryKeys.tenantSingle.byId(tenant.id)"],
  ["['tenant', tenantId]", "queryKeys.tenantSingle.byId(tenantId)"],

  // Sales Dashboard
  ["['sales-dashboard-orders', tenant?.id, timeRange]", "queryKeys.salesDashboard.orders(tenant?.id, timeRange)"],
  ["['sales-dashboard-prev-orders', tenant?.id, timeRange]", "queryKeys.salesDashboard.prevOrders(tenant?.id, timeRange)"],
  ["['sales-dashboard', tenantId, timeRange]", "queryKeys.salesDashboard.main(tenantId, timeRange)"],

  // POS
  ["['pos-transactions', tenantId, timeRange]", "queryKeys.posTransactions.byTenant(tenantId, timeRange)"],
  ["['pos-analytics', tenantId]", "queryKeys.posTransactions.analytics(tenantId)"],
  ["['pos-shifts-summary', tenantId]", "queryKeys.posTransactions.shiftsSummary(tenantId)"],

  // Workflow
  ["['workflow-versions', workflowId, tenant?.id]", "queryKeys.workflowVersions.byWorkflow(workflowId, tenant?.id)"],
  ["['workflow-versions']", "queryKeys.workflowVersions.all"],
  ["['workflow-executions', tenant?.id, limit]", "queryKeys.workflowExecutions.all"],
  ["['workflows']", "queryKeys.workflows.all"],

  // Runner
  ["['wholesale-runner-deliveries', runnerId]", "queryKeys.wholesaleRunnerDeliveries.byRunner(runnerId)"],
  ["['runner-stats', runnerId]", "queryKeys.runnerStats.byRunner(runnerId)"],
  ["['runner-location-history', runnerId, deliveryId, startTime, endTime]", "queryKeys.runnerLocationHistory.track(runnerId, deliveryId, startTime, endTime)"],
  ["['route-statistics', runnerId, deliveryId, startTime, endTime]", "queryKeys.runnerLocationHistory.routeStats(runnerId, deliveryId, startTime, endTime)"],
  ["['runner-deliveries', runnerId]", "queryKeys.runnerDeliveries.byRunner(runnerId)"],
  ["['runner-deliveries']", "queryKeys.runnerDeliveries.all"],
  ["['runner-active-deliveries', runnerId]", "queryKeys.runnerActiveDeliveries.byRunner(runnerId)"],
  ["['runner-active-deliveries']", "queryKeys.runnerActiveDeliveries.all"],
  ["['runner-today-stats', runnerId]", "queryKeys.runnerTodayStats.byRunner(runnerId)"],
  ["['runner-today-stats']", "queryKeys.runnerTodayStats.all"],
  ["['runner-info', runnerId]", "queryKeys.runnerInfo.byRunner(runnerId)"],

  // Marketplace
  ["['marketplace-profile', tenantId]", "queryKeys.marketplaceProfileAdmin.byTenant(tenantId)"],
  ["['marketplace-profile', tenant?.id]", "queryKeys.marketplaceProfileAdmin.byTenant(tenant?.id)"],
  ["['marketplace-profile']", "queryKeys.marketplaceProfileAdmin.byTenant()"],
  ["['marketplace-listings', tenantId, statusFilter]", "queryKeys.marketplaceListings.byTenant(tenantId, statusFilter)"],
  ["['marketplace-listings', tenantId]", "queryKeys.marketplaceListings.byTenant(tenantId)"],
  ["['marketplace-listings', tenant?.id]", "queryKeys.marketplaceListings.byTenant(tenant?.id)"],
  ["['marketplace-listings']", "queryKeys.marketplaceListings.all"],
  ["['marketplace-listing', listingId]", "queryKeys.marketplaceListings.detail(listingId)"],
  ["['marketplace-listing-detail', listingId]", "queryKeys.marketplaceListings.detailPage(listingId)"],
  ["['marketplace-listings-public', productTypeFilter, strainTypeFilter]", "queryKeys.marketplaceListings.public(productTypeFilter, strainTypeFilter)"],
  ["['marketplace-listing-public', listingId]", "queryKeys.marketplaceListings.publicDetail(listingId)"],
  ["['marketplace-listings-browse', productTypeFilter, strainTypeFilter]", "queryKeys.marketplaceListings.browse(productTypeFilter, strainTypeFilter)"],
  ["['marketplace-listings-for-forum']", "queryKeys.marketplaceListings.forForum()"],
  ["['marketplace-messages', tenantId]", "queryKeys.marketplaceMessages.byTenant(tenantId)"],
  ["['marketplace-cart', buyerTenantId]", "queryKeys.marketplaceCart.byBuyer(buyerTenantId)"],
  ["['marketplace-cart']", "queryKeys.marketplaceCart.all"],
  ["['marketplace-cart-count']", "queryKeys.marketplaceCart.count()"],
  ["['marketplace-browse', typeFilter]", "queryKeys.marketplaceBrowse.list(typeFilter)"],
  ["['marketplace-purchase-detail', orderId]", "queryKeys.marketplacePurchaseDetail.byOrder(orderId)"],
  ["['marketplace-orders-customer', buyerTenantId, statusFilter]", "queryKeys.marketplaceOrders.customer(buyerTenantId, statusFilter)"],
  ["['marketplace-order-detail-customer', orderId]", "queryKeys.marketplaceOrders.customerDetail(orderId)"],
  ["['marketplace-order-detail', orderId]", "queryKeys.marketplaceOrders.orderDetail(orderId)"],
  ["['marketplace-orders', tenantId, statusFilter, activeTab]", "queryKeys.marketplaceOrders.byTenant(tenantId, statusFilter, activeTab)"],
  ["['marketplace-orders', tenantId]", "queryKeys.marketplaceOrders.byTenant(tenantId)"],
  ["['marketplace-orders']", "queryKeys.marketplaceOrders.all"],
  ["['marketplace-categories', tenant?.id]", "queryKeys.marketplaceCategories.byTenant(tenant?.id)"],
  ["['marketplace-categories']", "queryKeys.marketplaceCategories.all"],
  ["['marketplace-analytics', profile?.id]", "queryKeys.marketplaceAnalytics.byProfile(profile?.id)"],
  ["['marketplace-banners', storeId]", "queryKeys.marketplaceBanners.byStore(storeId)"],
  ["['marketplace-coupons', tenant?.id]", "queryKeys.marketplaceCoupons.byTenant(tenant?.id)"],
  ["['marketplace-coupons']", "queryKeys.marketplaceCoupons.all"],
  ["['marketplace-store', tenant?.id]", "queryKeys.marketplaceStore.byTenant(tenant?.id)"],
  ["['marketplace-store', tenantId]", "queryKeys.marketplaceStore.byTenant(tenantId)"],
  ["['marketplace-settings', tenant?.id]", "queryKeys.marketplaceSettings.byTenant(tenant?.id)"],
  ["['marketplace-settings']", "queryKeys.marketplaceSettings.all"],
  ["['marketplace-bundles', store?.id]", "queryKeys.marketplaceBundles.byStore(store?.id)"],
  ["['marketplace-bundles']", "queryKeys.marketplaceBundles.all"],

  // Store/Support/Storefront
  ["['store-status', storeId]", "queryKeys.storeStatus.byStore(storeId)"],
  ["['support-ticket-comments', ticketId]", "queryKeys.supportTicketComments.byTicket(ticketId)"],
  ["['storefront-orders', storeId, customerId]", "queryKeys.storefrontOrders.byStoreCustomer(storeId, customerId)"],
  ["['storefront-orders']", "queryKeys.storefrontOrders.all"],
  ["['storefront-order-token', trackingToken]", "queryKeys.storefrontOrders.byToken(trackingToken)"],
  ["['storefront-order-detail', store?.id, orderId]", "queryKeys.storefrontOrders.detail(store?.id, orderId)"],
  ["['storefront-settings', tenant?.id]", "queryKeys.storefrontSettingsHook.byTenant(tenant?.id)"],
  ["['unified-orders']", "queryKeys.unifiedOrders.all"],
  ["['recent-wholesale-clients', tenant?.id, recentClientIds.map(c => c.id)]", "queryKeys.recentWholesaleClients.byTenant(tenant?.id, recentClientIds.map(c => c.id))"],
  ["['storefront-performance']", "queryKeys.storefrontPerformance.byTenant()"],
  ["['unified-earnings', role, userId, timeframe]", "queryKeys.unifiedEarnings.byUser(role, userId, timeframe)"],

  // Menu Schedule
  ["['menu-schedule', menuId]", "queryKeys.menuSchedule.byMenu(menuId)"],
  ["['menu-schedule', variables.menuId]", "queryKeys.menuSchedule.byMenu(variables.menuId)"],
  ["['menu-schedule-history', menuId]", "queryKeys.menuSchedule.history(menuId)"],
  ["['disposable-menus']", "queryKeys.disposableMenus.all"],
  ["['menu-products-preview', menuId]", "queryKeys.menuProductsPreview.byMenu(menuId)"],

  // Hotbox
  ["['hotbox-pulse', tenant?.id]", "queryKeys.hotbox.pulse(tenant?.id)"],
  ["['hotbox-weekly', tenant?.id]", "queryKeys.hotbox.weekly(tenant?.id)"],
  ["['hotbox-team', tenant?.id]", "queryKeys.hotbox.team(tenant?.id)"],
  ["['hotbox-strategic', tenant?.id]", "queryKeys.hotbox.strategic(tenant?.id)"],
  ["['hotbox-ready-for-pickup', tenant?.id]", "queryKeys.hotbox.readyForPickup(tenant?.id)"],
  ["['hotbox-locations', tenant?.id]", "queryKeys.hotbox.locations(tenant?.id)"],
  ["['hotbox-live-orders', tenant?.id]", "queryKeys.hotbox.liveOrders(tenant?.id)"],
  ["['hotbox-executive', tenant?.id]", "queryKeys.hotbox.executive(tenant?.id)"],
  ["['hotbox-courier-status', tenant?.id]", "queryKeys.hotbox.courierStatus(tenant?.id)"],

  // Gift Cards
  ["['gift-cards', storeId]", "queryKeys.giftCards.byStore(storeId)"],
  ["['gift-card-ledger', card.id]", "queryKeys.giftCards.ledger(card.id)"],
  ["['storefront-funnel', storeId]", "queryKeys.storefrontFunnel.byStore(storeId)"],
  ["['storefront-analytics', storeId, '7d'] as const", "queryKeys.storefrontAnalyticsWidget.byStore(storeId, '7d')"],
  ["['admin-payouts-pending']", "queryKeys.platformPayouts.pending()"],
  ["['customer-portal-profile', customerUser.customer_id, customerUser.tenant_id]", "queryKeys.customerPortal.profile(customerUser.customer_id, customerUser.tenant_id)"],
  ["['customer-retail-orders', tenantId, customerId, statusFilter]", "queryKeys.customerRetailOrders.byCustomer(tenantId, customerId, statusFilter)"],
  ["['customer-wholesale-orders', tenantId, statusFilter]", "queryKeys.customerWholesaleOrders.byTenant(tenantId, statusFilter)"],
  ["['customer-storefront-orders', tenantId, customerEmail, statusFilter]", "queryKeys.customerStorefrontOrders.byEmail(tenantId, customerEmail, statusFilter)"],
  ["['customer-access-logs', whitelistId]", "queryKeys.customerAccessLogs.byWhitelist(whitelistId)"],
  ["['customer-security-events', whitelistId]", "queryKeys.customerSecurityEvents.byWhitelist(whitelistId)"],
  ["['edit-menu', menuId]", "queryKeys.editMenu.byMenu(menuId)"],
  ["['inventory_batches']", "queryKeys.inventorySyncKeys.inventoryBatches()"],
  ["['storefront-products']", "queryKeys.inventorySyncKeys.storefrontProducts()"],

  // Store Pages
  ["['store-product-page', slug]", "queryKeys.storePages.product(slug)"],
  ["['store-product-detail', store?.tenant_id, id]", "queryKeys.storePages.productDetail(store?.tenant_id, id)"],
  ["['store-related-products', store?.tenant_id, product?.category, id]", "queryKeys.storePages.relatedProducts(store?.tenant_id, product?.category, id)"],
  ["['store-menu', slug]", "queryKeys.storePages.menu(slug)"],
  ["['store-menu-products', store?.tenant_id]", "queryKeys.storePages.menuProducts(store?.tenant_id)"],
  ["['store-landing', slug]", "queryKeys.storePages.landing(slug)"],
  ["['store-landing-products', store?.tenant_id]", "queryKeys.storePages.landingProducts(store?.tenant_id)"],
  ["['store-landing-categories', store?.tenant_id]", "queryKeys.storePages.landingCategories(store?.tenant_id)"],
  ["['store-active-deals', store?.id]", "queryKeys.storePages.activeDeals(store?.id)"],
  ["['store-products', tenant?.id]", "queryKeys.storePages.storeProducts(tenant?.id)"],

  // Shop Pages
  ["['shop-store', storeSlug]", "queryKeys.shopPages.store(storeSlug)"],
  ["['quick-view-product', store?.id, productId]", "queryKeys.shopPages.quickView(store?.id, productId)"],
  ["['luxury-products', storeId]", "queryKeys.shopPages.luxuryProducts(storeId)"],
  ["['order-tracking', trackingToken]", "queryKeys.shopPages.orderTracking(trackingToken)"],
  ["['order-confirmation', trackingToken || orderNumber]", "queryKeys.shopPages.orderConfirmation(trackingToken || orderNumber)"],
  ["['encrypted-store', token]", "queryKeys.shopPages.encryptedStore(token)"],
  ["['wishlist-products', storeId, wishlistIds]", "queryKeys.shopPages.wishlistProducts(storeId, wishlistIds)"],
  ["['customer-profile', customerId, tenantId]", "queryKeys.shopPages.customerProfile(customerId, tenantId)"],

  // Auth
  ["['auth-user']", "queryKeys.authUser.all"],

  // Featured Products
  ["['storefront-products-list', tenant?.id]", "queryKeys.featuredProducts.list(tenant?.id)"],

  // Customer Insights
  ["['customer-insights-customers', tenant?.id, timeRange]", "queryKeys.customerInsights.customers(tenant?.id, timeRange)"],
  ["['customer-insights-orders', tenant?.id, timeRange]", "queryKeys.customerInsights.orders(tenant?.id, timeRange)"],
  ["['customer-insights-top', tenant?.id]", "queryKeys.customerInsights.top(tenant?.id)"],

  // Retail
  ["['retail-businesses', stateFilter, deliveryFilter]", "queryKeys.retailBusinesses.list(stateFilter, deliveryFilter)"],
  ["['retail-business', targetBusinessSlug]", "queryKeys.retailBusinesses.detail(targetBusinessSlug)"],
  ["['retail-products', businessId, categoryFilter]", "queryKeys.retailBusinesses.products(businessId, categoryFilter)"],
  ["['retail-categories', businessId]", "queryKeys.retailBusinesses.categories(businessId)"],
  ["['cart', user?.id]", "queryKeys.cart.user(user?.id)"],

  // Menu Products
  ["['menu-products', tenant?.id]", "queryKeys.menuProducts.list(tenant?.id)"],
  ["['menu-products-list', tenant?.id]", "queryKeys.menuProducts.productsList(tenant?.id)"],
  ["['menu-products-ordering', menuId, tenant?.id]", "queryKeys.menuProducts.ordering(menuId, tenant?.id)"],
  ["['menu-builder-products', tenant?.id]", "queryKeys.menuProducts.builder(tenant?.id)"],
  ["['menu-overview-stats']", "queryKeys.menuOverviewStats.all"],
  ["['menu-recent-alerts']", "queryKeys.menuOverviewStats.recentAlerts()"],
  ["['recent-burned-menus']", "queryKeys.menuOverviewStats.recentBurned()"],
  ["['menu-trend-data', menuId, dateRange]", "queryKeys.menuImageTrend.byMenu(menuId, dateRange)"],
  ["['menu-analytics-menus', tenantId]", "queryKeys.menuAnalytics.menus(tenantId)"],
  ["['menu-specific-analytics', currentMenuId, dateRange?.from?.toISOString(), dateRange?.to?.toISOString()]", "queryKeys.menuAnalytics.specific(currentMenuId, dateRange?.from?.toISOString(), dateRange?.to?.toISOString())"],
  ["['menu-compare-analytics', compareMenuId, dateRange?.from?.toISOString(), dateRange?.to?.toISOString()]", "queryKeys.menuAnalytics.compare(compareMenuId, dateRange?.from?.toISOString(), dateRange?.to?.toISOString())"],

  // Remaining
  ["['wholesale-clients-for-import']", "queryKeys.importCustomersWholesale.all"],
  ["['menu-whitelist', menuId]", "queryKeys.menuWhitelist.byMenu(menuId)"],
  ["['menu-orders']", "queryKeys.menuOrders.all"],
  ["['menu-security-events']", "queryKeys.menuSecurityEvents.all"],
  ["['wholesale-client', id]", "queryKeys.wholesaleClient.byId(id)"],
  ["['modern-dashboard', tenantId]", "queryKeys.modernDashboard.byTenant(tenantId)"],
  ["['inventory-alerts', tenant?.id]", "queryKeys.inventoryAlerts.byTenant(tenant?.id)"],
  ["['inventory-alerts']", "queryKeys.inventoryAlerts.all"],
  ["['products-for-receiving', tenant?.id]", "queryKeys.productsForReceiving.byTenant(tenant?.id)"],
  ["['products-for-receiving']", "queryKeys.productsForReceiving.byTenant()"],
  ["['marketplace-stores-for-qr', tenant?.id]", "queryKeys.productsQR.stores(tenant?.id)"],
  ["['global-products', debouncedSearch, categoryFilter, debouncedBrand]", "queryKeys.globalProducts.list(debouncedSearch, categoryFilter, debouncedBrand)"],
  ["['global-product-imports', tenant?.id]", "queryKeys.globalProducts.imports(tenant?.id)"],
  ["['global-product-imports']", "queryKeys.globalProducts.imports()"],
  ["['forum', 'categories']", "queryKeys.forum.categories.all()"],
  ["['category', categorySlug]", "queryKeys.communityCategory.bySlug(categorySlug)"],
  ["['white-label', tenantId]", "queryKeys.whiteLabel.byTenant(tenantId)"],
  ["['automation-rules', tenantId]", "queryKeys.automationRules.byTenant(tenantId)"],
  ["['couriers', tenant?.id]", "queryKeys.couriersAdmin.byTenant(tenant?.id)"],
  ["['audit-trail', tenantId]", "queryKeys.auditTrail.byTenant(tenantId)"],
  ["['commission-tracking', tenantId]", "queryKeys.commissionTracking.byTenant(tenantId)"],
  ["['api-keys', tenantId]", "queryKeys.apiKeys.byTenant(tenantId)"],
  ["['collection-mode', tenant?.id]", "queryKeys.collections.mode(tenant?.id)"],
  ["['collection-mode']", "queryKeys.collections.mode()"],
  ["['collection-activities', variables.clientId]", "queryKeys.collections.activities(variables.clientId)"],
  ["['collection-activities', clientId]", "queryKeys.collections.activities(clientId)"],
  ["['advanced-analytics-orders', tenantId]", "queryKeys.advancedAnalyticsOrders.byTenant(tenantId)"],
  ["['advanced-analytics-orders', tenant?.id]", "queryKeys.advancedAnalyticsOrders.byTenant(tenant?.id)"],
  ["['advanced-analytics-customers', tenantId]", "queryKeys.advancedAnalyticsOrders.customers(tenantId)"],
  ["['quick-export', exportType, dateRange, tenantId]", "queryKeys.quickExport.byParams(exportType, dateRange, tenantId)"],
  ["['board-report-metrics', tenant?.id]", "queryKeys.boardReport.metrics(tenant?.id)"],
  ["['custom-domains', tenantId]", "queryKeys.customDomains.byTenant(tenantId)"],
  ["['expenses', tenantId]", "queryKeys.expenses.byTenant(tenantId)"],
  ["['customer-growth', tenantId]", "queryKeys.customerGrowth.byTenant(tenantId)"],
  ["['recent-customer-activity', tenantId]", "queryKeys.customerGrowth.recentActivity(tenantId)"],
  ["['customers', tenantId]", "queryKeys.customerAnalytics.customers(tenantId)"],
  ["['customer-orders', whitelistId]", "queryKeys.customerDetail.orders(whitelistId)"],
  ["['customer-orders', id, tenantId]", "queryKeys.customerInsightsAdmin.orders(id, tenantId)"],
  ["['customer-orders', tenantId]", "queryKeys.customerAnalytics.orders(tenantId)"],
  ["['custom-integrations', tenantId]", "queryKeys.customIntegrations.byTenant(tenantId)"],
  ["['customer', id, tenantId]", "queryKeys.customerInsightsAdmin.customer(id, tenantId)"],
  ["['preselected-client', preselectedClientId]", "queryKeys.preselectedClient.byId(preselectedClientId)"],
  ["['delivery-analytics', tenantId]", "queryKeys.deliveryAnalytics.byTenant(tenantId)"],
  ["['products-for-barcode', tenant?.id]", "queryKeys.productsForBarcode.byTenant(tenant?.id)"],
  ["['data-export-history', tenantId]", "queryKeys.dataExport.history(tenantId)"],
  ["['financial-quick-stats']", "queryKeys.financialCommandCenter.quickStats()"],
  ["['financial-cash-flow-pulse']", "queryKeys.financialCommandCenter.cashFlowPulse()"],
  ["['financial-ar-command']", "queryKeys.financialCommandCenter.arCommand()"],
  ["['financial-fronted-inventory']", "queryKeys.financialCommandCenter.frontedInventory()"],
  ["['financial-performance-pulse']", "queryKeys.financialCommandCenter.performancePulse()"],
  ["['financial-command-center']", "queryKeys.financialCommandCenter.quickStats()"],
  ["['financial-data']", "queryKeys.financialData.paymentSchedules()"],
  ["['revenue-reports', tenantId, dateRange]", "queryKeys.revenueReports.byTenant(tenantId, dateRange)"],
  ["['revenue-reports']", "queryKeys.financialCommandCenter.revenueReports()"],
  ["['inventory-audits', tenant?.id]", "queryKeys.inventoryAudits.byTenant(tenant?.id)"],
  ["['inventory-audits', tenant.id]", "queryKeys.inventoryAudits.byTenant(tenant.id)"],
  ["['products-for-transfer', tenantId]", "queryKeys.inventoryTransfersAdmin.products(tenantId)"],
  ["['inventory-locations', tenantId]", "queryKeys.inventoryTransfersAdmin.locations(tenantId)"],
  ["['inventory-transfers', tenantId]", "queryKeys.inventoryTransfersAdmin.transfers(tenantId)"],
  ["['location-analytics', tenantId]", "queryKeys.locationAnalytics.byTenant(tenantId)"],
  ["['location-analytics', tenant?.id]", "queryKeys.locationAnalytics.byTenant(tenant?.id)"],
  ["['roles', tenantId]", "queryKeys.roles.byTenant(tenantId)"],
  ["['realtime-dashboard', tenantId]", "queryKeys.realtimeDashboard.byTenant(tenantId)"],
  ["['active-deliveries-eta', tenant?.id]", "queryKeys.activeDeliveriesEta.byTenant(tenant?.id)"],
  ["['strategic-metrics', tenant?.id]", "queryKeys.strategicDashboard.metrics(tenant?.id)"],
  ["['tax-summary', tenantId, selectedPeriod]", "queryKeys.taxManagement.summary(tenantId, selectedPeriod)"],
  ["['vendor-dashboard-stats', tenantId]", "queryKeys.vendorDashboard.stats(tenantId)"],
  ["['vendor-dashboard-top-vendors', tenantId]", "queryKeys.vendorDashboard.topVendors(tenantId)"],
  ["['vendor-dashboard-activity', tenantId]", "queryKeys.vendorDashboard.activity(tenantId)"],
  ["['vendor-dashboard-categories', tenantId]", "queryKeys.vendorDashboard.categories(tenantId)"],
  ["['pricing-tiers', tenantId]", "queryKeys.pricingTiers.byTenant(tenantId)"],
  ["['pricing-tiers']", "queryKeys.pricingTiers.byTenant()"],
  ["['products-for-pricing', tenantId]", "queryKeys.pricingTiers.products(tenantId)"],
  ["['payout-history', tenantId]", "queryKeys.payoutsAdmin.history(tenantId)"],
  ["['payout-pending-orders', tenantId]", "queryKeys.payoutsAdmin.pendingOrders(tenantId)"],
  ["['tv-dashboard-orders', tenant?.id]", "queryKeys.smartTVDashboard.orders(tenant?.id)"],
  ["['tv-dashboard-orders']", "queryKeys.smartTVDashboard.orders()"],
  ["['tv-dashboard-hourly', tenant?.id]", "queryKeys.smartTVDashboard.hourly(tenant?.id)"],
  ["['tv-dashboard-inventory', tenant?.id]", "queryKeys.smartTVDashboard.inventory(tenant?.id)"],
  ["['pending-orders-for-assignment']", "queryKeys.pendingOrdersForAssignment.all"],
  ["['fleet-couriers', tenant?.id]", "queryKeys.fleetCouriers.byTenant(tenant?.id)"],
  ["['wholesale-pricing-tiers', tenant?.id]", "queryKeys.wholesalePricingTiers.byTenant(tenant?.id)"],
  ["['products-for-offline-order', tenant?.id, isOnline]", "queryKeys.productsForOfflineOrder.byTenant(tenant?.id, isOnline)"],
  ["['notification-templates', tenantId]", "queryKeys.notificationTemplates.byTenant(tenantId)"],
  ["['storefront-coupons', store?.id]", "queryKeys.storefrontCoupons.byStore(store?.id)"],
  ["['storefront-coupons']", "queryKeys.storefrontCoupons.all"],
  ["['storefront-announcements', tenantId, storeId]", "queryKeys.storefrontAnnouncements.byTenantStore(tenantId, storeId)"],
  ["['order-analytics', tenant?.id]", "queryKeys.orderAnalyticsAdmin.byTenant(tenant?.id)"],
  ["['order-analytics', tenantId]", "queryKeys.orderAnalyticsAdmin.byTenant(tenantId)"],
  ["['storefront-analytics-store', tenant?.id]", "queryKeys.storefrontAnalyticsStore.byTenant(tenant?.id)"],
  ["['compliance', tenantId]", "queryKeys.compliancePage.byTenant(tenantId)"],
  ["['public-delivery-tracking', trackingCode, lookupOrderNumber, lookupPhone]", "queryKeys.publicDeliveryTracking.byParams(trackingCode, lookupOrderNumber, lookupPhone)"],
  ["['public-delivery-tracking']", "queryKeys.publicDeliveryTracking.all"],
  ["['store-settings-potency']", "queryKeys.storeSettingsPotency.all"],
  ["['account-settings', tenant?.id]", "queryKeys.accountSettings.byTenant(tenant?.id)"],
  ["['account-settings']", "queryKeys.accountSettings.all"],
  ["['products-for-po', tenant?.id]", "queryKeys.productsForPO.byTenant(tenant?.id)"],
  ["['product-price-history', tenant?.id, productId]", "queryKeys.productPriceHistory.byProduct(tenant?.id, productId)"],
  ["['storefront-session', tenantId, sessionId]", "queryKeys.storefrontSession.bySession(tenantId, sessionId)"],
  ["['order-stock-validation', orderId, orderItems.map(i => i.product_id)]", "queryKeys.orderStockValidation.byOrder(orderId, orderItems.map(i => i.product_id))"],
  ["['geocode-address', deliveryAddress]", "queryKeys.geocodeAddress.byAddress(deliveryAddress)"],
  ["['order-analytics-insights', tenant?.id, orderId, customerId]", "queryKeys.orderAnalyticsInsights.byOrder(tenant?.id, orderId, customerId)"],
  ["['support-tickets', statusFilter, priorityFilter, searchTerm]", "queryKeys.saasAdmin.supportTickets(statusFilter, priorityFilter, searchTerm)"],
  ["['support-tickets', tenantId]", "queryKeys.superAdminTools.supportTickets(tenantId)"],
  ["['support-tickets']", "queryKeys.superAdminTools.supportTickets()"],
  ["['feature-flags']", "queryKeys.saasAdmin.featureFlags()"],
  ["['runners', account?.id]", "queryKeys.runnersAdmin.byAccount(account?.id)"],
  ["['customer-order', orderId]", "queryKeys.customerOrder.byId(orderId)"],
  ["['shop-products']", "queryKeys.shopStoreProducts.all"],
  ["['tenant-tickets', tenantId]", "queryKeys.tenantTickets.byTenant(tenantId)"],
  ["['team', 'members', tenantId]", "queryKeys.orderThreadedNotes.teamMembers(tenantId)"],
  ["['orders', viewMode, tenant?.id]", "queryKeys.orders.list(tenant?.id, { viewMode })"],
  ["['orders', tenant?.id]", "queryKeys.orders.byTenant(tenant?.id!)"],
  ["['vendors', 'list', tenant?.id, { withStats: true }]", "queryKeys.vendorOrdersHook.list(tenant?.id, { withStats: true })"],
  ["['vendors', tenant?.id]", "queryKeys.vendors.byTenant(tenant?.id!)"],

  // Storefront pages
  ["['storefront-customers', store?.id]", "queryKeys.storefrontCustomers.byStore(store?.id)"],
  ["['storefront-live-orders', store?.id, statusFilter]", "queryKeys.storefrontLiveOrders.byStore(store?.id, statusFilter)"],
  ["['storefront-live-orders']", "queryKeys.storefrontLiveOrders.all"],
  ["['marketplace-orders', store?.id, statusFilter]", "queryKeys.marketplaceOrders.byTenant(store?.id, statusFilter)"],
  ["['tenant-products', tenantId]", "queryKeys.tenantProducts.byTenant(tenantId)"],
  ["['marketplace-product-settings', store?.id]", "queryKeys.marketplaceProductSettingsByStore.byStore(store?.id)"],
  ["['featured-products-preview', formData.featured_product_ids]", "queryKeys.featuredProductsPreview.byIds(formData.featured_product_ids)"],
  ["['marketplace-store']", "queryKeys.marketplaceStore.byTenant()"],
  ["['store-orders', effectiveStoreId, statusFilter]", "queryKeys.storeOrdersTab.byStore(effectiveStoreId, statusFilter)"],
  ["['store-orders']", "queryKeys.storeOrdersTab.all"],
  ["['shop-store']", "queryKeys.shopStore.all"],
  ["['collection-activities']", "queryKeys.collections.activities('')"],
  ["['products', tenantId]", "queryKeys.products.byTenant(tenantId)"],
  ["['inventory', tenantId]", "queryKeys.inventory.byTenant(tenantId)"],

  // Catch-all simple keys (must be LAST)
  ["['fronted-inventory']", "queryKeys.frontedInventory.all"],
  ["['wholesale-deliveries']", "queryKeys.wholesaleDeliveries.all"],
  ["['wholesale-orders']", "queryKeys.wholesaleOrders.all"],
  ["['wholesale-clients']", "queryKeys.wholesaleClients.all"],
  ["['purchase-orders']", "queryKeys.purchaseOrders.all"],
  ["['notifications']", "queryKeys.notifications.all"],
  ["['deliveries']", "queryKeys.deliveries.all"],
  ["['live-orders']", "queryKeys.liveOrders.all"],
  ["['orders']", "queryKeys.orders.all"],
  ["['products']", "queryKeys.products.all"],
  ["['inventory']", "queryKeys.inventory.all"],
  ["['tenant']", "queryKeys.tenants.all"],
  ["['tenants']", "queryKeys.tenants.all"],
];

function walkDir(dir) {
  let results = [];
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (!item.startsWith('.') && item !== 'node_modules' && item !== '__tests__') {
        results = results.concat(walkDir(full));
      }
    } else if ((item.endsWith('.ts') || item.endsWith('.tsx')) && !item.includes('.test.') && item !== 'queryKeys.ts') {
      results.push(full);
    }
  }
  return results;
}

const srcDir = path.join(__dirname, 'src');
const allFiles = walkDir(srcDir);

let totalReplacements = 0;
let filesModified = 0;
let filesWithImportAdded = 0;
const remaining = [];

for (const filePath of allFiles) {
  let content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes("queryKey: ['") && !content.includes("{ queryKey: ['")) continue;

  const original = content;
  let fileReplacements = 0;

  for (const [search, replace] of rules) {
    while (content.includes(search)) {
      content = content.replace(search, replace);
      fileReplacements++;
    }
  }

  if (fileReplacements > 0) {
    // Add import if needed
    if (!content.includes("import { queryKeys }") && !content.includes("queryKeys } from")) {
      const lines = content.split('\n');
      let insertIdx = 0;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith('import ')) insertIdx = i + 1;
      }
      lines.splice(insertIdx, 0, "import { queryKeys } from '@/lib/queryKeys';");
      content = lines.join('\n');
      filesWithImportAdded++;
    }

    fs.writeFileSync(filePath, content, 'utf8');
    filesModified++;
    totalReplacements += fileReplacements;

    // Check for remaining
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("queryKey: ['")) {
        remaining.push(`${path.relative(__dirname, filePath)}:${i+1}: ${lines[i].trim()}`);
      }
    }
  }
}

console.log(`Files modified: ${filesModified}`);
console.log(`Imports added: ${filesWithImportAdded}`);
console.log(`Total replacements: ${totalReplacements}`);
if (remaining.length > 0) {
  console.log(`\nRemaining inline keys (${remaining.length}):`);
  remaining.forEach(r => console.log(`  ${r}`));
}
