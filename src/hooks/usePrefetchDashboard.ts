import { logger } from '@/lib/logger';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook to prefetch dashboard data for faster navigation
 * Improves perceived performance by loading data before user arrives
 */
export function usePrefetchDashboard() {
  const queryClient = useQueryClient();

  const prefetch = async (tenantSlug: string, tenantId?: string) => {
    try {
      if (!tenantId) {
        // Try to get tenantId from slug if not provided
        const { data: tenant } = await supabase
          .from('tenants')
          .select('id')
          .eq('slug', tenantSlug)
          .maybeSingle();

        if (!tenant?.id) {
          logger.warn('[PREFETCH] Could not find tenant for slug', { tenantSlug });
          return false;
        }

        tenantId = tenant.id;
      }

      // Prefetch key dashboard queries in parallel
      await Promise.allSettled([
        // Today's metrics
        queryClient.prefetchQuery({
          queryKey: ['tenant-dashboard-today', tenantId],
          queryFn: async () => {
            const { data: salesData } = await supabase
              .from('wholesale_orders')
              .select('total_amount')
              .eq('tenant_id', tenantId)
              .gte('created_at', new Date().toISOString().split('T')[0]);

            const sales = salesData?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;

            const { count: orderCount } = await supabase
              .from('wholesale_orders')
              .select('*', { count: 'exact', head: true })
              .eq('tenant_id', tenantId)
              .gte('created_at', new Date().toISOString().split('T')[0]);

            const { data: inventory } = await supabase
              .from('wholesale_inventory')
              .select('id, product_name, quantity_lbs, reorder_point')
              .eq('tenant_id', tenantId)
              .limit(100);

            const lowStock = (inventory || []).filter(
              (item: any) => Number(item.quantity_lbs || 0) <= Number(item.reorder_point || 10)
            ).slice(0, 5);

            return {
              sales,
              orderCount: orderCount || 0,
              lowStock,
            };
          },
          staleTime: 2 * 60 * 1000, // 2 minutes
        }),

        // Recent orders (for dashboard widgets)
        queryClient.prefetchQuery({
          queryKey: ['recent-orders', tenantId],
          queryFn: async () => {
            const { data } = await supabase
              .from('wholesale_orders')
              .select('*')
              .eq('tenant_id', tenantId)
              .order('created_at', { ascending: false })
              .limit(5);

            return data || [];
          },
          staleTime: 1 * 60 * 1000, // 1 minute
        }),

        // Usage stats (for limit indicators)
        queryClient.prefetchQuery({
          queryKey: ['usage-stats', tenantId],
          queryFn: async () => {
            const { data: tenant } = await supabase
              .from('tenants')
              .select('usage, limits')
              .eq('id', tenantId)
              .maybeSingle();

            return tenant || null;
          },
          staleTime: 5 * 60 * 1000, // 5 minutes
        }),
      ]);

      logger.info('[PREFETCH] Dashboard data ready', { tenantSlug, tenantId });
      return true;
    } catch (error) {
      logger.error('[PREFETCH] Error prefetching dashboard', error);
      return false;
    }
  };

  return { prefetch };
}

