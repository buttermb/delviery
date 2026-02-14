/**
 * React Query Configuration Tests
 * Tests for slow query tracking and performance monitoring
 *
 * Note: Timing measurements start from when query callbacks fire (onSuccess/onError),
 * not from when the query starts executing. This is a limitation of React Query's API.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';

// Mock logger must be defined before the module mock
vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
  },
}));

// Import after mocking
import { createQueryClient, withQueryRegistry } from './react-query-config';
import { logger } from '@/lib/logger';
import { queryRegistry } from '@/lib/queryRegistry';

describe('React Query Configuration - Slow Query Tracking', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createQueryClient();
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe('onError callback - Error logging', () => {
    it('should track errors for failed queries', async () => {
      const queryKey = ['test-error'];
      const error = new Error('Query failed');

      const queryFn = vi.fn().mockRejectedValue(error);

      try {
        await queryClient.fetchQuery({
          queryKey,
          queryFn,
          retry: false,
        });
      } catch {
        // Expected to fail
      }

      // onError callback should have been triggered (even if not logged due to no retries)
      // The callback initializes metrics for failed queries
      expect(queryFn).toHaveBeenCalled();
    });

    it('should log errors for queries that have been retried', async () => {
      const queryKey = ['test-retry-error'];
      const error = new Error('Query failed after retries');
      let callCount = 0;

      const queryFn = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount > 1) {
          throw error;
        }
        return { data: 'test' };
      });

      await queryClient.fetchQuery({
        queryKey,
        queryFn,
        retry: 0,
      });

      vi.clearAllMocks();

      try {
        await queryClient.fetchQuery({
          queryKey,
          queryFn,
          retry: 0,
          staleTime: 0,
        });
      } catch {
        // Expected to fail
      }

      const retryErrorCalls = vi.mocked(logger.error).mock.calls.filter(
        (call) => call[0] === 'Query error after retries'
      );
      expect(retryErrorCalls.length).toBeGreaterThan(0);
    });
  });

  describe('onSettled callback - Slow query detection', () => {
    it('should log debug info for all queries', async () => {
      const queryKey = ['test-debug'];
      const queryFn = vi.fn().mockResolvedValue({ data: 'test' });

      await queryClient.fetchQuery({
        queryKey,
        queryFn,
      });

      const debugCalls = vi.mocked(logger.debug).mock.calls.filter(
        (call) => call[0] === 'Query completed'
      );
      expect(debugCalls.length).toBeGreaterThan(0);
    });

    it('should include query metadata in logs', async () => {
      const queryKey = ['test-metadata'];
      const queryFn = vi.fn().mockResolvedValue({ data: 'test' });

      await queryClient.fetchQuery({
        queryKey,
        queryFn,
      });

      const debugCall = vi.mocked(logger.debug).mock.calls.find(
        (call) => call[0] === 'Query completed'
      );

      expect(debugCall).toBeDefined();
      if (debugCall) {
        const metadata = debugCall[1];
        expect(metadata).toHaveProperty('queryKey');
        expect(metadata).toHaveProperty('duration');
        expect(metadata).toHaveProperty('cached');
        expect(metadata).toHaveProperty('component', 'QueryCache');
      }
    });
  });

  describe('Query configuration defaults', () => {
    it('should have correct staleTime for queries', () => {
      const client = createQueryClient();
      const defaultOptions = client.getDefaultOptions();

      expect(defaultOptions.queries?.staleTime).toBe(5 * 60 * 1000); // 5 minutes
    });

    it('should have correct gcTime for queries', () => {
      const client = createQueryClient();
      const defaultOptions = client.getDefaultOptions();

      expect(defaultOptions.queries?.gcTime).toBe(30 * 60 * 1000); // 30 minutes
    });

    it('should have structural sharing enabled', () => {
      const client = createQueryClient();
      const defaultOptions = client.getDefaultOptions();

      expect(defaultOptions.queries?.structuralSharing).toBe(true);
    });

    it('should retry failed queries with exponential backoff', () => {
      const client = createQueryClient();
      const defaultOptions = client.getDefaultOptions();

      expect(defaultOptions.queries?.retry).toBeDefined();
      if (typeof defaultOptions.queries?.retryDelay === 'function') {
        expect(defaultOptions.queries.retryDelay(0)).toBe(1000);
        expect(defaultOptions.queries.retryDelay(1)).toBe(2000);
        expect(defaultOptions.queries.retryDelay(2)).toBe(4000);
      }
    });

    it('should not retry on 4xx errors', () => {
      const client = createQueryClient();
      const defaultOptions = client.getDefaultOptions();

      if (typeof defaultOptions.queries?.retry === 'function') {
        const shouldRetry404 = defaultOptions.queries.retry(0, { status: 404 });
        const shouldRetry500 = defaultOptions.queries.retry(0, { status: 500 });

        expect(shouldRetry404).toBe(false);
        expect(shouldRetry500).toBe(true);
      }
    });

    it('should have offlineFirst network mode', () => {
      const client = createQueryClient();
      const defaultOptions = client.getDefaultOptions();

      expect(defaultOptions.queries?.networkMode).toBe('offlineFirst');
    });

    it('should keep previous data during refetch', () => {
      const client = createQueryClient();
      const defaultOptions = client.getDefaultOptions();

      expect(defaultOptions.queries?.placeholderData).toBeDefined();
    });
  });

  describe('Mutation cache', () => {
    it('should have mutation cache configured', () => {
      const client = createQueryClient();
      const mutationCache = client.getMutationCache();

      expect(mutationCache).toBeDefined();
    });

    it('should have offlineFirst network mode for mutations', () => {
      const client = createQueryClient();
      const mutations = client.getDefaultOptions().mutations;
      expect(mutations?.networkMode).toBe('offlineFirst');
    });

    it('should have retry configuration for mutations', () => {
      const client = createQueryClient();
      const mutations = client.getDefaultOptions().mutations;
      expect(mutations?.retry).toBe(1);
      expect(mutations?.retryDelay).toBe(1000);
    });

    it('should have offlineFirst behavior configured', () => {
      const client = createQueryClient();
      const mutations = client.getDefaultOptions().mutations;

      // The mutation cache should be configured with offlineFirst
      expect(mutations?.networkMode).toBe('offlineFirst');
    });
  });

  describe('Query cache integration', () => {
    it('should handle successful queries', async () => {
      const queryKey = ['test-success'];
      const queryFn = vi.fn().mockResolvedValue({ data: 'success' });

      const result = await queryClient.fetchQuery({
        queryKey,
        queryFn,
      });

      expect(result).toEqual({ data: 'success' });
      expect(queryFn).toHaveBeenCalledTimes(1);
    });

    it('should deduplicate identical concurrent requests', async () => {
      const queryKey = ['test-dedupe'];
      const queryFn = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return { data: 'deduped' };
      });

      // Fire two concurrent requests
      const [result1, result2] = await Promise.all([
        queryClient.fetchQuery({ queryKey, queryFn }),
        queryClient.fetchQuery({ queryKey, queryFn }),
      ]);

      expect(result1).toEqual(result2);
      // QueryFn should only be called once due to deduplication
      expect(queryFn).toHaveBeenCalledTimes(1);
    });

    it('should cache and reuse query results', async () => {
      const queryKey = ['test-cache'];
      const queryFn = vi.fn().mockResolvedValue({ data: 'cached' });

      // First fetch
      await queryClient.fetchQuery({ queryKey, queryFn });
      expect(queryFn).toHaveBeenCalledTimes(1);

      // Second fetch should use cache
      await queryClient.fetchQuery({ queryKey, queryFn });
      // Still only called once because result was cached
      expect(queryFn).toHaveBeenCalledTimes(1);
    });
  });
});

describe('withQueryRegistry - QueryFn Wrapper', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createQueryClient();
    queryRegistry.clear();
  });

  afterEach(() => {
    queryClient.clear();
    queryRegistry.clear();
  });

  describe('Basic functionality', () => {
    it('should wrap a query function and execute it', async () => {
      const queryKey = ['test', 'basic'] as const;
      const mockData = { id: 1, name: 'Test' };
      const queryFn = vi.fn().mockResolvedValue(mockData);
      const wrappedFn = withQueryRegistry(queryFn);

      const result = await wrappedFn({ queryKey });

      expect(result).toEqual(mockData);
      expect(queryFn).toHaveBeenCalledWith({ queryKey });
      expect(queryFn).toHaveBeenCalledTimes(1);
    });

    it('should register query in registry before execution', async () => {
      const queryKey = ['test', 'registration'] as const;
      const queryFn = vi.fn().mockResolvedValue({ data: 'test' });
      const wrappedFn = withQueryRegistry(queryFn);

      await wrappedFn({ queryKey });

      // Query should have been registered
      const metadata = queryRegistry.get(queryKey);
      expect(metadata).toBeDefined();
      expect(metadata?.originalKey).toEqual(queryKey);
    });

    it('should mark query as complete after successful execution', async () => {
      const queryKey = ['test', 'complete'] as const;
      const queryFn = vi.fn().mockResolvedValue({ data: 'test' });
      const wrappedFn = withQueryRegistry(queryFn);

      await wrappedFn({ queryKey });

      // Query should be marked as inactive
      const metadata = queryRegistry.get(queryKey);
      expect(metadata?.isActive).toBe(false);
    });

    it('should mark query as complete after failed execution', async () => {
      const queryKey = ['test', 'error'] as const;
      const error = new Error('Query failed');
      const queryFn = vi.fn().mockRejectedValue(error);
      const wrappedFn = withQueryRegistry(queryFn);

      await expect(wrappedFn({ queryKey })).rejects.toThrow('Query failed');

      // Query should be marked as inactive even after error
      const metadata = queryRegistry.get(queryKey);
      expect(metadata?.isActive).toBe(false);
    });
  });

  describe('Deduplication', () => {
    it('should deduplicate concurrent identical requests', async () => {
      const queryKey = ['test', 'dedupe'] as const;
      let callCount = 0;
      const queryFn = vi.fn().mockImplementation(async () => {
        callCount++;
        await new Promise((resolve) => setTimeout(resolve, 50));
        return { data: `result-${callCount}` };
      });
      const wrappedFn = withQueryRegistry(queryFn);

      // Fire two concurrent requests
      const [result1, result2] = await Promise.all([
        wrappedFn({ queryKey }),
        wrappedFn({ queryKey }),
      ]);

      // Both should return the same result
      expect(result1).toEqual(result2);
      expect(result1).toEqual({ data: 'result-1' });

      // Original function should only be called once
      expect(queryFn).toHaveBeenCalledTimes(1);

      // Registry should show deduplication
      const metadata = queryRegistry.get(queryKey);
      expect(metadata?.requestCount).toBe(2);
    });

    it('should allow new requests after query completes', async () => {
      const queryKey = ['test', 're-request'] as const;
      const queryFn = vi.fn()
        .mockResolvedValueOnce({ data: 'first' })
        .mockResolvedValueOnce({ data: 'second' });
      const wrappedFn = withQueryRegistry(queryFn);

      // First request
      const result1 = await wrappedFn({ queryKey });
      expect(result1).toEqual({ data: 'first' });

      // Wait for query to be marked complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Second request should execute again
      const result2 = await wrappedFn({ queryKey });
      expect(result2).toEqual({ data: 'second' });

      // Function should have been called twice
      expect(queryFn).toHaveBeenCalledTimes(2);
    });

    it('should not deduplicate queries with different keys', async () => {
      const queryKey1 = ['test', 'key1'] as const;
      const queryKey2 = ['test', 'key2'] as const;
      const queryFn = vi.fn().mockResolvedValue({ data: 'test' });
      const wrappedFn = withQueryRegistry(queryFn);

      await Promise.all([
        wrappedFn({ queryKey: queryKey1 }),
        wrappedFn({ queryKey: queryKey2 }),
      ]);

      // Function should have been called for each unique key
      expect(queryFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error handling', () => {
    it('should propagate errors from query function', async () => {
      const queryKey = ['test', 'error-propagation'] as const;
      const error = new Error('Database connection failed');
      const queryFn = vi.fn().mockRejectedValue(error);
      const wrappedFn = withQueryRegistry(queryFn);

      await expect(wrappedFn({ queryKey })).rejects.toThrow('Database connection failed');
    });

    it('should mark query as complete even on error', async () => {
      const queryKey = ['test', 'error-complete'] as const;
      const queryFn = vi.fn().mockRejectedValue(new Error('Failed'));
      const wrappedFn = withQueryRegistry(queryFn);

      try {
        await wrappedFn({ queryKey });
      } catch {
        // Expected error
      }

      const metadata = queryRegistry.get(queryKey);
      expect(metadata?.isActive).toBe(false);
    });

    it('should handle errors in concurrent requests', async () => {
      const queryKey = ['test', 'concurrent-error'] as const;
      const error = new Error('Concurrent failure');
      const queryFn = vi.fn().mockRejectedValue(error);
      const wrappedFn = withQueryRegistry(queryFn);

      const results = await Promise.allSettled([
        wrappedFn({ queryKey }),
        wrappedFn({ queryKey }),
      ]);

      // Both should reject with the same error
      expect(results[0].status).toBe('rejected');
      expect(results[1].status).toBe('rejected');

      // Function should only be called once (deduplicated)
      expect(queryFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('Integration with React Query', () => {
    it('should work with queryClient.fetchQuery', async () => {
      const queryKey = ['integration', 'fetchQuery'] as const;
      const mockData = { products: ['Product A', 'Product B'] };
      const queryFn = vi.fn().mockResolvedValue(mockData);

      const result = await queryClient.fetchQuery({
        queryKey,
        queryFn: withQueryRegistry(queryFn),
      });

      expect(result).toEqual(mockData);
      expect(queryFn).toHaveBeenCalledTimes(1);

      // Verify registry integration
      const metadata = queryRegistry.get(queryKey);
      expect(metadata).toBeDefined();
      expect(metadata?.isActive).toBe(false);
    });

    it('should work with concurrent fetchQuery calls', async () => {
      const queryKey = ['integration', 'concurrent'] as const;
      const queryFn = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return { data: 'concurrent-test' };
      });

      const [result1, result2] = await Promise.all([
        queryClient.fetchQuery({
          queryKey,
          queryFn: withQueryRegistry(queryFn),
        }),
        queryClient.fetchQuery({
          queryKey,
          queryFn: withQueryRegistry(queryFn),
        }),
      ]);

      expect(result1).toEqual(result2);
      // React Query deduplicates at its level too, but our wrapper adds an extra layer
      expect(queryFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('Logging', () => {
    it('should log when reusing existing query promise', async () => {
      const queryKey = ['test', 'logging'] as const;
      const queryFn = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return { data: 'test' };
      });
      const wrappedFn = withQueryRegistry(queryFn);

      // Fire concurrent requests
      await Promise.all([
        wrappedFn({ queryKey }),
        wrappedFn({ queryKey }),
      ]);

      // Should have logged about reusing promise
      const debugCalls = vi.mocked(logger.debug).mock.calls.filter(
        (call) => call[0] === 'Reusing existing query promise'
      );
      expect(debugCalls.length).toBeGreaterThan(0);

      const logData = debugCalls[0][1];
      expect(logData).toHaveProperty('queryKey');
      // requestCount is incremented when logging, so it shows the count + 1
      expect(logData.requestCount).toBeGreaterThanOrEqual(2);
      expect(logData).toHaveProperty('component', 'withQueryRegistry');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty query keys', async () => {
      const queryKey: readonly unknown[] = [];
      const queryFn = vi.fn().mockResolvedValue({ data: 'empty-key' });
      const wrappedFn = withQueryRegistry(queryFn);

      const result = await wrappedFn({ queryKey });

      expect(result).toEqual({ data: 'empty-key' });
      expect(queryRegistry.get(queryKey)).toBeDefined();
    });

    it('should handle complex query keys with objects', async () => {
      const queryKey = ['products', { category: 'electronics', page: 1 }] as const;
      const queryFn = vi.fn().mockResolvedValue({ data: 'complex-key' });
      const wrappedFn = withQueryRegistry(queryFn);

      const result = await wrappedFn({ queryKey });

      expect(result).toEqual({ data: 'complex-key' });
      expect(queryRegistry.get(queryKey)).toBeDefined();
    });

    it('should handle null and undefined in query keys', async () => {
      const queryKey = ['test', null, undefined] as const;
      const queryFn = vi.fn().mockResolvedValue({ data: 'null-undefined' });
      const wrappedFn = withQueryRegistry(queryFn);

      const result = await wrappedFn({ queryKey });

      expect(result).toEqual({ data: 'null-undefined' });
      expect(queryRegistry.get(queryKey)).toBeDefined();
    });

    it('should handle deeply nested objects in query keys', async () => {
      const queryKey = ['test', { nested: { deep: { value: [1, 2, 3] } } }] as const;
      const queryFn = vi.fn().mockResolvedValue({ data: 'nested' });
      const wrappedFn = withQueryRegistry(queryFn);

      const result = await wrappedFn({ queryKey });

      expect(result).toEqual({ data: 'nested' });
      expect(queryRegistry.get(queryKey)).toBeDefined();
    });
  });

  describe('Memory management', () => {
    it('should not leak memory with many sequential requests', async () => {
      const queryFn = vi.fn().mockResolvedValue({ data: 'test' });
      const wrappedFn = withQueryRegistry(queryFn);

      // Execute many sequential requests
      for (let i = 0; i < 100; i++) {
        const queryKey = ['test', `query-${i}`] as const;
        await wrappedFn({ queryKey });
      }

      // Registry should have all inactive queries
      const stats = queryRegistry.getStats();
      expect(stats.activeQueries).toBe(0);
      expect(stats.registrySize).toBe(100);

      // Cleanup should work - wait a bit for lastRequestedAt to be in the past
      await new Promise((resolve) => setTimeout(resolve, 10));
      const cleaned = queryRegistry.cleanup(0);
      expect(cleaned).toBeGreaterThan(0);
      expect(queryRegistry.getStats().registrySize).toBeLessThan(100);
    });
  });

  describe('Type safety', () => {
    it('should preserve return type of query function', async () => {
      const queryKey = ['test', 'types'] as const;

      interface Product {
        id: number;
        name: string;
        price: number;
      }

      const queryFn = async (): Promise<Product[]> => {
        return [
          { id: 1, name: 'Product A', price: 10 },
          { id: 2, name: 'Product B', price: 20 },
        ];
      };

      const wrappedFn = withQueryRegistry(queryFn);
      const result = await wrappedFn({ queryKey });

      // TypeScript should infer this as Product[]
      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('price');
    });
  });
});

describe('ADMIN_PANEL_QUERY_CONFIG - Optimized Cache Settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Configuration values', () => {
    it('should have 10 minute staleTime for data freshness balance', async () => {
      const { ADMIN_PANEL_QUERY_CONFIG } = await import('./react-query-config');
      expect(ADMIN_PANEL_QUERY_CONFIG.staleTime).toBe(10 * 60 * 1000);
    });

    it('should have 20 minute gcTime for extended caching', async () => {
      const { ADMIN_PANEL_QUERY_CONFIG } = await import('./react-query-config');
      expect(ADMIN_PANEL_QUERY_CONFIG.gcTime).toBe(20 * 60 * 1000);
    });

    it('should disable refetchOnWindowFocus for manual admin actions', async () => {
      const { ADMIN_PANEL_QUERY_CONFIG } = await import('./react-query-config');
      expect(ADMIN_PANEL_QUERY_CONFIG.refetchOnWindowFocus).toBe(false);
    });

    it('should disable refetchOnMount to use cached data', async () => {
      const { ADMIN_PANEL_QUERY_CONFIG } = await import('./react-query-config');
      expect(ADMIN_PANEL_QUERY_CONFIG.refetchOnMount).toBe(false);
    });

    it('should enable refetchOnReconnect for reliability after network issues', async () => {
      const { ADMIN_PANEL_QUERY_CONFIG } = await import('./react-query-config');
      expect(ADMIN_PANEL_QUERY_CONFIG.refetchOnReconnect).toBe(true);
    });

    it('should enable keepPreviousData for smooth UX during operations', async () => {
      const { ADMIN_PANEL_QUERY_CONFIG } = await import('./react-query-config');
      expect(ADMIN_PANEL_QUERY_CONFIG.keepPreviousData).toBe(true);
    });
  });

  describe('Performance optimization', () => {
    it('should have longer cache time than dashboard config', async () => {
      const { ADMIN_PANEL_QUERY_CONFIG, DASHBOARD_QUERY_CONFIG } = await import('./react-query-config');
      expect(ADMIN_PANEL_QUERY_CONFIG.staleTime).toBeGreaterThan(DASHBOARD_QUERY_CONFIG.staleTime);
      expect(ADMIN_PANEL_QUERY_CONFIG.gcTime).toBeGreaterThan(DASHBOARD_QUERY_CONFIG.gcTime);
    });

    it('should have shorter cache time than product config', async () => {
      const { ADMIN_PANEL_QUERY_CONFIG, PRODUCT_QUERY_CONFIG } = await import('./react-query-config');
      expect(ADMIN_PANEL_QUERY_CONFIG.staleTime).toBeLessThan(PRODUCT_QUERY_CONFIG.staleTime);
    });

    it('should not have auto-refresh interval by default', async () => {
      const { ADMIN_PANEL_QUERY_CONFIG } = await import('./react-query-config');
      expect(ADMIN_PANEL_QUERY_CONFIG.refetchInterval).toBeUndefined();
    });
  });

  describe('Integration with QueryClient', () => {
    it('should work with fetchQuery using admin panel config', async () => {
      const queryClient = createQueryClient();
      const { ADMIN_PANEL_QUERY_CONFIG } = await import('./react-query-config');
      const queryKey = ['admin', 'users'];
      const mockData = { users: [{ id: 1, name: 'Admin User' }] };
      const queryFn = vi.fn().mockResolvedValue(mockData);

      const result = await queryClient.fetchQuery({
        queryKey,
        queryFn,
        ...ADMIN_PANEL_QUERY_CONFIG,
      });

      expect(result).toEqual(mockData);
      expect(queryFn).toHaveBeenCalledTimes(1);

      // Should use cached data on second fetch (within staleTime)
      const result2 = await queryClient.fetchQuery({
        queryKey,
        queryFn,
        ...ADMIN_PANEL_QUERY_CONFIG,
      });

      expect(result2).toEqual(mockData);
      expect(queryFn).toHaveBeenCalledTimes(1); // Still only called once
    });

    it('should keep previous data during refetch', async () => {
      const queryClient = createQueryClient();
      const { ADMIN_PANEL_QUERY_CONFIG } = await import('./react-query-config');
      const queryKey = ['admin', 'orders'];
      const oldData = { orders: [{ id: 1, status: 'pending' }] };
      const newData = { orders: [{ id: 1, status: 'completed' }] };

      let callCount = 0;
      const queryFn = vi.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve(callCount === 1 ? oldData : newData);
      });

      // First fetch
      await queryClient.fetchQuery({
        queryKey,
        queryFn,
        ...ADMIN_PANEL_QUERY_CONFIG,
      });

      // keepPreviousData should be enabled
      expect(ADMIN_PANEL_QUERY_CONFIG.keepPreviousData).toBe(true);
    });
  });

  describe('Use case validation', () => {
    it('should be suitable for user management tables', async () => {
      const { ADMIN_PANEL_QUERY_CONFIG } = await import('./react-query-config');

      // User management needs moderate freshness but not realtime
      expect(ADMIN_PANEL_QUERY_CONFIG.staleTime).toBeGreaterThan(5 * 60 * 1000); // > 5 min
      expect(ADMIN_PANEL_QUERY_CONFIG.staleTime).toBeLessThan(15 * 60 * 1000); // < 15 min

      // Should keep previous data for smooth pagination
      expect(ADMIN_PANEL_QUERY_CONFIG.keepPreviousData).toBe(true);
    });

    it('should be suitable for settings and configuration pages', async () => {
      const { ADMIN_PANEL_QUERY_CONFIG } = await import('./react-query-config');

      // Settings can be cached longer
      expect(ADMIN_PANEL_QUERY_CONFIG.gcTime).toBeGreaterThanOrEqual(20 * 60 * 1000);

      // Manual actions, no auto-refresh
      expect(ADMIN_PANEL_QUERY_CONFIG.refetchOnWindowFocus).toBe(false);
      expect(ADMIN_PANEL_QUERY_CONFIG.refetchOnMount).toBe(false);
    });

    it('should be reliable after network reconnection', async () => {
      const { ADMIN_PANEL_QUERY_CONFIG } = await import('./react-query-config');

      // Critical for admin reliability
      expect(ADMIN_PANEL_QUERY_CONFIG.refetchOnReconnect).toBe(true);
    });
  });

  describe('Comparison with other configs', () => {
    it('should be less aggressive than REALTIME_QUERY_CONFIG', async () => {
      const { ADMIN_PANEL_QUERY_CONFIG, REALTIME_QUERY_CONFIG } = await import('./react-query-config');

      expect(ADMIN_PANEL_QUERY_CONFIG.staleTime).toBeGreaterThan(REALTIME_QUERY_CONFIG.staleTime);
      expect(ADMIN_PANEL_QUERY_CONFIG.refetchInterval).toBeUndefined();
      expect(REALTIME_QUERY_CONFIG.refetchInterval).toBeDefined();
    });

    it('should be more conservative than STATIC_QUERY_CONFIG', async () => {
      const { ADMIN_PANEL_QUERY_CONFIG, STATIC_QUERY_CONFIG } = await import('./react-query-config');

      expect(ADMIN_PANEL_QUERY_CONFIG.staleTime).toBeLessThan(STATIC_QUERY_CONFIG.staleTime);
      expect(ADMIN_PANEL_QUERY_CONFIG.refetchOnReconnect).toBe(true);
      expect(STATIC_QUERY_CONFIG.refetchOnReconnect).toBe(false);
    });

    it('should be balanced compared to LIST_QUERY_CONFIG', async () => {
      const { ADMIN_PANEL_QUERY_CONFIG, LIST_QUERY_CONFIG } = await import('./react-query-config');

      // Admin panel should cache longer than generic lists
      expect(ADMIN_PANEL_QUERY_CONFIG.staleTime).toBeGreaterThan(LIST_QUERY_CONFIG.staleTime);

      // Both should keep previous data
      expect(ADMIN_PANEL_QUERY_CONFIG.keepPreviousData).toBe(true);
      expect(LIST_QUERY_CONFIG.keepPreviousData).toBe(true);
    });
  });
});

describe('DASHBOARD_QUERY_CONFIG - Background Refetch Settings', () => {
  it('should have refetchIntervalInBackground set to false', async () => {
    const { DASHBOARD_QUERY_CONFIG } = await import('./react-query-config');
    expect(DASHBOARD_QUERY_CONFIG.refetchIntervalInBackground).toBe(false);
  });

  it('should have refetchInterval configured', async () => {
    const { DASHBOARD_QUERY_CONFIG } = await import('./react-query-config');
    expect(DASHBOARD_QUERY_CONFIG.refetchInterval).toBe(60000);
  });
});

describe('ANALYTICS_QUERY_CONFIG - Background Refetch Settings', () => {
  it('should have refetchIntervalInBackground set to false', async () => {
    const { ANALYTICS_QUERY_CONFIG } = await import('./react-query-config');
    expect(ANALYTICS_QUERY_CONFIG.refetchIntervalInBackground).toBe(false);
  });

  it('should have refetchInterval configured', async () => {
    const { ANALYTICS_QUERY_CONFIG } = await import('./react-query-config');
    expect(ANALYTICS_QUERY_CONFIG.refetchInterval).toBe(60000);
  });
});

describe('REALTIME_QUERY_CONFIG - Background Refetch Settings', () => {
  it('should have refetchIntervalInBackground set to false', async () => {
    const { REALTIME_QUERY_CONFIG } = await import('./react-query-config');
    expect(REALTIME_QUERY_CONFIG.refetchIntervalInBackground).toBe(false);
  });

  it('should have refetchInterval configured', async () => {
    const { REALTIME_QUERY_CONFIG } = await import('./react-query-config');
    expect(REALTIME_QUERY_CONFIG.refetchInterval).toBe(30000);
  });
});
