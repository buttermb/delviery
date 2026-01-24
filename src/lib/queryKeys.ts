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
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.products.lists(), filters] as const,
    details: () => [...queryKeys.products.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.products.details(), id] as const,
    byTenant: (tenantId: string) => [...queryKeys.products.all, 'tenant', tenantId] as const,
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
    list: (filters?: Record<string, unknown>) => 
      [...queryKeys.orders.lists(), filters] as const,
    details: () => [...queryKeys.orders.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.orders.details(), id] as const,
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
    list: (warehouseId?: string) =>
      [...queryKeys.inventory.lists(), { warehouseId }] as const,
    alerts: () => [...queryKeys.inventory.all, 'alerts'] as const,
    lowStockAlerts: (tenantId?: string) =>
      [...queryKeys.inventory.all, 'low-stock-alerts', tenantId] as const,
    movements: (productId?: string) =>
      [...queryKeys.inventory.all, 'movements', productId] as const,
    history: (filters?: Record<string, unknown>) =>
      [...queryKeys.inventory.all, 'history', filters] as const,
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
    list: (filters?: Record<string, unknown>) => 
      [...queryKeys.menus.lists(), filters] as const,
    details: () => [...queryKeys.menus.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.menus.details(), id] as const,
    public: (token: string) => [...queryKeys.menus.all, 'public', token] as const,
    analytics: (id: string) => [...queryKeys.menus.detail(id), 'analytics'] as const,
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
    list: (filters?: Record<string, unknown>) => 
      [...queryKeys.deliveries.lists(), filters] as const,
    active: () => [...queryKeys.deliveries.all, 'active'] as const,
    detail: (id: string) => [...queryKeys.deliveries.all, id] as const,
  },

  // Customers
  customers: {
    all: ['customers'] as const,
    lists: () => [...queryKeys.customers.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) => 
      [...queryKeys.customers.lists(), filters] as const,
    detail: (id: string) => [...queryKeys.customers.all, id] as const,
    analytics: (id: string) => [...queryKeys.customers.detail(id), 'analytics'] as const,
    stats: (customerId: string) => [...queryKeys.customers.detail(customerId), 'stats'] as const,
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
  },

  // Analytics
  analytics: {
    all: ['analytics'] as const,
    revenue: (filters?: Record<string, unknown>) =>
      [...queryKeys.analytics.all, 'revenue', filters] as const,
    orders: (filters?: Record<string, unknown>) =>
      [...queryKeys.analytics.all, 'orders', filters] as const,
    customers: (filters?: Record<string, unknown>) =>
      [...queryKeys.analytics.all, 'customers', filters] as const,
    products: (filters?: Record<string, unknown>) =>
      [...queryKeys.analytics.all, 'products', filters] as const,
    trafficSources: (filters?: Record<string, unknown>) =>
      [...queryKeys.analytics.all, 'traffic-sources', filters] as const,
    storefront: (filters?: Record<string, unknown>) =>
      [...queryKeys.analytics.all, 'storefront', filters] as const,
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
  },

  // POS / Cash Register
  pos: {
    all: ['pos'] as const,
    products: (tenantId?: string) =>
      [...queryKeys.pos.all, 'products', { tenantId }] as const,
    transactions: (tenantId?: string) =>
      [...queryKeys.pos.all, 'transactions', { tenantId }] as const,
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
    documents: () => [...queryKeys.compliance.all, 'documents'] as const,
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
    list: (filters?: Record<string, unknown>) => 
      [...queryKeys.payments.lists(), filters] as const,
    byClient: (clientId: string) => 
      [...queryKeys.payments.all, 'client', clientId] as const,
    history: (clientId: string, limit?: number) => 
      [...queryKeys.payments.byClient(clientId), 'history', limit] as const,
    aging: (clientId: string) => 
      [...queryKeys.payments.byClient(clientId), 'aging'] as const,
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
} as const;
