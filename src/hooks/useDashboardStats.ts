import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useDashboardDateRangeOptional } from '@/contexts/DashboardDateRangeContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { subDays, startOfDay, endOfDay } from 'date-fns';

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

  // Get date range from context (optional - falls back to defaults if not in provider)
  const dateRangeContext = useDashboardDateRangeOptional();

  // Default date range: last 30 days if context not available
  const defaultRange = {
    from: startOfDay(subDays(new Date(), 29)),
    to: endOfDay(new Date()),
  };

  const dateRange = dateRangeContext?.dateRange ?? defaultRange;
  const dateRangeKey = dateRangeContext?.dateRangeKey ?? 'default';

  return useQuery({
    queryKey: queryKeys.dashboard.stats(tenantId, dateRangeKey),
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

      // Date calculations - use the date range from context
      const rangeStart = dateRange.from;
      const rangeEnd = dateRange.to;

      // For "today" stats, we still use actual today within the range
      const now = new Date();
      const today = startOfDay(now);

      // Calculate comparison period (same duration before the selected range)
      const rangeDurationMs = rangeEnd.getTime() - rangeStart.getTime();
      const comparisonEnd = new Date(rangeStart.getTime() - 1); // Day before range start
      const comparisonStart = new Date(comparisonEnd.getTime() - rangeDurationMs);

      const [
        // Orders queries
        pendingOrdersResult,
        rangeOrdersResult,
        rangeOrdersCountResult,
        completedRangeResult,

        // Inventory queries
        productsResult,

        // Revenue queries - in selected range
        revenueRangeResult,
        revenueComparisonResult,

        // Customer queries
        newCustomersResult,
        totalCustomersResult,
        activeSessionsResult,
      ] = await Promise.allSettled([
        // Pending orders: orders with status 'pending' or 'confirmed' (not filtered by date)
        supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .in('status', ['pending', 'confirmed']),

        // Total orders in date range (with amounts for revenue calculation)
        supabase
          .from('orders')
          .select('id, total_amount', { count: 'exact' })
          .eq('tenant_id', tenantId)
          .gte('created_at', rangeStart.toISOString())
          .lte('created_at', rangeEnd.toISOString())
          .not('status', 'in', '("cancelled","rejected","refunded")'),

        // Total orders count in date range
        supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .gte('created_at', rangeStart.toISOString())
          .lte('created_at', rangeEnd.toISOString())
          .not('status', 'in', '("cancelled","rejected","refunded")'),

        // Completed orders in date range
        supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .gte('created_at', rangeStart.toISOString())
          .lte('created_at', rangeEnd.toISOString())
          .in('status', ['completed', 'delivered']),

        // All products with stock info (not filtered by date)
        supabase
          .from('products')
          .select('id, stock_quantity, low_stock_alert, price, in_stock')
          .eq('tenant_id', tenantId),

        // Revenue in selected range (sum of completed/delivered orders)
        supabase
          .from('orders')
          .select('total_amount')
          .eq('tenant_id', tenantId)
          .gte('created_at', rangeStart.toISOString())
          .lte('created_at', rangeEnd.toISOString())
          .in('status', ['completed', 'delivered']),

        // Revenue in comparison period (for growth calculation)
        supabase
          .from('orders')
          .select('total_amount')
          .eq('tenant_id', tenantId)
          .gte('created_at', comparisonStart.toISOString())
          .lte('created_at', comparisonEnd.toISOString())
          .in('status', ['completed', 'delivered']),

        // New customers in date range
        supabase
          .from('customers')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .gte('created_at', rangeStart.toISOString())
          .lte('created_at', rangeEnd.toISOString()),

        // Total customers (not filtered by date)
        supabase
          .from('customers')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId),

        // Active sessions: online customers (approximate via recent activity, not filtered by date range)
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

      // Extract orders in range and revenue
      let totalOrdersInRange = 0;
      let revenueInRange = 0;
      if (rangeOrdersResult.status === 'fulfilled') {
        const { data, count, error } = rangeOrdersResult.value;
        if (!error) {
          totalOrdersInRange = count ?? 0;
          if (data) {
            revenueInRange = data.reduce(
              (sum, order) => sum + (Number(order.total_amount) || 0),
              0
            );
          }
        } else {
          logger.warn('Failed to fetch range orders', error, { component: 'useDashboardStats' });
        }
      }

      // Extract total orders count in range
      let totalOrdersCount = 0;
      if (rangeOrdersCountResult.status === 'fulfilled') {
        const { count, error } = rangeOrdersCountResult.value;
        if (!error) {
          totalOrdersCount = count ?? 0;
        } else {
          logger.warn('Failed to fetch range orders count', error, { component: 'useDashboardStats' });
        }
      }

      // Extract completed orders in range
      let completedOrdersInRange = 0;
      if (completedRangeResult.status === 'fulfilled') {
        const { count, error } = completedRangeResult.value;
        if (!error) {
          completedOrdersInRange = count ?? 0;
        } else {
          logger.warn('Failed to fetch completed orders in range', error, { component: 'useDashboardStats' });
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

      // Extract revenue in selected range
      let revenueRange = 0;
      if (revenueRangeResult.status === 'fulfilled') {
        const { data, error } = revenueRangeResult.value;
        if (!error && data) {
          revenueRange = data.reduce(
            (sum, order) => sum + (Number(order.total_amount) || 0),
            0
          );
        } else if (error) {
          logger.warn('Failed to fetch range revenue', error, { component: 'useDashboardStats' });
        }
      }

      // Extract comparison period revenue for growth calculation
      let revenueComparison = 0;
      if (revenueComparisonResult.status === 'fulfilled') {
        const { data, error } = revenueComparisonResult.value;
        if (!error && data) {
          revenueComparison = data.reduce(
            (sum, order) => sum + (Number(order.total_amount) || 0),
            0
          );
        } else if (error) {
          logger.warn('Failed to fetch comparison revenue', error, { component: 'useDashboardStats' });
        }
      }

      // Calculate revenue growth percentage (compared to previous period)
      const revenueGrowthPercent = revenueComparison > 0
        ? ((revenueRange - revenueComparison) / revenueComparison) * 100
        : 0;

      // Calculate average order value
      const avgOrderValue = totalOrdersCount > 0 ? revenueRange / totalOrdersCount : 0;

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
        totalOrdersToday: totalOrdersInRange, // Now represents orders in selected range
        totalOrdersMTD: totalOrdersCount, // Now represents total orders in selected range
        completedOrdersToday: completedOrdersInRange, // Now represents completed orders in selected range
        avgOrderValue,

        // Inventory KPIs
        totalProducts,
        lowStockItems,
        outOfStockItems,
        totalInventoryValue,

        // Revenue KPIs
        revenueToday: revenueInRange, // Now represents revenue in selected range
        revenueMTD: revenueRange, // Now represents total revenue in selected range
        revenueGrowthPercent,

        // Customer KPIs
        newCustomers,
        totalCustomers,
        activeSessions,
      };
    },
    enabled: !!tenantId,
    refetchInterval: 60_000, // 60 seconds
    staleTime: 60_000, // Consider data stale after 60s
  });
}
