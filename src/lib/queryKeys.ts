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
  // Products (admin)
  products: {
    all: ['products'] as const,
    lists: () => [...queryKeys.products.all, 'list'] as const,
    list: (tenantId?: string, filters?: Record<string, unknown>) =>
      [...queryKeys.products.lists(), { tenantId, ...filters }] as const,
    details: () => [...queryKeys.products.all, 'detail'] as const,
    detail: (tenantId: string, productId: string) => [...queryKeys.products.details(), tenantId, productId] as const,
    byTenant: (tenantId: string) => [...queryKeys.products.all, 'tenant', tenantId] as const,
    search: (tenantId: string, query: string) => [...queryKeys.products.byTenant(tenantId), 'search', query] as const,
    related: (tenantId: string, productId: string) => [...queryKeys.products.detail(tenantId, productId), 'related'] as const,
    posGrid: (tenantId?: string) => [...queryKeys.products.all, 'pos-grid', tenantId] as const,
  },

  // Storefront products (shop-facing)
  shopProducts: {
    all: ['shop-products'] as const,
    list: (storeId?: string) => [...queryKeys.shopProducts.all, storeId] as const,
    detail: (storeId?: string, productId?: string) =>
      ['shop-product', storeId, productId] as const,
    detailBySlug: (storeId?: string, slug?: string) =>
      ['shop-product', storeId, slug, true] as const,
    categories: (storeId?: string) => ['shop-categories', storeId] as const,
    related: (storeId?: string, category?: string) =>
      ['related-products', storeId, category] as const,
    carousels: (storeId?: string) => ['marketplace-products-map', storeId] as const,
  },

  // Orders
  orders: {
    all: ['orders'] as const,
    lists: () => [...queryKeys.orders.all, 'list'] as const,
    list: (tenantId?: string, filters?: Record<string, unknown>) =>
      [...queryKeys.orders.lists(), { tenantId, ...filters }] as const,
    details: () => [...queryKeys.orders.all, 'detail'] as const,
    detail: (tenantId: string, orderId: string) => [...queryKeys.orders.details(), tenantId, orderId] as const,
    byTenant: (tenantId: string) => [...queryKeys.orders.all, 'tenant', tenantId] as const,
    search: (tenantId: string, query: string) => [...queryKeys.orders.byTenant(tenantId), 'search', query] as const,
    related: (tenantId: string, orderId: string) => [...queryKeys.orders.detail(tenantId, orderId), 'related'] as const,
    offline: (tenantId?: string) => [...queryKeys.orders.all, 'offline', tenantId] as const,
    kanban: (tenantId?: string) => [...queryKeys.orders.all, 'kanban', tenantId] as const,
    pipeline: (tenantId?: string) => [...queryKeys.orders.all, 'pipeline', tenantId] as const,
    statusHistory: (orderId: string) => [...queryKeys.orders.all, 'status-history', orderId] as const,
    live: (tenantId?: string) => [...queryKeys.orders.all, 'live', tenantId] as const,
    byProduct: (tenantId: string, productId: string) => [...queryKeys.orders.byTenant(tenantId), 'product', productId] as const,
  },

  // Wholesale Orders
  wholesaleOrders: {
    all: ['wholesale-orders'] as const,
    lists: () => [...queryKeys.wholesaleOrders.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) => 
      [...queryKeys.wholesaleOrders.lists(), filters] as const,
    details: () => [...queryKeys.wholesaleOrders.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.wholesaleOrders.details(), id] as const,
  },

  // Wholesale Deliveries
  wholesaleDeliveries: {
    all: ['wholesale-deliveries'] as const,
    lists: () => [...queryKeys.wholesaleDeliveries.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.wholesaleDeliveries.lists(), filters] as const,
    details: () => [...queryKeys.wholesaleDeliveries.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.wholesaleDeliveries.details(), id] as const,
  },

  // Wholesale Payments
  wholesalePayments: {
    all: ['wholesale-payments'] as const,
    lists: () => [...queryKeys.wholesalePayments.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.wholesalePayments.lists(), filters] as const,
    details: () => [...queryKeys.wholesalePayments.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.wholesalePayments.details(), id] as const,
    byClient: (clientId: string) =>
      [...queryKeys.wholesalePayments.all, 'client', clientId] as const,
  },

  // Wholesale Clients
  wholesaleClients: {
    all: ['wholesale-clients'] as const,
    lists: () => [...queryKeys.wholesaleClients.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) => 
      [...queryKeys.wholesaleClients.lists(), filters] as const,
    details: () => [...queryKeys.wholesaleClients.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.wholesaleClients.details(), id] as const,
  },

  // Inventory
  inventory: {
    all: ['inventory'] as const,
    lists: () => [...queryKeys.inventory.all, 'list'] as const,
    list: (tenantId?: string, warehouseId?: string) =>
      [...queryKeys.inventory.lists(), { tenantId, warehouseId }] as const,
    details: () => [...queryKeys.inventory.all, 'detail'] as const,
    detail: (tenantId: string, inventoryId: string) => [...queryKeys.inventory.details(), tenantId, inventoryId] as const,
    byTenant: (tenantId: string) => [...queryKeys.inventory.all, 'tenant', tenantId] as const,
    search: (tenantId: string, query: string) => [...queryKeys.inventory.byTenant(tenantId), 'search', query] as const,
    related: (tenantId: string, inventoryId: string) => [...queryKeys.inventory.detail(tenantId, inventoryId), 'related'] as const,
    alerts: () => [...queryKeys.inventory.all, 'alerts'] as const,
    lowStockAlerts: (tenantId?: string) =>
      [...queryKeys.inventory.all, 'low-stock-alerts', tenantId] as const,
    movements: (productId?: string) =>
      [...queryKeys.inventory.all, 'movements', productId] as const,
    history: (filters?: Record<string, unknown>) =>
      [...queryKeys.inventory.all, 'history', filters] as const,
    transfers: (tenantId?: string) =>
      [...queryKeys.inventory.all, 'transfers', tenantId] as const,
    byLocation: (locationId?: string) =>
      [...queryKeys.inventory.all, 'by-location', locationId] as const,
    summary: (tenantId?: string) =>
      [...queryKeys.inventory.all, 'summary', tenantId] as const,
    locations: (tenantId?: string) =>
      [...queryKeys.inventory.all, 'locations', tenantId] as const,
  },

  // Locations
  locations: {
    all: ['locations'] as const,
    lists: () => [...queryKeys.locations.all, 'list'] as const,
    list: (tenantId?: string, filters?: Record<string, unknown>) =>
      [...queryKeys.locations.lists(), { tenantId, ...filters }] as const,
    detail: (id: string) => [...queryKeys.locations.all, id] as const,
    operations: (tenantId?: string) =>
      [...queryKeys.locations.all, 'operations', tenantId] as const,
    operationsSummary: (tenantId?: string) =>
      [...queryKeys.locations.all, 'operations-summary', tenantId] as const,
  },

  // Cart
  cart: {
    all: ['cart'] as const,
    user: (userId?: string) => [...queryKeys.cart.all, userId] as const,
    guest: () => [...queryKeys.cart.all, 'guest'] as const,
  },

  // Disposable Menus
  menus: {
    all: ['menus'] as const,
    lists: () => [...queryKeys.menus.all, 'list'] as const,
    list: (tenantId?: string, filters?: Record<string, unknown>) =>
      [...queryKeys.menus.lists(), { tenantId, ...filters }] as const,
    details: () => [...queryKeys.menus.all, 'detail'] as const,
    detail: (tenantId: string, menuId: string) => [...queryKeys.menus.details(), tenantId, menuId] as const,
    byTenant: (tenantId: string) => [...queryKeys.menus.all, 'tenant', tenantId] as const,
    search: (tenantId: string, query: string) => [...queryKeys.menus.byTenant(tenantId), 'search', query] as const,
    related: (tenantId: string, menuId: string) => [...queryKeys.menus.detail(tenantId, menuId), 'related'] as const,
    public: (token: string) => [...queryKeys.menus.all, 'public', token] as const,
    analytics: (tenantId: string, menuId: string) => [...queryKeys.menus.detail(tenantId, menuId), 'analytics'] as const,
    products: (tenantId: string, menuId: string) => [...queryKeys.menus.detail(tenantId, menuId), 'products'] as const,
  },

  // Couriers
  couriers: {
    all: ['couriers'] as const,
    lists: () => [...queryKeys.couriers.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) => 
      [...queryKeys.couriers.lists(), filters] as const,
    details: () => [...queryKeys.couriers.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.couriers.details(), id] as const,
    earnings: (id: string) => [...queryKeys.couriers.detail(id), 'earnings'] as const,
    location: (id: string) => [...queryKeys.couriers.detail(id), 'location'] as const,
  },

  // Deliveries
  deliveries: {
    all: ['deliveries'] as const,
    lists: () => [...queryKeys.deliveries.all, 'list'] as const,
    list: (tenantId?: string, filters?: Record<string, unknown>) =>
      [...queryKeys.deliveries.lists(), { tenantId, ...filters }] as const,
    details: () => [...queryKeys.deliveries.all, 'detail'] as const,
    detail: (tenantId: string, deliveryId: string) => [...queryKeys.deliveries.details(), tenantId, deliveryId] as const,
    byTenant: (tenantId: string) => [...queryKeys.deliveries.all, 'tenant', tenantId] as const,
    search: (tenantId: string, query: string) => [...queryKeys.deliveries.byTenant(tenantId), 'search', query] as const,
    related: (tenantId: string, deliveryId: string) => [...queryKeys.deliveries.detail(tenantId, deliveryId), 'related'] as const,
    active: (tenantId?: string) => [...queryKeys.deliveries.all, 'active', tenantId] as const,
    byDriver: (tenantId: string, driverId: string) => [...queryKeys.deliveries.byTenant(tenantId), 'driver', driverId] as const,
    byOrder: (tenantId: string, orderId: string) => [...queryKeys.deliveries.byTenant(tenantId), 'order', orderId] as const,
  },

  // Customers
  customers: {
    all: ['customers'] as const,
    lists: () => [...queryKeys.customers.all, 'list'] as const,
    list: (tenantId?: string, filters?: Record<string, unknown>) =>
      [...queryKeys.customers.lists(), { tenantId, ...filters }] as const,
    details: () => [...queryKeys.customers.all, 'detail'] as const,
    detail: (tenantId: string, customerId: string) => [...queryKeys.customers.details(), tenantId, customerId] as const,
    byTenant: (tenantId: string) => [...queryKeys.customers.all, 'tenant', tenantId] as const,
    search: (tenantId: string, query: string) => [...queryKeys.customers.byTenant(tenantId), 'search', query] as const,
    related: (tenantId: string, customerId: string) => [...queryKeys.customers.detail(tenantId, customerId), 'related'] as const,
    analytics: (tenantId: string, customerId: string) => [...queryKeys.customers.detail(tenantId, customerId), 'analytics'] as const,
    stats: (tenantId: string, customerId: string) => [...queryKeys.customers.detail(tenantId, customerId), 'stats'] as const,
    dropdown: (tenantId?: string) => [...queryKeys.customers.all, 'dropdown', tenantId] as const,
  },

  // Tenants
  tenants: {
    all: ['tenants'] as const,
    lists: () => [...queryKeys.tenants.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) => 
      [...queryKeys.tenants.lists(), filters] as const,
    detail: (id: string) => [...queryKeys.tenants.all, id] as const,
    current: () => [...queryKeys.tenants.all, 'current'] as const,
  },

  // Dashboard Hub
  dashboard: {
    all: ['dashboard'] as const,
    stats: (tenantId?: string) =>
      [...queryKeys.dashboard.all, 'stats', tenantId] as const,
    recentOrders: (tenantId?: string) =>
      [...queryKeys.dashboard.all, 'recent-orders', tenantId] as const,
    alerts: (tenantId?: string) =>
      [...queryKeys.dashboard.all, 'alerts', tenantId] as const,
    activity: (tenantId?: string) =>
      [...queryKeys.dashboard.all, 'activity', tenantId] as const,
    revenueChart: (tenantId?: string) =>
      [...queryKeys.dashboard.all, 'revenue-chart', tenantId] as const,
    ordersByStatus: (tenantId?: string) =>
      [...queryKeys.dashboard.all, 'orders-by-status', tenantId] as const,
    topProducts: (tenantId?: string) =>
      [...queryKeys.dashboard.all, 'top-products', tenantId] as const,
  },

  // Analytics
  analytics: {
    all: ['analytics'] as const,
    lists: () => [...queryKeys.analytics.all, 'list'] as const,
    list: (tenantId?: string, filters?: Record<string, unknown>) =>
      [...queryKeys.analytics.lists(), { tenantId, ...filters }] as const,
    details: () => [...queryKeys.analytics.all, 'detail'] as const,
    detail: (tenantId: string, reportId: string) => [...queryKeys.analytics.details(), tenantId, reportId] as const,
    byTenant: (tenantId: string) => [...queryKeys.analytics.all, 'tenant', tenantId] as const,
    search: (tenantId: string, query: string) => [...queryKeys.analytics.byTenant(tenantId), 'search', query] as const,
    related: (tenantId: string, reportId: string) => [...queryKeys.analytics.detail(tenantId, reportId), 'related'] as const,
    overview: (tenantId?: string) =>
      [...queryKeys.analytics.all, 'overview', tenantId] as const,
    revenue: (tenantId?: string, filters?: Record<string, unknown>) =>
      [...queryKeys.analytics.all, 'revenue', { tenantId, ...filters }] as const,
    orders: (tenantId?: string, filters?: Record<string, unknown>) =>
      [...queryKeys.analytics.all, 'orders', { tenantId, ...filters }] as const,
    customers: (tenantId?: string, filters?: Record<string, unknown>) =>
      [...queryKeys.analytics.all, 'customers', { tenantId, ...filters }] as const,
    products: (tenantId?: string, filters?: Record<string, unknown>) =>
      [...queryKeys.analytics.all, 'products', { tenantId, ...filters }] as const,
    trafficSources: (tenantId?: string, filters?: Record<string, unknown>) =>
      [...queryKeys.analytics.all, 'traffic-sources', { tenantId, ...filters }] as const,
  },

  // Super Admin
  superAdmin: {
    all: ['super-admin'] as const,
    dashboard: () => [...queryKeys.superAdmin.all, 'dashboard'] as const,
    metrics: () => [...queryKeys.superAdmin.all, 'metrics'] as const,
    monitoring: () => [...queryKeys.superAdmin.all, 'monitoring'] as const,
  },

  // Categories
  categories: {
    all: ['categories'] as const,
    lists: () => [...queryKeys.categories.all, 'list'] as const,
    list: (tenantId?: string) => 
      [...queryKeys.categories.lists(), { tenantId }] as const,
    detail: (id: string) => [...queryKeys.categories.all, id] as const,
  },

  // Product Images
  productImages: {
    all: ['product-images'] as const,
    lists: () => [...queryKeys.productImages.all, 'list'] as const,
    list: (tenantId?: string) => 
      [...queryKeys.productImages.lists(), { tenantId }] as const,
    detail: (id: string) => [...queryKeys.productImages.all, id] as const,
  },

  // Pricing
  pricing: {
    all: ['pricing'] as const,
    products: (tenantId?: string) => 
      [...queryKeys.pricing.all, 'products', { tenantId }] as const,
    tiers: (productId?: string) => 
      [...queryKeys.pricing.all, 'tiers', { productId }] as const,
  },

  // Runners
  runners: {
    all: ['runners'] as const,
    lists: () => [...queryKeys.runners.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.runners.lists(), filters] as const,
    detail: (id: string) => [...queryKeys.runners.all, id] as const,
    deliveries: (runnerId: string) =>
      [...queryKeys.runners.detail(runnerId), 'deliveries'] as const,
    available: () => [...queryKeys.runners.all, 'available'] as const,
    metrics: (runnerId: string, tenantId?: string) =>
      [...queryKeys.runners.detail(runnerId), 'metrics', tenantId] as const,
    leaderboard: (tenantId?: string, period?: string) =>
      [...queryKeys.runners.all, 'leaderboard', tenantId, period] as const,
    weeklyReport: (tenantId?: string, weekOffset?: number) =>
      [...queryKeys.runners.all, 'weekly-report', tenantId, weekOffset] as const,
  },

  // POS / Cash Register
  pos: {
    all: ['pos'] as const,
    products: (tenantId?: string) =>
      [...queryKeys.pos.all, 'products', { tenantId }] as const,
    transactions: (tenantId?: string) =>
      [...queryKeys.pos.all, 'transactions', { tenantId }] as const,
    session: (tenantId?: string) =>
      [...queryKeys.pos.all, 'session', tenantId] as const,
    cashDrawer: {
      all: () => [...queryKeys.pos.all, 'cash-drawer'] as const,
      events: (shiftId?: string) =>
        [...queryKeys.pos.cashDrawer.all(), 'events', shiftId] as const,
      balance: (shiftId?: string) =>
        [...queryKeys.pos.cashDrawer.all(), 'balance', shiftId] as const,
    },
    shifts: {
      all: () => [...queryKeys.pos.all, 'shifts'] as const,
      active: (tenantId?: string) =>
        [...queryKeys.pos.shifts.all(), 'active', tenantId] as const,
      recent: (tenantId?: string) =>
        [...queryKeys.pos.shifts.all(), 'recent', tenantId] as const,
      detail: (shiftId?: string) =>
        [...queryKeys.pos.shifts.all(), 'detail', shiftId] as const,
      transactions: (shiftId?: string) =>
        [...queryKeys.pos.shifts.all(), 'transactions', shiftId] as const,
      summary: (tenantId?: string) =>
        [...queryKeys.pos.shifts.all(), 'summary', tenantId] as const,
    },
  },

  // Batches
  batches: {
    all: ['inventory-batches'] as const,
    lists: () => [...queryKeys.batches.all, 'list'] as const,
    list: (tenantId?: string) => 
      [...queryKeys.batches.lists(), { tenantId }] as const,
    detail: (id: string) => [...queryKeys.batches.all, id] as const,
  },

  // Warehouses
  warehouses: {
    all: ['warehouses'] as const,
    lists: () => [...queryKeys.warehouses.all, 'list'] as const,
    list: (tenantId?: string) => 
      [...queryKeys.warehouses.lists(), { tenantId }] as const,
    detail: (id: string) => [...queryKeys.warehouses.all, id] as const,
  },

  // Receiving
  receiving: {
    all: ['receiving'] as const,
    lists: () => [...queryKeys.receiving.all, 'list'] as const,
    list: (tenantId?: string, filter?: string) => 
      [...queryKeys.receiving.lists(), { tenantId, filter }] as const,
    detail: (id: string) => [...queryKeys.receiving.all, id] as const,
  },

  // Suppliers
  suppliers: {
    all: ['suppliers'] as const,
    lists: () => [...queryKeys.suppliers.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) => 
      [...queryKeys.suppliers.lists(), filters] as const,
    details: () => [...queryKeys.suppliers.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.suppliers.details(), id] as const,
    transactions: (supplierId: string) => 
      [...queryKeys.suppliers.detail(supplierId), 'transactions'] as const,
  },

  // Purchase Orders
  purchaseOrders: {
    all: ['purchase-orders'] as const,
    lists: () => [...queryKeys.purchaseOrders.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) => 
      [...queryKeys.purchaseOrders.lists(), filters] as const,
    details: () => [...queryKeys.purchaseOrders.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.purchaseOrders.details(), id] as const,
    items: (poId: string) => 
      [...queryKeys.purchaseOrders.detail(poId), 'items'] as const,
  },

  // Returns
  returns: {
    all: ['returns'] as const,
    lists: () => [...queryKeys.returns.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) => 
      [...queryKeys.returns.lists(), filters] as const,
    details: () => [...queryKeys.returns.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.returns.details(), id] as const,
  },

  // Loyalty
  loyalty: {
    all: ['loyalty'] as const,
    rewards: () => [...queryKeys.loyalty.all, 'rewards'] as const,
    analytics: () => [...queryKeys.loyalty.all, 'analytics'] as const,
    config: (tenantId?: string) => [...queryKeys.loyalty.all, 'config', tenantId] as const,
    customer: (customerId?: string) => [...queryKeys.loyalty.all, 'customer', customerId] as const,
    // Customer loyalty (admin-side)
    customerStatus: (tenantId: string, customerId: string) =>
      [...queryKeys.loyalty.all, 'status', tenantId, customerId] as const,
    customerHistory: (tenantId: string, customerId: string) =>
      [...queryKeys.loyalty.all, 'history', tenantId, customerId] as const,
    leaderboard: (tenantId?: string) =>
      [...queryKeys.loyalty.all, 'leaderboard', tenantId] as const,
  },

  // Coupons
  coupons: {
    all: ['coupons'] as const,
    lists: () => [...queryKeys.coupons.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) => 
      [...queryKeys.coupons.lists(), filters] as const,
    details: () => [...queryKeys.coupons.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.coupons.details(), id] as const,
  },

  // Marketing
  marketing: {
    all: ['marketing'] as const,
    campaigns: () => [...queryKeys.marketing.all, 'campaigns'] as const,
    workflows: () => [...queryKeys.marketing.all, 'workflows'] as const,
  },

  // Appointments
  appointments: {
    all: ['appointments'] as const,
    lists: () => [...queryKeys.appointments.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) => 
      [...queryKeys.appointments.lists(), filters] as const,
    details: () => [...queryKeys.appointments.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.appointments.details(), id] as const,
  },

  // Support
  support: {
    all: ['support'] as const,
    tickets: () => [...queryKeys.support.all, 'tickets'] as const,
  },

  // Recall
  recall: {
    all: ['recall'] as const,
    lists: () => [...queryKeys.recall.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) => 
      [...queryKeys.recall.lists(), filters] as const,
    details: () => [...queryKeys.recall.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.recall.details(), id] as const,
  },

  // Compliance
  compliance: {
    all: ['compliance'] as const,
    lists: () => [...queryKeys.compliance.all, 'list'] as const,
    list: (tenantId?: string, filters?: Record<string, unknown>) =>
      [...queryKeys.compliance.lists(), { tenantId, ...filters }] as const,
    details: () => [...queryKeys.compliance.all, 'detail'] as const,
    detail: (tenantId: string, complianceId: string) => [...queryKeys.compliance.details(), tenantId, complianceId] as const,
    byTenant: (tenantId: string) => [...queryKeys.compliance.all, 'tenant', tenantId] as const,
    search: (tenantId: string, query: string) => [...queryKeys.compliance.byTenant(tenantId), 'search', query] as const,
    related: (tenantId: string, complianceId: string) => [...queryKeys.compliance.detail(tenantId, complianceId), 'related'] as const,
    documents: (tenantId?: string) => [...queryKeys.compliance.all, 'documents', tenantId] as const,
    audits: (tenantId: string) => [...queryKeys.compliance.byTenant(tenantId), 'audits'] as const,
    licenses: (tenantId: string) => [...queryKeys.compliance.byTenant(tenantId), 'licenses'] as const,
    reports: (tenantId: string) => [...queryKeys.compliance.byTenant(tenantId), 'reports'] as const,
  },

  // Team
  team: {
    all: ['team'] as const,
    members: (tenantId?: string) => [...queryKeys.team.all, 'members', tenantId] as const,
    invitations: (tenantId?: string) => [...queryKeys.team.all, 'invitations', tenantId] as const,
    activity: (tenantId?: string) => [...queryKeys.team.all, 'activity', tenantId] as const,
  },

  // Weather
  weather: {
    all: ['weather'] as const,
    current: (location?: string) => [...queryKeys.weather.all, 'current', location] as const,
    forecast: (location?: string) => [...queryKeys.weather.all, 'forecast', location] as const,
  },

  // Reporting
  reporting: {
    all: ['reporting'] as const,
    custom: () => [...queryKeys.reporting.all, 'custom'] as const,
    scheduled: () => [...queryKeys.reporting.all, 'scheduled'] as const,
  },

  // Vendor
  vendor: {
    all: ['vendor'] as const,
    purchaseOrders: (vendorId: string) => [...queryKeys.vendor.all, 'purchase-orders', vendorId] as const,
    invoices: (vendorId: string) => [...queryKeys.vendor.all, 'invoices', vendorId] as const,
  },

  // Forum
  forum: {
    all: ['forum'] as const,
    posts: {
      all: () => [...queryKeys.forum.all, 'posts'] as const,
      lists: () => [...queryKeys.forum.posts.all(), 'list'] as const,
      list: (options?: Record<string, unknown>) => [...queryKeys.forum.posts.lists(), options] as const,
      details: () => [...queryKeys.forum.posts.all(), 'detail'] as const,
      detail: (id: string) => [...queryKeys.forum.posts.details(), id] as const,
    },
    comments: {
      all: () => [...queryKeys.forum.all, 'comments'] as const,
      lists: () => [...queryKeys.forum.comments.all(), 'list'] as const,
      list: (postId: string) => [...queryKeys.forum.comments.lists(), postId] as const,
    },
    categories: {
      all: () => [...queryKeys.forum.all, 'categories'] as const,
      lists: () => [...queryKeys.forum.categories.all(), 'list'] as const,
    },
    votes: {
      all: () => [...queryKeys.forum.all, 'votes'] as const,
      userVote: (votableType: string, votableId: string) => [...queryKeys.forum.votes.all(), votableType, votableId] as const,
    },
    profile: {
      all: () => [...queryKeys.forum.all, 'profile'] as const,
      current: () => [...queryKeys.forum.profile.all(), 'current'] as const,
      byUsername: (username: string) => [...queryKeys.forum.profile.all(), 'username', username] as const,
    },
    approval: {
      all: () => [...queryKeys.forum.all, 'approval'] as const,
      current: () => [...queryKeys.forum.approval.all(), 'current'] as const,
    },
    reputation: {
      all: () => [...queryKeys.forum.all, 'reputation'] as const,
      user: (userId: string) => [...queryKeys.forum.reputation.all(), userId] as const,
    },
    notifications: {
      all: () => [...queryKeys.forum.all, 'notifications'] as const,
      lists: () => [...queryKeys.forum.notifications.all(), 'list'] as const,
    },
    search: {
      all: () => [...queryKeys.forum.all, 'search'] as const,
      posts: (query: string) => [...queryKeys.forum.search.all(), 'posts', query] as const,
    },
  },
  // CRM System
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

  // Payment Settings
  tenantPaymentSettings: (tenantId: string) => ['tenant-payment-settings', tenantId] as const,
  menuPaymentSettings: (menuId: string) => ['menu-payment-settings', menuId] as const,

  // Payments
  payments: {
    all: ['payments'] as const,
    lists: () => [...queryKeys.payments.all, 'list'] as const,
    list: (tenantId?: string, filters?: Record<string, unknown>) =>
      [...queryKeys.payments.lists(), { tenantId, ...filters }] as const,
    details: () => [...queryKeys.payments.all, 'detail'] as const,
    detail: (tenantId: string, paymentId: string) => [...queryKeys.payments.details(), tenantId, paymentId] as const,
    byTenant: (tenantId: string) => [...queryKeys.payments.all, 'tenant', tenantId] as const,
    search: (tenantId: string, query: string) => [...queryKeys.payments.byTenant(tenantId), 'search', query] as const,
    related: (tenantId: string, paymentId: string) => [...queryKeys.payments.detail(tenantId, paymentId), 'related'] as const,
    byClient: (tenantId: string, clientId: string) =>
      [...queryKeys.payments.byTenant(tenantId), 'client', clientId] as const,
    history: (tenantId: string, clientId: string, limit?: number) =>
      [...queryKeys.payments.byClient(tenantId, clientId), 'history', limit] as const,
    aging: (tenantId: string, clientId: string) =>
      [...queryKeys.payments.byClient(tenantId, clientId), 'aging'] as const,
    pending: (tenantId: string) => [...queryKeys.payments.byTenant(tenantId), 'pending'] as const,
    refunds: (tenantId: string) => [...queryKeys.payments.byTenant(tenantId), 'refunds'] as const,
    byOrder: (orderId: string) => [...queryKeys.payments.all, 'order', orderId] as const,
  },

  // Fronted Inventory
  frontedInventory: {
    all: ['fronted-inventory'] as const,
    lists: () => [...queryKeys.frontedInventory.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) => 
      [...queryKeys.frontedInventory.lists(), filters] as const,
    detail: (id: string) => [...queryKeys.frontedInventory.all, id] as const,
    payments: (frontedId: string) => 
      [...queryKeys.frontedInventory.detail(frontedId), 'payments'] as const,
  },

  // Sessions
  sessions: {
    all: ['sessions'] as const,
    lists: () => [...queryKeys.sessions.all, 'list'] as const,
    list: (userId?: string) => [...queryKeys.sessions.lists(), { userId }] as const,
  },

  // Credit Packages
  creditPackages: {
    all: ['credit-packages'] as const,
    lists: () => [...queryKeys.creditPackages.all, 'list'] as const,
    list: (tenantId?: string) =>
      [...queryKeys.creditPackages.lists(), { tenantId }] as const,
    details: () => [...queryKeys.creditPackages.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.creditPackages.details(), id] as const,
  },

  // Sidebar Badge Counts
  sidebarBadges: {
    all: ['sidebar-badges'] as const,
    counts: (tenantId?: string) =>
      [...queryKeys.sidebarBadges.all, 'counts', { tenantId }] as const,
  },

  // Collections
  collections: {
    all: ['collections'] as const,
    mode: (tenantId?: string) => ['collection-mode', tenantId] as const,
    activities: (clientId: string) => ['collection-activities', clientId] as const,
  },

  // Tags
  tags: {
    all: ['tags'] as const,
    lists: () => [...queryKeys.tags.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.tags.lists(), filters] as const,
    details: () => [...queryKeys.tags.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.tags.details(), id] as const,
  },

  // Customer Tags (junction)
  customerTags: {
    all: ['customer-tags'] as const,
    byContact: (contactId: string) => [...queryKeys.customerTags.all, 'contact', contactId] as const,
    byTag: (tagId: string) => [...queryKeys.customerTags.all, 'tag', tagId] as const,
  },

  // Credits
  credits: {
    all: ['credits'] as const,
    balance: (tenantId?: string) => [...queryKeys.credits.all, 'balance', tenantId] as const,
    transactions: (tenantId?: string) => [...queryKeys.credits.all, 'transactions', tenantId] as const,
    packages: (tenantId?: string) => [...queryKeys.credits.all, 'packages', tenantId] as const,
    subscription: (tenantId?: string) => [...queryKeys.credits.all, 'subscription', tenantId] as const,
  },

  // Credit Transactions
  creditTransactions: {
    all: ['credit-transactions'] as const,
    lists: () => [...queryKeys.creditTransactions.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.creditTransactions.lists(), filters] as const,
  },

  // Notifications
  notifications: {
    all: ['notifications'] as const,
    lists: () => [...queryKeys.notifications.all, 'list'] as const,
    list: (tenantId?: string, filters?: Record<string, unknown>) =>
      [...queryKeys.notifications.lists(), { tenantId, ...filters }] as const,
    details: () => [...queryKeys.notifications.all, 'detail'] as const,
    detail: (tenantId: string, notificationId: string) => [...queryKeys.notifications.details(), tenantId, notificationId] as const,
    byTenant: (tenantId: string) => [...queryKeys.notifications.all, 'tenant', tenantId] as const,
    search: (tenantId: string, query: string) => [...queryKeys.notifications.byTenant(tenantId), 'search', query] as const,
    related: (tenantId: string, notificationId: string) => [...queryKeys.notifications.detail(tenantId, notificationId), 'related'] as const,
    unread: (tenantId: string) => [...queryKeys.notifications.byTenant(tenantId), 'unread'] as const,
    byUser: (tenantId: string, userId: string) => [...queryKeys.notifications.byTenant(tenantId), 'user', userId] as const,
    byType: (tenantId: string, type: string) => [...queryKeys.notifications.byTenant(tenantId), 'type', type] as const,
    preferences: (tenantId: string, userId: string) => [...queryKeys.notifications.byUser(tenantId, userId), 'preferences'] as const,
  },

  // Messages
  messages: {
    all: ['messages'] as const,
    lists: () => [...queryKeys.messages.all, 'list'] as const,
    list: (tenantId?: string, filters?: Record<string, unknown>) =>
      [...queryKeys.messages.lists(), { tenantId, ...filters }] as const,
    details: () => [...queryKeys.messages.all, 'detail'] as const,
    detail: (tenantId: string, messageId: string) => [...queryKeys.messages.details(), tenantId, messageId] as const,
    byTenant: (tenantId: string) => [...queryKeys.messages.all, 'tenant', tenantId] as const,
    search: (tenantId: string, query: string) => [...queryKeys.messages.byTenant(tenantId), 'search', query] as const,
    related: (tenantId: string, messageId: string) => [...queryKeys.messages.detail(tenantId, messageId), 'related'] as const,
    threads: (tenantId: string) => [...queryKeys.messages.byTenant(tenantId), 'threads'] as const,
    thread: (tenantId: string, threadId: string) => [...queryKeys.messages.threads(tenantId), threadId] as const,
    unread: (tenantId: string) => [...queryKeys.messages.byTenant(tenantId), 'unread'] as const,
    byUser: (tenantId: string, userId: string) => [...queryKeys.messages.byTenant(tenantId), 'user', userId] as const,
    byContact: (tenantId: string, contactId: string) => [...queryKeys.messages.byTenant(tenantId), 'contact', contactId] as const,
  },

  // Security: Known Devices & Suspicious Activity
  security: {
    all: ['security'] as const,
    knownDevices: (userId?: string) => ['known-devices', userId] as const,
    suspiciousAlerts: (userId?: string) => ['suspicious-login-alerts', userId] as const,
    pendingAlerts: (userId?: string) => ['suspicious-login-alerts', userId, 'pending'] as const,
  },

  // Storefront Settings
  storefrontSettings: {
    all: ['storefront-settings'] as const,
    lists: () => [...queryKeys.storefrontSettings.all, 'list'] as const,
    list: (tenantId?: string) => [...queryKeys.storefrontSettings.lists(), { tenantId }] as const,
    details: () => [...queryKeys.storefrontSettings.all, 'detail'] as const,
    detail: (storeId: string) => [...queryKeys.storefrontSettings.details(), storeId] as const,
    byTenant: (tenantId: string) => [...queryKeys.storefrontSettings.all, 'tenant', tenantId] as const,
  },

  // Activity Feed
  activityFeed: {
    all: ['activity-feed'] as const,
    lists: () => [...queryKeys.activityFeed.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.activityFeed.lists(), filters] as const,
    byTenant: (tenantId: string) =>
      [...queryKeys.activityFeed.all, 'tenant', tenantId] as const,
    byCategory: (tenantId: string, category: string) =>
      [...queryKeys.activityFeed.byTenant(tenantId), 'category', category] as const,
    byUser: (tenantId: string, userId: string) =>
      [...queryKeys.activityFeed.byTenant(tenantId), 'user', userId] as const,
  },

  // Subscriptions
  subscriptions: {
    all: ['subscriptions'] as const,
    byTenant: (tenantId: string) =>
      [...queryKeys.subscriptions.all, 'tenant', tenantId] as const,
    plans: () => ['subscription-plans'] as const,
  },

  // Settings Versions
  settingsVersions: {
    all: ['settings-versions'] as const,
    byTenant: (tenantId: string) =>
      [...queryKeys.settingsVersions.all, 'tenant', tenantId] as const,
    byKey: (tenantId: string, settingsKey: string) =>
      [...queryKeys.settingsVersions.byTenant(tenantId), settingsKey] as const,
  },

  // Finance
  finance: {
    all: ['finance'] as const,
    revenue: (tenantId?: string, filters?: Record<string, unknown>) =>
      [...queryKeys.finance.all, 'revenue', tenantId, filters] as const,
    expenses: (tenantId?: string, filters?: Record<string, unknown>) =>
      [...queryKeys.finance.all, 'expenses', tenantId, filters] as const,
    invoices: (tenantId?: string, filters?: Record<string, unknown>) =>
      [...queryKeys.finance.all, 'invoices', tenantId, filters] as const,
    payments: (tenantId?: string, filters?: Record<string, unknown>) =>
      [...queryKeys.finance.all, 'payments', tenantId, filters] as const,
    completedOrders: (tenantId?: string, dateRange?: string) =>
      [...queryKeys.finance.all, 'completed-orders', tenantId, dateRange] as const,
    snapshot: (tenantId?: string) =>
      [...queryKeys.finance.all, 'snapshot', tenantId] as const,
    cashFlow: (tenantId?: string) =>
      [...queryKeys.finance.all, 'cash-flow', tenantId] as const,
    creditOut: (tenantId?: string) =>
      [...queryKeys.finance.all, 'credit-out', tenantId] as const,
    monthlyPerformance: (tenantId?: string) =>
      [...queryKeys.finance.all, 'monthly-performance', tenantId] as const,
    revenueGoal: (tenantId?: string) =>
      [...queryKeys.finance.all, 'revenue-goal', tenantId] as const,
  },

  // Fulfillment
  fulfillment: {
    all: ['fulfillment'] as const,
    queue: (tenantId?: string) =>
      [...queryKeys.fulfillment.all, 'queue', tenantId] as const,
    drivers: (tenantId?: string) =>
      [...queryKeys.fulfillment.all, 'drivers', tenantId] as const,
    activeDeliveries: (tenantId?: string) =>
      [...queryKeys.fulfillment.all, 'active-deliveries', tenantId] as const,
  },

  // Vendors
  vendors: {
    all: ['vendors'] as const,
    lists: () => [...queryKeys.vendors.all, 'list'] as const,
    list: (tenantId?: string, filters?: Record<string, unknown>) =>
      [...queryKeys.vendors.lists(), { tenantId, ...filters }] as const,
    details: () => [...queryKeys.vendors.all, 'detail'] as const,
    detail: (tenantId: string, vendorId: string) =>
      [...queryKeys.vendors.details(), tenantId, vendorId] as const,
    byTenant: (tenantId: string) => [...queryKeys.vendors.all, 'tenant', tenantId] as const,
    search: (tenantId: string, query: string) => [...queryKeys.vendors.byTenant(tenantId), 'search', query] as const,
    related: (tenantId: string, vendorId: string) => [...queryKeys.vendors.detail(tenantId, vendorId), 'related'] as const,
    orders: (tenantId: string, vendorId: string) =>
      [...queryKeys.vendors.detail(tenantId, vendorId), 'orders'] as const,
    products: (tenantId: string, vendorId: string) =>
      [...queryKeys.vendors.detail(tenantId, vendorId), 'products'] as const,
    payments: (tenantId: string, vendorId: string) =>
      [...queryKeys.vendors.detail(tenantId, vendorId), 'payments'] as const,
    payables: (tenantId?: string) =>
      [...queryKeys.vendors.all, 'payables', tenantId] as const,
    metrics: (tenantId: string, vendorId: string, filters?: Record<string, unknown>) =>
      [...queryKeys.vendors.detail(tenantId, vendorId), 'metrics', filters] as const,
    comparison: (tenantId: string, vendorIds: string[]) =>
      [...queryKeys.vendors.byTenant(tenantId), 'comparison', vendorIds.sort().join(',')] as const,
    contacts: (tenantId: string, vendorId: string) =>
      [...queryKeys.vendors.detail(tenantId, vendorId), 'contacts'] as const,
    contactHistory: (tenantId: string, contactId: string) =>
      [...queryKeys.vendors.all, 'contact-history', tenantId, contactId] as const,
    compliance: (tenantId: string, vendorId: string) =>
      [...queryKeys.vendors.detail(tenantId, vendorId), 'compliance'] as const,
    complianceDocuments: (tenantId: string, complianceId: string) =>
      [...queryKeys.vendors.all, 'compliance-documents', tenantId, complianceId] as const,
    complianceAudit: (tenantId: string, complianceId: string) =>
      [...queryKeys.vendors.all, 'compliance-audit', tenantId, complianceId] as const,
    ratings: (tenantId: string, vendorId: string) =>
      [...queryKeys.vendors.detail(tenantId, vendorId), 'ratings'] as const,
    ratingHistory: (tenantId: string, vendorId: string) =>
      [...queryKeys.vendors.detail(tenantId, vendorId), 'rating-history'] as const,
    ratingAggregate: (tenantId: string, vendorId: string) =>
      [...queryKeys.vendors.detail(tenantId, vendorId), 'rating-aggregate'] as const,
    communications: (tenantId: string, vendorId: string) =>
      [...queryKeys.vendors.detail(tenantId, vendorId), 'communications'] as const,
    communicationDetail: (tenantId: string, communicationId: string) =>
      [...queryKeys.vendors.all, 'communication', tenantId, communicationId] as const,
    documents: (tenantId: string, vendorId: string) =>
      [...queryKeys.vendors.detail(tenantId, vendorId), 'documents'] as const,
    documentDetail: (tenantId: string, documentId: string) =>
      [...queryKeys.vendors.all, 'document', tenantId, documentId] as const,
  },

  // Storefront
  storefront: {
    all: ['storefront'] as const,
    lists: () => [...queryKeys.storefront.all, 'list'] as const,
    list: (tenantId?: string, filters?: Record<string, unknown>) =>
      [...queryKeys.storefront.lists(), { tenantId, ...filters }] as const,
    details: () => [...queryKeys.storefront.all, 'detail'] as const,
    detail: (tenantId: string, storeId: string) => [...queryKeys.storefront.details(), tenantId, storeId] as const,
    byTenant: (tenantId: string) => [...queryKeys.storefront.all, 'tenant', tenantId] as const,
    search: (tenantId: string, query: string) => [...queryKeys.storefront.byTenant(tenantId), 'search', query] as const,
    related: (tenantId: string, storeId: string) => [...queryKeys.storefront.detail(tenantId, storeId), 'related'] as const,
    config: (tenantId?: string) =>
      [...queryKeys.storefront.all, 'config', tenantId] as const,
    liveOrders: (tenantId?: string) =>
      [...queryKeys.storefront.all, 'live-orders', tenantId] as const,
    banners: (storeId?: string) =>
      [...queryKeys.storefront.all, 'banners', storeId] as const,
    deals: (storeId?: string) =>
      [...queryKeys.storefront.all, 'deals', storeId] as const,
    products: (tenantId: string, storeId: string) =>
      [...queryKeys.storefront.detail(tenantId, storeId), 'products'] as const,
    categories: (tenantId: string, storeId: string) =>
      [...queryKeys.storefront.detail(tenantId, storeId), 'categories'] as const,
  },

  // Stock Alerts
  stockAlerts: {
    all: ['stock-alerts'] as const,
    active: (tenantId?: string) =>
      [...queryKeys.stockAlerts.all, 'active', tenantId] as const,
    byProduct: (productId: string) =>
      [...queryKeys.stockAlerts.all, 'product', productId] as const,
  },

  // Customer Invoices
  customerInvoices: {
    all: ['customer-invoices'] as const,
    lists: () => [...queryKeys.customerInvoices.all, 'list'] as const,
    list: (tenantId?: string, filters?: Record<string, unknown>) =>
      [...queryKeys.customerInvoices.lists(), { tenantId, ...filters }] as const,
    details: () => [...queryKeys.customerInvoices.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.customerInvoices.details(), id] as const,
    byCustomer: (customerId: string) =>
      [...queryKeys.customerInvoices.all, 'customer', customerId] as const,
    stats: (tenantId?: string) =>
      [...queryKeys.customerInvoices.all, 'stats', tenantId] as const,
  },

  // Order Audit Log
  orderAuditLog: {
    all: ['order-audit-log'] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.orderAuditLog.all, 'list', filters] as const,
    byOrder: (orderId: string) =>
      [...queryKeys.orderAuditLog.all, 'order', orderId] as const,
  },

  // Order Communications
  orderComms: {
    all: ['order-comms'] as const,
    byOrder: (orderId: string) =>
      [...queryKeys.orderComms.all, 'order', orderId] as const,
  },

  // Order Tags
  orderTags: {
    all: ['order-tags'] as const,
    byOrder: (orderId: string) =>
      [...queryKeys.orderTags.all, 'order', orderId] as const,
    lists: () => [...queryKeys.orderTags.all, 'list'] as const,
  },

  // Recurring Orders
  recurringOrders: {
    all: ['recurring-orders'] as const,
    lists: () => [...queryKeys.recurringOrders.all, 'list'] as const,
    list: (tenantId?: string) =>
      [...queryKeys.recurringOrders.lists(), { tenantId }] as const,
    detail: (id: string) =>
      [...queryKeys.recurringOrders.all, id] as const,
  },

  // Revenue Goal
  revenueGoal: {
    all: ['revenue-goal'] as const,
    current: (tenantId?: string) =>
      [...queryKeys.revenueGoal.all, 'current', tenantId] as const,
    history: (tenantId?: string) =>
      [...queryKeys.revenueGoal.all, 'history', tenantId] as const,
  },

  // Storefront Deals
  storefrontDeals: {
    all: ['storefront-deals'] as const,
    list: (storeId?: string) =>
      [...queryKeys.storefrontDeals.all, 'list', storeId] as const,
    detail: (dealId: string) =>
      [...queryKeys.storefrontDeals.all, dealId] as const,
  },

  // Module Health
  moduleHealth: {
    all: ['module-health'] as const,
    byTenant: (tenantId?: string) =>
      [...queryKeys.moduleHealth.all, tenantId] as const,
    byModule: (tenantId: string, moduleName: string) =>
      [...queryKeys.moduleHealth.byTenant(tenantId), moduleName] as const,
  },

  // Activity Log
  activity: {
    all: ['activity'] as const,
    lists: () => [...queryKeys.activity.all, 'list'] as const,
    list: (tenantId?: string, filters?: Record<string, unknown>) =>
      [...queryKeys.activity.lists(), { tenantId, ...filters }] as const,
    details: () => [...queryKeys.activity.all, 'detail'] as const,
    detail: (tenantId: string, activityId: string) =>
      [...queryKeys.activity.details(), tenantId, activityId] as const,
    byTenant: (tenantId: string) =>
      [...queryKeys.activity.all, 'tenant', tenantId] as const,
    byEntity: (tenantId: string, entityType: string, entityId?: string) =>
      [...queryKeys.activity.byTenant(tenantId), 'entity', entityType, entityId] as const,
    byUser: (tenantId: string, userId: string) =>
      [...queryKeys.activity.byTenant(tenantId), 'user', userId] as const,
    search: (tenantId: string, query: string) =>
      [...queryKeys.activity.byTenant(tenantId), 'search', query] as const,
    recent: (tenantId: string, limit?: number) =>
      [...queryKeys.activity.byTenant(tenantId), 'recent', limit] as const,
  },

  // SLA Tracking
  sla: {
    all: ['sla'] as const,
    compliance: (tenantId?: string) =>
      [...queryKeys.sla.all, 'compliance', tenantId] as const,
    byOrder: (orderId: string) =>
      [...queryKeys.sla.all, 'order', orderId] as const,
    targets: (tenantId?: string) =>
      [...queryKeys.sla.all, 'targets', tenantId] as const,
  },

  // Order Notes
  orderNotes: {
    all: ['order-notes'] as const,
    byOrder: (orderId: string, tenantId?: string) =>
      [...queryKeys.orderNotes.all, 'order', orderId, tenantId] as const,
    pinned: (tenantId?: string) =>
      [...queryKeys.orderNotes.all, 'pinned', tenantId] as const,
  },

  // Product Tags
  productTags: {
    all: ['product-tags'] as const,
    lists: () => [...queryKeys.productTags.all, 'list'] as const,
    list: (tenantId?: string) =>
      [...queryKeys.productTags.lists(), { tenantId }] as const,
    details: () => [...queryKeys.productTags.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.productTags.details(), id] as const,
    popular: (tenantId?: string, limit?: number) =>
      [...queryKeys.productTags.all, 'popular', tenantId, limit] as const,
    byProduct: (productId: string) =>
      [...queryKeys.productTags.all, 'product', productId] as const,
  },

  // Inventory Forecast
  inventoryForecast: {
    all: ['inventory-forecast'] as const,
    single: (tenantId?: string, productId?: string) =>
      [...queryKeys.inventoryForecast.all, 'single', tenantId, productId] as const,
    bulk: (tenantId?: string, options?: { productIds?: string[]; onlyAtRisk?: boolean }) =>
      [...queryKeys.inventoryForecast.all, 'bulk', tenantId, options?.productIds?.join(','), options?.onlyAtRisk] as const,
    dashboard: (tenantId?: string) =>
      [...queryKeys.inventoryForecast.all, 'dashboard', tenantId] as const,
  },

  // Customer Notes
  customerNotes: {
    all: ['customer-notes'] as const,
    byCustomer: (customerId: string, tenantId?: string) =>
      [...queryKeys.customerNotes.all, 'customer', customerId, tenantId] as const,
    pinned: (customerId: string, tenantId?: string) =>
      [...queryKeys.customerNotes.all, 'pinned', customerId, tenantId] as const,
    byOrder: (orderId: string) =>
      [...queryKeys.customerNotes.all, 'order', orderId] as const,
    search: (customerId: string, query: string, tenantId?: string) =>
      [...queryKeys.customerNotes.all, 'search', customerId, query, tenantId] as const,
  },

  // Abandoned Carts
  abandonedCarts: {
    all: ['abandoned-carts'] as const,
    lists: () => [...queryKeys.abandonedCarts.all, 'list'] as const,
    list: (tenantId?: string, filters?: Record<string, unknown>) =>
      [...queryKeys.abandonedCarts.lists(), { tenantId, ...filters }] as const,
    details: () => [...queryKeys.abandonedCarts.all, 'detail'] as const,
    detail: (tenantId: string, cartId: string) =>
      [...queryKeys.abandonedCarts.details(), tenantId, cartId] as const,
    byTenant: (tenantId: string) =>
      [...queryKeys.abandonedCarts.all, 'tenant', tenantId] as const,
    byCustomer: (tenantId: string, customerId: string) =>
      [...queryKeys.abandonedCarts.byTenant(tenantId), 'customer', customerId] as const,
    byMenu: (tenantId: string, menuId: string) =>
      [...queryKeys.abandonedCarts.byTenant(tenantId), 'menu', menuId] as const,
    stats: (tenantId?: string) =>
      [...queryKeys.abandonedCarts.all, 'stats', tenantId] as const,
    abandonmentRate: (tenantId?: string, menuId?: string) =>
      [...queryKeys.abandonedCarts.all, 'abandonment-rate', tenantId, menuId] as const,
  },

  // Live/Pending Orders (used across dashboard, badges, fulfillment)
  liveOrders: {
    all: ['live-orders'] as const,
    byTenant: (tenantId?: string) =>
      [...queryKeys.liveOrders.all, tenantId] as const,
  },

  pendingOrders: {
    all: ['pending-orders'] as const,
    byTenant: (tenantId?: string) =>
      [...queryKeys.pendingOrders.all, tenantId] as const,
  },

  // Admin Badge Counts
  badgeCounts: {
    all: ['admin-badge-counts'] as const,
    byTenant: (tenantId?: string) =>
      [...queryKeys.badgeCounts.all, tenantId] as const,
  },

  // Fulfillment Queue
  fulfillmentQueue: {
    all: ['fulfillment-queue'] as const,
    byTenant: (tenantId?: string) =>
      [...queryKeys.fulfillmentQueue.all, tenantId] as const,
  },

  // Dashboard Stats (standalone)
  dashboardStats: {
    all: ['dashboard-stats'] as const,
    byTenant: (tenantId?: string) =>
      [...queryKeys.dashboardStats.all, tenantId] as const,
  },

  // Delivery Ratings
  deliveryRatings: {
    all: ['delivery-ratings'] as const,
    byToken: (trackingToken: string) =>
      [...queryKeys.deliveryRatings.all, 'token', trackingToken] as const,
    recent: (tenantId: string, limit: number) =>
      [...queryKeys.deliveryRatings.all, 'recent', tenantId, limit] as const,
  },

  // Delivery Costs (P&L)
  deliveryCosts: {
    all: ['delivery-costs'] as const,
    lists: () => [...queryKeys.deliveryCosts.all, 'list'] as const,
    list: (tenantId?: string, filters?: Record<string, unknown>) =>
      [...queryKeys.deliveryCosts.lists(), { tenantId, ...filters }] as const,
    byOrder: (tenantId: string, orderId: string) =>
      [...queryKeys.deliveryCosts.all, 'order', tenantId, orderId] as const,
    analytics: (tenantId?: string, filters?: Record<string, unknown>) =>
      [...queryKeys.deliveryCosts.all, 'analytics', { tenantId, ...filters }] as const,
    byZone: (tenantId?: string) =>
      [...queryKeys.deliveryCosts.all, 'by-zone', tenantId] as const,
  },
} as const;
