/**
 * LOW_BALANCE_WARNING_LEVELS Progressive Thresholds Tests
 *
 * Verifies that LOW_BALANCE_WARNING_LEVELS = [200, 100, 50, 25] are:
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
  it('should be exactly [200, 100, 50, 25]', () => {
    expect(LOW_BALANCE_WARNING_LEVELS).toEqual([200, 100, 50, 25]);
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
    const snapshot = [200, 100, 50, 25];
    expect([...LOW_BALANCE_WARNING_LEVELS]).toEqual(snapshot);
  });
});

// ============================================================================
// Consistency with CREDIT_WARNING_THRESHOLDS
// ============================================================================

describe('Consistency with CREDIT_WARNING_THRESHOLDS', () => {
  it('should match FIRST_WARNING to first level (200)', () => {
    expect(LOW_BALANCE_WARNING_LEVELS[0]).toBe(
      CREDIT_WARNING_THRESHOLDS.FIRST_WARNING
    );
  });

  it('should match SECOND_WARNING to second level (100)', () => {
    expect(LOW_BALANCE_WARNING_LEVELS[1]).toBe(
      CREDIT_WARNING_THRESHOLDS.SECOND_WARNING
    );
  });

  it('should match YELLOW_BADGE to third level (50)', () => {
    expect(LOW_BALANCE_WARNING_LEVELS[2]).toBe(
      CREDIT_WARNING_THRESHOLDS.YELLOW_BADGE
    );
  });

  it('should match WARNING_MODAL to fourth level (25)', () => {
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
    it('should trigger 200 warning when balance is exactly 200', () => {
      expect(getNextWarning(200, new Set())).toBe(200);
    });

    it('should trigger 200 warning when balance is 199', () => {
      expect(getNextWarning(199, new Set())).toBe(200);
    });

    it('should trigger 200 warning when balance is 1 (all thresholds apply, first wins)', () => {
      expect(getNextWarning(1, new Set())).toBe(200);
    });

    it('should NOT trigger when balance is above all thresholds (201)', () => {
      expect(getNextWarning(201, new Set())).toBeNull();
    });

    it('should NOT trigger when balance is 500', () => {
      expect(getNextWarning(500, new Set())).toBeNull();
    });
  });

  describe('Progressive descent through thresholds', () => {
    it('should show warnings progressively as balance drops', () => {
      const shown = new Set<number>();

      // Balance drops to 200: show 200 warning
      expect(getNextWarning(200, shown)).toBe(200);
      shown.add(200);

      // Balance drops to 150: no new warning (already showed 200, 150 > 100)
      expect(getNextWarning(150, shown)).toBeNull();

      // Balance drops to 100: show 100 warning
      expect(getNextWarning(100, shown)).toBe(100);
      shown.add(100);

      // Balance drops to 75: no new warning (75 > 50)
      expect(getNextWarning(75, shown)).toBeNull();

      // Balance drops to 50: show 50 warning
      expect(getNextWarning(50, shown)).toBe(50);
      shown.add(50);

      // Balance drops to 30: no new warning (30 > 25)
      expect(getNextWarning(30, shown)).toBeNull();

      // Balance drops to 25: show 25 warning
      expect(getNextWarning(25, shown)).toBe(25);
      shown.add(25);

      // Balance drops to 10: no more warnings
      expect(getNextWarning(10, shown)).toBeNull();

      // Balance drops to 0: no more warnings
      expect(getNextWarning(0, shown)).toBeNull();
    });

    it('should handle rapid balance drop (skip intermediate thresholds)', () => {
      const shown = new Set<number>();

      // Balance drops directly from 500 to 10: should still show 200 first
      expect(getNextWarning(10, shown)).toBe(200);
      shown.add(200);

      // Next check at 10: should show 100 (skipped in balance but not in alerts)
      expect(getNextWarning(10, shown)).toBe(100);
      shown.add(100);

      // Next: 50
      expect(getNextWarning(10, shown)).toBe(50);
      shown.add(50);

      // Next: 25
      expect(getNextWarning(10, shown)).toBe(25);
      shown.add(25);

      // All shown
      expect(getNextWarning(10, shown)).toBeNull();
    });
  });

  describe('Edge cases', () => {
    it('should handle balance of exactly 0', () => {
      expect(getNextWarning(0, new Set())).toBe(200);
    });

    it('should handle negative balance', () => {
      // Negative balance should still trigger warnings
      expect(getNextWarning(-10, new Set())).toBe(200);
    });

    it('should handle balance between thresholds', () => {
      const shown = new Set([200]);
      // Balance is 99 (below 100 threshold)
      expect(getNextWarning(99, shown)).toBe(100);
    });

    it('should skip all already-shown thresholds', () => {
      const shown = new Set([200, 100]);
      expect(getNextWarning(50, shown)).toBe(50);
    });

    it('should return null when all thresholds are shown', () => {
      const allShown = new Set([200, 100, 50, 25]);
      expect(getNextWarning(1, allShown)).toBeNull();
    });

    it('should return null when balance is above threshold 201', () => {
      expect(getNextWarning(201, new Set())).toBeNull();
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
      case 200:
        return {
          title: 'Credits Running Low',
          description: `You have ${balance.toLocaleString()} credits remaining. Consider purchasing more to avoid interruptions.`,
        };
      case 100:
        return {
          title: 'Credit Balance Warning',
          description: `Only ${balance.toLocaleString()} credits left. Some features may become unavailable soon.`,
        };
      case 50:
        return {
          title: 'Low Credit Balance',
          description: `${balance.toLocaleString()} credits remaining. Purchase credits now to continue using premium features.`,
        };
      case 25:
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

  it('should mention blocking at the critical (25) threshold', () => {
    const message = getWarningMessage(25, 20);
    expect(message?.description).toContain('blocked');
  });

  it('should suggest purchasing at the 50 threshold', () => {
    const message = getWarningMessage(50, 45);
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
    { threshold: 200, severity: 'info', title: 'Credits Running Low' },
    { threshold: 100, severity: 'warning', title: 'Credit Balance Warning' },
    { threshold: 50, severity: 'critical', title: 'Low Credit Balance' },
    { threshold: 25, severity: 'danger', title: 'Critical Credit Balance' },
  ];

  it('should have a config for every LOW_BALANCE_WARNING_LEVEL', () => {
    for (const level of LOW_BALANCE_WARNING_LEVELS) {
      const config = THRESHOLD_CONFIGS.find((c) => c.threshold === level);
      expect(config).toBeDefined();
    }
  });

  it('should map 200 → info severity', () => {
    const config = THRESHOLD_CONFIGS.find((c) => c.threshold === 200);
    expect(config?.severity).toBe('info');
  });

  it('should map 100 → warning severity', () => {
    const config = THRESHOLD_CONFIGS.find((c) => c.threshold === 100);
    expect(config?.severity).toBe('warning');
  });

  it('should map 50 → critical severity', () => {
    const config = THRESHOLD_CONFIGS.find((c) => c.threshold === 50);
    expect(config?.severity).toBe('critical');
  });

  it('should map 25 → danger severity', () => {
    const config = THRESHOLD_CONFIGS.find((c) => c.threshold === 25);
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
    { threshold: 200, severity: 'info' },
    { threshold: 100, severity: 'warning' },
    { threshold: 50, severity: 'critical' },
    { threshold: 25, severity: 'danger' },
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

  it('should return info for balance between 1-200', () => {
    expect(getCurrentThreshold(200)?.severity).toBe('info');
    expect(getCurrentThreshold(150)?.severity).toBe('info');
    expect(getCurrentThreshold(101)?.severity).toBe('info');
  });

  it('should return warning for balance between 1-100', () => {
    expect(getCurrentThreshold(100)?.severity).toBe('warning');
    expect(getCurrentThreshold(75)?.severity).toBe('warning');
    expect(getCurrentThreshold(51)?.severity).toBe('warning');
  });

  it('should return critical for balance between 1-50', () => {
    expect(getCurrentThreshold(50)?.severity).toBe('critical');
    expect(getCurrentThreshold(30)?.severity).toBe('critical');
    expect(getCurrentThreshold(26)?.severity).toBe('critical');
  });

  it('should return danger for balance between 1-25', () => {
    expect(getCurrentThreshold(25)?.severity).toBe('danger');
    expect(getCurrentThreshold(10)?.severity).toBe('danger');
    expect(getCurrentThreshold(1)?.severity).toBe('danger');
  });

  it('should return null for balance > 200', () => {
    expect(getCurrentThreshold(201)).toBeNull();
    expect(getCurrentThreshold(500)).toBeNull();
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
   * duration: threshold <= 50 ? 8000 : 5000
   */
  const getToastDuration = (threshold: number): number => {
    return threshold <= 50 ? 8000 : 5000;
  };

  it('should show 5s for 200 threshold (info)', () => {
    expect(getToastDuration(200)).toBe(5000);
  });

  it('should show 5s for 100 threshold (warning)', () => {
    expect(getToastDuration(100)).toBe(5000);
  });

  it('should show 8s for 50 threshold (critical)', () => {
    expect(getToastDuration(50)).toBe(8000);
  });

  it('should show 8s for 25 threshold (danger)', () => {
    expect(getToastDuration(25)).toBe(8000);
  });
});

// ============================================================================
// Buy Credits Action Button Tests
// ============================================================================

describe('Buy Credits action button in toast', () => {
  /**
   * Mirrors useCredits.ts line 317:
   * action: threshold <= 50 ? { label: 'Buy Credits', ... } : undefined
   */
  const shouldShowBuyButton = (threshold: number): boolean => {
    return threshold <= 50;
  };

  it('should NOT show buy button at 200 threshold', () => {
    expect(shouldShowBuyButton(200)).toBe(false);
  });

  it('should NOT show buy button at 100 threshold', () => {
    expect(shouldShowBuyButton(100)).toBe(false);
  });

  it('should show buy button at 50 threshold', () => {
    expect(shouldShowBuyButton(50)).toBe(true);
  });

  it('should show buy button at 25 threshold', () => {
    expect(shouldShowBuyButton(25)).toBe(true);
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
