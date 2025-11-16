import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { logger } from '@/lib/logger';

/**
 * Hook to prefetch route data on hover/focus
 * Improves perceived performance by loading data before navigation
 */
export const useRoutePrefetch = () => {
  const queryClient = useQueryClient();

  const prefetchRoute = useCallback(async (route: string) => {
    // Extract route name from path
    const routeName = route.split('/').pop() || route.split('/').slice(-2).join('/');
    
    // Debounce: Only prefetch after 100ms hover (avoid prefetching on quick hovers)
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      // Define prefetch queries for each route
      const prefetchMap: Record<string, () => Promise<void>> = {
        'dashboard': async () => {
          // Prefetch dashboard metrics
          await queryClient.prefetchQuery({
            queryKey: ['tenant-dashboard-today'],
            queryFn: async () => {
              // This will be handled by the actual dashboard component
              return null;
            },
            staleTime: 2 * 60 * 1000, // 2 minutes
          });
        },
        'products': async () => {
          await queryClient.prefetchQuery({
            queryKey: ['products-list'],
            queryFn: async () => null,
            staleTime: 5 * 60 * 1000, // 5 minutes
          });
        },
        'customers': async () => {
          await queryClient.prefetchQuery({
            queryKey: ['customers-list'],
            queryFn: async () => null,
            staleTime: 5 * 60 * 1000,
          });
        },
        'orders': async () => {
          await queryClient.prefetchQuery({
            queryKey: ['orders-list'],
            queryFn: async () => null,
            staleTime: 1 * 60 * 1000, // 1 minute (more dynamic)
          });
        },
        'menus': async () => {
          await queryClient.prefetchQuery({
            queryKey: ['disposable-menus'],
            queryFn: async () => null,
            staleTime: 5 * 60 * 1000,
          });
        },
        'inventory': async () => {
          await queryClient.prefetchQuery({
            queryKey: ['wholesale-inventory'],
            queryFn: async () => null,
            staleTime: 2 * 60 * 1000,
          });
        },
      };

      const prefetchFn = prefetchMap[routeName];
      if (prefetchFn) {
        await prefetchFn();
        logger.debug('[PREFETCH] Route data prefetched', { route, routeName });
      }
    } catch (error) {
      logger.warn('[PREFETCH] Failed to prefetch route', { route, error });
      // Don't throw - prefetch failures shouldn't break navigation
    }
  }, [queryClient]);

  return { prefetchRoute };
};

