/**
 * React Query Configuration
 * Optimized caching strategy for better performance
 *
 * Key optimizations:
 * - Deduplication: Multiple identical requests become one
 * - Structural sharing: Only changed data triggers re-renders
 * - Smart retries: Exponential backoff for failed requests
 * - Network-aware: Different behavior online vs offline
 * - Performance tracking: Detailed metrics for debugging
 */

import { QueryClient, QueryCache, MutationCache, keepPreviousData } from '@tanstack/react-query';
import { logger } from '@/lib/logger';
import { queryRegistry } from '@/lib/queryRegistry';

/**
 * Performance metrics for queries
 */
interface QueryPerformanceMetrics {
  startTime: number;
  fetchStartTime?: number;
  isCacheHit: boolean;
  retryCount: number;
}

/**
 * Store query performance metrics for detailed tracking
 */
const queryMetrics = new WeakMap<object, QueryPerformanceMetrics>();

/**
 * Query cache with comprehensive error logging, performance tracking, and deduplication
 */
const queryCache = new QueryCache({
  onError: (error, query) => {
    // Initialize metrics if this is the first callback for this query
    let metrics = queryMetrics.get(query);
    if (!metrics) {
      // Query failed before success, estimate start time based on current time
      // This is a best-effort approach since React Query doesn't provide onStart
      metrics = {
        startTime: Date.now(),
        isCacheHit: false,
        retryCount: 0,
      };
      queryMetrics.set(query, metrics);
    }

    const duration = Date.now() - metrics.startTime;

    // Log slow query errors specifically (>500ms before error)
    if (duration > 500) {
      logger.error('Slow query failed', error, {
        queryKey: query.queryKey,
        duration: `${duration}ms`,
        retries: query.state.fetchFailureCount,
        cached: metrics.isCacheHit,
        component: 'QueryCache',
      });
    }

    // Only log errors for queries that have been retried
    if (query.state.dataUpdateCount > 0) {
      logger.error('Query error after retries', error, {
        queryKey: query.queryKey,
        retryCount: metrics?.retryCount ?? query.state.fetchFailureCount,
        component: 'QueryCache',
      });
    }
  },
  onSuccess: (_data, query) => {
    // Initialize or update query metrics
    const existingMetrics = queryMetrics.get(query);
    if (!existingMetrics) {
      // First time success - set start time
      queryMetrics.set(query, {
        startTime: Date.now(),
        isCacheHit: query.state.dataUpdateCount === 0,
        retryCount: 0,
      });
    } else {
      // Update metrics for retry success
      existingMetrics.retryCount = query.state.fetchFailureCount;
    }
  },
  onSettled: (_data, _error, query) => {
    // Track comprehensive query performance metrics
    const metrics = queryMetrics.get(query);
    if (metrics) {
      const duration = Date.now() - metrics.startTime;
      const isCachedData = query.state.dataUpdateCount === 0;
      const retryCount = query.state.fetchFailureCount;

      // Normalize query key to string for logging
      const queryKeyString = JSON.stringify(query.queryKey);

      // Log detailed debug info for all queries in development
      logger.debug('Query completed', {
        queryKey: queryKeyString,
        duration: `${duration}ms`,
        cached: isCachedData,
        retries: retryCount,
        fetchStatus: query.state.fetchStatus,
        dataUpdateCount: query.state.dataUpdateCount,
        component: 'QueryCache',
      });

      // Log warning for slow queries (>500ms)
      if (duration > 500) {
        logger.warn('Slow query detected', {
          queryKey: queryKeyString,
          duration: `${duration}ms`,
          cached: isCachedData,
          retries: retryCount,
          component: 'QueryCache',
        });
      }

      // Clean up to prevent memory leaks
      queryMetrics.delete(query);
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
        gcTime: 30 * 60 * 1000, // 30 minutes - keep cached data longer for navigation
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
        // Network mode - suspends queries when offline
        networkMode: 'offlineFirst',
        // Show previous data immediately while refetching (instant navigation)
        placeholderData: keepPreviousData,
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
 * Get performance stats for a specific query key (useful for debugging)
 * This returns aggregated performance metrics from the query cache
 *
 * @param queryClient - The query client instance
 * @param queryKey - The query key to get stats for
 * @returns Performance metrics or null if query not found
 */
export const getQueryPerformanceStats = (
  queryClient: QueryClient,
  queryKey: unknown[]
) => {
  const query = queryClient.getQueryCache().find({ queryKey });
  if (!query) return null;

  const metrics = queryMetrics.get(query);

  return {
    queryKey: JSON.stringify(queryKey),
    state: query.state.fetchStatus,
    dataUpdateCount: query.state.dataUpdateCount,
    errorUpdateCount: query.state.errorUpdateCount,
    fetchFailureCount: query.state.fetchFailureCount,
    fetchFailureReason: query.state.fetchFailureReason,
    metrics: metrics ? {
      duration: metrics.startTime ? Date.now() - metrics.startTime : null,
      isCacheHit: metrics.isCacheHit,
      retryCount: metrics.retryCount,
    } : null,
  };
};

/**
 * Product-specific query configuration
 * Products change less frequently, so longer cache time
 */
export const PRODUCT_QUERY_CONFIG = {
  staleTime: 15 * 60 * 1000, // 15 minutes
  gcTime: 30 * 60 * 1000, // 30 minutes
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
  refetchIntervalInBackground: false, // Don't refetch when tab is hidden
};

/**
 * Analytics data configuration
 * For dashboard metrics and real-time analytics that need regular updates
 */
export const ANALYTICS_QUERY_CONFIG = {
  staleTime: 2 * 60 * 1000, // 2 minutes
  gcTime: 5 * 60 * 1000, // 5 minutes
  refetchOnWindowFocus: false,
  refetchOnMount: false,
  refetchInterval: 60000, // Auto-refresh every minute
  refetchIntervalInBackground: false, // Don't refetch when tab is hidden
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
 * Static data configuration
 * For data that never changes during a session (categories, settings, etc.)
 * Data is cached indefinitely and never refetched
 */
export const STATIC_QUERY_CONFIG = {
  staleTime: Infinity, // Never becomes stale
  gcTime: 24 * 60 * 60 * 1000, // 24 hours
  refetchOnWindowFocus: false,
  refetchOnMount: false,
  refetchOnReconnect: false,
};

/**
 * Instant cache configuration
 * For immutable static data that never changes (constants, enums, etc.)
 * Data is cached indefinitely and never refetched
 */
export const INSTANT_CACHE_CONFIG = {
  staleTime: Infinity, // Never becomes stale
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
 * Optimized for admin dashboards and management interfaces
 *
 * Cache Strategy:
 * - Moderate staleTime (10 min) balances data freshness with performance
 * - Extended gcTime (20 min) keeps data for quick navigation between admin pages
 * - refetchOnReconnect ensures admins see latest data after network issues
 * - keepPreviousData provides smooth UX during pagination/filtering
 * - No auto-refresh by default (admin actions are typically manual)
 *
 * Use Cases:
 * - User management tables
 * - Order/product administration
 * - Settings and configuration pages
 * - Analytics dashboards (for non-realtime data)
 */
export const ADMIN_PANEL_QUERY_CONFIG = {
  staleTime: 10 * 60 * 1000, // 10 minutes - fresh enough for admin operations
  gcTime: 20 * 60 * 1000, // 20 minutes - keep cached for quick page switches
  refetchOnWindowFocus: false, // Admin actions are manual, not automatic
  refetchOnMount: false, // Use cached data on component mount for speed
  refetchOnReconnect: true, // Refresh after network issues for reliability
  keepPreviousData: true, // Show old data while loading new (smooth pagination/filtering)
};

/**
 * Wraps a query function with queryRegistry integration for automatic deduplication
 *
 * This wrapper:
 * 1. Registers the query in the registry before execution
 * 2. Deduplicates concurrent identical requests
 * 3. Marks queries as complete when they settle
 * 4. Tracks query metadata for debugging
 *
 * @param queryFn - The original query function to wrap
 * @returns A wrapped query function that integrates with queryRegistry
 *
 * @example
 * ```ts
 * const { data } = useQuery({
 *   queryKey: ['products', 'list'],
 *   queryFn: withQueryRegistry(async () => {
 *     const { data } = await supabase.from('products').select('*');
 *     return data;
 *   }),
 * });
 * ```
 */
export function withQueryRegistry<T>(
  queryFn: (context: { queryKey: readonly unknown[] }) => Promise<T>
): (context: { queryKey: readonly unknown[] }) => Promise<T> {
  return async (context) => {
    const { queryKey } = context;

    // Check if query is already active (deduplicated)
    const existingQuery = queryRegistry.get(queryKey);

    if (existingQuery?.isActive && existingQuery.promise) {
      // Increment request count for deduplication tracking
      queryRegistry.register(queryKey, existingQuery.promise);

      // Return the existing promise for deduplication
      logger.debug('Reusing existing query promise', {
        queryKey: JSON.stringify(queryKey),
        requestCount: existingQuery.requestCount + 1,
        component: 'withQueryRegistry',
      });

      return existingQuery.promise as Promise<T>;
    }

    // Create and register the new promise
    const promise = (async () => {
      try {
        const result = await queryFn(context);
        return result;
      } finally {
        // Mark query as complete when settled (success or error)
        queryRegistry.complete(queryKey);
      }
    })();

    // Register the query with the promise
    queryRegistry.register(queryKey, promise);

    // Return the promise
    return promise;
  };
}

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
