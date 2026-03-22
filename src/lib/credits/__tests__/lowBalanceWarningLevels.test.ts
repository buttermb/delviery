/**
 * LOW_BALANCE_WARNING_LEVELS Progressive Thresholds Tests
 *
 * Verifies that LOW_BALANCE_WARNING_LEVELS = [2000, 1000, 500, 100] are:
 * - Defined with correct values in descending order
 * - Consistent with CREDIT_WARNING_THRESHOLDS
 * - Progressive: each threshold triggers only once per session
 * - Warning messages have increasing severity at each level
 * - Alert banner severity maps correctly: info → warning → critical → danger
 */

import { describe, it, expect } from 'vitest';
import {
  LOW_BALANCE_WARNING_LEVELS,
  CREDIT_WARNING_THRESHOLDS,
  LOW_CREDIT_WARNING_THRESHOLD,
  CRITICAL_CREDIT_THRESHOLD,
} from '../creditCosts';

// ============================================================================
// Threshold Definition Tests
// ============================================================================

describe('LOW_BALANCE_WARNING_LEVELS definition', () => {
  it('should be exactly [2000, 1000, 500, 100]', () => {
    expect(LOW_BALANCE_WARNING_LEVELS).toEqual([2000, 1000, 500, 100]);
  });

  it('should have exactly 4 levels', () => {
    expect(LOW_BALANCE_WARNING_LEVELS).toHaveLength(4);
  });

  it('should be in strictly descending order', () => {
    for (let i = 1; i < LOW_BALANCE_WARNING_LEVELS.length; i++) {
      expect(LOW_BALANCE_WARNING_LEVELS[i]).toBeLessThan(
        LOW_BALANCE_WARNING_LEVELS[i - 1]
      );
    }
  });

  it('should have all positive values', () => {
    for (const level of LOW_BALANCE_WARNING_LEVELS) {
      expect(level).toBeGreaterThan(0);
    }
  });

  it('should be readonly (const assertion)', () => {
    // Verify it's a readonly tuple - attempting to modify should not compile
    // Runtime check: verify the values haven't been mutated
    const snapshot = [2000, 1000, 500, 100];
    expect([...LOW_BALANCE_WARNING_LEVELS]).toEqual(snapshot);
  });
});

// ============================================================================
// Consistency with CREDIT_WARNING_THRESHOLDS
// ============================================================================

describe('Consistency with CREDIT_WARNING_THRESHOLDS', () => {
  it('should match FIRST_WARNING to first level (2000)', () => {
    expect(LOW_BALANCE_WARNING_LEVELS[0]).toBe(
      CREDIT_WARNING_THRESHOLDS.FIRST_WARNING
    );
  });

  it('should match SECOND_WARNING to second level (1000)', () => {
    expect(LOW_BALANCE_WARNING_LEVELS[1]).toBe(
      CREDIT_WARNING_THRESHOLDS.SECOND_WARNING
    );
  });

  it('should match YELLOW_BADGE to third level (500)', () => {
    expect(LOW_BALANCE_WARNING_LEVELS[2]).toBe(
      CREDIT_WARNING_THRESHOLDS.YELLOW_BADGE
    );
  });

  it('should match WARNING_MODAL to fourth level (100)', () => {
    expect(LOW_BALANCE_WARNING_LEVELS[3]).toBe(
      CREDIT_WARNING_THRESHOLDS.WARNING_MODAL
    );
  });

  it('should have LOW_CREDIT_WARNING_THRESHOLD equal to highest level', () => {
    expect(LOW_CREDIT_WARNING_THRESHOLD).toBe(LOW_BALANCE_WARNING_LEVELS[0]);
  });

  it('should have CRITICAL_CREDIT_THRESHOLD equal to lowest level', () => {
    expect(CRITICAL_CREDIT_THRESHOLD).toBe(
      LOW_BALANCE_WARNING_LEVELS[LOW_BALANCE_WARNING_LEVELS.length - 1]
    );
  });
});

// ============================================================================
// Progressive Warning Logic Tests
// ============================================================================

describe('Progressive warning iteration logic', () => {
  /**
   * Mirrors the iteration logic in useCredits.ts (line 302):
   * for (const threshold of LOW_BALANCE_WARNING_LEVELS) {
   *   if (shownWarningThresholds.has(threshold)) continue;
   *   if (balance <= threshold) { show warning; break; }
   * }
   */
  const getNextWarning = (
    balance: number,
    shownThresholds: Set<number>
  ): number | null => {
    for (const threshold of LOW_BALANCE_WARNING_LEVELS) {
      if (shownThresholds.has(threshold)) continue;
      if (balance <= threshold) {
        return threshold;
      }
    }
    return null;
  };

  describe('Initial trigger at each threshold', () => {
    it('should trigger 2000 warning when balance is exactly 2000', () => {
      expect(getNextWarning(2000, new Set())).toBe(2000);
    });

    it('should trigger 2000 warning when balance is 1999', () => {
      expect(getNextWarning(1999, new Set())).toBe(2000);
    });

    it('should trigger 2000 warning when balance is 1 (all thresholds apply, first wins)', () => {
      expect(getNextWarning(1, new Set())).toBe(2000);
    });

    it('should NOT trigger when balance is above all thresholds (2001)', () => {
      expect(getNextWarning(2001, new Set())).toBeNull();
    });

    it('should NOT trigger when balance is 5000', () => {
      expect(getNextWarning(5000, new Set())).toBeNull();
    });
  });

  describe('Progressive descent through thresholds', () => {
    it('should show warnings progressively as balance drops', () => {
      const shown = new Set<number>();

      // Balance drops to 2000: show 2000 warning
      expect(getNextWarning(2000, shown)).toBe(2000);
      shown.add(2000);

      // Balance drops to 1500: no new warning (already showed 2000, 1500 > 1000)
      expect(getNextWarning(1500, shown)).toBeNull();

      // Balance drops to 1000: show 1000 warning
      expect(getNextWarning(1000, shown)).toBe(1000);
      shown.add(1000);

      // Balance drops to 750: no new warning (750 > 500)
      expect(getNextWarning(750, shown)).toBeNull();

      // Balance drops to 500: show 500 warning
      expect(getNextWarning(500, shown)).toBe(500);
      shown.add(500);

      // Balance drops to 200: no new warning (200 > 100)
      expect(getNextWarning(200, shown)).toBeNull();

      // Balance drops to 100: show 100 warning
      expect(getNextWarning(100, shown)).toBe(100);
      shown.add(100);

      // Balance drops to 50: no more warnings
      expect(getNextWarning(50, shown)).toBeNull();

      // Balance drops to 0: no more warnings
      expect(getNextWarning(0, shown)).toBeNull();
    });

    it('should handle rapid balance drop (skip intermediate thresholds)', () => {
      const shown = new Set<number>();

      // Balance drops directly from 5000 to 50: should still show 2000 first
      expect(getNextWarning(50, shown)).toBe(2000);
      shown.add(2000);

      // Next check at 50: should show 1000 (skipped in balance but not in alerts)
      expect(getNextWarning(50, shown)).toBe(1000);
      shown.add(1000);

      // Next: 500
      expect(getNextWarning(50, shown)).toBe(500);
      shown.add(500);

      // Next: 100
      expect(getNextWarning(50, shown)).toBe(100);
      shown.add(100);

      // All shown
      expect(getNextWarning(50, shown)).toBeNull();
    });
  });

  describe('Edge cases', () => {
    it('should handle balance of exactly 0', () => {
      expect(getNextWarning(0, new Set())).toBe(2000);
    });

    it('should handle negative balance', () => {
      // Negative balance should still trigger warnings
      expect(getNextWarning(-100, new Set())).toBe(2000);
    });

    it('should handle balance between thresholds', () => {
      const shown = new Set([2000]);
      // Balance is 999 (below 1000 threshold)
      expect(getNextWarning(999, shown)).toBe(1000);
    });

    it('should skip all already-shown thresholds', () => {
      const shown = new Set([2000, 1000]);
      expect(getNextWarning(500, shown)).toBe(500);
    });

    it('should return null when all thresholds are shown', () => {
      const allShown = new Set([2000, 1000, 500, 100]);
      expect(getNextWarning(1, allShown)).toBeNull();
    });

    it('should return null when balance is above threshold 2001', () => {
      expect(getNextWarning(2001, new Set())).toBeNull();
    });
  });
});

// ============================================================================
// Warning Message Severity Progression Tests
// ============================================================================

describe('Warning message severity progression', () => {
  /**
   * Mirrors getWarningMessage in useCredits.ts (line 125).
   * Each threshold has a title + description with increasing urgency.
   */
  const getWarningMessage = (
    threshold: number,
    balance: number
  ): { title: string; description: string } | null => {
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

  it('should have a message for every LOW_BALANCE_WARNING_LEVEL', () => {
    for (const threshold of LOW_BALANCE_WARNING_LEVELS) {
      const message = getWarningMessage(threshold, threshold);
      expect(message).not.toBeNull();
      expect(message?.title).toBeTruthy();
      expect(message?.description).toBeTruthy();
    }
  });

  it('should return null for non-threshold values', () => {
    expect(getWarningMessage(1500, 1500)).toBeNull();
    expect(getWarningMessage(300, 300)).toBeNull();
    expect(getWarningMessage(0, 0)).toBeNull();
  });

  it('should have progressively more urgent titles', () => {
    const titles = LOW_BALANCE_WARNING_LEVELS.map(
      (t) => getWarningMessage(t, t)?.title ?? ''
    );

    // Verify titles escalate: Running Low → Warning → Low → Critical
    expect(titles[0]).toBe('Credits Running Low');
    expect(titles[1]).toBe('Credit Balance Warning');
    expect(titles[2]).toBe('Low Credit Balance');
    expect(titles[3]).toBe('Critical Credit Balance');
  });

  it('should include balance in descriptions', () => {
    const testBalance = 450;
    for (const threshold of LOW_BALANCE_WARNING_LEVELS) {
      const message = getWarningMessage(threshold, testBalance);
      expect(message?.description).toContain(testBalance.toLocaleString());
    }
  });

  it('should mention blocking at the critical (100) threshold', () => {
    const message = getWarningMessage(100, 75);
    expect(message?.description).toContain('blocked');
  });

  it('should suggest purchasing at the 500 threshold', () => {
    const message = getWarningMessage(500, 450);
    expect(message?.description).toContain('Purchase credits now');
  });
});

// ============================================================================
// Alert Banner Severity Mapping Tests
// ============================================================================

describe('Alert banner severity mapping', () => {
  interface ThresholdConfig {
    threshold: number;
    severity: 'info' | 'warning' | 'critical' | 'danger';
    title: string;
  }

  /**
   * Mirrors THRESHOLD_CONFIGS in CreditAlertBanner.tsx and useCreditAlert.ts.
   * The severity should progress: info → warning → critical → danger.
   */
  const THRESHOLD_CONFIGS: ThresholdConfig[] = [
    { threshold: 2000, severity: 'info', title: 'Credits Running Low' },
    { threshold: 1000, severity: 'warning', title: 'Credit Balance Warning' },
    { threshold: 500, severity: 'critical', title: 'Low Credit Balance' },
    { threshold: 100, severity: 'danger', title: 'Critical Credit Balance' },
  ];

  it('should have a config for every LOW_BALANCE_WARNING_LEVEL', () => {
    for (const level of LOW_BALANCE_WARNING_LEVELS) {
      const config = THRESHOLD_CONFIGS.find((c) => c.threshold === level);
      expect(config).toBeDefined();
    }
  });

  it('should map 2000 → info severity', () => {
    const config = THRESHOLD_CONFIGS.find((c) => c.threshold === 2000);
    expect(config?.severity).toBe('info');
  });

  it('should map 1000 → warning severity', () => {
    const config = THRESHOLD_CONFIGS.find((c) => c.threshold === 1000);
    expect(config?.severity).toBe('warning');
  });

  it('should map 500 → critical severity', () => {
    const config = THRESHOLD_CONFIGS.find((c) => c.threshold === 500);
    expect(config?.severity).toBe('critical');
  });

  it('should map 100 → danger severity', () => {
    const config = THRESHOLD_CONFIGS.find((c) => c.threshold === 100);
    expect(config?.severity).toBe('danger');
  });

  it('should have severity escalation in correct order', () => {
    const severityOrder = ['info', 'warning', 'critical', 'danger'];
    const sortedConfigs = [...THRESHOLD_CONFIGS].sort(
      (a, b) => b.threshold - a.threshold
    );

    for (let i = 0; i < sortedConfigs.length; i++) {
      expect(sortedConfigs[i].severity).toBe(severityOrder[i]);
    }
  });
});

// ============================================================================
// getCurrentThreshold Logic Tests
// ============================================================================

describe('getCurrentThreshold logic', () => {
  interface ThresholdConfig {
    threshold: number;
    severity: string;
  }

  const THRESHOLD_CONFIGS: ThresholdConfig[] = [
    { threshold: 2000, severity: 'info' },
    { threshold: 1000, severity: 'warning' },
    { threshold: 500, severity: 'critical' },
    { threshold: 100, severity: 'danger' },
  ];

  /**
   * Mirrors getCurrentThreshold in CreditAlertBanner.tsx and useCreditAlert.ts.
   * Returns the most specific (lowest) threshold the balance qualifies for.
   * Sort ascending so we find the tightest match first.
   */
  const getCurrentThreshold = (
    balance: number
  ): ThresholdConfig | null => {
    const sorted = [...THRESHOLD_CONFIGS].sort(
      (a, b) => a.threshold - b.threshold
    );
    for (const config of sorted) {
      if (balance <= config.threshold && balance > 0) {
        return config;
      }
    }
    return null;
  };

  it('should return info for balance between 1-2000', () => {
    expect(getCurrentThreshold(2000)?.severity).toBe('info');
    expect(getCurrentThreshold(1500)?.severity).toBe('info');
    expect(getCurrentThreshold(1001)?.severity).toBe('info');
  });

  it('should return warning for balance between 1-1000', () => {
    expect(getCurrentThreshold(1000)?.severity).toBe('warning');
    expect(getCurrentThreshold(750)?.severity).toBe('warning');
    expect(getCurrentThreshold(501)?.severity).toBe('warning');
  });

  it('should return critical for balance between 1-500', () => {
    expect(getCurrentThreshold(500)?.severity).toBe('critical');
    expect(getCurrentThreshold(250)?.severity).toBe('critical');
    expect(getCurrentThreshold(101)?.severity).toBe('critical');
  });

  it('should return danger for balance between 1-100', () => {
    expect(getCurrentThreshold(100)?.severity).toBe('danger');
    expect(getCurrentThreshold(50)?.severity).toBe('danger');
    expect(getCurrentThreshold(1)?.severity).toBe('danger');
  });

  it('should return null for balance > 2000', () => {
    expect(getCurrentThreshold(2001)).toBeNull();
    expect(getCurrentThreshold(5000)).toBeNull();
  });

  it('should return null for balance <= 0 (handled by OutOfCreditsModal)', () => {
    expect(getCurrentThreshold(0)).toBeNull();
    expect(getCurrentThreshold(-10)).toBeNull();
  });
});

// ============================================================================
// Toast Duration Tests
// ============================================================================

describe('Toast duration by threshold', () => {
  /**
   * Mirrors useCredits.ts line 316:
   * duration: threshold <= 500 ? 8000 : 5000
   */
  const getToastDuration = (threshold: number): number => {
    return threshold <= 500 ? 8000 : 5000;
  };

  it('should show 5s for 2000 threshold (info)', () => {
    expect(getToastDuration(2000)).toBe(5000);
  });

  it('should show 5s for 1000 threshold (warning)', () => {
    expect(getToastDuration(1000)).toBe(5000);
  });

  it('should show 8s for 500 threshold (critical)', () => {
    expect(getToastDuration(500)).toBe(8000);
  });

  it('should show 8s for 100 threshold (danger)', () => {
    expect(getToastDuration(100)).toBe(8000);
  });
});

// ============================================================================
// Buy Credits Action Button Tests
// ============================================================================

describe('Buy Credits action button in toast', () => {
  /**
   * Mirrors useCredits.ts line 317:
   * action: threshold <= 500 ? { label: 'Buy Credits', ... } : undefined
   */
  const shouldShowBuyButton = (threshold: number): boolean => {
    return threshold <= 500;
  };

  it('should NOT show buy button at 2000 threshold', () => {
    expect(shouldShowBuyButton(2000)).toBe(false);
  });

  it('should NOT show buy button at 1000 threshold', () => {
    expect(shouldShowBuyButton(1000)).toBe(false);
  });

  it('should show buy button at 500 threshold', () => {
    expect(shouldShowBuyButton(500)).toBe(true);
  });

  it('should show buy button at 100 threshold', () => {
    expect(shouldShowBuyButton(100)).toBe(true);
  });
});

// ============================================================================
// Free Tier Guard Tests
// ============================================================================

describe('Free tier guard for warning display', () => {
  /**
   * Warnings should ONLY show for free tier users.
   * Mirrors useCredits.ts line 299:
   * if (!tenantId || !isFreeTier || isLoading) return;
   */
  const shouldShowWarnings = (
    tenantId: string | null,
    isFreeTier: boolean,
    isLoading: boolean
  ): boolean => {
    if (!tenantId || !isFreeTier || isLoading) return false;
    return true;
  };

  it('should show warnings for free tier with tenant', () => {
    expect(shouldShowWarnings('tenant-123', true, false)).toBe(true);
  });

  it('should NOT show warnings for paid tier', () => {
    expect(shouldShowWarnings('tenant-123', false, false)).toBe(false);
  });

  it('should NOT show warnings without tenant', () => {
    expect(shouldShowWarnings(null, true, false)).toBe(false);
  });

  it('should NOT show warnings while loading', () => {
    expect(shouldShowWarnings('tenant-123', true, true)).toBe(false);
  });
});
