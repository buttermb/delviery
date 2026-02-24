/**
 * Query Registry for React Query
 * Provides Map-based query deduplication and tracking
 *
 * Key features:
 * - Tracks active queries using Map for fast lookups
 * - Deduplicates concurrent identical requests
 * - Provides metadata about query execution
 * - Memory-efficient cleanup after queries settle
 *
 * Usage:
 *   import { queryRegistry } from '@/lib/queryRegistry';
 *
 *   // Register a query before execution
 *   queryRegistry.register(queryKey);
 *
 *   // Check if query is already active
 *   if (queryRegistry.has(queryKey)) {
 *     // Query is already running
 *   }
 *
 *   // Get query metadata
 *   const metadata = queryRegistry.get(queryKey);
 */

import { logger } from '@/lib/logger';

/**
 * Metadata tracked for each query in the registry
 */
export interface QueryMetadata {
  /** Serialized query key for fast comparison */
  key: string;
  /** Original query key array */
  originalKey: readonly unknown[];
  /** Timestamp when query was first registered */
  registeredAt: number;
  /** Number of times this query has been requested while active */
  requestCount: number;
  /** Whether this query is currently active */
  isActive: boolean;
  /** Timestamp when query was last requested */
  lastRequestedAt: number;
  /** Promise associated with this query (for stale promise detection) */
  promise?: Promise<unknown>;
  /** Timestamp when promise was last updated */
  promiseUpdatedAt?: number;
}

/**
 * QueryRegistry class for tracking and deduplicating queries
 * Uses Map for O(1) lookups by serialized query key
 */
export class QueryRegistry {
  /** Map of serialized query keys to metadata */
  private registry: Map<string, QueryMetadata>;

  /** Statistics for monitoring */
  private stats = {
    totalRegistrations: 0,
    totalDeduplications: 0,
    activeQueries: 0,
    stalePromisesCleaned: 0,
    cleanupRunCount: 0,
  };

  /** Maximum age for stale promises (default: 5 minutes) */
  private maxAge: number = 5 * 60 * 1000;

  /** Interval for automatic TTL cleanup checks (default: 1 minute) */
  private ttlCheckInterval: number = 1 * 60 * 1000;

  /** Timer for automatic cleanup */
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.registry = new Map();
  }

  /**
   * Serialize query key to string for Map lookup
   * Uses JSON.stringify for consistent serialization
   */
  private serializeKey(queryKey: readonly unknown[]): string {
    return JSON.stringify(queryKey);
  }

  /**
   * Register a query in the registry
   * If the query is already registered and active, increments request count (deduplication)
   *
   * @param queryKey - The query key to register
   * @param promise - Optional promise to track for TTL cleanup
   * @returns QueryMetadata for the registered query
   */
  register(queryKey: readonly unknown[], promise?: Promise<unknown>): QueryMetadata {
    const serializedKey = this.serializeKey(queryKey);
    const existing = this.registry.get(serializedKey);

    if (existing && existing.isActive) {
      // Query is already active - deduplicate
      existing.requestCount++;
      existing.lastRequestedAt = Date.now();
      this.stats.totalDeduplications++;

      // Update promise if provided
      if (promise) {
        existing.promise = promise;
        existing.promiseUpdatedAt = Date.now();
      }

      logger.debug('Query deduplicated', {
        queryKey: serializedKey,
        requestCount: existing.requestCount,
        component: 'QueryRegistry',
      });

      return existing;
    }

    // New registration
    const now = Date.now();
    const metadata: QueryMetadata = {
      key: serializedKey,
      originalKey: queryKey,
      registeredAt: now,
      requestCount: 1,
      isActive: true,
      lastRequestedAt: now,
      promise,
      promiseUpdatedAt: promise ? now : undefined,
    };

    this.registry.set(serializedKey, metadata);
    this.stats.totalRegistrations++;
    this.stats.activeQueries++;

    logger.debug('Query registered', {
      queryKey: serializedKey,
      component: 'QueryRegistry',
    });

    return metadata;
  }

  /**
   * Get metadata for a query key
   *
   * @param queryKey - The query key to look up
   * @returns QueryMetadata if found, undefined otherwise
   */
  get(queryKey: readonly unknown[]): QueryMetadata | undefined {
    const serializedKey = this.serializeKey(queryKey);
    return this.registry.get(serializedKey);
  }

  /**
   * Check if a query key is registered and active
   *
   * @param queryKey - The query key to check
   * @returns true if query is registered and active, false otherwise
   */
  has(queryKey: readonly unknown[]): boolean {
    const serializedKey = this.serializeKey(queryKey);
    const metadata = this.registry.get(serializedKey);
    return metadata?.isActive ?? false;
  }

  /**
   * Mark a query as complete (no longer active)
   * Keeps metadata in registry for potential future reuse
   *
   * @param queryKey - The query key to mark as complete
   */
  complete(queryKey: readonly unknown[]): void {
    const serializedKey = this.serializeKey(queryKey);
    const metadata = this.registry.get(serializedKey);

    if (metadata && metadata.isActive) {
      metadata.isActive = false;
      this.stats.activeQueries--;

      logger.debug('Query completed', {
        queryKey: serializedKey,
        requestCount: metadata.requestCount,
        duration: `${Date.now() - metadata.registeredAt}ms`,
        wasDeduplicated: metadata.requestCount > 1,
        component: 'QueryRegistry',
      });
    }
  }

  /**
   * Remove a query from the registry entirely
   * Use this to clean up queries that are no longer needed
   *
   * @param queryKey - The query key to remove
   * @returns true if query was removed, false if not found
   */
  remove(queryKey: readonly unknown[]): boolean {
    const serializedKey = this.serializeKey(queryKey);
    const metadata = this.registry.get(serializedKey);

    if (metadata) {
      if (metadata.isActive) {
        this.stats.activeQueries--;
      }
      this.registry.delete(serializedKey);
      return true;
    }

    return false;
  }

  /**
   * Clear all queries from the registry
   * Useful for cleanup during logout or cache invalidation
   */
  clear(): void {
    const count = this.registry.size;
    this.stopAutoCleanup(); // Stop cleanup timer before clearing
    this.registry.clear();
    this.stats.activeQueries = 0;

    logger.debug('Registry cleared', {
      clearedCount: count,
      component: 'QueryRegistry',
    });
  }

  /**
   * Get current registry statistics
   * Useful for monitoring and debugging
   *
   * @returns Statistics object
   */
  getStats() {
    // Calculate average promise age for active promises
    const now = Date.now();
    const activePromises = Array.from(this.registry.values())
      .filter(m => m.promise && m.promiseUpdatedAt);
    const avgPromiseAge = activePromises.length > 0
      ? activePromises.reduce((sum, m) => sum + (now - (m.promiseUpdatedAt ?? 0)), 0) / activePromises.length
      : 0;

    return {
      ...this.stats,
      registrySize: this.registry.size,
      activePromises: activePromises.length,
      avgPromiseAge: avgPromiseAge > 0 ? `${Math.round(avgPromiseAge)}ms` : '0ms',
      deduplicationRate: this.stats.totalRegistrations > 0
        ? (this.stats.totalDeduplications / this.stats.totalRegistrations * 100).toFixed(2) + '%'
        : '0%',
      autoCleanupActive: this.cleanupTimer !== null,
    };
  }

  /**
   * Get all active queries
   * Useful for debugging and monitoring
   *
   * @returns Array of active query metadata
   */
  getActiveQueries(): QueryMetadata[] {
    return Array.from(this.registry.values()).filter(m => m.isActive);
  }

  /**
   * Get the count of currently active queries
   * Useful for debugging and monitoring (e.g., AdminDebugPanel)
   *
   * @returns Number of active queries
   */
  getActiveQueryCount(): number {
    return this.stats.activeQueries;
  }

  /**
   * Get all registered queries (active and inactive)
   *
   * @returns Array of all query metadata
   */
  getAllQueries(): QueryMetadata[] {
    return Array.from(this.registry.values());
  }

  /**
   * Cleanup inactive queries older than the specified age
   * Prevents registry from growing unbounded
   *
   * @param maxAge - Maximum age in milliseconds (default: 5 minutes)
   * @returns Number of queries cleaned up
   */
  cleanup(maxAge: number = 5 * 60 * 1000): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, metadata] of this.registry.entries()) {
      if (!metadata.isActive && (now - metadata.lastRequestedAt) > maxAge) {
        this.registry.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug('Registry cleanup completed', {
        cleanedCount: cleaned,
        remainingSize: this.registry.size,
        component: 'QueryRegistry',
      });
    }

    return cleaned;
  }

  /**
   * Cleanup stale promises that haven't resolved within TTL
   * Removes promises that are older than maxAge, even if query is still active
   *
   * @param maxAge - Maximum age for promises in milliseconds (default: use instance maxAge)
   * @returns Number of stale promises cleaned up
   */
  cleanupStalePromises(maxAge?: number): number {
    const ttl = maxAge ?? this.maxAge;
    const now = Date.now();
    let cleaned = 0;

    for (const [key, metadata] of this.registry.entries()) {
      if (metadata.promise && metadata.promiseUpdatedAt) {
        const age = now - metadata.promiseUpdatedAt;
        if (age > ttl) {
          // Remove stale promise but keep metadata
          delete metadata.promise;
          delete metadata.promiseUpdatedAt;
          cleaned++;

          logger.debug('Stale promise cleaned', {
            queryKey: key,
            promiseAge: `${age}ms`,
            ttl: `${ttl}ms`,
            component: 'QueryRegistry',
          });
        }
      }
    }

    if (cleaned > 0) {
      this.stats.stalePromisesCleaned += cleaned;
      logger.debug('Stale promise cleanup completed', {
        cleanedCount: cleaned,
        totalStalePromisesCleaned: this.stats.stalePromisesCleaned,
        component: 'QueryRegistry',
      });
    }

    return cleaned;
  }

  /**
   * Get all stale promises (promises older than TTL)
   * Useful for monitoring and debugging
   *
   * @param maxAge - Maximum age for promises in milliseconds (default: use instance maxAge)
   * @returns Array of query metadata with stale promises
   */
  getStalePromises(maxAge?: number): QueryMetadata[] {
    const ttl = maxAge ?? this.maxAge;
    const now = Date.now();
    const stalePromises: QueryMetadata[] = [];

    for (const metadata of this.registry.values()) {
      if (metadata.promise && metadata.promiseUpdatedAt) {
        const age = now - metadata.promiseUpdatedAt;
        if (age > ttl) {
          stalePromises.push(metadata);
        }
      }
    }

    return stalePromises;
  }

  /**
   * Start automatic TTL-based cleanup
   * Runs cleanup at regular intervals based on ttlCheckInterval
   */
  startAutoCleanup(): void {
    // Stop existing timer if any
    this.stopAutoCleanup();

    this.cleanupTimer = setInterval(() => {
      this.stats.cleanupRunCount++;

      // Run both inactive query cleanup and stale promise cleanup
      const inactiveCleaned = this.cleanup(this.maxAge);
      const promisesCleaned = this.cleanupStalePromises(this.maxAge);

      if (inactiveCleaned > 0 || promisesCleaned > 0) {
        logger.debug('Auto cleanup completed', {
          inactiveCleaned,
          promisesCleaned,
          cleanupRunCount: this.stats.cleanupRunCount,
          component: 'QueryRegistry',
        });
      }
    }, this.ttlCheckInterval);

    logger.debug('Auto cleanup started', {
      maxAge: `${this.maxAge}ms`,
      interval: `${this.ttlCheckInterval}ms`,
      component: 'QueryRegistry',
    });
  }

  /**
   * Stop automatic TTL-based cleanup
   */
  stopAutoCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;

      logger.debug('Auto cleanup stopped', {
        component: 'QueryRegistry',
      });
    }
  }

  /**
   * Configure TTL settings
   *
   * @param options - Configuration options
   */
  configureTTL(options: {
    maxAge?: number;
    ttlCheckInterval?: number;
  }): void {
    if (options.maxAge !== undefined) {
      this.maxAge = options.maxAge;
    }
    if (options.ttlCheckInterval !== undefined) {
      this.ttlCheckInterval = options.ttlCheckInterval;
    }

    logger.debug('TTL configuration updated', {
      maxAge: `${this.maxAge}ms`,
      ttlCheckInterval: `${this.ttlCheckInterval}ms`,
      component: 'QueryRegistry',
    });

    // Restart auto cleanup if it's running with new settings
    if (this.cleanupTimer) {
      this.startAutoCleanup();
    }
  }
}

/**
 * Singleton instance of QueryRegistry
 * Export for use across the application
 */
export const queryRegistry = new QueryRegistry();

/**
 * Get the count of currently active queries
 * Standalone helper function for debugging purposes (e.g., AdminDebugPanel)
 *
 * @returns Number of active queries
 */
export function getActiveQueryCount(): number {
  return queryRegistry.getActiveQueryCount();
}
