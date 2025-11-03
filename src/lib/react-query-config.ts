/**
 * React Query Configuration
 * Optimized caching strategy for better performance
 */

import { QueryClient } from '@tanstack/react-query';

/**
 * Default query options for better performance:
 * - staleTime: 5 minutes (data considered fresh)
 * - gcTime: 10 minutes (cache garbage collection)
 * - Disable unnecessary refetches
 * - Product-specific cache: 15 minutes
 */
export const createQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
        retry: 1,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: 1,
      },
    },
  });
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
};

