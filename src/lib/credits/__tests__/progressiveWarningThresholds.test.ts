/**
 * Progressive Warning Thresholds → Correct UI Responses
 *
 * Simulates balance decreasing through 2000, 1000, 500, 100, 0 and verifies
 * the correct warning mechanism activates at each threshold:
 *
 *   2000 → info toast (5s), blue badge, info banner
 *   1000 → warning toast (5s), amber badge, warning banner
 *    500 → critical toast (8s) + Buy button, orange badge, critical banner
 *    100 → danger toast (8s) + Buy button, red+pulse badge, danger banner
 *      0 → no banner (OutOfCreditsModal handles this), no toast
 */

import { describe, it, expect } from 'vitest';
import {
  getCurrentThreshold,
  getBadgeColorClass,
  getAlertSeverityStyles,
  getWarningMessage,
  CREDIT_THRESHOLD_CONFIGS,
  type CreditWarningSeverity,
} from '../creditWarningConfig';
import {
  LOW_BALANCE_WARNING_LEVELS,
  CREDIT_WARNING_THRESHOLDS,
} from '../creditCosts';

// ============================================================================
// Helper: mirrors useCredits progressive warning iteration (lines 276-303)
// ============================================================================

function getNextWarning(
  balance: number,
  shownThresholds: Set<number>
): number | null {
  for (const threshold of LOW_BALANCE_WARNING_LEVELS) {
    if (shownThresholds.has(threshold)) continue;
    if (balance <= threshold) return threshold;
  }
  return null;
}

function getToastDuration(threshold: number): number {
  return threshold <= 500 ? 8000 : 5000;
}

function shouldShowBuyButton(threshold: number): boolean {
  return threshold <= 500;
}

// ============================================================================
// Expected UI mapping at each threshold
// ============================================================================

interface ExpectedUIResponse {
  threshold: number;
  severity: CreditWarningSeverity;
  toastDuration: number;
  hasBuyButton: boolean;
  toastTitle: string;
  badgeContains: string[];
  alertVariant: 'default' | 'destructive';
  alertIconColor: string;
}

const EXPECTED_UI_RESPONSES: ExpectedUIResponse[] = [
  {
    threshold: 2000,
    severity: 'info',
    toastDuration: 5000,
    hasBuyButton: false,
    toastTitle: 'Credits Running Low',
    badgeContains: ['text-blue-600', 'bg-blue-50', 'border-blue-200'],
    alertVariant: 'default',
    alertIconColor: 'text-blue-500',
  },
  {
    threshold: 1000,
    severity: 'warning',
    toastDuration: 5000,
    hasBuyButton: false,
    toastTitle: 'Credit Balance Warning',
    badgeContains: ['text-amber-600', 'bg-amber-50', 'border-amber-200'],
    alertVariant: 'default',
    alertIconColor: 'text-amber-500',
  },
  {
    threshold: 500,
    severity: 'critical',
    toastDuration: 8000,
    hasBuyButton: true,
    toastTitle: 'Low Credit Balance',
    badgeContains: ['text-orange-600', 'bg-orange-50', 'border-orange-200'],
    alertVariant: 'default',
    alertIconColor: 'text-orange-500',
  },
  {
    threshold: 100,
    severity: 'danger',
    toastDuration: 8000,
    hasBuyButton: true,
    toastTitle: 'Critical Credit Balance',
    badgeContains: ['text-red-600', 'bg-red-50', 'border-red-200', 'animate-pulse'],
    alertVariant: 'destructive',
    alertIconColor: 'text-red-500',
  },
];

// ============================================================================
// Full progressive descent simulation
// ============================================================================

describe('Progressive warning thresholds → correct UI responses', () => {
  describe('Full balance descent: 3000 → 2000 → 1000 → 500 → 100 → 0', () => {
    it('should trigger warnings at each threshold in sequence', () => {
      const shown = new Set<number>();
      const triggeredSequence: number[] = [];

      // Simulate descending balance snapshots
      const balanceSnapshots = [3000, 2500, 2000, 1500, 1000, 750, 500, 200, 100, 50, 0];

      for (const balance of balanceSnapshots) {
        const warning = getNextWarning(balance, shown);
        if (warning !== null) {
          shown.add(warning);
          triggeredSequence.push(warning);
        }
      }

      expect(triggeredSequence).toEqual([2000, 1000, 500, 100]);
    });

    it('should trigger exactly 4 warnings total across the descent', () => {
      const shown = new Set<number>();
      let count = 0;
      const balances = [3000, 2000, 1500, 1000, 750, 500, 200, 100, 50, 0];

      for (const balance of balances) {
        const warning = getNextWarning(balance, shown);
        if (warning !== null) {
          shown.add(warning);
          count++;
        }
      }

      expect(count).toBe(4);
    });

    it('should never repeat a warning once shown', () => {
      const shown = new Set<number>();

      // Check same balance twice
      const warning1 = getNextWarning(2000, shown);
      expect(warning1).toBe(2000);
      shown.add(2000);

      const warning2 = getNextWarning(2000, shown);
      expect(warning2).toBeNull();
    });
  });

  // ============================================================================
  // Per-threshold UI response verification
  // ============================================================================

  describe.each(EXPECTED_UI_RESPONSES)(
    'At $threshold threshold (severity=$severity)',
    ({
      threshold,
      severity,
      toastDuration,
      hasBuyButton,
      toastTitle,
      badgeContains,
      alertVariant,
      alertIconColor,
    }) => {
      it(`should resolve to ${severity} severity via getCurrentThreshold`, () => {
        const config = getCurrentThreshold(threshold);
        expect(config).not.toBeNull();
        expect(config!.severity).toBe(severity);
        expect(config!.threshold).toBe(threshold);
      });

      it(`should show toast with title "${toastTitle}"`, () => {
        const message = getWarningMessage(threshold, threshold);
        expect(message).not.toBeNull();
        expect(message!.title).toBe(toastTitle);
      });

      it(`should include balance in toast description`, () => {
        const testBalance = threshold - 10;
        const message = getWarningMessage(threshold, testBalance);
        expect(message!.description).toContain(testBalance.toLocaleString());
      });

      it(`should set toast duration to ${toastDuration}ms`, () => {
        expect(getToastDuration(threshold)).toBe(toastDuration);
      });

      it(`should ${hasBuyButton ? '' : 'NOT '}show Buy Credits button in toast`, () => {
        expect(shouldShowBuyButton(threshold)).toBe(hasBuyButton);
      });

      it(`should apply correct badge colors`, () => {
        const classes = getBadgeColorClass(threshold);
        for (const expected of badgeContains) {
          expect(classes).toContain(expected);
        }
      });

      it(`should apply ${alertVariant} alert variant`, () => {
        const styles = getAlertSeverityStyles(severity);
        expect(styles.variant).toBe(alertVariant);
      });

      it(`should set alert icon color to ${alertIconColor}`, () => {
        const styles = getAlertSeverityStyles(severity);
        expect(styles.iconColor).toBe(alertIconColor);
      });
    }
  );

  // ============================================================================
  // Balance = 0: OutOfCreditsModal territory, no toast/banner
  // ============================================================================

  describe('At balance = 0 (out of credits)', () => {
    it('should NOT trigger any toast warning', () => {
      // All thresholds already shown
      const allShown = new Set([2000, 1000, 500, 100]);
      expect(getNextWarning(0, allShown)).toBeNull();
    });

    it('should return null from getCurrentThreshold (handled by OutOfCreditsModal)', () => {
      expect(getCurrentThreshold(0)).toBeNull();
    });

    it('should return healthy (emerald) badge colors for 0 balance', () => {
      // When balance is 0, getCurrentThreshold returns null → falls back to HEALTHY_BADGE
      // The badge at 0 uses emerald because there's no threshold match
      const classes = getBadgeColorClass(0);
      expect(classes).toContain('text-emerald-600');
    });
  });

  // ============================================================================
  // Badge color progression: emerald → blue → amber → orange → red+pulse
  // ============================================================================

  describe('Badge color progression across balance levels', () => {
    it('should show emerald (healthy) above 2000', () => {
      const classes = getBadgeColorClass(3000);
      expect(classes).toContain('text-emerald-600');
      expect(classes).toContain('bg-emerald-50');
      expect(classes).not.toContain('animate-pulse');
    });

    it('should show blue (info) between 1001-2000', () => {
      const classes = getBadgeColorClass(1500);
      expect(classes).toContain('text-blue-600');
      expect(classes).toContain('bg-blue-50');
    });

    it('should show amber (warning) between 501-1000', () => {
      const classes = getBadgeColorClass(800);
      expect(classes).toContain('text-amber-600');
      expect(classes).toContain('bg-amber-50');
    });

    it('should show orange (critical) between 101-500', () => {
      const classes = getBadgeColorClass(300);
      expect(classes).toContain('text-orange-600');
      expect(classes).toContain('bg-orange-50');
    });

    it('should show red with pulse (danger) between 1-100', () => {
      const classes = getBadgeColorClass(50);
      expect(classes).toContain('text-red-600');
      expect(classes).toContain('bg-red-50');
      expect(classes).toContain('animate-pulse');
    });
  });

  // ============================================================================
  // Alert severity style progression
  // ============================================================================

  describe('Alert severity style progression', () => {
    it('should use default variant for info, warning, critical', () => {
      expect(getAlertSeverityStyles('info').variant).toBe('default');
      expect(getAlertSeverityStyles('warning').variant).toBe('default');
      expect(getAlertSeverityStyles('critical').variant).toBe('default');
    });

    it('should use destructive variant only for danger', () => {
      expect(getAlertSeverityStyles('danger').variant).toBe('destructive');
    });

    it('should have distinct icon colors for each severity', () => {
      const colors = (['info', 'warning', 'critical', 'danger'] as const).map(
        (s) => getAlertSeverityStyles(s).iconColor
      );
      const unique = new Set(colors);
      expect(unique.size).toBe(4);
    });

    it('should have distinct background colors for each severity', () => {
      const bgs = (['info', 'warning', 'critical', 'danger'] as const).map(
        (s) => getAlertSeverityStyles(s).bgColor
      );
      const unique = new Set(bgs);
      expect(unique.size).toBe(4);
    });
  });

  // ============================================================================
  // Warning message content progression
  // ============================================================================

  describe('Warning message content escalation', () => {
    it('should escalate tone from gentle to urgent across thresholds', () => {
      const messages = LOW_BALANCE_WARNING_LEVELS.map(
        (t) => getWarningMessage(t, t)!
      );

      // 2000: informational — "Consider purchasing"
      expect(messages[0].description).toContain('Consider purchasing');

      // 1000: mild urgency — "may become unavailable"
      expect(messages[1].description).toContain('may become unavailable');

      // 500: action-oriented — "Purchase credits now"
      expect(messages[2].description).toContain('Purchase credits now');

      // 100: danger — "will be blocked"
      expect(messages[3].description).toContain('blocked');
    });

    it('should have unique titles at each threshold', () => {
      const titles = LOW_BALANCE_WARNING_LEVELS.map(
        (t) => getWarningMessage(t, t)!.title
      );
      const unique = new Set(titles);
      expect(unique.size).toBe(4);
    });
  });

  // ============================================================================
  // Threshold config consistency checks
  // ============================================================================

  describe('Threshold config consistency with constants', () => {
    it('should have CREDIT_THRESHOLD_CONFIGS match LOW_BALANCE_WARNING_LEVELS', () => {
      const configThresholds = CREDIT_THRESHOLD_CONFIGS.map((c) => c.threshold);
      expect(configThresholds).toEqual([...LOW_BALANCE_WARNING_LEVELS]);
    });

    it('should have CREDIT_WARNING_THRESHOLDS.FIRST_WARNING = 2000', () => {
      expect(CREDIT_WARNING_THRESHOLDS.FIRST_WARNING).toBe(2000);
    });

    it('should have CREDIT_WARNING_THRESHOLDS.WARNING_MODAL = 100', () => {
      expect(CREDIT_WARNING_THRESHOLDS.WARNING_MODAL).toBe(100);
    });

    it('should have CREDIT_WARNING_THRESHOLDS.BLOCKED = 0', () => {
      expect(CREDIT_WARNING_THRESHOLDS.BLOCKED).toBe(0);
    });
  });

  // ============================================================================
  // Edge cases: boundary values
  // ============================================================================

  describe('Boundary value transitions', () => {
    it('should change severity at exact threshold boundaries', () => {
      // Just above → just at each threshold
      expect(getCurrentThreshold(2001)).toBeNull();
      expect(getCurrentThreshold(2000)!.severity).toBe('info');

      expect(getCurrentThreshold(1001)!.severity).toBe('info');
      expect(getCurrentThreshold(1000)!.severity).toBe('warning');

      expect(getCurrentThreshold(501)!.severity).toBe('warning');
      expect(getCurrentThreshold(500)!.severity).toBe('critical');

      expect(getCurrentThreshold(101)!.severity).toBe('critical');
      expect(getCurrentThreshold(100)!.severity).toBe('danger');
    });

    it('should transition badge colors at exact boundaries', () => {
      // 2001 = healthy (emerald), 2000 = info (blue)
      expect(getBadgeColorClass(2001)).toContain('emerald');
      expect(getBadgeColorClass(2000)).toContain('blue');

      // 1001 = info (blue), 1000 = warning (amber)
      expect(getBadgeColorClass(1001)).toContain('blue');
      expect(getBadgeColorClass(1000)).toContain('amber');

      // 501 = warning (amber), 500 = critical (orange)
      expect(getBadgeColorClass(501)).toContain('amber');
      expect(getBadgeColorClass(500)).toContain('orange');

      // 101 = critical (orange), 100 = danger (red)
      expect(getBadgeColorClass(101)).toContain('orange');
      expect(getBadgeColorClass(100)).toContain('red');
    });

    it('should transition toast duration at the 500 boundary', () => {
      expect(getToastDuration(501)).toBe(5000);
      expect(getToastDuration(500)).toBe(8000);
    });

    it('should transition Buy button visibility at the 500 boundary', () => {
      expect(shouldShowBuyButton(501)).toBe(false);
      expect(shouldShowBuyButton(500)).toBe(true);
    });
  });

  // ============================================================================
  // Rapid balance drop: all thresholds still fire in order
  // ============================================================================

  describe('Rapid balance drop scenario', () => {
    it('should fire all 4 warnings when balance drops from 5000 to 10 in one step', () => {
      const shown = new Set<number>();
      const warnings: number[] = [];

      // Simulate repeated checks at balance=10
      for (let i = 0; i < 10; i++) {
        const warning = getNextWarning(10, shown);
        if (warning !== null) {
          shown.add(warning);
          warnings.push(warning);
        }
      }

      expect(warnings).toEqual([2000, 1000, 500, 100]);
    });

    it('should stop firing after all 4 warnings are shown', () => {
      const shown = new Set<number>();

      // Exhaust all warnings
      for (let i = 0; i < 10; i++) {
        const warning = getNextWarning(10, shown);
        if (warning !== null) shown.add(warning);
      }

      // No more warnings
      expect(getNextWarning(10, shown)).toBeNull();
      expect(getNextWarning(1, shown)).toBeNull();
      expect(getNextWarning(0, shown)).toBeNull();
    });
  });

  // ============================================================================
  // isLowCredits / isCriticalCredits / isOutOfCredits status flags
  // ============================================================================

  describe('Credit status flags at each threshold', () => {
    const isLowCredits = (balance: number) => balance <= 2000;
    const isCriticalCredits = (balance: number) => balance <= 100;
    const isOutOfCredits = (balance: number) => balance <= 0;

    it('should flag isLowCredits at 2000 and below', () => {
      expect(isLowCredits(2001)).toBe(false);
      expect(isLowCredits(2000)).toBe(true);
      expect(isLowCredits(1000)).toBe(true);
      expect(isLowCredits(100)).toBe(true);
      expect(isLowCredits(0)).toBe(true);
    });

    it('should flag isCriticalCredits at 100 and below', () => {
      expect(isCriticalCredits(101)).toBe(false);
      expect(isCriticalCredits(100)).toBe(true);
      expect(isCriticalCredits(50)).toBe(true);
      expect(isCriticalCredits(0)).toBe(true);
    });

    it('should flag isOutOfCredits at 0 and below', () => {
      expect(isOutOfCredits(1)).toBe(false);
      expect(isOutOfCredits(0)).toBe(true);
      expect(isOutOfCredits(-10)).toBe(true);
    });
  });
});
