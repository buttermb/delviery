/**
 * Prefetch Hook
 * React hook for prefetching data
 */

import { useQueryClient, QueryKey } from '@tanstack/react-query';
import { prefetchRoute, prefetchQuery as prefetchQueryUtil } from '@/lib/utils/prefetch';

/**
 * Hook for prefetching routes and queries
 */
export function usePrefetch() {
  const queryClient = useQueryClient();

  const prefetchRouteData = (href: string) => {
    prefetchRoute(href);
  };

  const prefetchQuery = async <TData = unknown>(
    queryKey: QueryKey,
    queryFn: () => Promise<TData>
  ) => {
    await prefetchQueryUtil(queryClient, queryKey, queryFn);
  };

  return {
    prefetchRoute: prefetchRouteData,
    prefetchQuery,
  };
}

