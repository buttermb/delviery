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
  // Products
  products: {
    all: ['products'] as const,
    lists: () => [...queryKeys.products.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) => 
      [...queryKeys.products.lists(), filters] as const,
    details: () => [...queryKeys.products.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.products.details(), id] as const,
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
    movements: (productId?: string) => 
      [...queryKeys.inventory.all, 'movements', productId] as const,
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
  },

  // Super Admin
  superAdmin: {
    all: ['super-admin'] as const,
    dashboard: () => [...queryKeys.superAdmin.all, 'dashboard'] as const,
    metrics: () => [...queryKeys.superAdmin.all, 'metrics'] as const,
    monitoring: () => [...queryKeys.superAdmin.all, 'monitoring'] as const,
  },
} as const;
