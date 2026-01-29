import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';

/**
 * Comprehensive Dashboard KPIs pulled from Orders, Inventory, and Revenue
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
  revenueMTD: number;
  revenueGrowthPercent: number;

  // Customer KPIs
  newCustomers: number;
  totalCustomers: number;
  activeSessions: number;
}

export function useDashboardStats() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  return useQuery({
    queryKey: queryKeys.dashboard.stats(tenantId),
    queryFn: async (): Promise<DashboardStats> => {
      if (!tenantId) {
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
          revenueMTD: 0,
          revenueGrowthPercent: 0,
          newCustomers: 0,
          totalCustomers: 0,
          activeSessions: 0,
        };
      }

      // Date calculations
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
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

        // Inventory queries
        productsResult,

        // Revenue queries - MTD
        revenueMTDResult,
        revenueLastMonthResult,

        // Customer queries
        newCustomersResult,
        totalCustomersResult,
        activeSessionsResult,
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
      ]);

      // Extract pending orders count
      let pendingOrders = 0;
      if (pendingOrdersResult.status === 'fulfilled') {
        const { count, error } = pendingOrdersResult.value;
        if (!error) {
          pendingOrders = count ?? 0;
        } else {
          logger.warn('Failed to fetch pending orders', error, { component: 'useDashboardStats' });
        }
      }

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

      // Extract MTD orders count
      let totalOrdersMTD = 0;
      if (mtdOrdersResult.status === 'fulfilled') {
        const { count, error } = mtdOrdersResult.value;
        if (!error) {
          totalOrdersMTD = count ?? 0;
        } else {
          logger.warn('Failed to fetch MTD orders', error, { component: 'useDashboardStats' });
        }
      }

      // Extract completed orders today
      let completedOrdersToday = 0;
      if (completedTodayResult.status === 'fulfilled') {
        const { count, error } = completedTodayResult.value;
        if (!error) {
          completedOrdersToday = count ?? 0;
        } else {
          logger.warn('Failed to fetch completed orders today', error, { component: 'useDashboardStats' });
        }
      }

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

            // Calculate inventory value
            totalInventoryValue += qty * price;

            // Out of stock check
            if (qty <= 0 || !inStock) {
              outOfStockItems++;
            } else if (qty <= threshold) {
              // Low stock check (but not out of stock)
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

      // Calculate revenue growth percentage
      const revenueGrowthPercent = revenueLastMonth > 0
        ? ((revenueMTD - revenueLastMonth) / revenueLastMonth) * 100
        : 0;

      // Calculate average order value
      const avgOrderValue = totalOrdersMTD > 0 ? revenueMTD / totalOrdersMTD : 0;

      // Extract new customers count
      let newCustomers = 0;
      if (newCustomersResult.status === 'fulfilled') {
        const { count, error } = newCustomersResult.value;
        if (!error) {
          newCustomers = count ?? 0;
        } else {
          logger.warn('Failed to fetch new customers', error, { component: 'useDashboardStats' });
        }
      }

      // Extract total customers count
      let totalCustomers = 0;
      if (totalCustomersResult.status === 'fulfilled') {
        const { count, error } = totalCustomersResult.value;
        if (!error) {
          totalCustomers = count ?? 0;
        } else {
          logger.warn('Failed to fetch total customers', error, { component: 'useDashboardStats' });
        }
      }

      // Extract active sessions
      let activeSessions = 0;
      if (activeSessionsResult.status === 'fulfilled') {
        const { count, error } = activeSessionsResult.value;
        if (!error) {
          activeSessions = count ?? 0;
        } else {
          // last_seen_at column may not exist, gracefully handle
          logger.warn('Failed to fetch active sessions', error, { component: 'useDashboardStats' });
        }
      }

      return {
        // Orders KPIs
        pendingOrders,
        totalOrdersToday,
        totalOrdersMTD,
        completedOrdersToday,
        avgOrderValue,

        // Inventory KPIs
        totalProducts,
        lowStockItems,
        outOfStockItems,
        totalInventoryValue,

        // Revenue KPIs
        revenueToday,
        revenueMTD,
        revenueGrowthPercent,

        // Customer KPIs
        newCustomers,
        totalCustomers,
        activeSessions,
      };
    },
    enabled: !!tenantId,
    refetchInterval: 30_000, // 30 seconds
    staleTime: 15_000, // Consider data stale after 15s
  });
}
