/**
 * Query Key Factory for TanStack Query
 * Provides type-safe, consistent query keys across the application
 * 
 * Usage:
 *   import { queryKeys } from '@/lib/queryKeys';
 *   useQuery({
 *     queryKey: queryKeys.products.detail(productId),
 *     queryFn: () => fetchProduct(productId)
 *   });
 */

export const queryKeys = {
  /**
   * Products query keys (admin)
   * @description Query keys for product management in admin panel
   */
  products: {
    /** @description Base key for all product queries */
    all: ['products'] as const,
    /** @description Parent key for all product list queries */
    lists: () => [...queryKeys.products.all, 'list'] as const,
    /**
     * @description Query key for filtered product list
     * @param filters - Optional filters for the product list query
     * @example queryKeys.products.list({ category: 'electronics' })
     */
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.products.lists(), filters] as const,
    /** @description Parent key for all product detail queries */
    details: () => [...queryKeys.products.all, 'detail'] as const,
    /**
     * @description Query key for a specific product by ID
     * @param id - Product ID
     * @example queryKeys.products.detail('123e4567-e89b-12d3-a456-426614174000')
     */
    detail: (id: string) => [...queryKeys.products.details(), id] as const,
    /**
     * @description Query key for products by tenant ID
     * @param tenantId - Tenant ID
     * @example queryKeys.products.byTenant('tenant-123')
     */
    byTenant: (tenantId: string) => [...queryKeys.products.all, 'tenant', tenantId] as const,
  },

  /**
   * Storefront products query keys (shop-facing)
   * @description Query keys for customer-facing product queries
   */
  shopProducts: {
    /** @description Base key for all shop product queries */
    all: ['shop-products'] as const,
    /**
     * @description Query key for shop product list
     * @param storeId - Optional store ID
     * @example queryKeys.shopProducts.list('store-123')
     */
    list: (storeId?: string) => [...queryKeys.shopProducts.all, storeId] as const,
    /**
     * @description Query key for shop product detail by product ID
     * @param storeId - Optional store ID
     * @param productId - Optional product ID
     * @example queryKeys.shopProducts.detail('store-123', 'prod-456')
     */
    detail: (storeId?: string, productId?: string) =>
      ['shop-product', storeId, productId] as const,
    /**
     * @description Query key for shop product detail by slug
     * @param storeId - Optional store ID
     * @param slug - Optional product slug
     * @example queryKeys.shopProducts.detailBySlug('store-123', 'cannabis-flower')
     */
    detailBySlug: (storeId?: string, slug?: string) =>
      ['shop-product', storeId, slug, true] as const,
    /**
     * @description Query key for shop categories
     * @param storeId - Optional store ID
     * @example queryKeys.shopProducts.categories('store-123')
     */
    categories: (storeId?: string) => ['shop-categories', storeId] as const,
    /**
     * @description Query key for related products by category
     * @param storeId - Optional store ID
     * @param category - Optional category
     * @example queryKeys.shopProducts.related('store-123', 'edibles')
     */
    related: (storeId?: string, category?: string) =>
      ['related-products', storeId, category] as const,
    /**
     * @description Query key for marketplace product carousels
     * @param storeId - Optional store ID
     * @example queryKeys.shopProducts.carousels('store-123')
     */
    carousels: (storeId?: string) => ['marketplace-products-map', storeId] as const,
  },

  /**
   * Orders query keys
   * @description Query keys for order management
   */
  orders: {
    /** @description Base key for all order queries */
    all: ['orders'] as const,
    /** @description Parent key for all order list queries */
    lists: () => [...queryKeys.orders.all, 'list'] as const,
    /**
     * @description Query key for filtered order list
     * @param filters - Optional filters for the order list query
     * @example queryKeys.orders.list({ status: 'pending' })
     */
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.orders.lists(), filters] as const,
    /** @description Parent key for all order detail queries */
    details: () => [...queryKeys.orders.all, 'detail'] as const,
    /**
     * @description Query key for a specific order by ID
     * @param id - Order ID
     * @example queryKeys.orders.detail('order-123')
     */
    detail: (id: string) => [...queryKeys.orders.details(), id] as const,
    /**
     * @description Query key for offline orders by tenant
     * @param tenantId - Optional tenant ID
     * @example queryKeys.orders.offline('tenant-123')
     */
    offline: (tenantId?: string) => [...queryKeys.orders.all, 'offline', tenantId] as const,
    /**
     * @description Query key for order status history
     * @param orderId - Order ID
     * @example queryKeys.orders.statusHistory('order-123')
     */
    statusHistory: (orderId: string) => [...queryKeys.orders.all, 'status-history', orderId] as const,
    /**
     * @description Query key for order pipeline view
     * @param filters - Optional filters for the order pipeline query
     * @example queryKeys.orders.pipeline({ status: 'processing' })
     */
    pipeline: (filters?: Record<string, unknown>) =>
      [...queryKeys.orders.all, 'pipeline', filters] as const,
  },

  /**
   * Wholesale Orders query keys
   * @description Query keys for wholesale order management
   */
  wholesaleOrders: {
    /** @description Base key for all wholesale order queries */
    all: ['wholesale-orders'] as const,
    /** @description Parent key for all wholesale order list queries */
    lists: () => [...queryKeys.wholesaleOrders.all, 'list'] as const,
    /**
     * @description Query key for filtered wholesale order list
     * @param filters - Optional filters for the wholesale order list query
     * @example queryKeys.wholesaleOrders.list({ status: 'processing' })
     */
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.wholesaleOrders.lists(), filters] as const,
    /** @description Parent key for all wholesale order detail queries */
    details: () => [...queryKeys.wholesaleOrders.all, 'detail'] as const,
    /**
     * @description Query key for a specific wholesale order by ID
     * @param id - Wholesale order ID
     * @example queryKeys.wholesaleOrders.detail('wo-123')
     */
    detail: (id: string) => [...queryKeys.wholesaleOrders.details(), id] as const,
  },

  /**
   * Wholesale Clients query keys
   * @description Query keys for wholesale client management
   */
  wholesaleClients: {
    /** @description Base key for all wholesale client queries */
    all: ['wholesale-clients'] as const,
    /** @description Parent key for all wholesale client list queries */
    lists: () => [...queryKeys.wholesaleClients.all, 'list'] as const,
    /**
     * @description Query key for filtered wholesale client list
     * @param filters - Optional filters for the wholesale client list query
     * @example queryKeys.wholesaleClients.list({ active: true })
     */
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.wholesaleClients.lists(), filters] as const,
    /** @description Parent key for all wholesale client detail queries */
    details: () => [...queryKeys.wholesaleClients.all, 'detail'] as const,
    /**
     * @description Query key for a specific wholesale client by ID
     * @param id - Wholesale client ID
     * @example queryKeys.wholesaleClients.detail('client-123')
     */
    detail: (id: string) => [...queryKeys.wholesaleClients.details(), id] as const,
  },

  /**
   * Inventory query keys
   * @description Query keys for inventory management
   */
  inventory: {
    /** @description Base key for all inventory queries */
    all: ['inventory'] as const,
    /** @description Parent key for all inventory list queries */
    lists: () => [...queryKeys.inventory.all, 'list'] as const,
    /**
     * @description Query key for inventory list by warehouse
     * @param warehouseId - Optional warehouse ID
     * @example queryKeys.inventory.list('warehouse-123')
     */
    list: (warehouseId?: string) =>
      [...queryKeys.inventory.lists(), { warehouseId }] as const,
    /** @description Query key for all inventory alerts */
    alerts: () => [...queryKeys.inventory.all, 'alerts'] as const,
    /**
     * @description Query key for low stock alerts by tenant
     * @param tenantId - Optional tenant ID
     * @example queryKeys.inventory.lowStockAlerts('tenant-123')
     */
    lowStockAlerts: (tenantId?: string) =>
      [...queryKeys.inventory.all, 'low-stock-alerts', tenantId] as const,
    /**
     * @description Query key for inventory movements by product
     * @param productId - Optional product ID
     * @example queryKeys.inventory.movements('prod-123')
     */
    movements: (productId?: string) =>
      [...queryKeys.inventory.all, 'movements', productId] as const,
    /**
     * @description Query key for inventory history
     * @param filters - Optional filters for the inventory history query
     * @example queryKeys.inventory.history({ startDate: '2024-01-01' })
     */
    history: (filters?: Record<string, unknown>) =>
      [...queryKeys.inventory.all, 'history', filters] as const,
    /**
     * @description Query key for inventory summary by tenant
     * @param tenantId - Optional tenant ID
     * @example queryKeys.inventory.summary('tenant-123')
     */
    summary: (tenantId?: string) =>
      [...queryKeys.inventory.all, 'summary', tenantId] as const,
    /**
     * @description Query key for inventory locations by tenant
     * @param tenantId - Optional tenant ID
     * @example queryKeys.inventory.locations('tenant-123')
     */
    locations: (tenantId?: string) =>
      [...queryKeys.inventory.all, 'locations', tenantId] as const,
    /**
     * @description Query key for inventory by location
     * @param locationId - Location ID
     * @example queryKeys.inventory.byLocation('loc-123')
     */
    byLocation: (locationId: string) =>
      [...queryKeys.inventory.all, 'by-location', locationId] as const,
  },

  /**
   * Marketplace Customers query keys
   * @description Query keys for marketplace customer management
   */
  marketplaceCustomers: {
    /** @description Base key for all marketplace customer queries */
    all: ['marketplace-customers'] as const,
  },

  /**
   * Cart query keys
   * @description Query keys for shopping cart management
   */
  cart: {
    /** @description Base key for all cart queries */
    all: ['cart'] as const,
    /**
     * @description Query key for user cart
     * @param userId - Optional user ID
     * @example queryKeys.cart.user('user-123')
     */
    user: (userId?: string) => [...queryKeys.cart.all, userId] as const,
    /**
     * @description Query key for guest cart
     * @example queryKeys.cart.guest()
     */
    guest: () => [...queryKeys.cart.all, 'guest'] as const,
  },

  /**
   * Disposable Menus query keys
   * @description Query keys for disposable menu management
   */
  menus: {
    /** @description Base key for all menu queries */
    all: ['menus'] as const,
    /** @description Parent key for all menu list queries */
    lists: () => [...queryKeys.menus.all, 'list'] as const,
    /**
     * @description Query key for filtered menu list
     * @param filters - Optional filters for the menu list query
     * @example queryKeys.menus.list({ active: true })
     */
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.menus.lists(), filters] as const,
    /** @description Parent key for all menu detail queries */
    details: () => [...queryKeys.menus.all, 'detail'] as const,
    /**
     * @description Query key for a specific menu by ID
     * @param id - Menu ID
     * @example queryKeys.menus.detail('menu-123')
     */
    detail: (id: string) => [...queryKeys.menus.details(), id] as const,
    /**
     * @description Query key for public menu access by token
     * @param token - Public access token
     * @example queryKeys.menus.public('abc123token')
     */
    public: (token: string) => [...queryKeys.menus.all, 'public', token] as const,
    /**
     * @description Query key for menu analytics
     * @param id - Menu ID
     * @example queryKeys.menus.analytics('menu-123')
     */
    analytics: (id: string) => [...queryKeys.menus.detail(id), 'analytics'] as const,
  },

  /**
   * Couriers query keys
   * @description Query keys for courier/driver management
   */
  couriers: {
    /** @description Base key for all courier queries */
    all: ['couriers'] as const,
    /** @description Parent key for all courier list queries */
    lists: () => [...queryKeys.couriers.all, 'list'] as const,
    /**
     * @description Query key for filtered courier list
     * @param filters - Optional filters for the courier list query
     * @example queryKeys.couriers.list({ status: 'active' })
     */
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.couriers.lists(), filters] as const,
    /** @description Parent key for all courier detail queries */
    details: () => [...queryKeys.couriers.all, 'detail'] as const,
    /**
     * @description Query key for a specific courier by ID
     * @param id - Courier ID
     * @example queryKeys.couriers.detail('courier-123')
     */
    detail: (id: string) => [...queryKeys.couriers.details(), id] as const,
    /**
     * @description Query key for courier earnings
     * @param id - Courier ID
     * @example queryKeys.couriers.earnings('courier-123')
     */
    earnings: (id: string) => [...queryKeys.couriers.detail(id), 'earnings'] as const,
    /**
     * @description Query key for courier location
     * @param id - Courier ID
     * @example queryKeys.couriers.location('courier-123')
     */
    location: (id: string) => [...queryKeys.couriers.detail(id), 'location'] as const,
  },

  /**
   * Deliveries query keys
   * @description Query keys for delivery management
   */
  deliveries: {
    /** @description Base key for all delivery queries */
    all: ['deliveries'] as const,
    /** @description Parent key for all delivery list queries */
    lists: () => [...queryKeys.deliveries.all, 'list'] as const,
    /**
     * @description Query key for filtered delivery list
     * @param filters - Optional filters for the delivery list query
     * @example queryKeys.deliveries.list({ status: 'in-transit' })
     */
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.deliveries.lists(), filters] as const,
    /**
     * @description Query key for active deliveries
     * @example queryKeys.deliveries.active()
     */
    active: () => [...queryKeys.deliveries.all, 'active'] as const,
    /**
     * @description Query key for a specific delivery by ID
     * @param id - Delivery ID
     * @example queryKeys.deliveries.detail('delivery-123')
     */
    detail: (id: string) => [...queryKeys.deliveries.all, id] as const,
  },

  /**
   * Customers query keys
   * @description Query keys for customer management
   */
  customers: {
    /** @description Base key for all customer queries */
    all: ['customers'] as const,
    /** @description Parent key for all customer list queries */
    lists: () => [...queryKeys.customers.all, 'list'] as const,
    /**
     * @description Query key for filtered customer list
     * @param filters - Optional filters for the customer list query
     * @example queryKeys.customers.list({ vip: true })
     */
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.customers.lists(), filters] as const,
    /**
     * @description Query key for a specific customer by ID
     * @param id - Customer ID
     * @example queryKeys.customers.detail('customer-123')
     */
    detail: (id: string) => [...queryKeys.customers.all, id] as const,
    /**
     * @description Query key for customer analytics
     * @param id - Customer ID
     * @example queryKeys.customers.analytics('customer-123')
     */
    analytics: (id: string) => [...queryKeys.customers.detail(id), 'analytics'] as const,
    /**
     * @description Query key for customer statistics
     * @param customerId - Customer ID
     * @example queryKeys.customers.stats('customer-123')
     */
    stats: (customerId: string) => [...queryKeys.customers.detail(customerId), 'stats'] as const,
  },

  /**
   * Tenants query keys
   * @description Query keys for tenant management (multi-tenancy)
   */
  tenants: {
    /** @description Base key for all tenant queries */
    all: ['tenants'] as const,
    /** @description Parent key for all tenant list queries */
    lists: () => [...queryKeys.tenants.all, 'list'] as const,
    /**
     * @description Query key for filtered tenant list
     * @param filters - Optional filters for the tenant list query
     * @example queryKeys.tenants.list({ active: true })
     */
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.tenants.lists(), filters] as const,
    /**
     * @description Query key for a specific tenant by ID
     * @param id - Tenant ID
     * @example queryKeys.tenants.detail('tenant-123')
     */
    detail: (id: string) => [...queryKeys.tenants.all, id] as const,
    /**
     * @description Query key for the current tenant context
     * @example queryKeys.tenants.current()
     */
    current: () => [...queryKeys.tenants.all, 'current'] as const,
  },

  /**
   * Dashboard Hub query keys
   * @description Query keys for dashboard data
   */
  dashboard: {
    /** @description Base key for all dashboard queries */
    all: ['dashboard'] as const,
    /**
     * @description Query key for dashboard statistics
     * @param tenantId - Optional tenant ID
     * @param dateRangeKey - Optional date range key
     * @example queryKeys.dashboard.stats('tenant-123', '30d')
     */
    stats: (tenantId?: string, dateRangeKey?: string) =>
      [...queryKeys.dashboard.all, 'stats', tenantId, dateRangeKey] as const,
    /**
     * @description Query key for dashboard widgets
     * @param tenantId - Optional tenant ID
     * @example queryKeys.dashboard.widgets('tenant-123')
     */
    widgets: (tenantId?: string) =>
      [...queryKeys.dashboard.all, 'widgets', tenantId] as const,
    /**
     * @description Query key for dashboard alerts
     * @param tenantId - Optional tenant ID
     * @example queryKeys.dashboard.alerts('tenant-123')
     */
    alerts: (tenantId?: string) =>
      [...queryKeys.dashboard.all, 'alerts', tenantId] as const,
  },

  /**
   * Analytics query keys
   * @description Query keys for analytics and reporting
   */
  analytics: {
    /** @description Base key for all analytics queries */
    all: ['analytics'] as const,
    /**
     * @description Query key for revenue analytics
     * @param filters - Optional filters for revenue analytics
     * @example queryKeys.analytics.revenue({ period: 'monthly' })
     */
    revenue: (filters?: Record<string, unknown>) =>
      [...queryKeys.analytics.all, 'revenue', filters] as const,
    /**
     * @description Query key for order analytics
     * @param filters - Optional filters for order analytics
     * @example queryKeys.analytics.orders({ status: 'completed' })
     */
    orders: (filters?: Record<string, unknown>) =>
      [...queryKeys.analytics.all, 'orders', filters] as const,
    /**
     * @description Query key for customer analytics
     * @param filters - Optional filters for customer analytics
     * @example queryKeys.analytics.customers({ segment: 'vip' })
     */
    customers: (filters?: Record<string, unknown>) =>
      [...queryKeys.analytics.all, 'customers', filters] as const,
    /**
     * @description Query key for product analytics
     * @param filters - Optional filters for product analytics
     * @example queryKeys.analytics.products({ category: 'edibles' })
     */
    products: (filters?: Record<string, unknown>) =>
      [...queryKeys.analytics.all, 'products', filters] as const,
    /**
     * @description Query key for traffic source analytics
     * @param filters - Optional filters for traffic source analytics
     * @example queryKeys.analytics.trafficSources({ timeframe: '7d' })
     */
    trafficSources: (filters?: Record<string, unknown>) =>
      [...queryKeys.analytics.all, 'traffic-sources', filters] as const,
    /**
     * @description Query key for realtime analytics
     * @param filters - Optional filters for realtime analytics
     * @example queryKeys.analytics.realtime({ tenantId: 'tenant-123' })
     */
    realtime: (filters?: Record<string, unknown>) =>
      [...queryKeys.analytics.all, 'realtime', filters] as const,
  },

  /**
   * Super Admin query keys
   * @description Query keys for super admin functionality
   */
  superAdmin: {
    /** @description Base key for all super admin queries */
    all: ['super-admin'] as const,
    /**
     * @description Query key for super admin dashboard
     * @example queryKeys.superAdmin.dashboard()
     */
    dashboard: () => [...queryKeys.superAdmin.all, 'dashboard'] as const,
    /**
     * @description Query key for super admin metrics
     * @example queryKeys.superAdmin.metrics()
     */
    metrics: () => [...queryKeys.superAdmin.all, 'metrics'] as const,
    /**
     * @description Query key for super admin monitoring
     * @example queryKeys.superAdmin.monitoring()
     */
    monitoring: () => [...queryKeys.superAdmin.all, 'monitoring'] as const,
  },

  /**
   * Categories query keys
   * @description Query keys for product category management
   */
  categories: {
    /** @description Base key for all category queries */
    all: ['categories'] as const,
    /** @description Parent key for all category list queries */
    lists: () => [...queryKeys.categories.all, 'list'] as const,
    /**
     * @description Query key for category list by tenant
     * @param tenantId - Optional tenant ID
     * @example queryKeys.categories.list('tenant-123')
     */
    list: (tenantId?: string) =>
      [...queryKeys.categories.lists(), { tenantId }] as const,
    /**
     * @description Query key for a specific category by ID
     * @param id - Category ID
     * @example queryKeys.categories.detail('cat-123')
     */
    detail: (id: string) => [...queryKeys.categories.all, id] as const,
  },

  /**
   * Product Images query keys
   * @description Query keys for product image management
   */
  productImages: {
    /** @description Base key for all product image queries */
    all: ['product-images'] as const,
    /** @description Parent key for all product image list queries */
    lists: () => [...queryKeys.productImages.all, 'list'] as const,
    /**
     * @description Query key for product image list by tenant
     * @param tenantId - Optional tenant ID
     * @example queryKeys.productImages.list('tenant-123')
     */
    list: (tenantId?: string) =>
      [...queryKeys.productImages.lists(), { tenantId }] as const,
    /**
     * @description Query key for a specific product image by ID
     * @param id - Product image ID
     * @example queryKeys.productImages.detail('img-123')
     */
    detail: (id: string) => [...queryKeys.productImages.all, id] as const,
  },

  /**
   * Pricing query keys
   * @description Query keys for pricing and tier management
   */
  pricing: {
    /** @description Base key for all pricing queries */
    all: ['pricing'] as const,
    /**
     * @description Query key for product pricing by tenant
     * @param tenantId - Optional tenant ID
     * @example queryKeys.pricing.products('tenant-123')
     */
    products: (tenantId?: string) =>
      [...queryKeys.pricing.all, 'products', { tenantId }] as const,
    /**
     * @description Query key for pricing tiers by product
     * @param productId - Optional product ID
     * @example queryKeys.pricing.tiers('prod-123')
     */
    tiers: (productId?: string) =>
      [...queryKeys.pricing.all, 'tiers', { productId }] as const,
  },

  /**
   * Runners query keys
   * @description Query keys for delivery runner management
   */
  runners: {
    /** @description Base key for all runner queries */
    all: ['runners'] as const,
    /** @description Parent key for all runner list queries */
    lists: () => [...queryKeys.runners.all, 'list'] as const,
    /**
     * @description Query key for filtered runner list
     * @param filters - Optional filters for the runner list query
     * @example queryKeys.runners.list({ status: 'available' })
     */
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.runners.lists(), filters] as const,
    /**
     * @description Query key for a specific runner by ID
     * @param id - Runner ID
     * @example queryKeys.runners.detail('runner-123')
     */
    detail: (id: string) => [...queryKeys.runners.all, id] as const,
    /**
     * @description Query key for runner deliveries
     * @param runnerId - Runner ID
     * @example queryKeys.runners.deliveries('runner-123')
     */
    deliveries: (runnerId: string) =>
      [...queryKeys.runners.detail(runnerId), 'deliveries'] as const,
    /**
     * @description Query key for available runners
     * @example queryKeys.runners.available()
     */
    available: () => [...queryKeys.runners.all, 'available'] as const,
  },

  /**
   * POS / Cash Register query keys
   * @description Query keys for point-of-sale system management
   */
  pos: {
    /** @description Base key for all POS queries */
    all: ['pos'] as const,
    /**
     * @description Query key for POS products by tenant
     * @param tenantId - Optional tenant ID
     * @example queryKeys.pos.products('tenant-123')
     */
    products: (tenantId?: string) =>
      [...queryKeys.pos.all, 'products', { tenantId }] as const,
    /**
     * @description Query key for POS transactions by tenant
     * @param tenantId - Optional tenant ID
     * @example queryKeys.pos.transactions('tenant-123')
     */
    transactions: (tenantId?: string) =>
      [...queryKeys.pos.all, 'transactions', { tenantId }] as const,
    /**
     * @description Query key for POS cash drawer by tenant
     * @param tenantId - Optional tenant ID
     * @example queryKeys.pos.cashDrawer('tenant-123')
     */
    cashDrawer: (tenantId?: string) =>
      [...queryKeys.pos.all, 'cash-drawer', { tenantId }] as const,
    /**
     * POS Shifts query keys
     * @description Nested query keys for POS shift management
     */
    shifts: {
      /** @description Base key for all POS shift queries */
      all: () => [...queryKeys.pos.all, 'shifts'] as const,
      /**
       * @description Query key for active POS shift
       * @param tenantId - Optional tenant ID
       * @example queryKeys.pos.shifts.active('tenant-123')
       */
      active: (tenantId?: string) =>
        [...queryKeys.pos.shifts.all(), 'active', tenantId] as const,
      /**
       * @description Query key for recent POS shifts
       * @param tenantId - Optional tenant ID
       * @example queryKeys.pos.shifts.recent('tenant-123')
       */
      recent: (tenantId?: string) =>
        [...queryKeys.pos.shifts.all(), 'recent', tenantId] as const,
      /**
       * @description Query key for a specific POS shift by ID
       * @param shiftId - Optional shift ID
       * @example queryKeys.pos.shifts.detail('shift-123')
       */
      detail: (shiftId?: string) =>
        [...queryKeys.pos.shifts.all(), 'detail', shiftId] as const,
      /**
       * @description Query key for POS shift transactions
       * @param shiftId - Optional shift ID
       * @example queryKeys.pos.shifts.transactions('shift-123')
       */
      transactions: (shiftId?: string) =>
        [...queryKeys.pos.shifts.all(), 'transactions', shiftId] as const,
      /**
       * @description Query key for POS shift summary
       * @param tenantId - Optional tenant ID
       * @example queryKeys.pos.shifts.summary('tenant-123')
       */
      summary: (tenantId?: string) =>
        [...queryKeys.pos.shifts.all(), 'summary', tenantId] as const,
    },
  },

  /**
   * Finance query keys
   * @description Query keys for financial data and reporting
   */
  finance: {
    /** @description Base key for all finance queries */
    all: ['finance'] as const,
    /**
     * @description Query key for revenue data by tenant
     * @param tenantId - Optional tenant ID
     * @example queryKeys.finance.revenue('tenant-123')
     */
    revenue: (tenantId?: string) =>
      [...queryKeys.finance.all, 'revenue', { tenantId }] as const,
    /**
     * @description Query key for completed orders by tenant and date range
     * @param tenantId - Optional tenant ID
     * @param dateRange - Optional date range
     * @example queryKeys.finance.completedOrders('tenant-123', '30d')
     */
    completedOrders: (tenantId?: string, dateRange?: string) =>
      [...queryKeys.finance.all, 'completed-orders', { tenantId, dateRange }] as const,
    /**
     * @description Query key for financial snapshot by date range
     * @param dateRange - Optional date range
     * @example queryKeys.finance.snapshot('7d')
     */
    snapshot: (dateRange?: string) =>
      [...queryKeys.finance.all, 'snapshot', { dateRange }] as const,
    /**
     * @description Query key for revenue goal by tenant
     * @param tenantId - Optional tenant ID
     * @example queryKeys.finance.revenueGoal('tenant-123')
     */
    revenueGoal: (tenantId?: string) =>
      [...queryKeys.finance.all, 'revenue-goal', { tenantId }] as const,
    /**
     * @description Query key for financial snapshot by date range
     * @param dateRange - Optional date range
     * @example queryKeys.finance.snapshot('7d')
     */
    snapshot: (dateRange?: string) =>
      [...queryKeys.finance.all, 'snapshot', { dateRange }] as const,
  },

  /**
   * Storefront query keys
   * @description Query keys for storefront configuration
   */
  storefront: {
    /** @description Base key for all storefront queries */
    all: ['storefront'] as const,
    /**
     * @description Query key for storefront banners
     * @param storeId - Optional store ID
     * @example queryKeys.storefront.banners('store-123')
     */
    banners: (storeId?: string) =>
      [...queryKeys.storefront.all, 'banners', { storeId }] as const,
    /**
     * @description Query key for storefront settings by tenant
     * @param tenantId - Optional tenant ID
     * @example queryKeys.storefront.settings('tenant-123')
     */
    settings: (tenantId?: string) =>
      [...queryKeys.storefront.all, 'settings', { tenantId }] as const,
  },

  /**
   * Locations query keys
   * @description Query keys for location/warehouse management
   */
  locations: {
    /** @description Base key for all location queries */
    all: ['locations'] as const,
    /** @description Parent key for all location list queries */
    lists: () => [...queryKeys.locations.all, 'list'] as const,
    /**
     * @description Query key for location list by tenant with filters
     * @param tenantId - Optional tenant ID
     * @param filters - Optional filters for the location list query
     * @example queryKeys.locations.list('tenant-123', { active: true })
     */
    list: (tenantId?: string, filters?: Record<string, unknown>) =>
      [...queryKeys.locations.lists(), { tenantId, ...filters }] as const,
    /**
     * @description Query key for a specific location by ID
     * @param id - Location ID
     * @example queryKeys.locations.detail('loc-123')
     */
    detail: (id: string) => [...queryKeys.locations.all, id] as const,
    /**
     * @description Query key for location operations summary
     * @param tenantId - Tenant ID
     * @example queryKeys.locations.operationsSummary('tenant-123')
     */
    operationsSummary: (tenantId: string) =>
      [...queryKeys.locations.all, 'operations-summary', tenantId] as const,
  },

  /**
   * Stock Alerts query keys
   * @description Query keys for inventory stock alerts
   */
  stockAlerts: {
    /** @description Base key for all stock alert queries */
    all: ['stock-alerts'] as const,
    /**
     * @description Query key for active stock alerts by tenant
     * @param tenantId - Optional tenant ID
     * @example queryKeys.stockAlerts.active('tenant-123')
     */
    active: (tenantId?: string) =>
      [...queryKeys.stockAlerts.all, 'active', tenantId] as const,
  },


  /**
   * Batches query keys
   * @description Query keys for inventory batch management
   */
  batches: {
    /** @description Base key for all inventory batch queries */
    all: ['inventory-batches'] as const,
    /** @description Parent key for all batch list queries */
    lists: () => [...queryKeys.batches.all, 'list'] as const,
    /**
     * @description Query key for batch list by tenant
     * @param tenantId - Optional tenant ID
     * @example queryKeys.batches.list('tenant-123')
     */
    list: (tenantId?: string) =>
      [...queryKeys.batches.lists(), { tenantId }] as const,
    /**
     * @description Query key for a specific batch by ID
     * @param id - Batch ID
     * @example queryKeys.batches.detail('batch-123')
     */
    detail: (id: string) => [...queryKeys.batches.all, id] as const,
  },

  /**
   * Warehouses query keys
   * @description Query keys for warehouse management
   */
  warehouses: {
    /** @description Base key for all warehouse queries */
    all: ['warehouses'] as const,
    /** @description Parent key for all warehouse list queries */
    lists: () => [...queryKeys.warehouses.all, 'list'] as const,
    /**
     * @description Query key for warehouse list by tenant
     * @param tenantId - Optional tenant ID
     * @example queryKeys.warehouses.list('tenant-123')
     */
    list: (tenantId?: string) =>
      [...queryKeys.warehouses.lists(), { tenantId }] as const,
    /**
     * @description Query key for a specific warehouse by ID
     * @param id - Warehouse ID
     * @example queryKeys.warehouses.detail('wh-123')
     */
    detail: (id: string) => [...queryKeys.warehouses.all, id] as const,
  },

  /**
   * Receiving query keys
   * @description Query keys for receiving/intake management
   */
  receiving: {
    /** @description Base key for all receiving queries */
    all: ['receiving'] as const,
    /** @description Parent key for all receiving list queries */
    lists: () => [...queryKeys.receiving.all, 'list'] as const,
    /**
     * @description Query key for receiving list by tenant and filter
     * @param tenantId - Optional tenant ID
     * @param filter - Optional filter string
     * @example queryKeys.receiving.list('tenant-123', 'pending')
     */
    list: (tenantId?: string, filter?: string) =>
      [...queryKeys.receiving.lists(), { tenantId, filter }] as const,
    /**
     * @description Query key for a specific receiving record by ID
     * @param id - Receiving record ID
     * @example queryKeys.receiving.detail('recv-123')
     */
    detail: (id: string) => [...queryKeys.receiving.all, id] as const,
  },

  /**
   * Suppliers query keys
   * @description Query keys for supplier management
   */
  suppliers: {
    /** @description Base key for all supplier queries */
    all: ['suppliers'] as const,
    /** @description Parent key for all supplier list queries */
    lists: () => [...queryKeys.suppliers.all, 'list'] as const,
    /**
     * @description Query key for filtered supplier list
     * @param filters - Optional filters for the supplier list query
     * @example queryKeys.suppliers.list({ active: true })
     */
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.suppliers.lists(), filters] as const,
    /** @description Parent key for all supplier detail queries */
    details: () => [...queryKeys.suppliers.all, 'detail'] as const,
    /**
     * @description Query key for a specific supplier by ID
     * @param id - Supplier ID
     * @example queryKeys.suppliers.detail('sup-123')
     */
    detail: (id: string) => [...queryKeys.suppliers.details(), id] as const,
    /**
     * @description Query key for supplier transactions
     * @param supplierId - Supplier ID
     * @example queryKeys.suppliers.transactions('sup-123')
     */
    transactions: (supplierId: string) =>
      [...queryKeys.suppliers.detail(supplierId), 'transactions'] as const,
  },

  /**
   * Purchase Orders query keys
   * @description Query keys for purchase order management
   */
  purchaseOrders: {
    /** @description Base key for all purchase order queries */
    all: ['purchase-orders'] as const,
    /** @description Parent key for all purchase order list queries */
    lists: () => [...queryKeys.purchaseOrders.all, 'list'] as const,
    /**
     * @description Query key for filtered purchase order list
     * @param filters - Optional filters for the purchase order list query
     * @example queryKeys.purchaseOrders.list({ status: 'pending' })
     */
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.purchaseOrders.lists(), filters] as const,
    /** @description Parent key for all purchase order detail queries */
    details: () => [...queryKeys.purchaseOrders.all, 'detail'] as const,
    /**
     * @description Query key for a specific purchase order by ID
     * @param id - Purchase order ID
     * @example queryKeys.purchaseOrders.detail('po-123')
     */
    detail: (id: string) => [...queryKeys.purchaseOrders.details(), id] as const,
    /**
     * @description Query key for purchase order items
     * @param poId - Purchase order ID
     * @example queryKeys.purchaseOrders.items('po-123')
     */
    items: (poId: string) =>
      [...queryKeys.purchaseOrders.detail(poId), 'items'] as const,
  },

  /**
   * Returns query keys
   * @description Query keys for product return management
   */
  returns: {
    /** @description Base key for all return queries */
    all: ['returns'] as const,
    /** @description Parent key for all return list queries */
    lists: () => [...queryKeys.returns.all, 'list'] as const,
    /**
     * @description Query key for filtered return list
     * @param filters - Optional filters for the return list query
     * @example queryKeys.returns.list({ status: 'processing' })
     */
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.returns.lists(), filters] as const,
    /** @description Parent key for all return detail queries */
    details: () => [...queryKeys.returns.all, 'detail'] as const,
    /**
     * @description Query key for a specific return by ID
     * @param id - Return ID
     * @example queryKeys.returns.detail('ret-123')
     */
    detail: (id: string) => [...queryKeys.returns.details(), id] as const,
  },

  /**
   * Loyalty query keys
   * @description Query keys for customer loyalty program management
   */
  loyalty: {
    /** @description Base key for all loyalty queries */
    all: ['loyalty'] as const,
    /**
     * @description Query key for loyalty rewards
     * @example queryKeys.loyalty.rewards()
     */
    rewards: () => [...queryKeys.loyalty.all, 'rewards'] as const,
    /**
     * @description Query key for loyalty analytics
     * @example queryKeys.loyalty.analytics()
     */
    analytics: () => [...queryKeys.loyalty.all, 'analytics'] as const,
    /**
     * @description Query key for loyalty program configuration by store
     * @param storeId - Store ID
     * @example queryKeys.loyalty.config('store-123')
     */
    config: (storeId: string) => [...queryKeys.loyalty.all, 'config', storeId] as const,
    /**
     * @description Query key for customer loyalty data
     * @param storeId - Store ID
     * @param email - Customer email
     * @example queryKeys.loyalty.customer('store-123', 'customer@example.com')
     */
    customer: (storeId: string, email: string) =>
      [...queryKeys.loyalty.all, 'customer', storeId, email] as const,
  },

  /**
   * Coupons query keys
   * @description Query keys for coupon and discount management
   */
  coupons: {
    /** @description Base key for all coupon queries */
    all: ['coupons'] as const,
    /** @description Parent key for all coupon list queries */
    lists: () => [...queryKeys.coupons.all, 'list'] as const,
    /**
     * @description Query key for filtered coupon list
     * @param filters - Optional filters for the coupon list query
     * @example queryKeys.coupons.list({ active: true })
     */
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.coupons.lists(), filters] as const,
    /** @description Parent key for all coupon detail queries */
    details: () => [...queryKeys.coupons.all, 'detail'] as const,
    /**
     * @description Query key for a specific coupon by ID
     * @param id - Coupon ID
     * @example queryKeys.coupons.detail('cpn-123')
     */
    detail: (id: string) => [...queryKeys.coupons.details(), id] as const,
  },

  /**
   * Marketing query keys
   * @description Query keys for marketing automation and campaigns
   */
  marketing: {
    /** @description Base key for all marketing queries */
    all: ['marketing'] as const,
    /**
     * @description Query key for marketing campaigns
     * @example queryKeys.marketing.campaigns()
     */
    campaigns: () => [...queryKeys.marketing.all, 'campaigns'] as const,
    /**
     * @description Query key for marketing workflows
     * @example queryKeys.marketing.workflows()
     */
    workflows: () => [...queryKeys.marketing.all, 'workflows'] as const,
  },

  /**
   * Appointments query keys
   * @description Query keys for appointment scheduling
   */
  appointments: {
    /** @description Base key for all appointment queries */
    all: ['appointments'] as const,
    /** @description Parent key for all appointment list queries */
    lists: () => [...queryKeys.appointments.all, 'list'] as const,
    /**
     * @description Query key for filtered appointment list
     * @param filters - Optional filters for the appointment list query
     * @example queryKeys.appointments.list({ date: '2024-01-15' })
     */
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.appointments.lists(), filters] as const,
    /** @description Parent key for all appointment detail queries */
    details: () => [...queryKeys.appointments.all, 'detail'] as const,
    /**
     * @description Query key for a specific appointment by ID
     * @param id - Appointment ID
     * @example queryKeys.appointments.detail('appt-123')
     */
    detail: (id: string) => [...queryKeys.appointments.details(), id] as const,
  },

  /**
   * Support query keys
   * @description Query keys for customer support management
   */
  support: {
    /** @description Base key for all support queries */
    all: ['support'] as const,
    /**
     * @description Query key for support tickets
     * @example queryKeys.support.tickets()
     */
    tickets: () => [...queryKeys.support.all, 'tickets'] as const,
  },

  /**
   * Recall query keys
   * @description Query keys for product recall management
   */
  recall: {
    /** @description Base key for all recall queries */
    all: ['recall'] as const,
    /** @description Parent key for all recall list queries */
    lists: () => [...queryKeys.recall.all, 'list'] as const,
    /**
     * @description Query key for filtered recall list
     * @param filters - Optional filters for the recall list query
     * @example queryKeys.recall.list({ status: 'active' })
     */
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.recall.lists(), filters] as const,
    /** @description Parent key for all recall detail queries */
    details: () => [...queryKeys.recall.all, 'detail'] as const,
    /**
     * @description Query key for a specific recall by ID
     * @param id - Recall ID
     * @example queryKeys.recall.detail('recall-123')
     */
    detail: (id: string) => [...queryKeys.recall.details(), id] as const,
  },

  /**
   * Compliance query keys
   * @description Query keys for compliance and regulatory management
   */
  compliance: {
    /** @description Base key for all compliance queries */
    all: ['compliance'] as const,
    /**
     * @description Query key for compliance documents
     * @example queryKeys.compliance.documents()
     */
    documents: () => [...queryKeys.compliance.all, 'documents'] as const,
  },

  /**
   * Reporting query keys
   * @description Query keys for custom and scheduled reporting
   */
  reporting: {
    /** @description Base key for all reporting queries */
    all: ['reporting'] as const,
    /**
     * @description Query key for custom reports
     * @example queryKeys.reporting.custom()
     */
    custom: () => [...queryKeys.reporting.all, 'custom'] as const,
    /**
     * @description Query key for scheduled reports
     * @example queryKeys.reporting.scheduled()
     */
    scheduled: () => [...queryKeys.reporting.all, 'scheduled'] as const,
  },

  /**
   * Roles query keys
   * @description Query keys for role and permission management
   */
  roles: {
    /** @description Base key for all role queries */
    all: ['roles'] as const,
    /** @description Parent key for all role list queries */
    lists: () => [...queryKeys.roles.all, 'list'] as const,
    /**
     * @description Query key for role list by tenant
     * @param tenantId - Optional tenant ID
     * @example queryKeys.roles.list('tenant-123')
     */
    list: (tenantId?: string) => [...queryKeys.roles.lists(), { tenantId }] as const,
    /**
     * @description Query key for a specific role by ID
     * @param id - Role ID
     * @example queryKeys.roles.detail('role-123')
     */
    detail: (id: string) => [...queryKeys.roles.all, id] as const,
  },

  /**
   * Vendor query keys
   * @description Query keys for vendor portal functionality
   */
  vendor: {
    /** @description Base key for all vendor queries */
    all: ['vendor'] as const,
    /**
     * @description Query key for vendor purchase orders
     * @param vendorId - Vendor ID
     * @example queryKeys.vendor.purchaseOrders('vendor-123')
     */
    purchaseOrders: (vendorId: string) => [...queryKeys.vendor.all, 'purchase-orders', vendorId] as const,
    /**
     * @description Query key for vendor invoices
     * @param vendorId - Vendor ID
     * @example queryKeys.vendor.invoices('vendor-123')
     */
    invoices: (vendorId: string) => [...queryKeys.vendor.all, 'invoices', vendorId] as const,
  },

  /**
   * Forum query keys
   * @description Query keys for community forum functionality
   */
  forum: {
    /** @description Base key for all forum queries */
    all: ['forum'] as const,
    /**
     * Forum Posts query keys
     * @description Nested query keys for forum post management
     */
    posts: {
      /** @description Base key for all forum post queries */
      all: () => [...queryKeys.forum.all, 'posts'] as const,
      /** @description Parent key for all forum post list queries */
      lists: () => [...queryKeys.forum.posts.all(), 'list'] as const,
      /**
       * @description Query key for forum post list with options
       * @param options - Optional query options
       * @example queryKeys.forum.posts.list({ category: 'general' })
       */
      list: (options?: Record<string, unknown>) => [...queryKeys.forum.posts.lists(), options] as const,
      /** @description Parent key for all forum post detail queries */
      details: () => [...queryKeys.forum.posts.all(), 'detail'] as const,
      /**
       * @description Query key for a specific forum post by ID
       * @param id - Post ID
       * @example queryKeys.forum.posts.detail('post-123')
       */
      detail: (id: string) => [...queryKeys.forum.posts.details(), id] as const,
    },
    /**
     * Forum Comments query keys
     * @description Nested query keys for forum comment management
     */
    comments: {
      /** @description Base key for all forum comment queries */
      all: () => [...queryKeys.forum.all, 'comments'] as const,
      /** @description Parent key for all forum comment list queries */
      lists: () => [...queryKeys.forum.comments.all(), 'list'] as const,
      /**
       * @description Query key for comments by post
       * @param postId - Post ID
       * @example queryKeys.forum.comments.list('post-123')
       */
      list: (postId: string) => [...queryKeys.forum.comments.lists(), postId] as const,
    },
    /**
     * Forum Categories query keys
     * @description Nested query keys for forum category management
     */
    categories: {
      /** @description Base key for all forum category queries */
      all: () => [...queryKeys.forum.all, 'categories'] as const,
      /**
       * @description Query key for forum category list
       * @example queryKeys.forum.categories.lists()
       */
      lists: () => [...queryKeys.forum.categories.all(), 'list'] as const,
    },
    /**
     * Forum Votes query keys
     * @description Nested query keys for forum voting system
     */
    votes: {
      /** @description Base key for all forum vote queries */
      all: () => [...queryKeys.forum.all, 'votes'] as const,
      /**
       * @description Query key for user vote on a specific item
       * @param votableType - Type of votable item (post/comment)
       * @param votableId - ID of votable item
       * @example queryKeys.forum.votes.userVote('post', 'post-123')
       */
      userVote: (votableType: string, votableId: string) => [...queryKeys.forum.votes.all(), votableType, votableId] as const,
    },
    /**
     * Forum Profile query keys
     * @description Nested query keys for forum user profiles
     */
    profile: {
      /** @description Base key for all forum profile queries */
      all: () => [...queryKeys.forum.all, 'profile'] as const,
      /**
       * @description Query key for current user's forum profile
       * @example queryKeys.forum.profile.current()
       */
      current: () => [...queryKeys.forum.profile.all(), 'current'] as const,
      /**
       * @description Query key for forum profile by username
       * @param username - Username
       * @example queryKeys.forum.profile.byUsername('john_doe')
       */
      byUsername: (username: string) => [...queryKeys.forum.profile.all(), 'username', username] as const,
    },
    /**
     * Forum Approval query keys
     * @description Nested query keys for forum content approval
     */
    approval: {
      /** @description Base key for all forum approval queries */
      all: () => [...queryKeys.forum.all, 'approval'] as const,
      /**
       * @description Query key for current approval status
       * @example queryKeys.forum.approval.current()
       */
      current: () => [...queryKeys.forum.approval.all(), 'current'] as const,
    },
    /**
     * Forum Reputation query keys
     * @description Nested query keys for forum reputation system
     */
    reputation: {
      /** @description Base key for all forum reputation queries */
      all: () => [...queryKeys.forum.all, 'reputation'] as const,
      /**
       * @description Query key for user reputation
       * @param userId - User ID
       * @example queryKeys.forum.reputation.user('user-123')
       */
      user: (userId: string) => [...queryKeys.forum.reputation.all(), userId] as const,
    },
    /**
     * Forum Notifications query keys
     * @description Nested query keys for forum notifications
     */
    notifications: {
      /** @description Base key for all forum notification queries */
      all: () => [...queryKeys.forum.all, 'notifications'] as const,
      /**
       * @description Query key for forum notification list
       * @example queryKeys.forum.notifications.lists()
       */
      lists: () => [...queryKeys.forum.notifications.all(), 'list'] as const,
    },
    /**
     * Forum Search query keys
     * @description Nested query keys for forum search functionality
     */
    search: {
      /** @description Base key for all forum search queries */
      all: () => [...queryKeys.forum.all, 'search'] as const,
      /**
       * @description Query key for forum post search
       * @param query - Search query string
       * @example queryKeys.forum.search.posts('cannabis regulations')
       */
      posts: (query: string) => [...queryKeys.forum.search.all(), 'posts', query] as const,
    },
  },
  /**
   * CRM System query keys
   * @description Query keys for Customer Relationship Management functionality
   */
  crm: {
    all: ['crm'] as const,
    clients: {
      all: () => [...queryKeys.crm.all, 'clients'] as const,
      lists: () => [...queryKeys.crm.clients.all(), 'list'] as const,
      list: (status?: string) => [...queryKeys.crm.clients.lists(), { status }] as const,
      detail: (id: string) => [...queryKeys.crm.clients.all(), id] as const,
      search: (term: string) => [...queryKeys.crm.clients.all(), 'search', term] as const,
    },
    invoices: {
      all: () => [...queryKeys.crm.all, 'invoices'] as const,
      lists: () => [...queryKeys.crm.invoices.all(), 'list'] as const,
      list: (status?: string) => [...queryKeys.crm.invoices.lists(), { status }] as const,
      detail: (id: string) => [...queryKeys.crm.invoices.all(), id] as const,
      byToken: (token: string) => [...queryKeys.crm.invoices.all(), 'token', token] as const,
      byClient: (clientId: string) => [...queryKeys.crm.invoices.all(), 'client', clientId] as const,
      recent: (limit: number) => [...queryKeys.crm.invoices.lists(), 'recent', limit] as const,
    },
    preOrders: {
      all: () => [...queryKeys.crm.all, 'pre-orders'] as const,
      lists: () => [...queryKeys.crm.preOrders.all(), 'list'] as const,
      list: (status?: string) => [...queryKeys.crm.preOrders.lists(), { status }] as const,
      detail: (id: string) => [...queryKeys.crm.preOrders.all(), id] as const,
      byClient: (clientId: string) => [...queryKeys.crm.preOrders.all(), 'client', clientId] as const,
      count: () => [...queryKeys.crm.preOrders.lists(), 'count'] as const,
    },
    notes: {
      all: () => [...queryKeys.crm.all, 'notes'] as const,
      byClient: (clientId: string) => [...queryKeys.crm.notes.all(), 'client', clientId] as const,
    },
    messages: {
      all: () => [...queryKeys.crm.all, 'messages'] as const,
      byClient: (clientId: string) => [...queryKeys.crm.messages.all(), 'client', clientId] as const,
    },
    invites: {
      all: () => [...queryKeys.crm.all, 'invites'] as const,
      lists: () => [...queryKeys.crm.invites.all(), 'list'] as const,
      list: (status?: string) => [...queryKeys.crm.invites.lists(), { status }] as const,
    },
    activity: {
      all: () => [...queryKeys.crm.all, 'activity'] as const,
      byClient: (clientId: string) => [...queryKeys.crm.activity.all(), 'client', clientId] as const,
      recent: (limit: number) => [...queryKeys.crm.activity.all(), 'recent', limit] as const,
    },
    settings: {
      all: () => [...queryKeys.crm.all, 'settings'] as const,
      detail: () => [...queryKeys.crm.settings.all(), 'detail'] as const,
    },
    products: {
      all: () => [...queryKeys.crm.all, 'products'] as const,
      lists: () => [...queryKeys.crm.products.all(), 'list'] as const,
    },
    dashboard: {
      all: () => [...queryKeys.crm.all, 'dashboard'] as const,
      metrics: () => [...queryKeys.crm.dashboard.all(), 'metrics'] as const,
    },
  },

  portal: {
    all: ['portal'] as const,
    client: (token: string) => [...queryKeys.portal.all, 'client', token] as const,
    invoices: (token: string) => [...queryKeys.portal.all, 'invoices', token] as const,
    orders: (token: string) => [...queryKeys.portal.all, 'orders', token] as const,
    history: (token: string) => [...queryKeys.portal.all, 'history', token] as const,
  },

  /**
   * Tenant Payment Settings query key
   * @description Query key for tenant-specific payment settings
   * @param tenantId - Tenant ID
   * @example queryKeys.tenantPaymentSettings('tenant-123')
   */
  tenantPaymentSettings: (tenantId: string) => ['tenant-payment-settings', tenantId] as const,

  /**
   * Menu Payment Settings query key
   * @description Query key for menu-specific payment settings
   * @param menuId - Menu ID
   * @example queryKeys.menuPaymentSettings('menu-123')
   */
  menuPaymentSettings: (menuId: string) => ['menu-payment-settings', menuId] as const,

  /**
   * Payments query keys
   * @description Query keys for payment management
   */
  payments: {
    all: ['payments'] as const,
    lists: () => [...queryKeys.payments.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.payments.lists(), filters] as const,
    byClient: (clientId: string) =>
      [...queryKeys.payments.all, 'client', clientId] as const,
    history: (clientId: string, limit?: number) =>
      [...queryKeys.payments.byClient(clientId), 'history', limit] as const,
    aging: (clientId: string) =>
      [...queryKeys.payments.byClient(clientId), 'aging'] as const,
  },

  /**
   * Fronted Inventory query keys
   * @description Query keys for fronted inventory management (inventory on credit)
   */
  frontedInventory: {
    /** @description Base key for all fronted inventory queries */
    all: ['fronted-inventory'] as const,
    /** @description Parent key for all fronted inventory list queries */
    lists: () => [...queryKeys.frontedInventory.all, 'list'] as const,
    /**
     * @description Query key for filtered fronted inventory list
     * @param filters - Optional filters for the fronted inventory list query
     * @example queryKeys.frontedInventory.list({ status: 'pending' })
     */
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.frontedInventory.lists(), filters] as const,
    /**
     * @description Query key for a specific fronted inventory record by ID
     * @param id - Fronted inventory ID
     * @example queryKeys.frontedInventory.detail('fronted-123')
     */
    detail: (id: string) => [...queryKeys.frontedInventory.all, id] as const,
    /**
     * @description Query key for fronted inventory payments
     * @param frontedId - Fronted inventory ID
     * @example queryKeys.frontedInventory.payments('fronted-123')
     */
    payments: (frontedId: string) =>
      [...queryKeys.frontedInventory.detail(frontedId), 'payments'] as const,
  },

  /**
   * Sessions query keys
   * @description Query keys for user session management
   */
  sessions: {
    /** @description Base key for all session queries */
    all: ['sessions'] as const,
    /** @description Parent key for all session list queries */
    lists: () => [...queryKeys.sessions.all, 'list'] as const,
    /**
     * @description Query key for session list by user
     * @param userId - Optional user ID
     * @example queryKeys.sessions.list('user-123')
     */
    list: (userId?: string) => [...queryKeys.sessions.lists(), { userId }] as const,
  },

  /**
   * Credit Packages query keys
   * @description Query keys for credit package management
   */
  creditPackages: {
    /** @description Base key for all credit package queries */
    all: ['credit-packages'] as const,
    /** @description Parent key for all credit package list queries */
    lists: () => [...queryKeys.creditPackages.all, 'list'] as const,
    /**
     * @description Query key for credit package list by tenant
     * @param tenantId - Optional tenant ID
     * @example queryKeys.creditPackages.list('tenant-123')
     */
    list: (tenantId?: string) =>
      [...queryKeys.creditPackages.lists(), { tenantId }] as const,
    /** @description Parent key for all credit package detail queries */
    details: () => [...queryKeys.creditPackages.all, 'detail'] as const,
    /**
     * @description Query key for a specific credit package by ID
     * @param id - Credit package ID
     * @example queryKeys.creditPackages.detail('pkg-123')
     */
    detail: (id: string) => [...queryKeys.creditPackages.details(), id] as const,
  },

  /**
   * Sidebar Badge Counts query keys
   * @description Query keys for UI sidebar notification badge counts
   */
  sidebarBadges: {
    /** @description Base key for all sidebar badge queries */
    all: ['sidebar-badges'] as const,
    /**
     * @description Query key for sidebar badge counts by tenant
     * @param tenantId - Optional tenant ID
     * @example queryKeys.sidebarBadges.counts('tenant-123')
     */
    counts: (tenantId?: string) =>
      [...queryKeys.sidebarBadges.all, 'counts', { tenantId }] as const,
  },

  /**
   * Collections query keys
   * @description Query keys for collections mode and activities
   */
  collections: {
    /** @description Base key for all collections queries */
    all: ['collections'] as const,
    /**
     * @description Query key for collection mode by tenant
     * @param tenantId - Optional tenant ID
     * @example queryKeys.collections.mode('tenant-123')
     */
    mode: (tenantId?: string) => ['collection-mode', tenantId] as const,
    /**
     * @description Query key for collection activities by client
     * @param clientId - Client ID
     * @example queryKeys.collections.activities('client-123')
     */
    activities: (clientId: string) => ['collection-activities', clientId] as const,
  },

  /**
   * Tags query keys
   * @description Query keys for tag management
   */
  tags: {
    /** @description Base key for all tag queries */
    all: ['tags'] as const,
    /** @description Parent key for all tag list queries */
    lists: () => [...queryKeys.tags.all, 'list'] as const,
    /**
     * @description Query key for filtered tag list
     * @param filters - Optional filters for the tag list query
     * @example queryKeys.tags.list({ type: 'customer' })
     */
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.tags.lists(), filters] as const,
    /** @description Parent key for all tag detail queries */
    details: () => [...queryKeys.tags.all, 'detail'] as const,
    /**
     * @description Query key for a specific tag by ID
     * @param id - Tag ID
     * @example queryKeys.tags.detail('tag-123')
     */
    detail: (id: string) => [...queryKeys.tags.details(), id] as const,
  },

  /**
   * Customer Tags query keys (junction table)
   * @description Query keys for customer-tag relationships
   */
  customerTags: {
    /** @description Base key for all customer-tag queries */
    all: ['customer-tags'] as const,
    /**
     * @description Query key for customer tags by contact
     * @param contactId - Contact ID
     * @example queryKeys.customerTags.byContact('contact-123')
     */
    byContact: (contactId: string) => [...queryKeys.customerTags.all, 'contact', contactId] as const,
    /**
     * @description Query key for customer tags by tag
     * @param tagId - Tag ID
     * @example queryKeys.customerTags.byTag('tag-123')
     */
    byTag: (tagId: string) => [...queryKeys.customerTags.all, 'tag', tagId] as const,
  },

  /**
   * Order Tags query keys (junction table)
   * @description Query keys for order-tag relationships
   */
  orderTags: {
    /** @description Base key for all order-tag queries */
    all: ['order-tags'] as const,
    /**
     * @description Query key for order tags by order
     * @param orderId - Order ID
     * @example queryKeys.orderTags.byOrder('order-123')
     */
    byOrder: (orderId: string) => [...queryKeys.orderTags.all, 'order', orderId] as const,
    /**
     * @description Query key for order tags by tag
     * @param tagId - Tag ID
     * @example queryKeys.orderTags.byTag('tag-123')
     */
    byTag: (tagId: string) => [...queryKeys.orderTags.all, 'tag', tagId] as const,
  },

  /**
   * Credits query keys
   * @description Query keys for credit balance and subscription management
   */
  credits: {
    /** @description Base key for all credit queries */
    all: ['credits'] as const,
    /**
     * @description Query key for credit balance by tenant
     * @param tenantId - Optional tenant ID
     * @example queryKeys.credits.balance('tenant-123')
     */
    balance: (tenantId?: string) => [...queryKeys.credits.all, 'balance', tenantId] as const,
    /**
     * @description Query key for credit transactions by tenant
     * @param tenantId - Optional tenant ID
     * @example queryKeys.credits.transactions('tenant-123')
     */
    transactions: (tenantId?: string) => [...queryKeys.credits.all, 'transactions', tenantId] as const,
    /**
     * @description Query key for credit packages by tenant
     * @param tenantId - Optional tenant ID
     * @example queryKeys.credits.packages('tenant-123')
     */
    packages: (tenantId?: string) => [...queryKeys.credits.all, 'packages', tenantId] as const,
    /**
     * @description Query key for credit subscription by tenant
     * @param tenantId - Optional tenant ID
     * @example queryKeys.credits.subscription('tenant-123')
     */
    subscription: (tenantId?: string) => [...queryKeys.credits.all, 'subscription', tenantId] as const,
  },

  /**
   * Credit Transactions query keys
   * @description Query keys for credit transaction history
   */
  creditTransactions: {
    /** @description Base key for all credit transaction queries */
    all: ['credit-transactions'] as const,
    /** @description Parent key for all credit transaction list queries */
    lists: () => [...queryKeys.creditTransactions.all, 'list'] as const,
    /**
     * @description Query key for filtered credit transaction list
     * @param filters - Optional filters for the credit transaction list query
     * @example queryKeys.creditTransactions.list({ type: 'debit' })
     */
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.creditTransactions.lists(), filters] as const,
  },

  /**
   * Security query keys
   * @description Query keys for security features (known devices, suspicious activity)
   */
  security: {
    /** @description Base key for all security queries */
    all: ['security'] as const,
    /**
     * @description Query key for known devices by user
     * @param userId - Optional user ID
     * @example queryKeys.security.knownDevices('user-123')
     */
    knownDevices: (userId?: string) => ['known-devices', userId] as const,
    /**
     * @description Query key for suspicious login alerts by user
     * @param userId - Optional user ID
     * @example queryKeys.security.suspiciousAlerts('user-123')
     */
    suspiciousAlerts: (userId?: string) => ['suspicious-login-alerts', userId] as const,
    /**
     * @description Query key for pending suspicious login alerts by user
     * @param userId - Optional user ID
     * @example queryKeys.security.pendingAlerts('user-123')
     */
    pendingAlerts: (userId?: string) => ['suspicious-login-alerts', userId, 'pending'] as const,
  },

  /**
   * Storefront Settings query keys
   * @description Query keys for storefront configuration and settings
   */
  storefrontSettings: {
    /** @description Base key for all storefront settings queries */
    all: ['storefront-settings'] as const,
    /** @description Parent key for all storefront settings list queries */
    lists: () => [...queryKeys.storefrontSettings.all, 'list'] as const,
    /**
     * @description Query key for storefront settings list by tenant
     * @param tenantId - Optional tenant ID
     * @example queryKeys.storefrontSettings.list('tenant-123')
     */
    list: (tenantId?: string) => [...queryKeys.storefrontSettings.lists(), { tenantId }] as const,
    /** @description Parent key for all storefront settings detail queries */
    details: () => [...queryKeys.storefrontSettings.all, 'detail'] as const,
    /**
     * @description Query key for a specific storefront settings by store ID
     * @param storeId - Store ID
     * @example queryKeys.storefrontSettings.detail('store-123')
     */
    detail: (storeId: string) => [...queryKeys.storefrontSettings.details(), storeId] as const,
    /**
     * @description Query key for storefront settings by tenant
     * @param tenantId - Tenant ID
     * @example queryKeys.storefrontSettings.byTenant('tenant-123')
     */
    byTenant: (tenantId: string) => [...queryKeys.storefrontSettings.all, 'tenant', tenantId] as const,
  },

  /**
   * Activity Feed query keys
   * @description Query keys for activity feed and audit logging
   */
  activityFeed: {
    /** @description Base key for all activity feed queries */
    all: ['activity-feed'] as const,
    /** @description Parent key for all activity feed list queries */
    lists: () => [...queryKeys.activityFeed.all, 'list'] as const,
    /**
     * @description Query key for filtered activity feed list
     * @param filters - Optional filters for the activity feed list query
     * @example queryKeys.activityFeed.list({ action: 'create' })
     */
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.activityFeed.lists(), filters] as const,
    /**
     * @description Query key for activity feed by tenant
     * @param tenantId - Tenant ID
     * @example queryKeys.activityFeed.byTenant('tenant-123')
     */
    byTenant: (tenantId: string) =>
      [...queryKeys.activityFeed.all, 'tenant', tenantId] as const,
    /**
     * @description Query key for activity feed by tenant and category
     * @param tenantId - Tenant ID
     * @param category - Activity category
     * @example queryKeys.activityFeed.byCategory('tenant-123', 'orders')
     */
    byCategory: (tenantId: string, category: string) =>
      [...queryKeys.activityFeed.byTenant(tenantId), 'category', category] as const,
    /**
     * @description Query key for activity feed by tenant and user
     * @param tenantId - Tenant ID
     * @param userId - User ID
     * @example queryKeys.activityFeed.byUser('tenant-123', 'user-456')
     */
    byUser: (tenantId: string, userId: string) =>
      [...queryKeys.activityFeed.byTenant(tenantId), 'user', userId] as const,
  },

  /**
   * Subscriptions query keys
   * @description Query keys for subscription management
   */
  subscriptions: {
    /** @description Base key for all subscription queries */
    all: ['subscriptions'] as const,
    /**
     * @description Query key for subscriptions by tenant
     * @param tenantId - Tenant ID
     * @example queryKeys.subscriptions.byTenant('tenant-123')
     */
    byTenant: (tenantId: string) =>
      [...queryKeys.subscriptions.all, 'tenant', tenantId] as const,
    /**
     * @description Query key for subscription plans
     * @example queryKeys.subscriptions.plans()
     */
    plans: () => ['subscription-plans'] as const,
  },

  /**
   * Refunds query keys
   * @description Query keys for refund management
   */
  refunds: {
    /** @description Base key for all refund queries */
    all: ['refunds'] as const,
    /** @description Parent key for all refund list queries */
    lists: () => [...queryKeys.refunds.all, 'list'] as const,
    /**
     * @description Query key for filtered refund list
     * @param filters - Optional filters for the refund list query
     * @example queryKeys.refunds.list({ status: 'approved' })
     */
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.refunds.lists(), filters] as const,
    /** @description Parent key for all refund detail queries */
    details: () => [...queryKeys.refunds.all, 'detail'] as const,
    /**
     * @description Query key for a specific refund by ID
     * @param id - Refund ID
     * @example queryKeys.refunds.detail('refund-123')
     */
    detail: (id: string) => [...queryKeys.refunds.details(), id] as const,
    /**
     * @description Query key for refunds by order
     * @param orderId - Order ID
     * @example queryKeys.refunds.byOrder('order-123')
     */
    byOrder: (orderId: string) =>
      [...queryKeys.refunds.all, 'order', orderId] as const,
  },

  /**
   * Settings Versions query keys
   * @description Query keys for settings version history
   */
  settingsVersions: {
    /** @description Base key for all settings version queries */
    all: ['settings-versions'] as const,
    /**
     * @description Query key for settings versions by tenant
     * @param tenantId - Tenant ID
     * @example queryKeys.settingsVersions.byTenant('tenant-123')
     */
    byTenant: (tenantId: string) =>
      [...queryKeys.settingsVersions.all, 'tenant', tenantId] as const,
    /**
     * @description Query key for settings versions by tenant and key
     * @param tenantId - Tenant ID
     * @param settingsKey - Settings key
     * @example queryKeys.settingsVersions.byKey('tenant-123', 'storefront')
     */
    byKey: (tenantId: string, settingsKey: string) =>
      [...queryKeys.settingsVersions.byTenant(tenantId), settingsKey] as const,
  },

  /**
   * Team Management query keys
   * @description Query keys for team member and invitation management
   */
  team: {
    /** @description Base key for all team queries */
    all: ['team'] as const,
    /**
     * Team Members query keys
     * @description Nested query keys for team member management
     */
    members: {
      /** @description Base key for all team member queries */
      all: () => [...queryKeys.team.all, 'members'] as const,
      /** @description Parent key for all team member list queries */
      lists: () => [...queryKeys.team.members.all(), 'list'] as const,
      /**
       * @description Query key for team member list by tenant
       * @param tenantId - Optional tenant ID
       * @example queryKeys.team.members.list('tenant-123')
       */
      list: (tenantId?: string) =>
        [...queryKeys.team.members.lists(), { tenantId }] as const,
      /**
       * @description Query key for a specific team member by user ID
       * @param userId - User ID
       * @example queryKeys.team.members.detail('user-123')
       */
      detail: (userId: string) =>
        [...queryKeys.team.members.all(), userId] as const,
    },
    /**
     * Team Invitations query keys
     * @description Nested query keys for team invitation management
     */
    invitations: {
      /** @description Base key for all team invitation queries */
      all: () => [...queryKeys.team.all, 'invitations'] as const,
      /** @description Parent key for all team invitation list queries */
      lists: () => [...queryKeys.team.invitations.all(), 'list'] as const,
      /**
       * @description Query key for pending team invitations by tenant
       * @param tenantId - Optional tenant ID
       * @example queryKeys.team.invitations.pending('tenant-123')
       */
      pending: (tenantId?: string) =>
        [...queryKeys.team.invitations.lists(), 'pending', { tenantId }] as const,
    },
    /**
     * Team Activity query keys
     * @description Nested query keys for team activity tracking
     */
    activity: {
      /** @description Base key for all team activity queries */
      all: () => [...queryKeys.team.all, 'activity'] as const,
      /** @description Parent key for all team activity list queries */
      lists: () => [...queryKeys.team.activity.all(), 'list'] as const,
      /**
       * @description Query key for team activity list by tenant with filters
       * @param tenantId - Optional tenant ID
       * @param filters - Optional filters for the team activity list query
       * @example queryKeys.team.activity.list('tenant-123', { action: 'login' })
       */
      list: (tenantId?: string, filters?: Record<string, unknown>) =>
        [...queryKeys.team.activity.lists(), { tenantId, ...filters }] as const,
      /**
       * @description Query key for team activity by tenant and user
       * @param tenantId - Tenant ID
       * @param userId - User ID
       * @example queryKeys.team.activity.byUser('tenant-123', 'user-456')
       */
      byUser: (tenantId: string, userId: string) =>
        [...queryKeys.team.activity.all(), 'user', tenantId, userId] as const,
    },
  },

  /**
   * Customer Invoices query keys
   * @description Query keys for customer invoice management
   */
  customerInvoices: {
    /** @description Base key for all customer invoice queries */
    all: ['customer-invoices'] as const,
    /** @description Parent key for all customer invoice list queries */
    lists: () => [...queryKeys.customerInvoices.all, 'list'] as const,
    /**
     * @description Query key for customer invoice list by tenant with filters
     * @param tenantId - Optional tenant ID
     * @param filters - Optional filters for the customer invoice list query
     * @example queryKeys.customerInvoices.list('tenant-123', { status: 'overdue' })
     */
    list: (tenantId?: string, filters?: Record<string, unknown>) =>
      [...queryKeys.customerInvoices.lists(), { tenantId, ...filters }] as const,
    /** @description Parent key for all customer invoice detail queries */
    details: () => [...queryKeys.customerInvoices.all, 'detail'] as const,
    /**
     * @description Query key for a specific customer invoice by ID
     * @param id - Customer invoice ID
     * @example queryKeys.customerInvoices.detail('invoice-123')
     */
    detail: (id: string) => [...queryKeys.customerInvoices.details(), id] as const,
    /**
     * @description Query key for customer invoices by customer
     * @param customerId - Customer ID
     * @example queryKeys.customerInvoices.byCustomer('customer-123')
     */
    byCustomer: (customerId: string) =>
      [...queryKeys.customerInvoices.all, 'customer', customerId] as const,
    /**
     * @description Query key for customer invoice statistics by tenant
     * @param tenantId - Optional tenant ID
     * @example queryKeys.customerInvoices.stats('tenant-123')
     */
    stats: (tenantId?: string) =>
      [...queryKeys.customerInvoices.all, 'stats', tenantId] as const,
  },

  /**
   * Order Audit Log query keys
   * @description Query keys for order audit trail and history
   */
  orderAuditLog: {
    /** @description Base key for all order audit log queries */
    all: ['order-audit-log'] as const,
    /** @description Parent key for all order audit log list queries */
    lists: () => [...queryKeys.orderAuditLog.all, 'list'] as const,
    /**
     * @description Query key for filtered order audit log list
     * @param filters - Optional filters for the order audit log list query
     * @example queryKeys.orderAuditLog.list({ action: 'status_change' })
     */
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.orderAuditLog.lists(), filters] as const,
    /**
     * @description Query key for order audit log by order
     * @param orderId - Order ID
     * @example queryKeys.orderAuditLog.byOrder('order-123')
     */
    byOrder: (orderId: string) =>
      [...queryKeys.orderAuditLog.all, 'order', orderId] as const,
    /**
     * @description Query key for order audit log by tenant
     * @param tenantId - Tenant ID
     * @example queryKeys.orderAuditLog.byTenant('tenant-123')
     */
    byTenant: (tenantId: string) =>
      [...queryKeys.orderAuditLog.all, 'tenant', tenantId] as const,
  },
} as const;
