/**
 * Query Registry Tests
 * Tests for Map-based query deduplication and tracking
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryRegistry, queryRegistry, getActiveQueryCount } from './queryRegistry';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { logger } from '@/lib/logger';

describe('QueryRegistry', () => {
  let registry: QueryRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = new QueryRegistry();
  });

  afterEach(() => {
    registry.clear();
  });

  describe('register', () => {
    it('should register a new query', () => {
      const queryKey = ['products', 'list'];
      const metadata = registry.register(queryKey);

      expect(metadata).toBeDefined();
      expect(metadata.originalKey).toEqual(queryKey);
      expect(metadata.key).toBe(JSON.stringify(queryKey));
      expect(metadata.requestCount).toBe(1);
      expect(metadata.isActive).toBe(true);
      expect(metadata.registeredAt).toBeGreaterThan(0);
    });

    it('should deduplicate concurrent identical requests', () => {
      const queryKey = ['products', 'list'];

      const metadata1 = registry.register(queryKey);
      const metadata2 = registry.register(queryKey);

      expect(metadata1).toBe(metadata2); // Same object reference
      expect(metadata2.requestCount).toBe(2);
      expect(metadata2.isActive).toBe(true);
    });

    it('should increment request count for duplicate registrations', () => {
      const queryKey = ['orders', { status: 'pending' }];

      registry.register(queryKey);
      registry.register(queryKey);
      const metadata = registry.register(queryKey);

      expect(metadata.requestCount).toBe(3);
    });

    it('should handle complex query keys with objects', () => {
      const queryKey = ['products', { category: 'electronics', page: 1 }];

      const metadata = registry.register(queryKey);

      expect(metadata.key).toBe(JSON.stringify(queryKey));
      expect(registry.has(queryKey)).toBe(true);
    });

    it('should log debug message on registration', () => {
      const queryKey = ['test', 'query'];

      registry.register(queryKey);

      expect(logger.debug).toHaveBeenCalledWith('Query registered', {
        queryKey: JSON.stringify(queryKey),
        component: 'QueryRegistry',
      });
    });

    it('should log debug message on deduplication', () => {
      const queryKey = ['test', 'dedupe'];

      registry.register(queryKey);
      vi.clearAllMocks();
      registry.register(queryKey);

      expect(logger.debug).toHaveBeenCalledWith('Query deduplicated', {
        queryKey: JSON.stringify(queryKey),
        requestCount: 2,
        component: 'QueryRegistry',
      });
    });

    it('should allow re-registration after completion', () => {
      const queryKey = ['products', 'detail', '123'];

      const metadata1 = registry.register(queryKey);
      registry.complete(queryKey);

      const metadata2 = registry.register(queryKey);

      expect(metadata2.requestCount).toBe(1); // Reset to 1
      expect(metadata2.isActive).toBe(true);
      expect(metadata1).not.toBe(metadata2); // Different instances
    });

    it('should update lastRequestedAt on duplicate registration', () => {
      const queryKey = ['test', 'timestamp'];

      const metadata1 = registry.register(queryKey);
      const firstTimestamp = metadata1.lastRequestedAt;

      // Wait a bit
      vi.useFakeTimers();
      vi.advanceTimersByTime(100);

      const metadata2 = registry.register(queryKey);
      const secondTimestamp = metadata2.lastRequestedAt;

      expect(secondTimestamp).toBeGreaterThan(firstTimestamp);

      vi.useRealTimers();
    });
  });

  describe('get', () => {
    it('should return metadata for registered query', () => {
      const queryKey = ['products', 'list'];

      registry.register(queryKey);
      const metadata = registry.get(queryKey);

      expect(metadata).toBeDefined();
      expect(metadata?.originalKey).toEqual(queryKey);
    });

    it('should return undefined for unregistered query', () => {
      const queryKey = ['nonexistent', 'query'];

      const metadata = registry.get(queryKey);

      expect(metadata).toBeUndefined();
    });

    it('should handle identical query keys correctly', () => {
      const queryKey1 = ['products', { id: '1' }];
      const queryKey2 = ['products', { id: '1' }];

      registry.register(queryKey1);
      const metadata = registry.get(queryKey2);

      expect(metadata).toBeDefined();
      expect(metadata?.originalKey).toEqual(queryKey1);
    });
  });

  describe('has', () => {
    it('should return true for active registered query', () => {
      const queryKey = ['products', 'list'];

      registry.register(queryKey);

      expect(registry.has(queryKey)).toBe(true);
    });

    it('should return false for unregistered query', () => {
      const queryKey = ['nonexistent', 'query'];

      expect(registry.has(queryKey)).toBe(false);
    });

    it('should return false for completed query', () => {
      const queryKey = ['products', 'list'];

      registry.register(queryKey);
      registry.complete(queryKey);

      expect(registry.has(queryKey)).toBe(false);
    });

    it('should handle query keys with different structures', () => {
      const queryKey1 = ['products', '1'];
      const queryKey2 = ['products', '2'];

      registry.register(queryKey1);

      expect(registry.has(queryKey1)).toBe(true);
      expect(registry.has(queryKey2)).toBe(false);
    });
  });

  describe('complete', () => {
    it('should mark query as inactive', () => {
      const queryKey = ['products', 'list'];

      registry.register(queryKey);
      registry.complete(queryKey);

      const metadata = registry.get(queryKey);
      expect(metadata?.isActive).toBe(false);
    });

    it('should log completion with metadata', () => {
      const queryKey = ['test', 'completion'];

      registry.register(queryKey);
      vi.clearAllMocks();

      registry.complete(queryKey);

      const logCall = vi.mocked(logger.debug).mock.calls.find(
        call => call[0] === 'Query completed'
      );
      expect(logCall).toBeDefined();
      expect(logCall?.[1]).toMatchObject({
        queryKey: JSON.stringify(queryKey),
        component: 'QueryRegistry',
      });
    });

    it('should include deduplication info in completion log', () => {
      const queryKey = ['test', 'dedupe-complete'];

      registry.register(queryKey);
      registry.register(queryKey); // Deduplicate
      vi.clearAllMocks();

      registry.complete(queryKey);

      const logCall = vi.mocked(logger.debug).mock.calls.find(
        call => call[0] === 'Query completed'
      );
      expect(logCall?.[1]).toMatchObject({
        requestCount: 2,
        wasDeduplicated: true,
      });
    });

    it('should not error when completing unregistered query', () => {
      const queryKey = ['nonexistent', 'query'];

      expect(() => registry.complete(queryKey)).not.toThrow();
    });

    it('should decrement active queries count', () => {
      const queryKey = ['products', 'list'];

      registry.register(queryKey);
      const statsBefore = registry.getStats();

      registry.complete(queryKey);
      const statsAfter = registry.getStats();

      expect(statsAfter.activeQueries).toBe(statsBefore.activeQueries - 1);
    });
  });

  describe('remove', () => {
    it('should remove query from registry', () => {
      const queryKey = ['products', 'list'];

      registry.register(queryKey);
      const removed = registry.remove(queryKey);

      expect(removed).toBe(true);
      expect(registry.has(queryKey)).toBe(false);
      expect(registry.get(queryKey)).toBeUndefined();
    });

    it('should return false when removing non-existent query', () => {
      const queryKey = ['nonexistent', 'query'];

      const removed = registry.remove(queryKey);

      expect(removed).toBe(false);
    });

    it('should decrement active queries count if query was active', () => {
      const queryKey = ['products', 'list'];

      registry.register(queryKey);
      const statsBefore = registry.getStats();

      registry.remove(queryKey);
      const statsAfter = registry.getStats();

      expect(statsAfter.activeQueries).toBe(statsBefore.activeQueries - 1);
    });

    it('should not affect other queries', () => {
      const queryKey1 = ['products', 'list'];
      const queryKey2 = ['orders', 'list'];

      registry.register(queryKey1);
      registry.register(queryKey2);

      registry.remove(queryKey1);

      expect(registry.has(queryKey1)).toBe(false);
      expect(registry.has(queryKey2)).toBe(true);
    });
  });

  describe('clear', () => {
    it('should remove all queries from registry', () => {
      registry.register(['products', 'list']);
      registry.register(['orders', 'list']);
      registry.register(['customers', 'list']);

      registry.clear();

      expect(registry.getStats().registrySize).toBe(0);
      expect(registry.getStats().activeQueries).toBe(0);
    });

    it('should log clear operation', () => {
      registry.register(['test', '1']);
      registry.register(['test', '2']);
      vi.clearAllMocks();

      registry.clear();

      expect(logger.debug).toHaveBeenCalledWith('Registry cleared', {
        clearedCount: 2,
        component: 'QueryRegistry',
      });
    });
  });

  describe('getStats', () => {
    it('should return accurate statistics', () => {
      registry.register(['query', '1']);
      registry.register(['query', '2']);
      registry.register(['query', '1']); // Deduplicate

      const stats = registry.getStats();

      expect(stats.totalRegistrations).toBe(2);
      expect(stats.totalDeduplications).toBe(1);
      expect(stats.activeQueries).toBe(2);
      expect(stats.registrySize).toBe(2);
    });

    it('should calculate deduplication rate', () => {
      registry.register(['query', '1']);
      registry.register(['query', '1']); // Deduplicate
      registry.register(['query', '2']);

      const stats = registry.getStats();

      // 2 registrations (query 1 and query 2), 1 deduplication = 50%
      expect(stats.deduplicationRate).toBe('50.00%');
    });

    it('should handle zero registrations gracefully', () => {
      const stats = registry.getStats();

      expect(stats.totalRegistrations).toBe(0);
      expect(stats.totalDeduplications).toBe(0);
      expect(stats.deduplicationRate).toBe('0%');
    });
  });

  describe('getActiveQueries', () => {
    it('should return only active queries', () => {
      registry.register(['active', '1']);
      registry.register(['active', '2']);
      registry.register(['inactive', '1']);

      registry.complete(['inactive', '1']);

      const activeQueries = registry.getActiveQueries();

      expect(activeQueries).toHaveLength(2);
      expect(activeQueries.every(q => q.isActive)).toBe(true);
    });

    it('should return empty array when no active queries', () => {
      const activeQueries = registry.getActiveQueries();

      expect(activeQueries).toEqual([]);
    });
  });

  describe('getActiveQueryCount', () => {
    it('should return the count of active queries', () => {
      registry.register(['active', '1']);
      registry.register(['active', '2']);
      registry.register(['active', '3']);

      const count = registry.getActiveQueryCount();

      expect(count).toBe(3);
    });

    it('should return 0 when no active queries', () => {
      const count = registry.getActiveQueryCount();

      expect(count).toBe(0);
    });

    it('should not count completed queries', () => {
      registry.register(['active', '1']);
      registry.register(['active', '2']);
      registry.register(['completed', '1']);

      registry.complete(['completed', '1']);

      const count = registry.getActiveQueryCount();

      expect(count).toBe(2);
    });

    it('should decrement count when queries are completed', () => {
      registry.register(['query', '1']);
      registry.register(['query', '2']);

      expect(registry.getActiveQueryCount()).toBe(2);

      registry.complete(['query', '1']);

      expect(registry.getActiveQueryCount()).toBe(1);

      registry.complete(['query', '2']);

      expect(registry.getActiveQueryCount()).toBe(0);
    });

    it('should not count duplicate registrations as separate active queries', () => {
      const queryKey = ['duplicate', 'test'];

      registry.register(queryKey);
      registry.register(queryKey);
      registry.register(queryKey);

      const count = registry.getActiveQueryCount();

      expect(count).toBe(1);
    });

    it('should increment when new query registered after completion', () => {
      const queryKey = ['reregistered', 'query'];

      registry.register(queryKey);
      expect(registry.getActiveQueryCount()).toBe(1);

      registry.complete(queryKey);
      expect(registry.getActiveQueryCount()).toBe(0);

      registry.register(queryKey);
      expect(registry.getActiveQueryCount()).toBe(1);
    });
  });

  describe('getAllQueries', () => {
    it('should return all queries regardless of status', () => {
      registry.register(['active', '1']);
      registry.register(['inactive', '1']);

      registry.complete(['inactive', '1']);

      const allQueries = registry.getAllQueries();

      expect(allQueries).toHaveLength(2);
    });
  });

  describe('cleanup', () => {
    it('should remove old inactive queries', () => {
      vi.useFakeTimers();

      const queryKey1 = ['old', 'query'];
      const queryKey2 = ['new', 'query'];

      registry.register(queryKey1);
      registry.complete(queryKey1);

      vi.advanceTimersByTime(6 * 60 * 1000); // 6 minutes

      registry.register(queryKey2);
      registry.complete(queryKey2);

      const cleaned = registry.cleanup(5 * 60 * 1000); // 5 minute threshold

      expect(cleaned).toBe(1);
      expect(registry.get(queryKey1)).toBeUndefined();
      expect(registry.get(queryKey2)).toBeDefined();

      vi.useRealTimers();
    });

    it('should not remove active queries', () => {
      vi.useFakeTimers();

      const queryKey = ['active', 'query'];

      registry.register(queryKey);

      vi.advanceTimersByTime(10 * 60 * 1000); // 10 minutes

      const cleaned = registry.cleanup(5 * 60 * 1000);

      expect(cleaned).toBe(0);
      expect(registry.has(queryKey)).toBe(true);

      vi.useRealTimers();
    });

    it('should log cleanup results when queries cleaned', () => {
      vi.useFakeTimers();

      registry.register(['old', '1']);
      registry.complete(['old', '1']);

      vi.advanceTimersByTime(6 * 60 * 1000);
      vi.clearAllMocks();

      registry.cleanup(5 * 60 * 1000);

      expect(logger.debug).toHaveBeenCalledWith('Registry cleanup completed', {
        cleanedCount: 1,
        remainingSize: 0,
        component: 'QueryRegistry',
      });

      vi.useRealTimers();
    });

    it('should not log when no queries cleaned', () => {
      vi.clearAllMocks();

      registry.cleanup();

      expect(logger.debug).not.toHaveBeenCalled();
    });

    it('should use default maxAge when not specified', () => {
      vi.useFakeTimers();

      registry.register(['old', '1']);
      registry.complete(['old', '1']);

      vi.advanceTimersByTime(4 * 60 * 1000); // 4 minutes

      const cleaned = registry.cleanup(); // Default 5 minutes

      expect(cleaned).toBe(0); // Not old enough

      vi.useRealTimers();
    });
  });

  describe('singleton instance', () => {
    it('should export a singleton queryRegistry instance', () => {
      expect(queryRegistry).toBeInstanceOf(QueryRegistry);
    });

    it('should maintain state across imports', () => {
      const testKey = ['singleton', 'test'];

      queryRegistry.register(testKey);

      expect(queryRegistry.has(testKey)).toBe(true);

      // Clean up
      queryRegistry.remove(testKey);
    });
  });

  describe('concurrent operations', () => {
    it('should handle rapid concurrent registrations', () => {
      const queryKey = ['concurrent', 'test'];

      // Simulate 10 concurrent requests
      for (let i = 0; i < 10; i++) {
        registry.register(queryKey);
      }

      const metadata = registry.get(queryKey);
      expect(metadata?.requestCount).toBe(10);
      expect(registry.getStats().totalDeduplications).toBe(9);
    });

    it('should handle mixed operations correctly', () => {
      const queryKey = ['mixed', 'test'];

      registry.register(queryKey);
      registry.register(queryKey);
      registry.complete(queryKey);
      registry.register(queryKey);

      const metadata = registry.get(queryKey);
      expect(metadata?.isActive).toBe(true);
      expect(metadata?.requestCount).toBe(1); // New registration after completion
    });
  });

  describe('memory management', () => {
    it('should not leak memory with many registrations', () => {
      const initialSize = registry.getStats().registrySize;

      // Register and complete many queries
      for (let i = 0; i < 1000; i++) {
        const queryKey = ['test', i.toString()];
        registry.register(queryKey);
        registry.complete(queryKey);
      }

      const afterSize = registry.getStats().registrySize;
      expect(afterSize).toBe(initialSize + 1000);

      // Cleanup should reduce size
      vi.useFakeTimers();
      vi.advanceTimersByTime(6 * 60 * 1000);
      const cleaned = registry.cleanup();

      expect(cleaned).toBe(1000);
      expect(registry.getStats().registrySize).toBe(initialSize);

      vi.useRealTimers();
    });
  });

  describe('edge cases', () => {
    it('should handle empty query key array', () => {
      const queryKey: readonly unknown[] = [];

      const metadata = registry.register(queryKey);

      expect(metadata).toBeDefined();
      expect(metadata.key).toBe('[]');
    });

    it('should handle query keys with null/undefined values', () => {
      const queryKey = ['test', null, undefined];

      const metadata = registry.register(queryKey);

      expect(metadata).toBeDefined();
      expect(registry.has(queryKey)).toBe(true);
    });

    it('should distinguish between similar but different query keys', () => {
      const queryKey1 = ['products', { id: '1' }];
      const queryKey2 = ['products', { id: '2' }];

      registry.register(queryKey1);
      registry.register(queryKey2);

      expect(registry.get(queryKey1)).not.toBe(registry.get(queryKey2));
    });

    it('should handle deeply nested query keys', () => {
      const queryKey = ['test', { nested: { deep: { value: [1, 2, 3] } } }];

      const metadata = registry.register(queryKey);

      expect(metadata).toBeDefined();
      expect(registry.has(queryKey)).toBe(true);
    });
  });

  describe('TTL and Promise Tracking', () => {
    afterEach(() => {
      registry.stopAutoCleanup();
    });

    describe('register with promise', () => {
      it('should track promise when provided during registration', () => {
        const queryKey = ['test', 'promise'];
        const promise = Promise.resolve({ data: 'test' });

        const metadata = registry.register(queryKey, promise);

        expect(metadata.promise).toBe(promise);
        expect(metadata.promiseUpdatedAt).toBeGreaterThan(0);
      });

      it('should update promise on duplicate registration', () => {
        vi.useFakeTimers();

        const queryKey = ['test', 'promise-update'];
        const promise1 = Promise.resolve({ data: 'test1' });
        const promise2 = Promise.resolve({ data: 'test2' });

        const metadata1 = registry.register(queryKey, promise1);
        expect(metadata1.promise).toBe(promise1);
        const firstTimestamp = metadata1.promiseUpdatedAt || 0;

        vi.advanceTimersByTime(100);

        const metadata2 = registry.register(queryKey, promise2);
        expect(metadata2.promise).toBe(promise2);
        expect(metadata2.promiseUpdatedAt).toBeGreaterThan(firstTimestamp);

        vi.useRealTimers();
      });

      it('should allow registration without promise', () => {
        const queryKey = ['test', 'no-promise'];

        const metadata = registry.register(queryKey);

        expect(metadata.promise).toBeUndefined();
        expect(metadata.promiseUpdatedAt).toBeUndefined();
      });
    });

    describe('cleanupStalePromises', () => {
      it('should remove stale promises older than TTL', () => {
        vi.useFakeTimers();

        const queryKey = ['test', 'stale'];
        const promise = Promise.resolve({ data: 'test' });

        registry.register(queryKey, promise);

        // Advance time beyond TTL (default 5 minutes)
        vi.advanceTimersByTime(6 * 60 * 1000);

        const cleaned = registry.cleanupStalePromises();

        expect(cleaned).toBe(1);

        const metadata = registry.get(queryKey);
        expect(metadata?.promise).toBeUndefined();
        expect(metadata?.promiseUpdatedAt).toBeUndefined();

        vi.useRealTimers();
      });

      it('should not remove fresh promises', () => {
        vi.useFakeTimers();

        const queryKey = ['test', 'fresh'];
        const promise = Promise.resolve({ data: 'test' });

        registry.register(queryKey, promise);

        // Advance time but not beyond TTL
        vi.advanceTimersByTime(2 * 60 * 1000);

        const cleaned = registry.cleanupStalePromises();

        expect(cleaned).toBe(0);

        const metadata = registry.get(queryKey);
        expect(metadata?.promise).toBe(promise);

        vi.useRealTimers();
      });

      it('should use custom maxAge when provided', () => {
        vi.useFakeTimers();

        const queryKey = ['test', 'custom-ttl'];
        const promise = Promise.resolve({ data: 'test' });

        registry.register(queryKey, promise);

        // Advance time to 2 minutes
        vi.advanceTimersByTime(2 * 60 * 1000);

        // Clean with 1 minute TTL
        const cleaned = registry.cleanupStalePromises(1 * 60 * 1000);

        expect(cleaned).toBe(1);

        vi.useRealTimers();
      });

      it('should keep metadata when cleaning stale promises', () => {
        vi.useFakeTimers();

        const queryKey = ['test', 'keep-metadata'];
        const promise = Promise.resolve({ data: 'test' });

        registry.register(queryKey, promise);

        vi.advanceTimersByTime(6 * 60 * 1000);

        registry.cleanupStalePromises();

        const metadata = registry.get(queryKey);
        expect(metadata).toBeDefined();
        expect(metadata?.key).toBe(JSON.stringify(queryKey));
        expect(metadata?.isActive).toBe(true);

        vi.useRealTimers();
      });

      it('should update stats when cleaning stale promises', () => {
        vi.useFakeTimers();

        const queryKey = ['test', 'stats'];
        const promise = Promise.resolve({ data: 'test' });

        registry.register(queryKey, promise);

        vi.advanceTimersByTime(6 * 60 * 1000);

        const statsBefore = registry.getStats();
        registry.cleanupStalePromises();
        const statsAfter = registry.getStats();

        expect(statsAfter.stalePromisesCleaned).toBe(statsBefore.stalePromisesCleaned + 1);

        vi.useRealTimers();
      });

      it('should log when stale promises are cleaned', () => {
        vi.useFakeTimers();

        const queryKey = ['test', 'logging'];
        const promise = Promise.resolve({ data: 'test' });

        registry.register(queryKey, promise);
        vi.clearAllMocks();

        vi.advanceTimersByTime(6 * 60 * 1000);

        registry.cleanupStalePromises();

        const logCalls = vi.mocked(logger.debug).mock.calls;
        const cleanupLog = logCalls.find(call => call[0] === 'Stale promise cleanup completed');

        expect(cleanupLog).toBeDefined();
        expect(cleanupLog?.[1]).toMatchObject({
          cleanedCount: 1,
          component: 'QueryRegistry',
        });

        vi.useRealTimers();
      });
    });

    describe('getStalePromises', () => {
      it('should return all stale promises', () => {
        vi.useFakeTimers();

        const queryKey1 = ['test', 'stale1'];
        const queryKey2 = ['test', 'stale2'];
        const queryKey3 = ['test', 'fresh'];

        registry.register(queryKey1, Promise.resolve({}));
        registry.register(queryKey2, Promise.resolve({}));

        vi.advanceTimersByTime(6 * 60 * 1000);

        registry.register(queryKey3, Promise.resolve({}));

        const stale = registry.getStalePromises();

        expect(stale).toHaveLength(2);
        expect(stale.map(m => m.key)).toContain(JSON.stringify(queryKey1));
        expect(stale.map(m => m.key)).toContain(JSON.stringify(queryKey2));

        vi.useRealTimers();
      });

      it('should return empty array when no stale promises', () => {
        const queryKey = ['test', 'fresh'];
        registry.register(queryKey, Promise.resolve({}));

        const stale = registry.getStalePromises();

        expect(stale).toEqual([]);
      });

      it('should use custom maxAge when provided', () => {
        vi.useFakeTimers();

        const queryKey = ['test', 'custom'];
        registry.register(queryKey, Promise.resolve({}));

        vi.advanceTimersByTime(2 * 60 * 1000);

        const staleDefault = registry.getStalePromises();
        expect(staleDefault).toHaveLength(0);

        const staleCustom = registry.getStalePromises(1 * 60 * 1000);
        expect(staleCustom).toHaveLength(1);

        vi.useRealTimers();
      });
    });

    describe('startAutoCleanup and stopAutoCleanup', () => {
      it('should start automatic cleanup', () => {
        registry.startAutoCleanup();

        const stats = registry.getStats();
        expect(stats.autoCleanupActive).toBe(true);
      });

      it('should stop automatic cleanup', () => {
        registry.startAutoCleanup();
        registry.stopAutoCleanup();

        const stats = registry.getStats();
        expect(stats.autoCleanupActive).toBe(false);
      });

      it('should run cleanup at regular intervals', () => {
        vi.useFakeTimers();

        registry.configureTTL({ ttlCheckInterval: 1000 }); // 1 second for testing
        registry.startAutoCleanup();

        const statsBefore = registry.getStats();

        // Advance time to trigger cleanup
        vi.advanceTimersByTime(1000);

        const statsAfter = registry.getStats();
        expect(statsAfter.cleanupRunCount).toBeGreaterThan(statsBefore.cleanupRunCount);

        vi.useRealTimers();
      });

      it('should clean up both inactive queries and stale promises', () => {
        vi.useFakeTimers();

        const queryKey1 = ['test', 'inactive'];
        const queryKey2 = ['test', 'stale-promise'];

        // Register and complete an inactive query
        registry.register(queryKey1);
        registry.complete(queryKey1);

        // Register with stale promise
        registry.register(queryKey2, Promise.resolve({}));

        // Advance time beyond TTL
        vi.advanceTimersByTime(6 * 60 * 1000);

        registry.configureTTL({ ttlCheckInterval: 1000 });
        registry.startAutoCleanup();

        vi.clearAllMocks();

        // Trigger cleanup
        vi.advanceTimersByTime(1000);

        // Should have cleaned both inactive query and stale promise
        const logCalls = vi.mocked(logger.debug).mock.calls;
        const autoCleanupLog = logCalls.find(call => call[0] === 'Auto cleanup completed');

        expect(autoCleanupLog).toBeDefined();

        vi.useRealTimers();
      });

      it('should stop old timer when starting new one', () => {
        registry.startAutoCleanup();
        const firstStart = registry.getStats().autoCleanupActive;

        registry.startAutoCleanup(); // Start again
        const secondStart = registry.getStats().autoCleanupActive;

        expect(firstStart).toBe(true);
        expect(secondStart).toBe(true);

        // Should still be running with only one timer
        registry.stopAutoCleanup();
        expect(registry.getStats().autoCleanupActive).toBe(false);
      });

      it('should log when auto cleanup starts and stops', () => {
        vi.clearAllMocks();

        registry.startAutoCleanup();

        expect(logger.debug).toHaveBeenCalledWith('Auto cleanup started', expect.objectContaining({
          component: 'QueryRegistry',
        }));

        vi.clearAllMocks();

        registry.stopAutoCleanup();

        expect(logger.debug).toHaveBeenCalledWith('Auto cleanup stopped', {
          component: 'QueryRegistry',
        });
      });
    });

    describe('configureTTL', () => {
      it('should update maxAge configuration', () => {
        const customMaxAge = 10 * 60 * 1000; // 10 minutes

        registry.configureTTL({ maxAge: customMaxAge });

        vi.useFakeTimers();

        const queryKey = ['test', 'custom-age'];
        registry.register(queryKey, Promise.resolve({}));

        // Advance 6 minutes (should not clean with 10 min TTL)
        vi.advanceTimersByTime(6 * 60 * 1000);

        const cleaned = registry.cleanupStalePromises();
        expect(cleaned).toBe(0);

        // Advance to 11 minutes (should clean now)
        vi.advanceTimersByTime(5 * 60 * 1000);

        const cleaned2 = registry.cleanupStalePromises();
        expect(cleaned2).toBe(1);

        vi.useRealTimers();
      });

      it('should update ttlCheckInterval configuration', () => {
        vi.useFakeTimers();

        const customInterval = 500; // 500ms

        registry.configureTTL({ ttlCheckInterval: customInterval });
        registry.startAutoCleanup();

        const statsBefore = registry.getStats();

        vi.advanceTimersByTime(500);

        const statsAfter = registry.getStats();
        expect(statsAfter.cleanupRunCount).toBeGreaterThan(statsBefore.cleanupRunCount);

        vi.useRealTimers();
      });

      it('should restart auto cleanup with new settings if running', () => {
        registry.startAutoCleanup();
        vi.clearAllMocks();

        registry.configureTTL({ maxAge: 10 * 60 * 1000 });

        // Should restart auto cleanup (stop old, start new)
        const logCalls = vi.mocked(logger.debug).mock.calls;
        expect(logCalls.some(call => call[0] === 'Auto cleanup stopped')).toBe(true);
        expect(logCalls.some(call => call[0] === 'Auto cleanup started')).toBe(true);
      });

      it('should log TTL configuration changes', () => {
        vi.clearAllMocks();

        registry.configureTTL({
          maxAge: 8 * 60 * 1000,
          ttlCheckInterval: 2 * 60 * 1000,
        });

        expect(logger.debug).toHaveBeenCalledWith('TTL configuration updated', expect.objectContaining({
          component: 'QueryRegistry',
        }));
      });
    });

    describe('clear with TTL cleanup', () => {
      it('should stop auto cleanup when clearing registry', () => {
        registry.startAutoCleanup();
        expect(registry.getStats().autoCleanupActive).toBe(true);

        registry.clear();

        expect(registry.getStats().autoCleanupActive).toBe(false);
      });
    });

    describe('stats with TTL metrics', () => {
      it('should include activePromises count in stats', () => {
        registry.register(['test', '1'], Promise.resolve({}));
        registry.register(['test', '2'], Promise.resolve({}));
        registry.register(['test', '3']); // No promise

        const stats = registry.getStats();

        expect(stats.activePromises).toBe(2);
      });

      it('should calculate average promise age', () => {
        vi.useFakeTimers();

        registry.register(['test', '1'], Promise.resolve({}));

        vi.advanceTimersByTime(1000);

        registry.register(['test', '2'], Promise.resolve({}));

        const stats = registry.getStats();

        expect(stats.avgPromiseAge).toMatch(/\d+ms/);
        expect(parseInt(stats.avgPromiseAge)).toBeGreaterThan(0);

        vi.useRealTimers();
      });

      it('should show 0ms average when no active promises', () => {
        const stats = registry.getStats();

        expect(stats.avgPromiseAge).toBe('0ms');
      });

      it('should include stalePromisesCleaned in stats', () => {
        vi.useFakeTimers();

        registry.register(['test', '1'], Promise.resolve({}));
        registry.register(['test', '2'], Promise.resolve({}));

        vi.advanceTimersByTime(6 * 60 * 1000);

        registry.cleanupStalePromises();

        const stats = registry.getStats();

        expect(stats.stalePromisesCleaned).toBe(2);

        vi.useRealTimers();
      });

      it('should include cleanupRunCount in stats', () => {
        vi.useFakeTimers();

        registry.configureTTL({ ttlCheckInterval: 1000 });
        registry.startAutoCleanup();

        vi.advanceTimersByTime(3000); // 3 cleanup runs

        const stats = registry.getStats();

        expect(stats.cleanupRunCount).toBeGreaterThanOrEqual(3);

        vi.useRealTimers();
      });

      it('should show autoCleanupActive status', () => {
        let stats = registry.getStats();
        expect(stats.autoCleanupActive).toBe(false);

        registry.startAutoCleanup();
        stats = registry.getStats();
        expect(stats.autoCleanupActive).toBe(true);

        registry.stopAutoCleanup();
        stats = registry.getStats();
        expect(stats.autoCleanupActive).toBe(false);
      });
    });
  });
});

describe('getActiveQueryCount standalone function', () => {
  beforeEach(() => {
    queryRegistry.clear();
  });

  afterEach(() => {
    queryRegistry.clear();
  });

  it('should return the count of active queries from singleton', () => {
    queryRegistry.register(['test', '1']);
    queryRegistry.register(['test', '2']);

    const count = getActiveQueryCount();

    expect(count).toBe(2);
  });

  it('should return 0 when singleton has no active queries', () => {
    const count = getActiveQueryCount();

    expect(count).toBe(0);
  });

  it('should reflect changes in singleton state', () => {
    queryRegistry.register(['dynamic', '1']);
    expect(getActiveQueryCount()).toBe(1);

    queryRegistry.register(['dynamic', '2']);
    expect(getActiveQueryCount()).toBe(2);

    queryRegistry.complete(['dynamic', '1']);
    expect(getActiveQueryCount()).toBe(1);

    queryRegistry.clear();
    expect(getActiveQueryCount()).toBe(0);
  });

  it('should be useful for debugging (AdminDebugPanel use case)', () => {
    // Simulate scenario where AdminDebugPanel would use this
    queryRegistry.register(['products', 'list']);
    queryRegistry.register(['orders', { status: 'pending' }]);
    queryRegistry.register(['customers', 'search', { query: 'test' }]);

    const activeCount = getActiveQueryCount();

    // AdminDebugPanel can display this count
    expect(activeCount).toBe(3);
    expect(typeof activeCount).toBe('number');
  });
});
