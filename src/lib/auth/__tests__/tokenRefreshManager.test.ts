/**
 * TokenRefreshManager Tests
 *
 * Tests for the singleton TokenRefreshManager that prevents race conditions
 * during token refresh operations.
 *
 * Verifies:
 * 1. Deduplication of concurrent refresh calls (same scope)
 * 2. Independent refresh across different scopes
 * 3. Minimum interval enforcement between refreshes
 * 4. Error handling and propagation
 * 5. Reset functionality (per-scope and global)
 * 6. isRefreshing status tracking
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tokenRefreshManager } from '@/lib/auth/tokenRefreshManager';
import type { TokenRefreshResult } from '@/lib/auth/tokenRefreshManager';

// Mock the logger
vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('TokenRefreshManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tokenRefreshManager.resetAll();
  });

  afterEach(() => {
    tokenRefreshManager.resetAll();
  });

  describe('Deduplication', () => {
    it('should deduplicate concurrent refresh calls for the same scope', async () => {
      const executor = vi.fn(async (): Promise<TokenRefreshResult> => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return { success: true, accessToken: 'new-at', refreshToken: 'new-rt' };
      });

      // Fire three concurrent refresh calls
      const [result1, result2, result3] = await Promise.all([
        tokenRefreshManager.refresh('tenant-admin', executor),
        tokenRefreshManager.refresh('tenant-admin', executor),
        tokenRefreshManager.refresh('tenant-admin', executor),
      ]);

      // All should return the same result
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result3.success).toBe(true);

      // But executor should only be called once
      expect(executor).toHaveBeenCalledTimes(1);
    });

    it('should allow new refresh after previous completes', async () => {
      let callCount = 0;
      const executor = vi.fn(async (): Promise<TokenRefreshResult> => {
        callCount++;
        return { success: true, accessToken: `at-${callCount}` };
      });

      // First refresh
      const result1 = await tokenRefreshManager.refresh('tenant-admin', executor);
      expect(result1.accessToken).toBe('at-1');

      // Wait past the minimum interval (5 seconds)
      vi.useFakeTimers();
      vi.advanceTimersByTime(6000);
      vi.useRealTimers();

      // Reset the manager to clear the lastRefreshTime for testing
      tokenRefreshManager.reset('tenant-admin');

      // Second refresh should call executor again
      const result2 = await tokenRefreshManager.refresh('tenant-admin', executor);
      expect(result2.accessToken).toBe('at-2');

      expect(executor).toHaveBeenCalledTimes(2);
    });
  });

  describe('Scope Isolation', () => {
    it('should handle different scopes independently', async () => {
      const tenantExecutor = vi.fn(async (): Promise<TokenRefreshResult> => {
        return { success: true, accessToken: 'tenant-at' };
      });

      const customerExecutor = vi.fn(async (): Promise<TokenRefreshResult> => {
        return { success: true, accessToken: 'customer-at' };
      });

      const [tenantResult, customerResult] = await Promise.all([
        tokenRefreshManager.refresh('tenant-admin', tenantExecutor),
        tokenRefreshManager.refresh('customer', customerExecutor),
      ]);

      expect(tenantResult.accessToken).toBe('tenant-at');
      expect(customerResult.accessToken).toBe('customer-at');

      // Both executors called independently
      expect(tenantExecutor).toHaveBeenCalledTimes(1);
      expect(customerExecutor).toHaveBeenCalledTimes(1);
    });
  });

  describe('Minimum Interval Enforcement', () => {
    it('should skip refresh if called too soon after previous refresh', async () => {
      const executor = vi.fn(async (): Promise<TokenRefreshResult> => {
        return { success: true, accessToken: 'at' };
      });

      // First refresh - should execute
      const result1 = await tokenRefreshManager.refresh('tenant-admin', executor);
      expect(result1.success).toBe(true);
      expect(executor).toHaveBeenCalledTimes(1);

      // Second refresh immediately - should be skipped (within 5s interval)
      const result2 = await tokenRefreshManager.refresh('tenant-admin', executor);
      expect(result2.success).toBe(true); // Returns { success: true } as a skip

      // Executor should NOT have been called again
      expect(executor).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    it('should propagate executor failure result', async () => {
      const executor = vi.fn(async (): Promise<TokenRefreshResult> => {
        return { success: false, error: 'Token expired' };
      });

      const result = await tokenRefreshManager.refresh('tenant-admin', executor);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Token expired');
    });

    it('should catch executor exceptions and return failure', async () => {
      const executor = vi.fn(async (): Promise<TokenRefreshResult> => {
        throw new Error('Network error');
      });

      const result = await tokenRefreshManager.refresh('tenant-admin', executor);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should clear in-progress state after executor throws', async () => {
      const executor = vi.fn(async (): Promise<TokenRefreshResult> => {
        throw new Error('Failed');
      });

      await tokenRefreshManager.refresh('tenant-admin', executor);

      // Should not be refreshing after error
      expect(tokenRefreshManager.isRefreshing('tenant-admin')).toBe(false);
    });
  });

  describe('isRefreshing', () => {
    it('should return false when no refresh is in progress', () => {
      expect(tokenRefreshManager.isRefreshing('tenant-admin')).toBe(false);
    });

    it('should return true during refresh', async () => {
      let resolveRefresh: (() => void) | undefined;
      const executor = vi.fn(
        () =>
          new Promise<TokenRefreshResult>(resolve => {
            resolveRefresh = () => resolve({ success: true });
          })
      );

      // Start refresh but don't await
      const refreshPromise = tokenRefreshManager.refresh('tenant-admin', executor);

      // Should be refreshing now
      expect(tokenRefreshManager.isRefreshing('tenant-admin')).toBe(true);

      // Complete the refresh
      resolveRefresh!();
      await refreshPromise;

      // Should no longer be refreshing
      expect(tokenRefreshManager.isRefreshing('tenant-admin')).toBe(false);
    });
  });

  describe('Reset', () => {
    it('should clear state for a specific scope', async () => {
      const executor = vi.fn(async (): Promise<TokenRefreshResult> => {
        return { success: true };
      });

      // Do a refresh
      await tokenRefreshManager.refresh('tenant-admin', executor);

      // Reset the scope
      tokenRefreshManager.reset('tenant-admin');

      // Should be able to refresh immediately (no min interval blocking)
      const result = await tokenRefreshManager.refresh('tenant-admin', executor);
      expect(result.success).toBe(true);
      expect(executor).toHaveBeenCalledTimes(2);
    });

    it('should not affect other scopes', async () => {
      const executor = vi.fn(async (): Promise<TokenRefreshResult> => {
        return { success: true };
      });

      await tokenRefreshManager.refresh('tenant-admin', executor);
      await tokenRefreshManager.refresh('customer', executor);

      // Reset only tenant-admin
      tokenRefreshManager.reset('tenant-admin');

      // tenant-admin should allow immediate refresh
      await tokenRefreshManager.refresh('tenant-admin', executor);
      expect(executor).toHaveBeenCalledTimes(3);

      // customer should still be rate-limited
      await tokenRefreshManager.refresh('customer', executor);
      // Should still be 3 calls (customer was skipped due to min interval)
      expect(executor).toHaveBeenCalledTimes(3);
    });

    it('resetAll should clear all scopes', async () => {
      const executor = vi.fn(async (): Promise<TokenRefreshResult> => {
        return { success: true };
      });

      await tokenRefreshManager.refresh('tenant-admin', executor);
      await tokenRefreshManager.refresh('customer', executor);

      tokenRefreshManager.resetAll();

      // Both scopes should allow immediate refresh
      await tokenRefreshManager.refresh('tenant-admin', executor);
      await tokenRefreshManager.refresh('customer', executor);

      expect(executor).toHaveBeenCalledTimes(4);
    });
  });

  describe('TokenRefreshResult interface', () => {
    it('should return accessToken and refreshToken on success', async () => {
      const executor = vi.fn(async (): Promise<TokenRefreshResult> => {
        return {
          success: true,
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
        };
      });

      const result = await tokenRefreshManager.refresh('test', executor);

      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBe('new-refresh-token');
      expect(result.error).toBeUndefined();
    });

    it('should return error message on failure', async () => {
      const executor = vi.fn(async (): Promise<TokenRefreshResult> => {
        return {
          success: false,
          error: 'Invalid refresh token',
        };
      });

      const result = await tokenRefreshManager.refresh('test', executor);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid refresh token');
      expect(result.accessToken).toBeUndefined();
    });
  });
});
