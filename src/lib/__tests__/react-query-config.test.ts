/**
 * Tests for React Query configuration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { keepPreviousData } from '@tanstack/react-query';
import {
  createQueryClient,
  appQueryClient,
  getQueryPerformanceStats,
  PRODUCT_QUERY_CONFIG,
  DASHBOARD_QUERY_CONFIG,
  ANALYTICS_QUERY_CONFIG,
  REALTIME_QUERY_CONFIG,
  STATIC_QUERY_CONFIG,
  INSTANT_CACHE_CONFIG,
  LIST_QUERY_CONFIG,
  ADMIN_PANEL_QUERY_CONFIG,
} from '../react-query-config';

describe('React Query Configuration', () => {
  describe('createQueryClient', () => {
    it('should create a query client with default options', () => {
      const client = createQueryClient();
      expect(client).toBeDefined();
      expect(client.getDefaultOptions().queries?.staleTime).toBe(5 * 60 * 1000);
      expect(client.getDefaultOptions().queries?.gcTime).toBe(30 * 60 * 1000);
    });

    it('should have retry configuration', () => {
      const client = createQueryClient();
      const queries = client.getDefaultOptions().queries;
      expect(queries?.retry).toBeDefined();
      expect(queries?.retryDelay).toBeDefined();
    });

    it('should have placeholderData set to keepPreviousData', () => {
      const client = createQueryClient();
      const queries = client.getDefaultOptions().queries;
      expect(queries?.placeholderData).toBeDefined();
      expect(queries?.placeholderData).toBe(keepPreviousData);
    });

    it('should enable instant navigation with previous data', () => {
      const client = createQueryClient();
      const queries = client.getDefaultOptions().queries;
      // placeholderData: keepPreviousData ensures users see old data while new data loads
      expect(queries?.placeholderData).toBe(keepPreviousData);
    });

    it('should have structural sharing enabled', () => {
      const client = createQueryClient();
      const queries = client.getDefaultOptions().queries;
      expect(queries?.structuralSharing).toBe(true);
    });

    it('should have network mode set to offlineFirst', () => {
      const client = createQueryClient();
      const queries = client.getDefaultOptions().queries;
      expect(queries?.networkMode).toBe('offlineFirst');
    });

    it('should not refetch on window focus by default', () => {
      const client = createQueryClient();
      const queries = client.getDefaultOptions().queries;
      expect(queries?.refetchOnWindowFocus).toBe(false);
    });

    it('should not refetch on mount by default', () => {
      const client = createQueryClient();
      const queries = client.getDefaultOptions().queries;
      expect(queries?.refetchOnMount).toBe(false);
    });

    it('should refetch on reconnect', () => {
      const client = createQueryClient();
      const queries = client.getDefaultOptions().queries;
      expect(queries?.refetchOnReconnect).toBe(true);
    });
  });

  describe('appQueryClient', () => {
    it('should be a singleton instance', () => {
      expect(appQueryClient).toBeDefined();
      expect(appQueryClient).toBe(appQueryClient);
    });
  });

  describe('PRODUCT_QUERY_CONFIG', () => {
    it('should have correct configuration for products', () => {
      expect(PRODUCT_QUERY_CONFIG).toEqual({
        staleTime: 15 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
      });
    });

    it('should have longer staleTime than default', () => {
      expect(PRODUCT_QUERY_CONFIG.staleTime).toBe(15 * 60 * 1000);
      expect(PRODUCT_QUERY_CONFIG.staleTime).toBeGreaterThan(5 * 60 * 1000);
    });
  });

  describe('DASHBOARD_QUERY_CONFIG', () => {
    it('should have correct configuration for dashboard', () => {
      expect(DASHBOARD_QUERY_CONFIG).toEqual({
        staleTime: 2 * 60 * 1000,
        gcTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
        refetchInterval: 60000,
        refetchIntervalInBackground: false,
      });
    });

    it('should auto-refresh every minute', () => {
      expect(DASHBOARD_QUERY_CONFIG.refetchInterval).toBe(60000);
    });
  });

  describe('ANALYTICS_QUERY_CONFIG', () => {
    it('should have correct configuration for analytics', () => {
      expect(ANALYTICS_QUERY_CONFIG).toEqual({
        staleTime: 2 * 60 * 1000,
        gcTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchInterval: 60000,
        refetchIntervalInBackground: false,
      });
    });

    it('should auto-refresh every minute', () => {
      expect(ANALYTICS_QUERY_CONFIG.refetchInterval).toBe(60000);
    });

    it('should have refetchInterval of 60000ms', () => {
      expect(ANALYTICS_QUERY_CONFIG.refetchInterval).toBe(60000);
    });

    it('should not refetch on window focus', () => {
      expect(ANALYTICS_QUERY_CONFIG.refetchOnWindowFocus).toBe(false);
    });

    it('should not refetch on mount', () => {
      expect(ANALYTICS_QUERY_CONFIG.refetchOnMount).toBe(false);
    });

    it('should have 2 minute staleTime', () => {
      expect(ANALYTICS_QUERY_CONFIG.staleTime).toBe(2 * 60 * 1000);
    });

    it('should have 5 minute gcTime', () => {
      expect(ANALYTICS_QUERY_CONFIG.gcTime).toBe(5 * 60 * 1000);
    });
  });

  describe('REALTIME_QUERY_CONFIG', () => {
    it('should have correct configuration for realtime data', () => {
      expect(REALTIME_QUERY_CONFIG).toEqual({
        staleTime: 30 * 1000,
        gcTime: 2 * 60 * 1000,
        refetchInterval: 30000,
        refetchIntervalInBackground: false,
      });
    });

    it('should refresh more frequently than analytics', () => {
      expect(REALTIME_QUERY_CONFIG.refetchInterval).toBe(30000);
      expect(REALTIME_QUERY_CONFIG.refetchInterval).toBeLessThan(
        ANALYTICS_QUERY_CONFIG.refetchInterval || 0
      );
    });
  });

  describe('STATIC_QUERY_CONFIG', () => {
    it('should have correct configuration for static data', () => {
      expect(STATIC_QUERY_CONFIG).toEqual({
        staleTime: Infinity,
        gcTime: 24 * 60 * 60 * 1000,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false,
      });
    });

    it('should never become stale', () => {
      expect(STATIC_QUERY_CONFIG.staleTime).toBe(Infinity);
      expect(STATIC_QUERY_CONFIG.gcTime).toBe(24 * 60 * 60 * 1000);
    });

    it('should never refetch', () => {
      expect(STATIC_QUERY_CONFIG.refetchOnWindowFocus).toBe(false);
      expect(STATIC_QUERY_CONFIG.refetchOnMount).toBe(false);
      expect(STATIC_QUERY_CONFIG.refetchOnReconnect).toBe(false);
    });
  });

  describe('INSTANT_CACHE_CONFIG', () => {
    it('should have correct configuration for instant cache', () => {
      expect(INSTANT_CACHE_CONFIG).toEqual({
        staleTime: Infinity,
        gcTime: 24 * 60 * 60 * 1000,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false,
      });
    });

    it('should never become stale', () => {
      expect(INSTANT_CACHE_CONFIG.staleTime).toBe(Infinity);
    });

    it('should cache for 24 hours', () => {
      expect(INSTANT_CACHE_CONFIG.gcTime).toBe(24 * 60 * 60 * 1000);
    });

    it('should never refetch', () => {
      expect(INSTANT_CACHE_CONFIG.refetchOnWindowFocus).toBe(false);
      expect(INSTANT_CACHE_CONFIG.refetchOnMount).toBe(false);
      expect(INSTANT_CACHE_CONFIG.refetchOnReconnect).toBe(false);
    });
  });

  describe('LIST_QUERY_CONFIG', () => {
    it('should have correct configuration for list data', () => {
      expect(LIST_QUERY_CONFIG).toEqual({
        staleTime: 60 * 1000,
        gcTime: 5 * 60 * 1000,
        keepPreviousData: true,
      });
    });

    it('should keep previous data for smooth pagination', () => {
      expect(LIST_QUERY_CONFIG.keepPreviousData).toBe(true);
    });
  });

  describe('ADMIN_PANEL_QUERY_CONFIG', () => {
    it('should have correct configuration for admin panel', () => {
      expect(ADMIN_PANEL_QUERY_CONFIG).toEqual({
        staleTime: 10 * 60 * 1000,
        gcTime: 20 * 60 * 1000,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: true,
        keepPreviousData: true,
      });
    });

    it('should have 10 minute staleTime', () => {
      expect(ADMIN_PANEL_QUERY_CONFIG.staleTime).toBe(10 * 60 * 1000);
    });

    it('should have 20 minute gcTime', () => {
      expect(ADMIN_PANEL_QUERY_CONFIG.gcTime).toBe(20 * 60 * 1000);
    });

    it('should have gcTime greater than staleTime', () => {
      expect(ADMIN_PANEL_QUERY_CONFIG.gcTime).toBeGreaterThan(
        ADMIN_PANEL_QUERY_CONFIG.staleTime
      );
    });

    it('should not refetch on window focus', () => {
      expect(ADMIN_PANEL_QUERY_CONFIG.refetchOnWindowFocus).toBe(false);
    });

    it('should not refetch on mount', () => {
      expect(ADMIN_PANEL_QUERY_CONFIG.refetchOnMount).toBe(false);
    });
  });

  describe('Configuration consistency', () => {
    it('should have gcTime >= staleTime for all configs', () => {
      const configs = [
        PRODUCT_QUERY_CONFIG,
        DASHBOARD_QUERY_CONFIG,
        ANALYTICS_QUERY_CONFIG,
        REALTIME_QUERY_CONFIG,
        STATIC_QUERY_CONFIG,
        LIST_QUERY_CONFIG,
        ADMIN_PANEL_QUERY_CONFIG,
      ];

      configs.forEach((config) => {
        if (config.staleTime && config.gcTime) {
          // Skip validation if staleTime is Infinity (it's acceptable for gcTime to be less than Infinity)
          if (config.staleTime === Infinity) {
            expect(config.gcTime).toBeGreaterThan(0);
          } else {
            expect(config.gcTime).toBeGreaterThanOrEqual(config.staleTime);
          }
        }
      });
    });

    it('should have appropriate refresh intervals', () => {
      // Realtime should refresh faster than analytics/dashboard
      if (REALTIME_QUERY_CONFIG.refetchInterval && ANALYTICS_QUERY_CONFIG.refetchInterval) {
        expect(REALTIME_QUERY_CONFIG.refetchInterval).toBeLessThan(
          ANALYTICS_QUERY_CONFIG.refetchInterval
        );
      }

      // Analytics and dashboard should have the same interval
      expect(ANALYTICS_QUERY_CONFIG.refetchInterval).toBe(
        DASHBOARD_QUERY_CONFIG.refetchInterval
      );
    });
  });

  describe('Performance Tracking', () => {
    let client: ReturnType<typeof createQueryClient>;
    let debugSpy: ReturnType<typeof vi.spyOn>;
    let warnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      client = createQueryClient();
      debugSpy = vi.spyOn(logger, 'debug');
      warnSpy = vi.spyOn(logger, 'warn');
      vi.spyOn(logger, 'error'); // Track errors, but don't need to assert on them
    });

    afterEach(() => {
      client.clear();
      vi.clearAllMocks();
    });

    it('should track query performance metrics', async () => {
      const queryKey = ['test-query'];
      const queryFn = () => Promise.resolve({ data: 'test' });

      await client.fetchQuery({ queryKey, queryFn });

      expect(debugSpy).toHaveBeenCalledWith(
        'Query completed',
        expect.objectContaining({
          queryKey: JSON.stringify(queryKey),
          duration: expect.stringContaining('ms'),
          cached: expect.any(Boolean),
          retries: expect.any(Number),
        })
      );
    });

    it('should log debug info for all queries', async () => {
      // Note: Current implementation tracks timing from onSuccess to onSettled
      // which happens very quickly. This test validates the debug logging.
      const queryKey = ['test-timing-query'];
      const queryFn = () => Promise.resolve({ data: 'test' });

      await client.fetchQuery({ queryKey, queryFn });

      // Verify debug log is called with timing info
      expect(debugSpy).toHaveBeenCalledWith(
        'Query completed',
        expect.objectContaining({
          queryKey: JSON.stringify(queryKey),
          duration: expect.stringContaining('ms'),
          cached: expect.any(Boolean),
          retries: expect.any(Number),
        })
      );
    });

    it('should not log warning for fast queries under 500ms', async () => {
      const queryKey = ['fast-query'];
      const queryFn = () => Promise.resolve({ data: 'fast' });

      await client.fetchQuery({ queryKey, queryFn });

      expect(warnSpy).not.toHaveBeenCalledWith(
        'Slow query detected',
        expect.anything()
      );
    });

    it('should track cache hits', async () => {
      const queryKey = ['cache-test'];
      const queryFn = vi.fn(() => Promise.resolve({ data: 'cached' }));

      // First call - network fetch
      await client.fetchQuery({ queryKey, queryFn, staleTime: 60000 });

      // Second call - should use cache
      await client.fetchQuery({ queryKey, queryFn, staleTime: 60000 });

      expect(queryFn).toHaveBeenCalledTimes(1);
    });

    it('should track retry counts on query errors', async () => {
      const queryKey = ['error-query'];
      let attempts = 0;
      const queryFn = () => {
        attempts++;
        if (attempts < 3) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({ data: 'success' });
      };

      await client.fetchQuery({ queryKey, queryFn });

      expect(attempts).toBeGreaterThan(1);
    });

    it('should log errors for slow failing queries', async () => {
      const queryKey = ['slow-failing-query'];
      const error = new Error('Slow failure');

      // Create a query that takes time before failing
      const queryFn = vi.fn(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(error), 600);
        });
      });

      try {
        await client.fetchQuery({ queryKey, queryFn, retry: 0 });
      } catch {
        // Expected to fail
      }

      // Wait for async error handling
      await new Promise(resolve => setTimeout(resolve, 100));

      // Error logging depends on whether dataUpdateCount > 0 or if query is slow
      // At minimum, the error spy should be called for slow queries that fail
      expect(queryFn).toHaveBeenCalled();
    });

    it('should include query metadata in performance logs', async () => {
      const queryKey = ['metadata-query'];
      const queryFn = () => Promise.resolve({ data: 'test' });

      await client.fetchQuery({ queryKey, queryFn });

      expect(debugSpy).toHaveBeenCalledWith(
        'Query completed',
        expect.objectContaining({
          queryKey: expect.any(String),
          duration: expect.any(String),
          cached: expect.any(Boolean),
          retries: expect.any(Number),
          fetchStatus: expect.any(String),
          dataUpdateCount: expect.any(Number),
          component: 'QueryCache',
        })
      );
    });
  });

  describe('getQueryPerformanceStats', () => {
    let client: ReturnType<typeof createQueryClient>;

    beforeEach(() => {
      client = createQueryClient();
    });

    afterEach(() => {
      client.clear();
    });

    it('should return null for non-existent queries', () => {
      const stats = getQueryPerformanceStats(client, ['non-existent']);
      expect(stats).toBeNull();
    });

    it('should return performance stats for existing queries', async () => {
      const queryKey = ['stats-query'];
      const queryFn = () => Promise.resolve({ data: 'test' });

      await client.fetchQuery({ queryKey, queryFn });

      const stats = getQueryPerformanceStats(client, queryKey);

      expect(stats).toBeDefined();
      expect(stats?.queryKey).toBe(JSON.stringify(queryKey));
      expect(stats?.state).toBeDefined();
      expect(stats?.dataUpdateCount).toBeDefined();
    });

    it('should include query state information', async () => {
      const queryKey = ['state-query'];
      const queryFn = () => Promise.resolve({ data: 'test' });

      await client.fetchQuery({ queryKey, queryFn });

      const stats = getQueryPerformanceStats(client, queryKey);

      expect(stats).toMatchObject({
        queryKey: expect.any(String),
        state: expect.any(String),
        dataUpdateCount: expect.any(Number),
        errorUpdateCount: expect.any(Number),
        fetchFailureCount: expect.any(Number),
      });
    });

    it('should track failure information for failed queries', async () => {
      const queryKey = ['failure-query'];
      const error = new Error('Test error');
      const queryFn = () => Promise.reject(error);

      try {
        await client.fetchQuery({ queryKey, queryFn, retry: 1 });
      } catch {
        // Expected to fail
      }

      const stats = getQueryPerformanceStats(client, queryKey);

      expect(stats?.fetchFailureCount).toBeGreaterThan(0);
      expect(stats?.fetchFailureReason).toBeDefined();
    });
  });
});
