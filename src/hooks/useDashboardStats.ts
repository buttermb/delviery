import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';

/**
 * Comprehensive Dashboard KPIs pulled from Orders, Inventory, Revenue,
 * Deliveries, Menus, and Customers -- with yesterday-comparison trends.
 */
export interface DashboardStats {
  // Orders KPIs
  pendingOrders: number;
  totalOrdersToday: number;
  totalOrdersMTD: number;
  completedOrdersToday: number;
  avgOrderValue: number;

  // Inventory KPIs
  totalProducts: number;
  lowStockItems: number;
  outOfStockItems: number;
  totalInventoryValue: number;

  // Revenue KPIs
  revenueToday: number;
  revenueYesterday: number;
  revenueMTD: number;
  revenueGrowthPercent: number;

  // Customer KPIs
  newCustomersToday: number;
  newCustomersYesterday: number;
  newCustomers: number;
  totalCustomers: number;
  activeSessions: number;

  // Delivery KPIs
  activeDeliveries: number;
  activeDeliveriesYesterday: number;

  // Menu KPIs
  activeMenus: number;

  // Yesterday comparisons for trend indicators
  pendingOrdersYesterday: number;
  totalOrdersYesterday: number;
  lowStockItemsYesterday: number;
}

export function useDashboardStats() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  return useQuery({
    queryKey: queryKeys.dashboard.stats(tenantId),
    queryFn: async (): Promise<DashboardStats> => {
      if (!tenantId) {
        return getEmptyStats();
      }

      // Date calculations
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [
        // Orders queries
        pendingOrdersResult,
        todayOrdersResult,
        mtdOrdersResult,
        completedTodayResult,
        yesterdayOrdersResult,

        // Inventory queries
        productsResult,

        // Revenue queries
        revenueMTDResult,
        revenueLastMonthResult,
        revenueYesterdayResult,

        // Customer queries
        newCustomersTodayResult,
        newCustomersYesterdayResult,
        newCustomers30dResult,
        totalCustomersResult,
        activeSessionsResult,

        // Delivery queries
        activeDeliveriesResult,

        // Menu queries
        activeMenusResult,
      ] = await Promise.allSettled([
        // Pending orders: orders with status 'pending' or 'confirmed'
        supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .in('status', ['pending', 'confirmed']),

        // Total orders today
        supabase
          .from('orders')
          .select('id, total_amount', { count: 'exact' })
          .eq('tenant_id', tenantId)
          .gte('created_at', today.toISOString())
          .not('status', 'in', '("cancelled","rejected","refunded")'),

        // Total orders MTD
        supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .gte('created_at', startOfMonth.toISOString())
          .not('status', 'in', '("cancelled","rejected","refunded")'),

        // Completed orders today
        supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .gte('created_at', today.toISOString())
          .in('status', ['completed', 'delivered']),

        // Yesterday's orders (for trend)
        supabase
          .from('orders')
          .select('id, total_amount', { count: 'exact' })
          .eq('tenant_id', tenantId)
          .gte('created_at', yesterday.toISOString())
          .lt('created_at', today.toISOString())
          .not('status', 'in', '("cancelled","rejected","refunded")'),

        // All products with stock info
        supabase
          .from('products')
          .select('id, stock_quantity, low_stock_alert, price, in_stock')
          .eq('tenant_id', tenantId),

        // Revenue MTD (sum of completed/delivered orders)
        supabase
          .from('orders')
          .select('total_amount')
          .eq('tenant_id', tenantId)
          .gte('created_at', startOfMonth.toISOString())
          .in('status', ['completed', 'delivered']),

        // Revenue last month (for growth calculation)
        supabase
          .from('orders')
          .select('total_amount')
          .eq('tenant_id', tenantId)
          .gte('created_at', startOfLastMonth.toISOString())
          .lt('created_at', endOfLastMonth.toISOString())
          .in('status', ['completed', 'delivered']),

        // Revenue yesterday (for trend)
        supabase
          .from('orders')
          .select('total_amount')
          .eq('tenant_id', tenantId)
          .gte('created_at', yesterday.toISOString())
          .lt('created_at', today.toISOString())
          .in('status', ['completed', 'delivered']),

        // New customers today
        supabase
          .from('customers')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .gte('created_at', today.toISOString()),

        // New customers yesterday (for trend)
        supabase
          .from('customers')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .gte('created_at', yesterday.toISOString())
          .lt('created_at', today.toISOString()),

        // New customers in the last 30 days
        supabase
          .from('customers')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .gte('created_at', thirtyDaysAgo.toISOString()),

        // Total customers
        supabase
          .from('customers')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId),

        // Active sessions: online customers (approximate via recent activity)
        supabase
          .from('customers')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .gte('last_seen_at', new Date(Date.now() - 15 * 60 * 1000).toISOString()),

        // Active deliveries (in_transit)
        supabase
          .from('wholesale_deliveries')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .in('status', ['assigned', 'picked_up', 'in_transit']),

        // Active menus (not burned)
        supabase
          .from('disposable_menus')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('status', 'active'),
      ]);

      // Helper to extract count from result
      const extractCount = (
        result: PromiseSettledResult<{ count: number | null; error: { message: string } | null }>,
        label: string
      ): number => {
        if (result.status === 'fulfilled') {
          const { count, error } = result.value;
          if (!error) return count ?? 0;
          logger.warn(`Failed to fetch ${label}`, error, { component: 'useDashboardStats' });
        }
        return 0;
      };

      // Extract pending orders
      const pendingOrders = extractCount(pendingOrdersResult, 'pending orders');

      // Extract today orders and revenue
      let totalOrdersToday = 0;
      let revenueToday = 0;
      if (todayOrdersResult.status === 'fulfilled') {
        const { data, count, error } = todayOrdersResult.value;
        if (!error) {
          totalOrdersToday = count ?? 0;
          if (data) {
            revenueToday = data.reduce(
              (sum, order) => sum + (Number(order.total_amount) || 0),
              0
            );
          }
        } else {
          logger.warn('Failed to fetch today orders', error, { component: 'useDashboardStats' });
        }
      }

      // Extract yesterday orders and revenue
      let totalOrdersYesterday = 0;
      if (yesterdayOrdersResult.status === 'fulfilled') {
        const { count, error } = yesterdayOrdersResult.value;
        if (!error) {
          totalOrdersYesterday = count ?? 0;
        } else {
          logger.warn('Failed to fetch yesterday orders', error, { component: 'useDashboardStats' });
        }
      }

      // Extract MTD orders count
      const totalOrdersMTD = extractCount(mtdOrdersResult, 'MTD orders');

      // Extract completed orders today
      const completedOrdersToday = extractCount(completedTodayResult, 'completed orders today');

      // Extract inventory metrics
      let totalProducts = 0;
      let lowStockItems = 0;
      let outOfStockItems = 0;
      let totalInventoryValue = 0;
      const DEFAULT_LOW_STOCK_THRESHOLD = 10;

      if (productsResult.status === 'fulfilled') {
        const { data, error } = productsResult.value;
        if (!error && data) {
          totalProducts = data.length;
          data.forEach((item) => {
            const qty = (item.stock_quantity as number | null) ?? 0;
            const threshold = (item.low_stock_alert as number | null) ?? DEFAULT_LOW_STOCK_THRESHOLD;
            const price = (item.price as number | null) ?? 0;
            const inStock = item.in_stock ?? true;

            totalInventoryValue += qty * price;

            if (qty <= 0 || !inStock) {
              outOfStockItems++;
            } else if (qty <= threshold) {
              lowStockItems++;
            }
          });
        } else if (error) {
          logger.warn('Failed to fetch products', error, { component: 'useDashboardStats' });
        }
      }

      // Extract revenue MTD
      let revenueMTD = 0;
      if (revenueMTDResult.status === 'fulfilled') {
        const { data, error } = revenueMTDResult.value;
        if (!error && data) {
          revenueMTD = data.reduce(
            (sum, order) => sum + (Number(order.total_amount) || 0),
            0
          );
        } else if (error) {
          logger.warn('Failed to fetch MTD revenue', error, { component: 'useDashboardStats' });
        }
      }

      // Extract last month revenue for growth calculation
      let revenueLastMonth = 0;
      if (revenueLastMonthResult.status === 'fulfilled') {
        const { data, error } = revenueLastMonthResult.value;
        if (!error && data) {
          revenueLastMonth = data.reduce(
            (sum, order) => sum + (Number(order.total_amount) || 0),
            0
          );
        } else if (error) {
          logger.warn('Failed to fetch last month revenue', error, { component: 'useDashboardStats' });
        }
      }

      // Extract revenue yesterday
      let revYesterday = 0;
      if (revenueYesterdayResult.status === 'fulfilled') {
        const { data, error } = revenueYesterdayResult.value;
        if (!error && data) {
          revYesterday = data.reduce(
            (sum, order) => sum + (Number(order.total_amount) || 0),
            0
          );
        }
      }

      // Calculate revenue growth percentage
      const revenueGrowthPercent = revenueLastMonth > 0
        ? ((revenueMTD - revenueLastMonth) / revenueLastMonth) * 100
        : 0;

      // Calculate average order value
      const avgOrderValue = totalOrdersMTD > 0 ? revenueMTD / totalOrdersMTD : 0;

      // Customer KPIs
      const newCustomersToday = extractCount(newCustomersTodayResult, 'new customers today');
      const newCustomersYesterday = extractCount(newCustomersYesterdayResult, 'new customers yesterday');
      const newCustomers = extractCount(newCustomers30dResult, 'new customers 30d');
      const totalCustomers = extractCount(totalCustomersResult, 'total customers');

      // Active sessions (may fail if column does not exist)
      let activeSessions = 0;
      if (activeSessionsResult.status === 'fulfilled') {
        const { count, error } = activeSessionsResult.value;
        if (!error) {
          activeSessions = count ?? 0;
        } else {
          logger.warn('Failed to fetch active sessions', error, { component: 'useDashboardStats' });
        }
      }

      // Active deliveries
      const activeDeliveries = extractCount(activeDeliveriesResult, 'active deliveries');

      // Active menus
      const activeMenus = extractCount(activeMenusResult, 'active menus');

      return {
        pendingOrders,
        totalOrdersToday,
        totalOrdersMTD,
        completedOrdersToday,
        avgOrderValue,

        totalProducts,
        lowStockItems,
        outOfStockItems,
        totalInventoryValue,

        revenueToday,
        revenueYesterday: revYesterday,
        revenueMTD,
        revenueGrowthPercent,

        newCustomersToday,
        newCustomersYesterday,
        newCustomers,
        totalCustomers,
        activeSessions,

        activeDeliveries,
        activeDeliveriesYesterday: 0, // Not tracked historically

        activeMenus,

        pendingOrdersYesterday: 0, // Pending is a current-state metric
        totalOrdersYesterday,
        lowStockItemsYesterday: 0, // Not tracked historically
      };
    },
    enabled: !!tenantId,
    refetchInterval: 30_000,
    staleTime: 30_000,
  });
}

function getEmptyStats(): DashboardStats {
  return {
    pendingOrders: 0,
    totalOrdersToday: 0,
    totalOrdersMTD: 0,
    completedOrdersToday: 0,
    avgOrderValue: 0,
    totalProducts: 0,
    lowStockItems: 0,
    outOfStockItems: 0,
    totalInventoryValue: 0,
    revenueToday: 0,
    revenueYesterday: 0,
    revenueMTD: 0,
    revenueGrowthPercent: 0,
    newCustomersToday: 0,
    newCustomersYesterday: 0,
    newCustomers: 0,
    totalCustomers: 0,
    activeSessions: 0,
    activeDeliveries: 0,
    activeDeliveriesYesterday: 0,
    activeMenus: 0,
    pendingOrdersYesterday: 0,
    totalOrdersYesterday: 0,
    lowStockItemsYesterday: 0,
  };
}
