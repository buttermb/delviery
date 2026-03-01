/**
 * Unified Analytics Data Hook
 *
 * Connects to all data sources: Orders, Inventory, Customers, Finance
 * Provides comprehensive analytics for the dashboard.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, startOfWeek, format } from 'date-fns';

// ============================================================================
// Types
// ============================================================================

export interface OrderAnalytics {
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  ordersByType: {
    retail: number;
    wholesale: number;
    menu: number;
    pos: number;
  };
  ordersByStatus: Record<string, number>;
  dailyOrders: Array<{ date: string; count: number; revenue: number }>;
}

export interface InventoryAnalytics {
  totalProducts: number;
  activeProducts: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  totalStockValue: number;
  recentMovements: Array<{
    date: string;
    type: string;
    count: number;
  }>;
  topProducts: Array<{
    id: string;
    name: string;
    stockQuantity: number;
    lowStockAlert: number;
  }>;
  categoryBreakdown: Array<{
    category: string;
    count: number;
    value: number;
  }>;
}

export interface CustomerAnalytics {
  totalCustomers: number;
  newCustomers: number;
  activeCustomers: number;
  customersBySegment: Record<string, number>;
  topCustomers: Array<{
    id: string;
    name: string;
    email: string;
    totalSpent: number;
    orderCount: number;
  }>;
  customerGrowth: Array<{
    date: string;
    newCustomers: number;
    totalCustomers: number;
  }>;
  retentionRate: number;
}

export interface FinanceAnalytics {
  todayRevenue: number;
  weekRevenue: number;
  monthRevenue: number;
  totalOutstanding: number;
  collectionsToday: number;
  expectedThisWeek: number;
  overdueAccounts: Array<{
    clientId: string;
    clientName: string;
    amount: number;
    daysPastDue: number;
  }>;
  revenueByDay: Array<{
    date: string;
    revenue: number;
    cost: number;
    profit: number;
  }>;
  paymentMethods: Record<string, number>;
}

export interface UnifiedAnalyticsData {
  orders: OrderAnalytics;
  inventory: InventoryAnalytics;
  customers: CustomerAnalytics;
  finance: FinanceAnalytics;
  lastUpdated: string;
}

export interface AnalyticsFilters {
  startDate?: Date;
  endDate?: Date;
  orderType?: 'all' | 'retail' | 'wholesale' | 'menu' | 'pos';
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useAnalyticsData(filters: AnalyticsFilters = {}) {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  const {
    startDate = subDays(new Date(), 30),
    endDate = new Date(),
    orderType = 'all',
  } = filters;

  return useQuery({
    queryKey: queryKeys.unifiedAnalytics.all(tenantId, startDate?.toISOString(), endDate?.toISOString(), orderType),
    queryFn: async (): Promise<UnifiedAnalyticsData> => {
      if (!tenantId) {
        throw new Error('No tenant context');
      }

      const startDateStr = startOfDay(startDate).toISOString();
      const endDateStr = endOfDay(endDate).toISOString();
      const todayStart = startOfDay(new Date()).toISOString();
      const todayEnd = endOfDay(new Date()).toISOString();
      const weekStart = startOfWeek(new Date()).toISOString();
      const monthStart = startOfMonth(new Date()).toISOString();
      const monthEnd = endOfMonth(new Date()).toISOString();

      // Parallel fetch all data sources
      const [
        ordersResult,
        productsResult,
        customersResult,
        paymentsResult,
        clientsResult,
        inventoryHistoryResult,
      ] = await Promise.allSettled([
        // Orders from unified_orders table
        fetchOrdersData(tenantId, startDateStr, endDateStr, orderType),
        // Products/Inventory
        fetchProductsData(tenantId),
        // Customers
        fetchCustomersData(tenantId, startDateStr, endDateStr),
        // Payments
        fetchPaymentsData(tenantId, todayStart, todayEnd, weekStart),
        // Wholesale clients for outstanding balances
        fetchClientsData(tenantId),
        // Inventory history
        fetchInventoryHistory(tenantId, startDateStr, endDateStr),
      ]);

      // Process orders data
      const ordersData = ordersResult.status === 'fulfilled' ? ordersResult.value : getDefaultOrdersData();

      // Process products data
      const productsData = productsResult.status === 'fulfilled' ? productsResult.value : getDefaultProductsData();

      // Process customers data
      const customersData = customersResult.status === 'fulfilled' ? customersResult.value : getDefaultCustomersData();

      // Process payments data
      const paymentsData = paymentsResult.status === 'fulfilled' ? paymentsResult.value : { collectionsToday: 0, expectedThisWeek: 0 };

      // Process clients data
      const clientsData = clientsResult.status === 'fulfilled' ? clientsResult.value : { totalOutstanding: 0, overdueAccounts: [] };

      // Process inventory history
      const inventoryHistory = inventoryHistoryResult.status === 'fulfilled' ? inventoryHistoryResult.value : [];

      // Build unified analytics response
      return {
        orders: ordersData,
        inventory: {
          ...productsData,
          recentMovements: processInventoryMovements(inventoryHistory),
        },
        customers: customersData,
        finance: {
          todayRevenue: ordersData.dailyOrders.find(d => d.date === format(new Date(), 'yyyy-MM-dd'))?.revenue ?? 0,
          weekRevenue: ordersData.dailyOrders
            .filter(d => new Date(d.date) >= new Date(weekStart))
            .reduce((sum, d) => sum + d.revenue, 0),
          monthRevenue: ordersData.dailyOrders
            .filter(d => new Date(d.date) >= new Date(monthStart) && new Date(d.date) <= new Date(monthEnd))
            .reduce((sum, d) => sum + d.revenue, 0),
          totalOutstanding: clientsData.totalOutstanding,
          collectionsToday: paymentsData.collectionsToday,
          expectedThisWeek: paymentsData.expectedThisWeek,
          overdueAccounts: clientsData.overdueAccounts,
          revenueByDay: ordersData.dailyOrders.map(d => ({
            date: d.date,
            revenue: d.revenue,
            cost: d.revenue * 0.62, // Estimated COGS
            profit: d.revenue * 0.38,
          })),
          paymentMethods: ordersData.paymentMethods ?? {},
        },
        lastUpdated: new Date().toISOString(),
      };
    },
    enabled: !!tenantId,
    staleTime: 60_000, // 1 minute
    gcTime: 300_000, // 5 minutes
  });
}

// ============================================================================
// Data Fetchers
// ============================================================================

async function fetchOrdersData(
  tenantId: string,
  startDate: string,
  endDate: string,
  orderType: string
): Promise<OrderAnalytics & { paymentMethods: Record<string, number> }> {
  let query = supabase
    .from('unified_orders')
    .select('id, order_type, status, total_amount, payment_method, created_at')
    .eq('tenant_id', tenantId)
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  if (orderType !== 'all') {
    query = query.eq('order_type', orderType);
  }

  const { data: orders, error } = await query;

  if (error) {
    logger.error('Failed to fetch orders for analytics', { error, tenantId });
    throw error;
  }

  const ordersList = orders ?? [];

  // Calculate metrics
  const totalOrders = ordersList.length;
  const pendingOrders = ordersList.filter(o => ['pending', 'confirmed'].includes(o.status)).length;
  const completedOrders = ordersList.filter(o => ['completed', 'delivered'].includes(o.status)).length;
  const cancelledOrders = ordersList.filter(o => o.status === 'cancelled').length;
  const totalRevenue = ordersList
    .filter(o => ['completed', 'delivered'].includes(o.status))
    .reduce((sum, o) => sum + (o.total_amount ?? 0), 0);
  const averageOrderValue = completedOrders > 0 ? totalRevenue / completedOrders : 0;

  // Orders by type
  const ordersByType = {
    retail: ordersList.filter(o => o.order_type === 'retail').length,
    wholesale: ordersList.filter(o => o.order_type === 'wholesale').length,
    menu: ordersList.filter(o => o.order_type === 'menu').length,
    pos: ordersList.filter(o => o.order_type === 'pos').length,
  };

  // Orders by status
  const ordersByStatus: Record<string, number> = {};
  ordersList.forEach(o => {
    ordersByStatus[o.status] = (ordersByStatus[o.status] ?? 0) + 1;
  });

  // Daily orders
  const dailyMap = new Map<string, { count: number; revenue: number }>();
  ordersList.forEach(o => {
    const date = format(new Date(o.created_at), 'yyyy-MM-dd');
    const existing = dailyMap.get(date) ?? { count: 0, revenue: 0 };
    dailyMap.set(date, {
      count: existing.count + 1,
      revenue: existing.revenue + (['completed', 'delivered'].includes(o.status) ? (o.total_amount ?? 0) : 0),
    });
  });

  const dailyOrders = Array.from(dailyMap.entries())
    .map(([date, data]) => ({
      date,
      count: data.count,
      revenue: Math.round(data.revenue * 100) / 100,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Payment methods
  const paymentMethods: Record<string, number> = {};
  ordersList.forEach(o => {
    const method = o.payment_method ?? 'unknown';
    paymentMethods[method] = (paymentMethods[method] ?? 0) + (o.total_amount ?? 0);
  });

  return {
    totalOrders,
    pendingOrders,
    completedOrders,
    cancelledOrders,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    averageOrderValue: Math.round(averageOrderValue * 100) / 100,
    ordersByType,
    ordersByStatus,
    dailyOrders,
    paymentMethods,
  };
}

async function fetchProductsData(tenantId: string): Promise<Omit<InventoryAnalytics, 'recentMovements'>> {
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, sku, stock_quantity, low_stock_alert, price, category, in_stock')
    .eq('tenant_id', tenantId)
    .limit(1000);

  if (error) {
    logger.error('Failed to fetch products for analytics', { error, tenantId });
    throw error;
  }

  const productsList = products ?? [];

  const totalProducts = productsList.length;
  const activeProducts = productsList.filter(p => p.in_stock !== false).length;
  const lowStockProducts = productsList.filter(p => {
    const threshold = p.low_stock_alert ?? 10;
    const qty = p.stock_quantity ?? 0;
    return qty > 0 && qty <= threshold;
  }).length;
  const outOfStockProducts = productsList.filter(p => (p.stock_quantity ?? 0) <= 0).length;

  const totalStockValue = productsList.reduce((sum, p) => {
    return sum + ((p.stock_quantity ?? 0) * (p.price ?? 0));
  }, 0);

  // Top products by stock
  const topProducts = productsList
    .filter(p => p.in_stock !== false)
    .sort((a, b) => (b.stock_quantity ?? 0) - (a.stock_quantity ?? 0))
    .slice(0, 10)
    .map(p => ({
      id: p.id,
      name: p.name,
      stockQuantity: p.stock_quantity ?? 0,
      lowStockAlert: p.low_stock_alert ?? 10,
    }));

  // Category breakdown
  const categoryMap = new Map<string, { count: number; value: number }>();
  productsList.forEach(p => {
    const category = p.category ?? 'Uncategorized';
    const existing = categoryMap.get(category) ?? { count: 0, value: 0 };
    categoryMap.set(category, {
      count: existing.count + 1,
      value: existing.value + ((p.stock_quantity ?? 0) * (p.price ?? 0)),
    });
  });

  const categoryBreakdown = Array.from(categoryMap.entries())
    .map(([category, data]) => ({
      category,
      count: data.count,
      value: Math.round(data.value * 100) / 100,
    }))
    .sort((a, b) => b.value - a.value);

  return {
    totalProducts,
    activeProducts,
    lowStockProducts,
    outOfStockProducts,
    totalStockValue: Math.round(totalStockValue * 100) / 100,
    topProducts,
    categoryBreakdown,
  };
}

async function fetchCustomersData(
  tenantId: string,
  startDate: string,
  endDate: string
): Promise<CustomerAnalytics> {
  // Fetch customers
  const { data: customers, error } = await supabase
    .from('customers')
    .select('id, first_name, last_name, email, created_at')
    .eq('tenant_id', tenantId)
    .limit(5000);

  if (error) {
    logger.error('Failed to fetch customers for analytics', { error, tenantId });
    throw error;
  }

  const customersList = customers ?? [];
  const totalCustomers = customersList.length;

  // New customers in period
  const newCustomers = customersList.filter(c =>
    c.created_at && new Date(c.created_at) >= new Date(startDate) && new Date(c.created_at) <= new Date(endDate)
  ).length;

  // Fetch customer order stats
  const { data: orderStats, error: orderError } = await supabase
    .from('unified_orders')
    .select('customer_id, total_amount, status')
    .eq('tenant_id', tenantId)
    .not('customer_id', 'is', null)
    .in('status', ['completed', 'delivered']);

  if (orderError) {
    logger.warn('Failed to fetch customer order stats', { error: orderError, tenantId });
  }

  const orderStatsList = orderStats ?? [];

  // Calculate active customers (those with orders)
  const activeCustomerIds = new Set(orderStatsList.map(o => o.customer_id));
  const activeCustomers = activeCustomerIds.size;

  // Top customers by spend
  const customerSpendMap = new Map<string, { totalSpent: number; orderCount: number }>();
  orderStatsList.forEach(o => {
    if (!o.customer_id) return;
    const existing = customerSpendMap.get(o.customer_id) ?? { totalSpent: 0, orderCount: 0 };
    customerSpendMap.set(o.customer_id, {
      totalSpent: existing.totalSpent + (o.total_amount ?? 0),
      orderCount: existing.orderCount + 1,
    });
  });

  const topCustomers = Array.from(customerSpendMap.entries())
    .map(([customerId, stats]) => {
      const customer = customersList.find(c => c.id === customerId);
      return {
        id: customerId,
        name: customer ? `${customer.first_name ?? ''} ${customer.last_name ?? ''}`.trim() || 'Unknown' : 'Unknown',
        email: customer?.email ?? '',
        totalSpent: Math.round(stats.totalSpent * 100) / 100,
        orderCount: stats.orderCount,
      };
    })
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, 10);

  // Customer growth by day
  const growthMap = new Map<string, number>();
  customersList.forEach(c => {
    if (!c.created_at) return;
    const date = format(new Date(c.created_at), 'yyyy-MM-dd');
    growthMap.set(date, (growthMap.get(date) ?? 0) + 1);
  });

  // Sort dates and calculate cumulative totals
  const sortedDates = Array.from(growthMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  let cumulative = 0;
  const customerGrowth = sortedDates.map(([date, newCount]) => {
    cumulative += newCount;
    return {
      date,
      newCustomers: newCount,
      totalCustomers: cumulative,
    };
  });

  // Retention rate (simplified: % of customers who made more than one order)
  const repeatCustomers = Array.from(customerSpendMap.values()).filter(s => s.orderCount > 1).length;
  const retentionRate = activeCustomers > 0 ? Math.round((repeatCustomers / activeCustomers) * 100) : 0;

  // Customer segments
  const customersBySegment: Record<string, number> = {
    'New': customersList.filter(c => c.created_at && new Date(c.created_at) >= subDays(new Date(), 30)).length,
    'Active': activeCustomers,
    'Repeat': repeatCustomers,
    'Inactive': totalCustomers - activeCustomers,
  };

  return {
    totalCustomers,
    newCustomers,
    activeCustomers,
    customersBySegment,
    topCustomers,
    customerGrowth,
    retentionRate,
  };
}

async function fetchPaymentsData(
  tenantId: string,
  todayStart: string,
  todayEnd: string,
  weekStart: string
): Promise<{ collectionsToday: number; expectedThisWeek: number }> {
  // Today's collections from wholesale_payments
  const { data: todayPayments, error: paymentsError } = await supabase
    .from('wholesale_payments')
    .select('amount')
    .eq('tenant_id', tenantId)
    .gte('created_at', todayStart)
    .lte('created_at', todayEnd);

  if (paymentsError) {
    logger.warn('Failed to fetch today payments', { error: paymentsError, tenantId });
  }

  const collectionsToday = (todayPayments ?? []).reduce((sum, p) => sum + (p.amount ?? 0), 0);

  // Expected this week from orders
  const { data: weekOrders, error: weekError } = await supabase
    .from('unified_orders')
    .select('total_amount')
    .eq('tenant_id', tenantId)
    .gte('created_at', weekStart)
    .neq('status', 'cancelled');

  if (weekError) {
    logger.warn('Failed to fetch week orders', { error: weekError, tenantId });
  }

  const expectedThisWeek = (weekOrders ?? []).reduce((sum, o) => sum + (o.total_amount ?? 0), 0);

  return {
    collectionsToday: Math.round(collectionsToday * 100) / 100,
    expectedThisWeek: Math.round(expectedThisWeek * 100) / 100,
  };
}

async function fetchClientsData(tenantId: string): Promise<{
  totalOutstanding: number;
  overdueAccounts: Array<{ clientId: string; clientName: string; amount: number; daysPastDue: number }>;
}> {
  const { data: clients, error } = await supabase
    .from('wholesale_clients')
    .select('id, business_name, outstanding_balance, last_payment_date, payment_terms')
    .eq('tenant_id', tenantId)
    .gt('outstanding_balance', 0)
    .order('outstanding_balance', { ascending: false });

  if (error) {
    logger.warn('Failed to fetch wholesale clients', { error, tenantId });
    return { totalOutstanding: 0, overdueAccounts: [] };
  }

  const clientsList = clients ?? [];
  const totalOutstanding = clientsList.reduce((sum, c) => sum + (c.outstanding_balance ?? 0), 0);

  // Find overdue accounts
  const now = new Date();
  const overdueAccounts = clientsList
    .filter(c => {
      if (!c.last_payment_date) return true;
      const daysSincePayment = Math.floor((now.getTime() - new Date(c.last_payment_date).getTime()) / (1000 * 60 * 60 * 24));
      return daysSincePayment > (c.payment_terms ?? 30);
    })
    .slice(0, 10)
    .map(c => ({
      clientId: c.id,
      clientName: c.business_name ?? 'Unknown',
      amount: c.outstanding_balance ?? 0,
      daysPastDue: c.last_payment_date
        ? Math.floor((now.getTime() - new Date(c.last_payment_date).getTime()) / (1000 * 60 * 60 * 24)) - (c.payment_terms ?? 30)
        : 0,
    }));

  return {
    totalOutstanding: Math.round(totalOutstanding * 100) / 100,
    overdueAccounts,
  };
}

async function fetchInventoryHistory(
  tenantId: string,
  startDate: string,
  endDate: string
): Promise<Array<{ change_type: string; created_at: string }>> {
  const { data, error } = await supabase
    .from('inventory_history')
    .select('change_type, created_at')
    .eq('tenant_id', tenantId)
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .limit(500);

  if (error) {
    logger.warn('Failed to fetch inventory history', { error, tenantId });
    return [];
  }

  return (data as Array<{ change_type: string; created_at: string }>) ?? [];
}

function processInventoryMovements(
  history: Array<{ change_type: string; created_at: string }>
): Array<{ date: string; type: string; count: number }> {
  const movementMap = new Map<string, Map<string, number>>();

  history.forEach(h => {
    const date = format(new Date(h.created_at), 'yyyy-MM-dd');
    if (!movementMap.has(date)) {
      movementMap.set(date, new Map());
    }
    const typeMap = movementMap.get(date);
    if (!typeMap) return;
    typeMap.set(h.change_type, (typeMap.get(h.change_type) ?? 0) + 1);
  });

  const result: Array<{ date: string; type: string; count: number }> = [];
  movementMap.forEach((typeMap, date) => {
    typeMap.forEach((count, type) => {
      result.push({ date, type, count });
    });
  });

  return result.sort((a, b) => a.date.localeCompare(b.date));
}

// ============================================================================
// Default Data
// ============================================================================

function getDefaultOrdersData(): OrderAnalytics & { paymentMethods: Record<string, number> } {
  return {
    totalOrders: 0,
    pendingOrders: 0,
    completedOrders: 0,
    cancelledOrders: 0,
    totalRevenue: 0,
    averageOrderValue: 0,
    ordersByType: { retail: 0, wholesale: 0, menu: 0, pos: 0 },
    ordersByStatus: {},
    dailyOrders: [],
    paymentMethods: {},
  };
}

function getDefaultProductsData(): Omit<InventoryAnalytics, 'recentMovements'> {
  return {
    totalProducts: 0,
    activeProducts: 0,
    lowStockProducts: 0,
    outOfStockProducts: 0,
    totalStockValue: 0,
    topProducts: [],
    categoryBreakdown: [],
  };
}

function getDefaultCustomersData(): CustomerAnalytics {
  return {
    totalCustomers: 0,
    newCustomers: 0,
    activeCustomers: 0,
    customersBySegment: {},
    topCustomers: [],
    customerGrowth: [],
    retentionRate: 0,
  };
}

// ============================================================================
// Individual Analytics Hooks
// ============================================================================

/**
 * Hook for order-specific analytics
 */
export function useOrderAnalytics(filters: AnalyticsFilters = {}) {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  const {
    startDate = subDays(new Date(), 30),
    endDate = new Date(),
    orderType = 'all',
  } = filters;

  return useQuery({
    queryKey: queryKeys.analytics.orders(tenantId, { startDate: startDate?.toISOString(), endDate: endDate?.toISOString(), orderType }),
    queryFn: async () => {
      if (!tenantId) throw new Error('No tenant context');
      return fetchOrdersData(tenantId, startOfDay(startDate).toISOString(), endOfDay(endDate).toISOString(), orderType);
    },
    enabled: !!tenantId,
    staleTime: 60_000,
  });
}

/**
 * Hook for inventory-specific analytics
 */
export function useInventoryAnalytics() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  return useQuery({
    queryKey: queryKeys.inventoryAnalytics.all(tenantId),
    queryFn: async () => {
      if (!tenantId) throw new Error('No tenant context');
      const products = await fetchProductsData(tenantId);
      const history = await fetchInventoryHistory(tenantId, subDays(new Date(), 30).toISOString(), new Date().toISOString());
      return {
        ...products,
        recentMovements: processInventoryMovements(history),
      };
    },
    enabled: !!tenantId,
    staleTime: 120_000,
  });
}

/**
 * Hook for customer-specific analytics
 */
export function useCustomerAnalytics(filters: AnalyticsFilters = {}) {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  const {
    startDate = subDays(new Date(), 30),
    endDate = new Date(),
  } = filters;

  return useQuery({
    queryKey: queryKeys.analytics.customers(tenantId, { startDate: startDate?.toISOString(), endDate: endDate?.toISOString() }),
    queryFn: async () => {
      if (!tenantId) throw new Error('No tenant context');
      return fetchCustomersData(tenantId, startOfDay(startDate).toISOString(), endOfDay(endDate).toISOString());
    },
    enabled: !!tenantId,
    staleTime: 120_000,
  });
}

/**
 * Hook for finance-specific analytics
 */
export function useFinanceAnalytics() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  return useQuery({
    queryKey: queryKeys.financeAnalytics.all(tenantId),
    queryFn: async () => {
      if (!tenantId) throw new Error('No tenant context');

      const todayStart = startOfDay(new Date()).toISOString();
      const todayEnd = endOfDay(new Date()).toISOString();
      const weekStart = startOfWeek(new Date()).toISOString();
      const monthStart = startOfMonth(new Date()).toISOString();
      const monthEnd = endOfMonth(new Date()).toISOString();

      const [paymentsData, clientsData, ordersData] = await Promise.all([
        fetchPaymentsData(tenantId, todayStart, todayEnd, weekStart),
        fetchClientsData(tenantId),
        fetchOrdersData(tenantId, monthStart, monthEnd, 'all'),
      ]);

      return {
        todayRevenue: ordersData.dailyOrders.find(d => d.date === format(new Date(), 'yyyy-MM-dd'))?.revenue ?? 0,
        weekRevenue: ordersData.dailyOrders
          .filter(d => new Date(d.date) >= new Date(weekStart))
          .reduce((sum, d) => sum + d.revenue, 0),
        monthRevenue: ordersData.totalRevenue,
        totalOutstanding: clientsData.totalOutstanding,
        collectionsToday: paymentsData.collectionsToday,
        expectedThisWeek: paymentsData.expectedThisWeek,
        overdueAccounts: clientsData.overdueAccounts,
        revenueByDay: ordersData.dailyOrders.map(d => ({
          date: d.date,
          revenue: d.revenue,
          cost: d.revenue * 0.62,
          profit: d.revenue * 0.38,
        })),
        paymentMethods: ordersData.paymentMethods,
      } as FinanceAnalytics;
    },
    enabled: !!tenantId,
    staleTime: 60_000,
  });
}
