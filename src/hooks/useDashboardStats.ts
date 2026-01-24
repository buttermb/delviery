import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';

export interface DashboardStats {
  pendingOrders: number;
  lowStockItems: number;
  newCustomers: number;
  revenue: number;
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
          lowStockItems: 0,
          newCustomers: 0,
          revenue: 0,
          activeSessions: 0,
        };
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [
        pendingOrdersResult,
        lowStockResult,
        newCustomersResult,
        revenueResult,
        activeSessionsResult,
      ] = await Promise.allSettled([
        // Pending orders: orders with status 'pending' or 'confirmed'
        supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .in('status', ['pending', 'confirmed']),

        // Low stock items: products where stock_quantity <= low_stock_alert (or <= 10 default)
        supabase
          .from('products')
          .select('id, stock_quantity, low_stock_alert')
          .eq('tenant_id', tenantId)
          .gt('stock_quantity', -1),

        // New customers in the last 30 days
        supabase
          .from('customers')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .gte('created_at', thirtyDaysAgo.toISOString()),

        // Revenue: sum of completed orders today
        supabase
          .from('orders')
          .select('total_amount')
          .eq('tenant_id', tenantId)
          .in('status', ['completed', 'delivered'])
          .gte('created_at', today.toISOString()),

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

      // Extract low stock items
      let lowStockItems = 0;
      if (lowStockResult.status === 'fulfilled') {
        const { data, error } = lowStockResult.value;
        if (!error && data) {
          const DEFAULT_LOW_STOCK_THRESHOLD = 10;
          lowStockItems = data.filter((item) => {
            const threshold = (item.low_stock_alert as number | null) ?? DEFAULT_LOW_STOCK_THRESHOLD;
            const qty = (item.stock_quantity as number | null) ?? 0;
            return qty <= threshold;
          }).length;
        } else if (error) {
          logger.warn('Failed to fetch low stock items', error, { component: 'useDashboardStats' });
        }
      }

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

      // Extract revenue
      let revenue = 0;
      if (revenueResult.status === 'fulfilled') {
        const { data, error } = revenueResult.value;
        if (!error && data) {
          revenue = data.reduce(
            (sum, order) => sum + (Number(order.total_amount) || 0),
            0
          );
        } else if (error) {
          logger.warn('Failed to fetch revenue', error, { component: 'useDashboardStats' });
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
        pendingOrders,
        lowStockItems,
        newCustomers,
        revenue,
        activeSessions,
      };
    },
    enabled: !!tenantId,
    refetchInterval: 30_000, // 30 seconds
    staleTime: 15_000, // Consider data stale after 15s
  });
}
