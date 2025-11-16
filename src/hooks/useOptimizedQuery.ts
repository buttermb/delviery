import { useQuery, QueryKey, UseQueryOptions } from '@tanstack/react-query';

interface UseOptimizedQueryOptions<TData, TError = Error> 
  extends Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'> {
  // Custom options for our optimized query
}

/**
 * Optimized query hook with smart defaults for performance
 * - Longer stale time to reduce unnecessary refetches
 * - Cache time optimized for better memory usage
 * - Retry logic with exponential backoff
 */
export function useOptimizedQuery<TData = unknown, TError = Error>(
  queryKey: QueryKey,
  queryFn: () => Promise<TData>,
  options?: UseOptimizedQueryOptions<TData, TError>
) {
  return useQuery<TData, TError>({
    queryKey,
    queryFn,
    staleTime: 60000, // 60 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: (failureCount, error) => {
      // Don't retry on 4xx errors
      if (error && typeof error === 'object' && 'status' in error) {
        const status = (error as any).status;
        if (status >= 400 && status < 500) return false;
      }
      // Retry up to 2 times with exponential backoff
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...options,
  });
}
