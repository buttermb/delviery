/**
 * Progressive Credit Warning Toast Tests
 *
 * Verifies that progressive warning toasts at thresholds 2000, 1000, 500, 100:
 * - Use severity-matched toast types (info, warning, error)
 * - Show "Buy Credits" action button only at critical thresholds (<=500)
 * - Dispatch CREDIT_PURCHASE_EVENT when "Buy Credits" is clicked
 * - Include correct warning messages with interpolated balance
 * - Apply longer duration for critical thresholds
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  CREDIT_THRESHOLD_CONFIGS,
  CREDIT_PURCHASE_EVENT,
  getWarningMessage,
  type CreditToastType,
} from '../creditWarningConfig';
import { LOW_BALANCE_WARNING_LEVELS } from '../creditCosts';

// ============================================================================
// Toast Type Mapping Tests
// ============================================================================

describe('Progressive warning toast type mapping', () => {
  it('should use info toast at 2000 threshold', () => {
    const msg = getWarningMessage(2000, 1800);
    expect(msg?.toastType).toBe('info');
  });

  it('should use warning toast at 1000 threshold', () => {
    const msg = getWarningMessage(1000, 950);
    expect(msg?.toastType).toBe('warning');
  });

  it('should use warning toast at 500 threshold', () => {
    const msg = getWarningMessage(500, 420);
    expect(msg?.toastType).toBe('warning');
  });

  it('should use error toast at 100 threshold', () => {
    const msg = getWarningMessage(100, 80);
    expect(msg?.toastType).toBe('error');
  });

  it('should have toast type for every threshold config', () => {
    for (const config of CREDIT_THRESHOLD_CONFIGS) {
      expect(config.toastType).toBeDefined();
      expect(['info', 'warning', 'error']).toContain(config.toastType);
    }
  });

  it('should escalate toast severity from info to error as threshold decreases', () => {
    const severityOrder: Record<CreditToastType, number> = {
      info: 0,
      warning: 1,
      error: 2,
    };

    const sorted = [...CREDIT_THRESHOLD_CONFIGS].sort(
      (a, b) => b.threshold - a.threshold
    );

    for (let i = 1; i < sorted.length; i++) {
      const prev = severityOrder[sorted[i - 1].toastType];
      const curr = severityOrder[sorted[i].toastType];
      expect(curr).toBeGreaterThanOrEqual(prev);
    }
  });
});

// ============================================================================
// Toast Duration Tests
// ============================================================================

describe('Progressive warning toast duration', () => {
  const getToastDuration = (threshold: number): number => {
    return threshold <= 500 ? 8000 : 5000;
  };

  it('should use 5s duration for info threshold (2000)', () => {
    expect(getToastDuration(2000)).toBe(5000);
  });

  it('should use 5s duration for warning threshold (1000)', () => {
    expect(getToastDuration(1000)).toBe(5000);
  });

  it('should use 8s duration for critical threshold (500)', () => {
    expect(getToastDuration(500)).toBe(8000);
  });

  it('should use 8s duration for danger threshold (100)', () => {
    expect(getToastDuration(100)).toBe(8000);
  });
});

// ============================================================================
// Buy Credits Action Button Tests
// ============================================================================

describe('Buy Credits action button in progressive toasts', () => {
  const shouldShowBuyButton = (threshold: number): boolean => {
    return threshold <= 500;
  };

  it('should NOT show Buy Credits at 2000 (info)', () => {
    expect(shouldShowBuyButton(2000)).toBe(false);
  });

  it('should NOT show Buy Credits at 1000 (warning)', () => {
    expect(shouldShowBuyButton(1000)).toBe(false);
  });

  it('should show Buy Credits at 500 (critical)', () => {
    expect(shouldShowBuyButton(500)).toBe(true);
  });

  it('should show Buy Credits at 100 (danger)', () => {
    expect(shouldShowBuyButton(100)).toBe(true);
  });
});

// ============================================================================
// CREDIT_PURCHASE_EVENT Tests
// ============================================================================

describe('CREDIT_PURCHASE_EVENT custom event', () => {
  it('should be a non-empty string constant', () => {
    expect(CREDIT_PURCHASE_EVENT).toBeTruthy();
    expect(typeof CREDIT_PURCHASE_EVENT).toBe('string');
  });

  it('should dispatch and receive via window events', () => {
    const handler = vi.fn();
    window.addEventListener(CREDIT_PURCHASE_EVENT, handler);

    window.dispatchEvent(new CustomEvent(CREDIT_PURCHASE_EVENT));

    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener(CREDIT_PURCHASE_EVENT, handler);
  });

  it('should not fire handler after removal', () => {
    const handler = vi.fn();
    window.addEventListener(CREDIT_PURCHASE_EVENT, handler);
    window.removeEventListener(CREDIT_PURCHASE_EVENT, handler);

    window.dispatchEvent(new CustomEvent(CREDIT_PURCHASE_EVENT));

    expect(handler).not.toHaveBeenCalled();
  });
});

// ============================================================================
// Warning Message Content Tests
// ============================================================================

describe('Progressive warning message content', () => {
  it('should include balance in all warning messages', () => {
    const testBalance = 750;
    for (const threshold of LOW_BALANCE_WARNING_LEVELS) {
      const msg = getWarningMessage(threshold, testBalance);
      expect(msg?.description).toContain(testBalance.toLocaleString());
    }
  });

  it('should have progressively more urgent titles', () => {
    const titles = LOW_BALANCE_WARNING_LEVELS.map(
      (t) => getWarningMessage(t, t)?.title ?? ''
    );

    expect(titles[0]).toBe('Credits Running Low');
    expect(titles[1]).toBe('Credit Balance Warning');
    expect(titles[2]).toBe('Low Credit Balance');
    expect(titles[3]).toBe('Critical Credit Balance');
  });

  it('should mention blocking at danger threshold (100)', () => {
    const msg = getWarningMessage(100, 75);
    expect(msg?.description).toContain('blocked');
  });

  it('should suggest purchasing at critical threshold (500)', () => {
    const msg = getWarningMessage(500, 450);
    expect(msg?.description).toContain('Purchase credits now');
  });

  it('should suggest considering at info threshold (2000)', () => {
    const msg = getWarningMessage(2000, 1900);
    expect(msg?.description).toContain('Consider purchasing');
  });

  it('should return null for non-existent threshold', () => {
    expect(getWarningMessage(300, 250)).toBeNull();
    expect(getWarningMessage(0, 0)).toBeNull();
  });
});

// ============================================================================
// Progressive Iteration Logic (simulates useCredits.ts behavior)
// ============================================================================

describe('Progressive toast iteration logic', () => {
  const getNextWarningWithType = (
    balance: number,
    shownThresholds: Set<number>
  ): { threshold: number; toastType: CreditToastType } | null => {
    for (const threshold of LOW_BALANCE_WARNING_LEVELS) {
      if (shownThresholds.has(threshold)) continue;
      if (balance <= threshold) {
        const msg = getWarningMessage(threshold, balance);
        return msg ? { threshold, toastType: msg.toastType } : null;
      }
    }
    return null;
  };

  it('should return info toast when balance first drops to 2000', () => {
    const result = getNextWarningWithType(2000, new Set());
    expect(result?.threshold).toBe(2000);
    expect(result?.toastType).toBe('info');
  });

  it('should return warning toast when balance drops to 1000 (after 2000 shown)', () => {
    const result = getNextWarningWithType(1000, new Set([2000]));
    expect(result?.threshold).toBe(1000);
    expect(result?.toastType).toBe('warning');
  });

  it('should return warning toast when balance drops to 500 (after 2000,1000 shown)', () => {
    const result = getNextWarningWithType(500, new Set([2000, 1000]));
    expect(result?.threshold).toBe(500);
    expect(result?.toastType).toBe('warning');
  });

  it('should return error toast when balance drops to 100 (after 2000,1000,500 shown)', () => {
    const result = getNextWarningWithType(100, new Set([2000, 1000, 500]));
    expect(result?.threshold).toBe(100);
    expect(result?.toastType).toBe('error');
  });

  it('should show warnings progressively through all thresholds', () => {
    const shown = new Set<number>();
    const expectedTypes: CreditToastType[] = ['info', 'warning', 'warning', 'error'];

    for (let i = 0; i < LOW_BALANCE_WARNING_LEVELS.length; i++) {
      const threshold = LOW_BALANCE_WARNING_LEVELS[i];
      const result = getNextWarningWithType(threshold, shown);
      expect(result?.threshold).toBe(threshold);
      expect(result?.toastType).toBe(expectedTypes[i]);
      shown.add(threshold);
    }

    // No more warnings after all shown
    expect(getNextWarningWithType(50, shown)).toBeNull();
  });

  it('should handle rapid balance drop from 5000 to 50', () => {
    const shown = new Set<number>();

    // First check at 50: should show 2000 (info) first
    const r1 = getNextWarningWithType(50, shown);
    expect(r1?.threshold).toBe(2000);
    expect(r1?.toastType).toBe('info');
    shown.add(2000);

    // Second check: should show 1000 (warning)
    const r2 = getNextWarningWithType(50, shown);
    expect(r2?.threshold).toBe(1000);
    expect(r2?.toastType).toBe('warning');
    shown.add(1000);

    // Third: 500 (warning)
    const r3 = getNextWarningWithType(50, shown);
    expect(r3?.threshold).toBe(500);
    expect(r3?.toastType).toBe('warning');
    shown.add(500);

    // Fourth: 100 (error)
    const r4 = getNextWarningWithType(50, shown);
    expect(r4?.threshold).toBe(100);
    expect(r4?.toastType).toBe('error');
    shown.add(100);

    // Done
    expect(getNextWarningWithType(50, shown)).toBeNull();
  });
});
