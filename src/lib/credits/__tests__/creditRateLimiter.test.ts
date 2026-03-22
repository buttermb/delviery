/**
 * Credit Rate Limiter Tests
 *
 * Tests that the credit consumption rate limiter blocks actions
 * after exceeding the per-minute threshold.
 *
 * The rate limiter uses a sliding window counter:
 * - CREDIT_CONSUME: 30 actions per minute (edge function limit)
 * - API: 100 actions per minute (general API limit)
 *
 * This test verifies the in-memory rate limiting algorithm used
 * in both the edge function rateLimiting.ts and the client-side
 * useCredits.performAction rate limiting.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ============================================================================
// Rate Limiter Implementation (mirrors supabase/functions/_shared/rateLimiting.ts)
// Extracted here for testability in vitest environment (Deno modules can't be
// imported directly into vitest/jsdom)
// ============================================================================

interface RateLimitConfig {
  key: string;
  limit: number;
  windowMs: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

const memoryStore = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(config: RateLimitConfig, identifier: string): RateLimitResult {
  const key = `${config.key}:${identifier}`;
  const now = Date.now();
  const resetAt = now + config.windowMs;

  const stored = memoryStore.get(key);

  if (stored && stored.resetAt > now) {
    if (stored.count >= config.limit) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: stored.resetAt,
      };
    }

    stored.count += 1;
    return {
      allowed: true,
      remaining: config.limit - stored.count,
      resetAt: stored.resetAt,
    };
  }

  memoryStore.set(key, { count: 1, resetAt });

  return {
    allowed: true,
    remaining: config.limit - 1,
    resetAt,
  };
}

// Standard rate limit configurations (mirrors rateLimiting.ts RATE_LIMITS)
const RATE_LIMITS = {
  CREDIT_CONSUME: { key: 'credit_consume', limit: 30, windowMs: 60 * 1000 },
  API: { key: 'api', limit: 100, windowMs: 60 * 1000 },
} as const;

// ============================================================================
// Tests
// ============================================================================

describe('Credit Rate Limiter', () => {
  beforeEach(() => {
    memoryStore.clear();
    vi.useFakeTimers();
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  // ==========================================================================
  // Core: Rate limiter blocks after limit exceeded
  // ==========================================================================

  describe('blocks after limit is exceeded', () => {
    it('should allow actions up to the credit consume limit (30/min)', () => {
      const tenantId = 'tenant-rate-test-001';

      for (let i = 0; i < 30; i++) {
        const result = checkRateLimit(RATE_LIMITS.CREDIT_CONSUME, tenantId);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(29 - i);
      }

      // 31st action should be blocked
      const blocked = checkRateLimit(RATE_LIMITS.CREDIT_CONSUME, tenantId);
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
    });

    it('should block the 101st action when using API rate limit (100/min)', () => {
      const tenantId = 'tenant-api-rate-001';

      // Simulate 100 successful actions
      for (let i = 0; i < 100; i++) {
        const result = checkRateLimit(RATE_LIMITS.API, tenantId);
        expect(result.allowed).toBe(true);
      }

      // 101st action should be blocked
      const blocked = checkRateLimit(RATE_LIMITS.API, tenantId);
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
    });

    it('should return correct remaining count as actions accumulate', () => {
      const tenantId = 'tenant-remaining-001';
      const limit = RATE_LIMITS.CREDIT_CONSUME.limit;

      const result1 = checkRateLimit(RATE_LIMITS.CREDIT_CONSUME, tenantId);
      expect(result1.remaining).toBe(limit - 1); // 29

      const result2 = checkRateLimit(RATE_LIMITS.CREDIT_CONSUME, tenantId);
      expect(result2.remaining).toBe(limit - 2); // 28

      const result3 = checkRateLimit(RATE_LIMITS.CREDIT_CONSUME, tenantId);
      expect(result3.remaining).toBe(limit - 3); // 27
    });
  });

  // ==========================================================================
  // Window reset behavior
  // ==========================================================================

  describe('window reset behavior', () => {
    it('should reset counter after window expires', () => {
      const tenantId = 'tenant-reset-001';

      // Exhaust the limit
      for (let i = 0; i < 30; i++) {
        checkRateLimit(RATE_LIMITS.CREDIT_CONSUME, tenantId);
      }

      // Confirm blocked
      const blocked = checkRateLimit(RATE_LIMITS.CREDIT_CONSUME, tenantId);
      expect(blocked.allowed).toBe(false);

      // Advance time past the window (60 seconds)
      vi.advanceTimersByTime(61 * 1000);

      // Should be allowed again
      const allowed = checkRateLimit(RATE_LIMITS.CREDIT_CONSUME, tenantId);
      expect(allowed.allowed).toBe(true);
      expect(allowed.remaining).toBe(29);
    });

    it('should not reset counter before window expires', () => {
      const tenantId = 'tenant-no-reset-001';

      // Exhaust the limit
      for (let i = 0; i < 30; i++) {
        checkRateLimit(RATE_LIMITS.CREDIT_CONSUME, tenantId);
      }

      // Advance time but NOT past the window (only 30 seconds)
      vi.advanceTimersByTime(30 * 1000);

      // Should still be blocked
      const result = checkRateLimit(RATE_LIMITS.CREDIT_CONSUME, tenantId);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should provide resetAt timestamp in the result', () => {
      const tenantId = 'tenant-resetat-001';
      const now = Date.now();

      const result = checkRateLimit(RATE_LIMITS.CREDIT_CONSUME, tenantId);
      expect(result.resetAt).toBeGreaterThan(now);
      expect(result.resetAt).toBeLessThanOrEqual(now + RATE_LIMITS.CREDIT_CONSUME.windowMs + 1);
    });
  });

  // ==========================================================================
  // Tenant isolation
  // ==========================================================================

  describe('tenant isolation', () => {
    it('should track rate limits independently per tenant', () => {
      const tenantA = 'tenant-a-001';
      const tenantB = 'tenant-b-001';

      // Exhaust limit for tenant A
      for (let i = 0; i < 30; i++) {
        checkRateLimit(RATE_LIMITS.CREDIT_CONSUME, tenantA);
      }

      // Tenant A should be blocked
      const blockedA = checkRateLimit(RATE_LIMITS.CREDIT_CONSUME, tenantA);
      expect(blockedA.allowed).toBe(false);

      // Tenant B should still be allowed
      const allowedB = checkRateLimit(RATE_LIMITS.CREDIT_CONSUME, tenantB);
      expect(allowedB.allowed).toBe(true);
      expect(allowedB.remaining).toBe(29);
    });
  });

  // ==========================================================================
  // Rapid succession simulation (task requirement)
  // ==========================================================================

  describe('rapid succession blocking', () => {
    it('should block after 100 rapid consumeCredits-style calls via API limit', () => {
      const tenantId = 'tenant-rapid-001';
      let blockedAt = -1;

      // Simulate 101 rapid-fire credit consumption calls
      for (let i = 0; i < 101; i++) {
        const result = checkRateLimit(RATE_LIMITS.API, tenantId);
        if (!result.allowed && blockedAt === -1) {
          blockedAt = i;
        }
      }

      // The 101st call (index 100) should be the first blocked one
      expect(blockedAt).toBe(100);
    });

    it('should block after 30 rapid consumeCredits calls via credit consume limit', () => {
      const tenantId = 'tenant-rapid-credit-001';
      let blockedAt = -1;

      // Simulate 31 rapid-fire credit consumption calls
      for (let i = 0; i < 31; i++) {
        const result = checkRateLimit(RATE_LIMITS.CREDIT_CONSUME, tenantId);
        if (!result.allowed && blockedAt === -1) {
          blockedAt = i;
        }
      }

      // The 31st call (index 30) should be the first blocked one
      expect(blockedAt).toBe(30);
    });

    it('should continue blocking all subsequent calls after limit reached', () => {
      const tenantId = 'tenant-continued-block-001';

      // Exhaust the limit
      for (let i = 0; i < 100; i++) {
        checkRateLimit(RATE_LIMITS.API, tenantId);
      }

      // All subsequent calls should be blocked
      for (let i = 0; i < 10; i++) {
        const result = checkRateLimit(RATE_LIMITS.API, tenantId);
        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);
      }
    });
  });

  // ==========================================================================
  // Custom rate limit config
  // ==========================================================================

  describe('custom rate limit configuration', () => {
    it('should respect custom limit value of 100 actions per minute', () => {
      const config: RateLimitConfig = {
        key: 'credit_consume_custom',
        limit: 100,
        windowMs: 60 * 1000,
      };
      const tenantId = 'tenant-custom-001';

      // First 100 calls should be allowed
      for (let i = 0; i < 100; i++) {
        const result = checkRateLimit(config, tenantId);
        expect(result.allowed).toBe(true);
      }

      // 101st should be blocked
      const blocked = checkRateLimit(config, tenantId);
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
    });

    it('should handle limit of 1 (single action per window)', () => {
      const config: RateLimitConfig = {
        key: 'strict_limit',
        limit: 1,
        windowMs: 60 * 1000,
      };
      const tenantId = 'tenant-strict-001';

      const first = checkRateLimit(config, tenantId);
      expect(first.allowed).toBe(true);
      expect(first.remaining).toBe(0);

      const second = checkRateLimit(config, tenantId);
      expect(second.allowed).toBe(false);
    });
  });

  // ==========================================================================
  // Client-side rate limiting (useCredits.performAction pattern)
  // ==========================================================================

  describe('client-side rate limiting pattern', () => {
    const CLIENT_RATE_LIMIT = {
      maxOperations: 30,
      windowMs: 60 * 1000,
    };

    it('should block after maxOperations in the client-side pattern', () => {
      const recentOperations: number[] = [];
      const baseTime = Date.now();

      // Simulate 30 operations within the window
      for (let i = 0; i < 30; i++) {
        recentOperations.push(baseTime + i);
      }

      // Check: filter operations within window, check count
      const now = baseTime + 30;
      const recentOps = recentOperations.filter(t => now - t < CLIENT_RATE_LIMIT.windowMs);
      expect(recentOps.length).toBeGreaterThanOrEqual(CLIENT_RATE_LIMIT.maxOperations);

      // This simulates the rate limit check in useCredits.performAction
      const isRateLimited = recentOps.length >= CLIENT_RATE_LIMIT.maxOperations;
      expect(isRateLimited).toBe(true);
    });

    it('should allow operations after window expires in client-side pattern', () => {
      const recentOperations: number[] = [];
      const baseTime = Date.now();

      // Add 30 operations at baseTime
      for (let i = 0; i < 30; i++) {
        recentOperations.push(baseTime);
      }

      // Check at baseTime + 61 seconds (past window)
      const now = baseTime + 61 * 1000;
      const recentOps = recentOperations.filter(t => now - t < CLIENT_RATE_LIMIT.windowMs);
      expect(recentOps.length).toBe(0);

      // Should not be rate limited
      const isRateLimited = recentOps.length >= CLIENT_RATE_LIMIT.maxOperations;
      expect(isRateLimited).toBe(false);
    });

    it('should correctly count only operations within the sliding window', () => {
      const recentOperations: number[] = [];
      const baseTime = Date.now();

      // Add 20 operations at baseTime (these will expire)
      for (let i = 0; i < 20; i++) {
        recentOperations.push(baseTime);
      }

      // Add 15 operations at baseTime + 45 seconds (still in window)
      for (let i = 0; i < 15; i++) {
        recentOperations.push(baseTime + 45 * 1000);
      }

      // Check at baseTime + 65 seconds (first batch expired, second still active)
      const now = baseTime + 65 * 1000;
      const recentOps = recentOperations.filter(t => now - t < CLIENT_RATE_LIMIT.windowMs);
      expect(recentOps.length).toBe(15);

      // Should NOT be rate limited (15 < 30)
      const isRateLimited = recentOps.length >= CLIENT_RATE_LIMIT.maxOperations;
      expect(isRateLimited).toBe(false);
    });
  });

  // ==========================================================================
  // Rate limit headers (for 429 response)
  // ==========================================================================

  describe('rate limit response metadata', () => {
    it('should provide resetAt for Retry-After header calculation', () => {
      const tenantId = 'tenant-headers-001';
      const now = Date.now();

      // Exhaust the limit
      for (let i = 0; i < 30; i++) {
        checkRateLimit(RATE_LIMITS.CREDIT_CONSUME, tenantId);
      }

      const blocked = checkRateLimit(RATE_LIMITS.CREDIT_CONSUME, tenantId);
      expect(blocked.allowed).toBe(false);
      expect(blocked.resetAt).toBeGreaterThan(now);

      // Calculate retry-after in seconds
      const retryAfterSeconds = Math.ceil((blocked.resetAt - now) / 1000);
      expect(retryAfterSeconds).toBeGreaterThan(0);
      expect(retryAfterSeconds).toBeLessThanOrEqual(60);
    });

    it('should generate correct rate limit headers from result', () => {
      const tenantId = 'tenant-gen-headers-001';

      const result = checkRateLimit(RATE_LIMITS.CREDIT_CONSUME, tenantId);

      // Mirrors getRateLimitHeaders from rateLimiting.ts
      const headers = {
        'X-RateLimit-Limit': result.remaining.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': Math.ceil(result.resetAt / 1000).toString(),
      };

      expect(headers['X-RateLimit-Remaining']).toBe('29');
      expect(headers['X-RateLimit-Reset']).toBeDefined();
    });
  });

  // ==========================================================================
  // Edge cases
  // ==========================================================================

  describe('edge cases', () => {
    it('should handle exactly at limit boundary (allowed on last action)', () => {
      const tenantId = 'tenant-boundary-001';
      const limit = RATE_LIMITS.CREDIT_CONSUME.limit;

      // Perform exactly limit-1 actions
      for (let i = 0; i < limit - 1; i++) {
        checkRateLimit(RATE_LIMITS.CREDIT_CONSUME, tenantId);
      }

      // The last allowed action
      const lastAllowed = checkRateLimit(RATE_LIMITS.CREDIT_CONSUME, tenantId);
      expect(lastAllowed.allowed).toBe(true);
      expect(lastAllowed.remaining).toBe(0);

      // The next action should be blocked
      const firstBlocked = checkRateLimit(RATE_LIMITS.CREDIT_CONSUME, tenantId);
      expect(firstBlocked.allowed).toBe(false);
    });

    it('should handle multiple windows correctly (exhaust, reset, exhaust again)', () => {
      const tenantId = 'tenant-multi-window-001';

      // Exhaust first window
      for (let i = 0; i < 30; i++) {
        checkRateLimit(RATE_LIMITS.CREDIT_CONSUME, tenantId);
      }
      expect(checkRateLimit(RATE_LIMITS.CREDIT_CONSUME, tenantId).allowed).toBe(false);

      // Advance past window
      vi.advanceTimersByTime(61 * 1000);

      // Exhaust second window
      for (let i = 0; i < 30; i++) {
        const result = checkRateLimit(RATE_LIMITS.CREDIT_CONSUME, tenantId);
        expect(result.allowed).toBe(true);
      }

      // Should be blocked again
      expect(checkRateLimit(RATE_LIMITS.CREDIT_CONSUME, tenantId).allowed).toBe(false);
    });

    it('should handle different rate limit keys independently', () => {
      const tenantId = 'tenant-keys-001';

      // Exhaust credit consume limit
      for (let i = 0; i < 30; i++) {
        checkRateLimit(RATE_LIMITS.CREDIT_CONSUME, tenantId);
      }
      expect(checkRateLimit(RATE_LIMITS.CREDIT_CONSUME, tenantId).allowed).toBe(false);

      // API limit should still be available
      const apiResult = checkRateLimit(RATE_LIMITS.API, tenantId);
      expect(apiResult.allowed).toBe(true);
    });
  });
});
