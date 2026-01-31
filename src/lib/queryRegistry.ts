/**
 * Query Registry for Request Deduplication
 *
 * Prevents duplicate in-flight requests by tracking active promises.
 * When multiple components request the same data simultaneously,
 * only one network request is made and the result is shared.
 *
 * Features:
 * - Automatic deduplication of concurrent requests
 * - TTL-based cleanup of stale promises
 * - Debug utilities for monitoring active queries
 */

type QueryFn<T> = () => Promise<T>;

interface PendingQuery<T> {
  promise: Promise<T>;
  timestamp: number;
}

const DEFAULT_TTL = 5000; // 5 seconds

class QueryRegistry {
  private pendingQueries: Map<string, PendingQuery<unknown>> = new Map();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Start cleanup interval
    this.startCleanup();
  }

  /**
   * Deduplicate a query by key. If a query with the same key is already
   * in-flight, return the existing promise. Otherwise, execute the queryFn
   * and store the promise for sharing.
   */
  async deduplicateQuery<T>(key: string, queryFn: QueryFn<T>, ttl = DEFAULT_TTL): Promise<T> {
    const existing = this.pendingQueries.get(key) as PendingQuery<T> | undefined;

    // Return existing promise if still valid
    if (existing && Date.now() - existing.timestamp < ttl) {
      return existing.promise;
    }

    // Create new query promise
    const promise = queryFn().finally(() => {
      // Clean up after resolution (with small delay to allow for race conditions)
      setTimeout(() => {
        const current = this.pendingQueries.get(key);
        if (current?.promise === promise) {
          this.pendingQueries.delete(key);
        }
      }, 100);
    });

    this.pendingQueries.set(key, {
      promise: promise as Promise<unknown>,
      timestamp: Date.now(),
    });

    return promise;
  }

  /**
   * Get the count of currently active (in-flight) queries.
   * Useful for debugging and monitoring.
   */
  getActiveQueryCount(): number {
    return this.pendingQueries.size;
  }

  /**
   * Get all active query keys.
   * Useful for debugging.
   */
  getActiveQueryKeys(): string[] {
    return Array.from(this.pendingQueries.keys());
  }

  /**
   * Clear all pending queries.
   * Useful for cleanup on logout or error recovery.
   */
  clear(): void {
    this.pendingQueries.clear();
  }

  /**
   * Start the cleanup interval for stale promises.
   */
  private startCleanup(): void {
    if (this.cleanupInterval) return;

    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const staleThreshold = DEFAULT_TTL * 2; // Keep for 2x TTL before cleanup

      for (const [key, query] of this.pendingQueries.entries()) {
        if (now - query.timestamp > staleThreshold) {
          this.pendingQueries.delete(key);
        }
      }
    }, 10000); // Run cleanup every 10 seconds
  }

  /**
   * Stop the cleanup interval.
   * Call this when the registry is no longer needed.
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
  }
}

// Singleton instance
export const queryRegistry = new QueryRegistry();

// Convenience exports
export const deduplicateQuery = queryRegistry.deduplicateQuery.bind(queryRegistry);
export const getActiveQueryCount = queryRegistry.getActiveQueryCount.bind(queryRegistry);
export const getActiveQueryKeys = queryRegistry.getActiveQueryKeys.bind(queryRegistry);
export const clearQueryRegistry = queryRegistry.clear.bind(queryRegistry);

/**
 * Create a deduplicated query function wrapper.
 * Use this to wrap your queryFn in useQuery for automatic deduplication.
 *
 * @example
 * const { data } = useQuery({
 *   queryKey: ['orders', tenantId],
 *   queryFn: createDeduplicatedQuery('orders-list', () => fetchOrders(tenantId)),
 * });
 */
export function createDeduplicatedQuery<T>(key: string, queryFn: QueryFn<T>, ttl?: number): QueryFn<T> {
  return () => queryRegistry.deduplicateQuery(key, queryFn, ttl);
}
