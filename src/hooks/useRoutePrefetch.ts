import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';

/**
 * Hook to prefetch route data on hover/focus
 * Improves perceived performance by loading data before navigation
 *
 * Uses real Supabase queries with proper queryKeys factory keys
 * so the TanStack Query cache is warm when the page mounts.
 */
export const useRoutePrefetch = () => {
  const queryClient = useQueryClient();
  const { tenant } = useTenantAdminAuth();
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const prefetchRoute = useCallback((route: string) => {
    // Cancel any pending prefetch from a previous hover
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }

    const tenantId = tenant?.id;
    if (!tenantId) return;

    // Extract the last meaningful path segment
    const segments = route.split('/').filter(Boolean);
    const routeName = segments[segments.length - 1] ?? '';

    // Debounce: Only prefetch after 150ms hover
    hoverTimerRef.current = setTimeout(() => {
      const staleTime = 2 * 60 * 1000; // 2 minutes

      const prefetchMap: Record<string, () => void> = {
        dashboard: () => {
          void queryClient.prefetchQuery({
            queryKey: queryKeys.dashboard.stats(tenantId),
            queryFn: async () => {
              const { data } = await supabase
                .from('orders')
                .select('id', { count: 'exact', head: true })
                .eq('tenant_id', tenantId);
              return data;
            },
            staleTime,
          });
        },

        orders: () => {
          void queryClient.prefetchQuery({
            queryKey: queryKeys.orders.lists(),
            queryFn: async () => {
              const { data } = await supabase
                .from('unified_orders')
                .select('id, order_number, status, created_at, total_amount')
                .eq('tenant_id', tenantId)
                .order('created_at', { ascending: false })
                .limit(20);
              return data;
            },
            staleTime,
          });
        },

        products: () => {
          void queryClient.prefetchQuery({
            queryKey: queryKeys.products.lists(),
            queryFn: async () => {
              const { data } = await supabase
                .from('products')
                .select('id, name, price, stock_quantity, in_stock, image_url')
                .eq('tenant_id', tenantId)
                .order('created_at', { ascending: false })
                .limit(20);
              return data;
            },
            staleTime,
          });
        },

        customers: () => {
          void queryClient.prefetchQuery({
            queryKey: queryKeys.customers.lists(),
            queryFn: async () => {
              const { data } = await supabase
                .from('contacts')
                .select('id, name, email, phone, status')
                .eq('tenant_id', tenantId)
                .eq('status', 'active')
                .order('created_at', { ascending: false })
                .limit(20);
              return data;
            },
            staleTime,
          });
        },

        'disposable-menus': () => {
          void queryClient.prefetchQuery({
            queryKey: queryKeys.menus.list(tenantId),
            queryFn: async () => {
              const { data } = await supabase
                .from('disposable_menus')
                .select('id, menu_name, status, created_at')
                .eq('tenant_id', tenantId)
                .order('created_at', { ascending: false })
                .limit(20);
              return data;
            },
            staleTime,
          });
        },

        'vendor-management': () => {
          void queryClient.prefetchQuery({
            queryKey: queryKeys.vendors.lists(),
            queryFn: async () => {
              const { data } = await supabase
                .from('vendors')
                .select('id, name, status, created_at')
                .eq('tenant_id', tenantId)
                .order('created_at', { ascending: false })
                .limit(20);
              return data;
            },
            staleTime,
          });
        },

        'delivery-management': () => {
          void queryClient.prefetchQuery({
            queryKey: queryKeys.deliveries.lists(),
            queryFn: async () => {
              const { data } = await supabase
                .from('wholesale_deliveries')
                .select('id, status, created_at')
                .eq('tenant_id', tenantId)
                .order('created_at', { ascending: false })
                .limit(20);
              return data;
            },
            staleTime,
          });
        },

        'inventory-hub': () => {
          void queryClient.prefetchQuery({
            queryKey: queryKeys.inventory.lists(),
            queryFn: async () => {
              const { data } = await supabase
                .from('products')
                .select('id, name, stock_quantity, low_stock_alert, in_stock')
                .eq('tenant_id', tenantId)
                .order('stock_quantity', { ascending: true })
                .limit(20);
              return data;
            },
            staleTime,
          });
        },

        'analytics-hub': () => {
          void queryClient.prefetchQuery({
            queryKey: queryKeys.analytics.overview(tenantId),
            queryFn: async () => {
              const { data } = await supabase
                .from('orders')
                .select('id, total_amount, created_at, status')
                .eq('tenant_id', tenantId)
                .order('created_at', { ascending: false })
                .limit(50);
              return data;
            },
            staleTime,
          });
        },
      };

      const prefetchFn = prefetchMap[routeName];
      if (prefetchFn) {
        prefetchFn();
        logger.debug('[PREFETCH] Route data prefetched', { route, routeName });
      }
    }, 150);
  }, [queryClient, tenant?.id]);

  const cancelPrefetch = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  }, []);

  return { prefetchRoute, cancelPrefetch };
};
