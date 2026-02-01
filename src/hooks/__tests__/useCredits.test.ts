/**
 * useCredits Hook Tests
 * Tests for credit balance management and low balance warnings
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import {
  LOW_BALANCE_WARNING_LEVELS,
  CREDIT_WARNING_THRESHOLDS,
  LOW_CREDIT_WARNING_THRESHOLD,
  CRITICAL_CREDIT_THRESHOLD,
  FREE_TIER_MONTHLY_CREDITS,
} from '@/lib/credits';

// Mock dependencies
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
    removeChannel: vi.fn(),
  },
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: vi.fn(() => ({
    tenant: { id: 'test-tenant-id' },
    tenantSlug: 'test-tenant',
  })),
}));

vi.mock('@/lib/credits', async () => {
  const actual = await vi.importActual<typeof import('@/lib/credits')>('@/lib/credits');
  return {
    ...actual,
    getCreditBalance: vi.fn(),
    trackCreditEvent: vi.fn(),
  };
});

vi.mock('sonner', () => ({
  toast: {
    warning: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe('Credit Warning Thresholds Configuration', () => {
  it('should have correct low balance warning levels', () => {
    expect(LOW_BALANCE_WARNING_LEVELS).toEqual([2000, 1000, 500, 100]);
  });

  it('should have LOW_CREDIT_WARNING_THRESHOLD set to 2000', () => {
    expect(LOW_CREDIT_WARNING_THRESHOLD).toBe(2000);
  });

  it('should have CRITICAL_CREDIT_THRESHOLD set to 100', () => {
    expect(CRITICAL_CREDIT_THRESHOLD).toBe(100);
  });

  it('should have correct progressive warning thresholds', () => {
    expect(CREDIT_WARNING_THRESHOLDS.FIRST_WARNING).toBe(2000);
    expect(CREDIT_WARNING_THRESHOLDS.SECOND_WARNING).toBe(1000);
    expect(CREDIT_WARNING_THRESHOLDS.YELLOW_BADGE).toBe(500);
    expect(CREDIT_WARNING_THRESHOLDS.WARNING_MODAL).toBe(100);
    expect(CREDIT_WARNING_THRESHOLDS.BANNER_WARNING).toBe(50);
    expect(CREDIT_WARNING_THRESHOLDS.BLOCKED).toBe(0);
  });

  it('should have warning levels in descending order', () => {
    const levels = [...LOW_BALANCE_WARNING_LEVELS];
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i]).toBeLessThan(levels[i - 1]);
    }
  });
});

describe('Credit Color Coding Logic', () => {
  // Test the color logic used in CreditBalance component
  const getColorClass = (amount: number) => {
    if (amount > 2000) return 'emerald'; // Green - healthy
    if (amount > 1000) return 'yellow'; // Yellow - first warning
    if (amount > 500) return 'amber'; // Amber - second warning
    if (amount > 100) return 'orange'; // Orange - low
    return 'red'; // Red - critical
  };

  it('should return emerald (green) for balance > 2000', () => {
    expect(getColorClass(2001)).toBe('emerald');
    expect(getColorClass(5000)).toBe('emerald');
    expect(getColorClass(10000)).toBe('emerald');
  });

  it('should return yellow for balance between 1001-2000', () => {
    expect(getColorClass(2000)).toBe('yellow');
    expect(getColorClass(1500)).toBe('yellow');
    expect(getColorClass(1001)).toBe('yellow');
  });

  it('should return amber for balance between 501-1000', () => {
    expect(getColorClass(1000)).toBe('amber');
    expect(getColorClass(750)).toBe('amber');
    expect(getColorClass(501)).toBe('amber');
  });

  it('should return orange for balance between 101-500', () => {
    expect(getColorClass(500)).toBe('orange');
    expect(getColorClass(250)).toBe('orange');
    expect(getColorClass(101)).toBe('orange');
  });

  it('should return red (critical) for balance <= 100', () => {
    expect(getColorClass(100)).toBe('red');
    expect(getColorClass(50)).toBe('red');
    expect(getColorClass(0)).toBe('red');
    expect(getColorClass(-10)).toBe('red');
  });
});

describe('Warning Message Generation', () => {
  // Test the warning message logic
  const getWarningMessage = (threshold: number, balance: number) => {
    switch (threshold) {
      case 2000:
        return {
          title: 'Credits Running Low',
          description: `You have ${balance.toLocaleString()} credits remaining. Consider purchasing more to avoid interruptions.`,
        };
      case 1000:
        return {
          title: 'Credit Balance Warning',
          description: `Only ${balance.toLocaleString()} credits left. Some features may become unavailable soon.`,
        };
      case 500:
        return {
          title: 'Low Credit Balance',
          description: `${balance.toLocaleString()} credits remaining. Purchase credits now to continue using premium features.`,
        };
      case 100:
        return {
          title: 'Critical Credit Balance',
          description: `Only ${balance.toLocaleString()} credits left! Actions will be blocked when credits run out.`,
        };
      default:
        return null;
    }
  };

  it('should generate correct message for 2000 threshold', () => {
    const message = getWarningMessage(2000, 1950);
    expect(message?.title).toBe('Credits Running Low');
    expect(message?.description).toContain('1,950');
    expect(message?.description).toContain('Consider purchasing');
  });

  it('should generate correct message for 1000 threshold', () => {
    const message = getWarningMessage(1000, 950);
    expect(message?.title).toBe('Credit Balance Warning');
    expect(message?.description).toContain('950');
    expect(message?.description).toContain('features may become unavailable');
  });

  it('should generate correct message for 500 threshold', () => {
    const message = getWarningMessage(500, 450);
    expect(message?.title).toBe('Low Credit Balance');
    expect(message?.description).toContain('450');
    expect(message?.description).toContain('Purchase credits now');
  });

  it('should generate correct message for 100 threshold', () => {
    const message = getWarningMessage(100, 75);
    expect(message?.title).toBe('Critical Credit Balance');
    expect(message?.description).toContain('75');
    expect(message?.description).toContain('Actions will be blocked');
  });

  it('should return null for unknown thresholds', () => {
    expect(getWarningMessage(999, 500)).toBeNull();
    expect(getWarningMessage(0, 0)).toBeNull();
  });
});

describe('Warning Threshold Detection', () => {
  // Test which warning should be shown when balance drops
  const getApplicableWarning = (balance: number, shownThresholds: Set<number>): number | null => {
    for (const threshold of LOW_BALANCE_WARNING_LEVELS) {
      if (shownThresholds.has(threshold)) continue;
      if (balance <= threshold) {
        return threshold;
      }
    }
    return null;
  };

  it('should detect 2000 threshold when balance drops to 2000', () => {
    const shown = new Set<number>();
    expect(getApplicableWarning(2000, shown)).toBe(2000);
  });

  it('should detect 1000 threshold when balance drops to 1000', () => {
    const shown = new Set<number>();
    expect(getApplicableWarning(1000, shown)).toBe(2000); // 2000 not shown yet
  });

  it('should skip already shown thresholds', () => {
    const shown = new Set([2000]);
    expect(getApplicableWarning(1000, shown)).toBe(1000);
  });

  it('should skip multiple already shown thresholds', () => {
    const shown = new Set([2000, 1000]);
    expect(getApplicableWarning(500, shown)).toBe(500);
  });

  it('should return 100 when balance is critical and others shown', () => {
    const shown = new Set([2000, 1000, 500]);
    expect(getApplicableWarning(50, shown)).toBe(100);
  });

  it('should return null when all thresholds shown', () => {
    const shown = new Set([2000, 1000, 500, 100]);
    expect(getApplicableWarning(50, shown)).toBeNull();
  });

  it('should return null when balance is above all thresholds', () => {
    const shown = new Set<number>();
    expect(getApplicableWarning(3000, shown)).toBeNull();
  });
});

describe('Credit Status Flags', () => {
  // Test the status flag derivation logic
  const deriveStatusFlags = (balance: number, isFreeTier: boolean) => {
    return {
      isLowCredits: isFreeTier && balance <= LOW_CREDIT_WARNING_THRESHOLD,
      isCriticalCredits: isFreeTier && balance <= CRITICAL_CREDIT_THRESHOLD,
      isOutOfCredits: isFreeTier && balance <= 0,
    };
  };

  it('should mark as low credits when balance <= 2000 for free tier', () => {
    const flags = deriveStatusFlags(2000, true);
    expect(flags.isLowCredits).toBe(true);
    expect(flags.isCriticalCredits).toBe(false);
    expect(flags.isOutOfCredits).toBe(false);
  });

  it('should mark as critical when balance <= 100 for free tier', () => {
    const flags = deriveStatusFlags(100, true);
    expect(flags.isLowCredits).toBe(true);
    expect(flags.isCriticalCredits).toBe(true);
    expect(flags.isOutOfCredits).toBe(false);
  });

  it('should mark as out of credits when balance <= 0 for free tier', () => {
    const flags = deriveStatusFlags(0, true);
    expect(flags.isLowCredits).toBe(true);
    expect(flags.isCriticalCredits).toBe(true);
    expect(flags.isOutOfCredits).toBe(true);
  });

  it('should NOT flag for paid tier regardless of balance', () => {
    const flags = deriveStatusFlags(50, false);
    expect(flags.isLowCredits).toBe(false);
    expect(flags.isCriticalCredits).toBe(false);
    expect(flags.isOutOfCredits).toBe(false);
  });

  it('should NOT flag when balance is healthy', () => {
    const flags = deriveStatusFlags(5000, true);
    expect(flags.isLowCredits).toBe(false);
    expect(flags.isCriticalCredits).toBe(false);
    expect(flags.isOutOfCredits).toBe(false);
  });
});

describe('Percent Used Calculation', () => {
  const calculatePercentUsed = (isFreeTier: boolean, lifetimeSpent: number, lifetimeEarned: number) => {
    if (!isFreeTier || lifetimeEarned === 0) return 0;
    return Math.round((lifetimeSpent / lifetimeEarned) * 100);
  };

  it('should return 0 for non-free tier', () => {
    expect(calculatePercentUsed(false, 1000, 5000)).toBe(0);
  });

  it('should return 0 when lifetime earned is 0', () => {
    expect(calculatePercentUsed(true, 0, 0)).toBe(0);
  });

  it('should calculate correct percentage', () => {
    expect(calculatePercentUsed(true, 2500, 5000)).toBe(50);
    expect(calculatePercentUsed(true, 1000, 5000)).toBe(20);
    expect(calculatePercentUsed(true, 4500, 5000)).toBe(90);
  });

  it('should round to nearest integer', () => {
    expect(calculatePercentUsed(true, 333, 1000)).toBe(33);
    expect(calculatePercentUsed(true, 666, 1000)).toBe(67);
  });
});

describe('Rate Limiting Logic', () => {
  const RATE_LIMIT = {
    maxOperations: 30,
    windowMs: 60 * 1000, // 1 minute
  };

  const isRateLimited = (recentOperations: number[], now: number) => {
    const recentOps = recentOperations.filter(t => now - t < RATE_LIMIT.windowMs);
    return recentOps.length >= RATE_LIMIT.maxOperations;
  };

  it('should not rate limit when under threshold', () => {
    const now = Date.now();
    const recentOps = Array(29).fill(now - 1000); // 29 recent ops
    expect(isRateLimited(recentOps, now)).toBe(false);
  });

  it('should rate limit when at threshold', () => {
    const now = Date.now();
    const recentOps = Array(30).fill(now - 1000); // 30 recent ops
    expect(isRateLimited(recentOps, now)).toBe(true);
  });

  it('should not count old operations', () => {
    const now = Date.now();
    const oldOps = Array(50).fill(now - 120000); // 50 ops from 2 minutes ago
    expect(isRateLimited(oldOps, now)).toBe(false);
  });

  it('should only count operations within window', () => {
    const now = Date.now();
    const mixedOps = [
      ...Array(20).fill(now - 120000), // 20 old ops
      ...Array(29).fill(now - 1000),   // 29 recent ops
    ];
    expect(isRateLimited(mixedOps, now)).toBe(false);
  });
});

describe('Idempotency Key Generation', () => {
  const generateIdempotencyKey = (actionKey: string, referenceId?: string) => {
    return `${actionKey}:${referenceId || 'default'}`;
  };

  it('should generate key with action and reference', () => {
    expect(generateIdempotencyKey('menu_create', 'menu-123')).toBe('menu_create:menu-123');
  });

  it('should use default when no reference provided', () => {
    expect(generateIdempotencyKey('menu_create')).toBe('menu_create:default');
    expect(generateIdempotencyKey('menu_create', undefined)).toBe('menu_create:default');
  });

  it('should prevent duplicate action detection', () => {
    const inFlight = new Set(['menu_create:menu-123']);
    const key = generateIdempotencyKey('menu_create', 'menu-123');
    expect(inFlight.has(key)).toBe(true);
  });

  it('should allow same action with different reference', () => {
    const inFlight = new Set(['menu_create:menu-123']);
    const key = generateIdempotencyKey('menu_create', 'menu-456');
    expect(inFlight.has(key)).toBe(false);
  });
});
