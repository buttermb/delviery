import { logger } from '@/lib/logger';
import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';

// Cache for tenant ID lookups to avoid repeat queries
const tenantIdCache = new Map<string, { id: string; timestamp: number }>();
const TENANT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Hook to prefetch dashboard data for faster navigation
 * Improves perceived performance by loading data before user arrives
 */
export function usePrefetchDashboard() {
  const queryClient = useQueryClient();
  const retryCountRef = useRef<Map<string, number>>(new Map());

  /**
   * Get tenant ID with caching to avoid repeat lookups
   */
  const getTenantId = useCallback(async (tenantSlug: string, providedTenantId?: string): Promise<string | null> => {
    if (providedTenantId) return providedTenantId;

    // Check cache first
    const cached = tenantIdCache.get(tenantSlug);
    if (cached && Date.now() - cached.timestamp < TENANT_CACHE_TTL) {
      return cached.id;
    }

    // Fetch from database
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', tenantSlug)
      .maybeSingle();

    if (!tenant?.id) {
      logger.warn('[PREFETCH] Could not find tenant for slug', { tenantSlug });
      return null;
    }

    // Cache the result
    tenantIdCache.set(tenantSlug, { id: tenant.id, timestamp: Date.now() });
    return tenant.id;
  }, []);

  /**
   * Retry with exponential backoff
   */
  const withRetry = useCallback(async <T>(
    key: string,
    fn: () => Promise<T>,
    maxRetries = 3
  ): Promise<T | null> => {
    const retryCount = retryCountRef.current.get(key) || 0;

    try {
      const result = await fn();
      retryCountRef.current.set(key, 0); // Reset on success
      return result;
    } catch (error) {
      if (retryCount < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
        retryCountRef.current.set(key, retryCount + 1);
        logger.warn(`[PREFETCH] Retry ${retryCount + 1}/${maxRetries} for ${key} in ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return withRetry(key, fn, maxRetries);
      }
      logger.error(`[PREFETCH] Failed after ${maxRetries} retries: ${key}`, error);
      return null;
    }
  }, []);

  const prefetch = useCallback(async (tenantSlug: string, tenantId?: string) => {
    try {
      const resolvedTenantId = await getTenantId(tenantSlug, tenantId);
      if (!resolvedTenantId) return false;

      // Prefetch key dashboard queries in parallel
      await Promise.allSettled([
        // Today's metrics
        queryClient.prefetchQuery({
          queryKey: ['tenant-dashboard-today', resolvedTenantId],
          queryFn: async () => {
            const { data: salesData } = await supabase
              .from('wholesale_orders')
              .select('total_amount')
              .eq('tenant_id', resolvedTenantId)
              .gte('created_at', new Date().toISOString().split('T')[0]);

            const sales = salesData?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;

            const { count: orderCount } = await supabase
              .from('wholesale_orders')
              .select('id', { count: 'exact', head: true })
              .eq('tenant_id', resolvedTenantId)
              .gte('created_at', new Date().toISOString().split('T')[0]);

            return { sales, orderCount: orderCount || 0 };
          },
          staleTime: 5 * 60 * 1000, // 5 minutes (increased from 2 min)
        }),

        // Pending orders count
        queryClient.prefetchQuery({
          queryKey: ['pending-orders-count', resolvedTenantId],
          queryFn: async () => {
            const { count } = await supabase
              .from('orders')
              .select('id', { count: 'exact', head: true })
              .eq('tenant_id', resolvedTenantId)
              .in('status', ['pending', 'confirmed']);
            return count || 0;
          },
          staleTime: 5 * 60 * 1000,
        }),

        // Low stock items
        queryClient.prefetchQuery({
          queryKey: queryKeys.inventory.lowStockAlerts(resolvedTenantId),
          queryFn: async () => {
            const { data: inventory } = await supabase
              .from('products')
              .select('id, name, stock_quantity, available_quantity, low_stock_alert')
              .eq('tenant_id', resolvedTenantId)
              .limit(100);

            return (inventory || []).filter(
              (item: { available_quantity?: number; stock_quantity?: number; low_stock_alert?: number }) => {
                const currentStock = item.available_quantity ?? item.stock_quantity ?? 0;
                const reorderPoint = item.low_stock_alert ?? 10;
                return Number(currentStock) <= Number(reorderPoint);
              }
            ).slice(0, 10);
          },
          staleTime: 5 * 60 * 1000,
        }),

        // Inventory alerts
        queryClient.prefetchQuery({
          queryKey: queryKeys.inventory.alerts(),
          queryFn: async () => {
            const { data } = await supabase
              .from('products')
              .select('id, name, available_quantity, stock_quantity')
              .eq('tenant_id', resolvedTenantId)
              .or('available_quantity.lte.0,stock_quantity.lte.0')
              .limit(20);
            return data || [];
          },
          staleTime: 5 * 60 * 1000,
        }),

        // Recent orders (for dashboard widgets)
        queryClient.prefetchQuery({
          queryKey: ['recent-orders', resolvedTenantId],
          queryFn: async () => {
            const { data } = await supabase
              .from('wholesale_orders')
              .select('id, created_at, status, total_amount, wholesale_clients(business_name)')
              .eq('tenant_id', resolvedTenantId)
              .order('created_at', { ascending: false })
              .limit(5);
            return data || [];
          },
          staleTime: 5 * 60 * 1000,
        }),

        // Usage stats (for limit indicators)
        queryClient.prefetchQuery({
          queryKey: ['usage-stats', resolvedTenantId],
          queryFn: async () => {
            const { data: tenant } = await supabase
              .from('tenants')
              .select('usage, limits')
              .eq('id', resolvedTenantId)
              .maybeSingle();
            return tenant || null;
          },
          staleTime: 5 * 60 * 1000,
        }),
      ]);

      logger.info('[PREFETCH] Dashboard data ready', { tenantSlug, tenantId: resolvedTenantId });
      return true;
    } catch (error) {
      logger.error('[PREFETCH] Error prefetching dashboard', error);
      return false;
    }
  }, [queryClient, getTenantId]);

  /**
   * Prefetch dashboard data on login
   * Called after successful authentication to warm the cache
   */
  const prefetchOnLogin = useCallback(async (tenantId: string) => {
    logger.info('[PREFETCH] Warming cache on login', { tenantId });

    return withRetry('login-prefetch', async () => {
      // Prefetch core dashboard data
      await Promise.allSettled([
        queryClient.prefetchQuery({
          queryKey: queryKeys.dashboard.stats(tenantId),
          queryFn: async () => {
            // Fetch basic stats for immediate display
            const [ordersRes, productsRes] = await Promise.all([
              supabase
                .from('orders')
                .select('id', { count: 'exact', head: true })
                .eq('tenant_id', tenantId)
                .in('status', ['pending', 'confirmed']),
              supabase
                .from('products')
                .select('id', { count: 'exact', head: true })
                .eq('tenant_id', tenantId),
            ]);

            return {
              pendingOrders: ordersRes.count || 0,
              totalProducts: productsRes.count || 0,
            };
          },
          staleTime: 5 * 60 * 1000,
        }),
      ]);

      return true;
    });
  }, [queryClient, withRetry]);

  return { prefetch, prefetchOnLogin, getTenantId };
}

/**
 * Clear the tenant ID cache (call on logout)
 */
export function clearTenantIdCache() {
  tenantIdCache.clear();
}
