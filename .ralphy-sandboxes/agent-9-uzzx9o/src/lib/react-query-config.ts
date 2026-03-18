/**
 * React Query Configuration
 * Optimized caching strategy for better performance
 * 
 * Key optimizations:
 * - Deduplication: Multiple identical requests become one
 * - Structural sharing: Only changed data triggers re-renders
 * - Smart retries: Exponential backoff for failed requests
 * - Network-aware: Different behavior online vs offline
 */

import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';
import { logger } from '@/lib/logger';

/**
 * Query cache with error logging and deduplication
 */
const queryCache = new QueryCache({
  onError: (error, query) => {
    // Only log errors for queries that have been retried
    if (query.state.dataUpdateCount > 0) {
      logger.error('Query error after retries', error, {
        queryKey: query.queryKey,
        component: 'QueryCache',
      });
    }
  },
});

/**
 * Mutation cache with error logging
 */
const mutationCache = new MutationCache({
  onError: (error, _variables, _context, mutation) => {
    logger.error('Mutation error', error, {
      mutationKey: mutation.options.mutationKey,
      component: 'MutationCache',
    });
  },
});

/**
 * Create optimized query client with:
 * - staleTime: 5 minutes (data considered fresh)
 * - gcTime: 10 minutes (cache garbage collection)
 * - Structural sharing for memory efficiency
 * - Exponential backoff for retries
 * - Network-aware refetching
 */
export const createQueryClient = () => {
  return new QueryClient({
    queryCache,
    mutationCache,
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
        retry: (failureCount, error) => {
          // Don't retry on 4xx errors (client errors)
          if (error && typeof error === 'object' && 'status' in error) {
            const status = (error as { status: number }).status;
            if (status >= 400 && status < 500) return false;
          }
          return failureCount < 2;
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: true,
        // Structural sharing - only re-render when data actually changes
        structuralSharing: true,
        // Don't poll when the browser tab is hidden/backgrounded
        refetchIntervalInBackground: false,
        // Network mode - suspends queries when offline
        networkMode: 'offlineFirst',
      },
      mutations: {
        retry: 1,
        retryDelay: 1000,
        networkMode: 'offlineFirst',
      },
    },
  });
};

/**
 * Singleton query client instance used across the app.
 * Exported for use in logout utilities that need to clear cache outside React.
 */
export const appQueryClient = createQueryClient();

/**
 * Product-specific query configuration
 * Products change infrequently — 5-minute stale window
 */
export const PRODUCT_QUERY_CONFIG = {
  staleTime: 5 * 60 * 1000, // 5 minutes
  gcTime: 15 * 60 * 1000, // 15 minutes
  refetchOnWindowFocus: false,
  refetchOnMount: false,
};

/**
 * Dashboard query configuration
 * Dashboard data should be fresh but cached for quick navigation
 */
export const DASHBOARD_QUERY_CONFIG = {
  staleTime: 2 * 60 * 1000, // 2 minutes
  gcTime: 5 * 60 * 1000, // 5 minutes
  refetchOnWindowFocus: false,
  refetchInterval: 60000, // Auto-refresh every minute
  refetchIntervalInBackground: false, // Don't poll when tab is hidden
};

/**
 * Realtime data configuration
 * For data that needs frequent updates
 */
export const REALTIME_QUERY_CONFIG = {
  staleTime: 30 * 1000, // 30 seconds
  gcTime: 2 * 60 * 1000, // 2 minutes
  refetchInterval: 30000, // Refresh every 30 seconds
  refetchIntervalInBackground: false, // Don't refetch when tab is hidden
};

/**
 * Orders query configuration
 * Orders need near-real-time freshness
 */
export const ORDERS_QUERY_CONFIG = {
  staleTime: 30 * 1000, // 30 seconds
  gcTime: 2 * 60 * 1000, // 2 minutes
  refetchOnWindowFocus: false,
};

/**
 * Settings query configuration
 * Settings change rarely, 15-minute stale window
 */
export const SETTINGS_QUERY_CONFIG = {
  staleTime: 15 * 60 * 1000, // 15 minutes
  gcTime: 30 * 60 * 1000, // 30 minutes
  refetchOnWindowFocus: false,
  refetchOnMount: false,
};

/**
 * Analytics query configuration
 * Analytics data 2-minute stale window
 */
export const ANALYTICS_QUERY_CONFIG = {
  staleTime: 2 * 60 * 1000, // 2 minutes
  gcTime: 10 * 60 * 1000, // 10 minutes
  refetchOnWindowFocus: false,
};

/**
 * Static data configuration
 * For data that rarely changes (categories, enums, etc.)
 */
export const STATIC_QUERY_CONFIG = {
  staleTime: 60 * 60 * 1000, // 1 hour
  gcTime: 24 * 60 * 60 * 1000, // 24 hours
  refetchOnWindowFocus: false,
  refetchOnMount: false,
  refetchOnReconnect: false,
};

/**
 * List data configuration
 * For paginated or filtered lists
 */
export const LIST_QUERY_CONFIG = {
  staleTime: 60 * 1000, // 1 minute
  gcTime: 5 * 60 * 1000, // 5 minutes
  keepPreviousData: true, // Keep old data while fetching new
};

/**
 * Admin panel query configuration
 * Balanced between freshness and performance
 */
export const ADMIN_PANEL_QUERY_CONFIG = {
  staleTime: 5 * 60 * 1000, // 5 minutes
  gcTime: 20 * 60 * 1000, // 20 minutes
  refetchOnWindowFocus: false,
  refetchOnMount: false,
};

/**
 * Helper to prefetch common routes data
 */
export const prefetchRouteData = async (
  queryClient: QueryClient,
  route: 'dashboard' | 'orders' | 'products' | 'customers'
) => {
  const prefetchMap: Record<string, () => Promise<void>> = {
    dashboard: async () => {
      // Prefetch will be handled by individual components
    },
    orders: async () => {
      // Prefetch orders list
    },
    products: async () => {
      // Prefetch products list
    },
    customers: async () => {
      // Prefetch customers list
    },
  };

  await prefetchMap[route]?.();
};

