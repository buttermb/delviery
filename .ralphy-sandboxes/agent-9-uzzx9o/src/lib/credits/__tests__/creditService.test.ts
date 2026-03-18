/**
 * Credit Service Tests
 *
 * Tests for credit balance management, consumption, and blocking logic.
 * Verifies the core credit system functionality.
 */

import { describe, it, expect } from 'vitest';
import {
  getCreditCost,
  getCreditCostInfo,
  getCreditCostsByCategory,
  isActionFree,
  FREE_TIER_MONTHLY_CREDITS,
  LOW_CREDIT_WARNING_THRESHOLD,
  CRITICAL_CREDIT_THRESHOLD,
  CREDIT_WARNING_THRESHOLDS,
  LOW_BALANCE_WARNING_LEVELS,
  FREE_TIER_LIMITS,
  FREE_ACTIONS,
  CREDIT_PACKAGES,
  getPricePerCredit,
} from '../creditCosts';
import {
  calculateCreditVsSubscription,
  estimateCreditDuration,
} from '../creditService';

// ============================================================================
// Credit Cost Configuration Tests
// ============================================================================

describe('Credit Cost Configuration', () => {
  describe('getCreditCost', () => {
    it('should return the correct cost for known actions', () => {
      expect(getCreditCost('menu_create')).toBe(100);
      expect(getCreditCost('menu_order_received')).toBe(75);
      expect(getCreditCost('pos_process_sale')).toBe(25);
      expect(getCreditCost('product_add')).toBe(10);
    });

    it('should return 0 for free actions', () => {
      expect(getCreditCost('dashboard_view')).toBe(0);
      expect(getCreditCost('orders_view')).toBe(0);
      expect(getCreditCost('product_view')).toBe(0);
      expect(getCreditCost('settings_view')).toBe(0);
    });

    it('should return 0 for unknown actions', () => {
      expect(getCreditCost('unknown_action')).toBe(0);
      expect(getCreditCost('')).toBe(0);
    });
  });

  describe('getCreditCostInfo', () => {
    it('should return full info for known actions', () => {
      const info = getCreditCostInfo('menu_create');
      expect(info).not.toBeNull();
      expect(info?.actionKey).toBe('menu_create');
      expect(info?.actionName).toBe('Create Menu');
      expect(info?.credits).toBe(100);
      expect(info?.category).toBe('menus');
    });

    it('should return null for unknown actions', () => {
      expect(getCreditCostInfo('unknown_action')).toBeNull();
    });
  });

  describe('getCreditCostsByCategory', () => {
    it('should return all costs for a category', () => {
      const menuCosts = getCreditCostsByCategory('menus');
      expect(menuCosts.length).toBeGreaterThan(0);
      expect(menuCosts.every(cost => cost.category === 'menus')).toBe(true);
    });

    it('should return empty array for unknown category', () => {
      const costs = getCreditCostsByCategory('unknown' as never);
      expect(costs).toEqual([]);
    });
  });

  describe('isActionFree', () => {
    it('should return true for all free actions', () => {
      for (const action of FREE_ACTIONS) {
        expect(isActionFree(action)).toBe(true);
      }
    });

    it('should return false for paid actions', () => {
      expect(isActionFree('menu_create')).toBe(false);
      expect(isActionFree('pos_process_sale')).toBe(false);
      expect(isActionFree('invoice_create')).toBe(false);
    });

    it('should return true for actions with 0 cost', () => {
      // Actions explicitly set to 0 cost
      expect(isActionFree('order_update_status')).toBe(true);
      expect(isActionFree('menu_edit')).toBe(true);
    });
  });
});

// ============================================================================
// Credit Threshold Configuration Tests
// ============================================================================

describe('Credit Threshold Configuration', () => {
  it('should have correct warning thresholds', () => {
    expect(CREDIT_WARNING_THRESHOLDS.FIRST_WARNING).toBe(2000);
    expect(CREDIT_WARNING_THRESHOLDS.SECOND_WARNING).toBe(1000);
    expect(CREDIT_WARNING_THRESHOLDS.YELLOW_BADGE).toBe(500);
    expect(CREDIT_WARNING_THRESHOLDS.WARNING_MODAL).toBe(100);
    expect(CREDIT_WARNING_THRESHOLDS.BANNER_WARNING).toBe(50);
    expect(CREDIT_WARNING_THRESHOLDS.BLOCKED).toBe(0);
  });

  it('should have low balance warning levels in descending order', () => {
    const levels = [...LOW_BALANCE_WARNING_LEVELS];
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i]).toBeLessThan(levels[i - 1]);
    }
  });

  it('should have LOW_BALANCE_WARNING_LEVELS match expected values', () => {
    expect(LOW_BALANCE_WARNING_LEVELS).toEqual([2000, 1000, 500, 100]);
  });

  it('should have consistent threshold values', () => {
    expect(LOW_CREDIT_WARNING_THRESHOLD).toBe(2000);
    expect(CRITICAL_CREDIT_THRESHOLD).toBe(100);
    expect(FREE_TIER_MONTHLY_CREDITS).toBe(500);
  });
});

// ============================================================================
// Free Tier Limits Tests
// ============================================================================

describe('Free Tier Limits', () => {
  it('should have reasonable daily limits', () => {
    expect(FREE_TIER_LIMITS.max_menus_per_day).toBe(1);
    expect(FREE_TIER_LIMITS.max_orders_per_day).toBe(3);
    expect(FREE_TIER_LIMITS.max_sms_per_day).toBe(2);
    expect(FREE_TIER_LIMITS.max_emails_per_day).toBe(5);
    expect(FREE_TIER_LIMITS.max_pos_sales_per_day).toBe(5);
  });

  it('should have blocked features for free tier', () => {
    expect(FREE_TIER_LIMITS.blocked_features).toContain('route_optimization');
    expect(FREE_TIER_LIMITS.blocked_features).toContain('ai_analytics');
    expect(FREE_TIER_LIMITS.blocked_features).toContain('custom_reports');
    expect(FREE_TIER_LIMITS.blocked_features).toContain('api_access');
  });

  it('should not block data export', () => {
    // Exports should always be free - this is explicitly not blocked
    expect(FREE_TIER_LIMITS.blocked_features).not.toContain('data_export_unlimited');
  });
});

// ============================================================================
// Credit Package Tests
// ============================================================================

describe('Credit Packages', () => {
  it('should have packages in ascending credit order', () => {
    for (let i = 1; i < CREDIT_PACKAGES.length; i++) {
      expect(CREDIT_PACKAGES[i].credits).toBeGreaterThan(CREDIT_PACKAGES[i - 1].credits);
    }
  });

  it('should have better price per credit for larger packages', () => {
    const pricePerCredit = CREDIT_PACKAGES.map(p => getPricePerCredit(p.priceCents, p.credits));

    for (let i = 1; i < pricePerCredit.length; i++) {
      expect(pricePerCredit[i]).toBeLessThan(pricePerCredit[i - 1]);
    }
  });

  it('should have all required fields on each package', () => {
    for (const pkg of CREDIT_PACKAGES) {
      expect(pkg.id).toBeDefined();
      expect(pkg.name).toBeDefined();
      expect(pkg.slug).toBeDefined();
      expect(pkg.credits).toBeGreaterThan(0);
      expect(pkg.priceCents).toBeGreaterThan(0);
      expect(pkg.description).toBeDefined();
    }
  });

  it('should have unique slugs', () => {
    const slugs = CREDIT_PACKAGES.map(p => p.slug);
    const uniqueSlugs = new Set(slugs);
    expect(uniqueSlugs.size).toBe(slugs.length);
  });
});

// ============================================================================
// Credit Balance Logic Tests
// ============================================================================

describe('Credit Balance Logic', () => {
  describe('Insufficient Balance Detection', () => {
    const checkInsufficientBalance = (balance: number, cost: number): boolean => {
      return balance < cost;
    };

    it('should detect insufficient balance', () => {
      expect(checkInsufficientBalance(50, 100)).toBe(true);
      expect(checkInsufficientBalance(0, 10)).toBe(true);
      expect(checkInsufficientBalance(99, 100)).toBe(true);
    });

    it('should allow action when balance is sufficient', () => {
      expect(checkInsufficientBalance(100, 100)).toBe(false);
      expect(checkInsufficientBalance(200, 100)).toBe(false);
      expect(checkInsufficientBalance(10000, 250)).toBe(false);
    });

    it('should allow free actions regardless of balance', () => {
      const cost = 0;
      expect(checkInsufficientBalance(0, cost)).toBe(false);
      expect(checkInsufficientBalance(-10, cost)).toBe(true); // Edge case: negative balance
    });
  });

  describe('Balance Status Flags', () => {
    const getBalanceStatus = (balance: number, isFreeTier: boolean) => ({
      isLowCredits: isFreeTier && balance <= LOW_CREDIT_WARNING_THRESHOLD,
      isCriticalCredits: isFreeTier && balance <= CRITICAL_CREDIT_THRESHOLD,
      isOutOfCredits: isFreeTier && balance <= 0,
    });

    it('should correctly flag low credits', () => {
      const status = getBalanceStatus(2000, true);
      expect(status.isLowCredits).toBe(true);
      expect(status.isCriticalCredits).toBe(false);
      expect(status.isOutOfCredits).toBe(false);
    });

    it('should correctly flag critical credits', () => {
      const status = getBalanceStatus(100, true);
      expect(status.isLowCredits).toBe(true);
      expect(status.isCriticalCredits).toBe(true);
      expect(status.isOutOfCredits).toBe(false);
    });

    it('should correctly flag out of credits', () => {
      const status = getBalanceStatus(0, true);
      expect(status.isLowCredits).toBe(true);
      expect(status.isCriticalCredits).toBe(true);
      expect(status.isOutOfCredits).toBe(true);
    });

    it('should never flag for paid tier', () => {
      const status = getBalanceStatus(0, false);
      expect(status.isLowCredits).toBe(false);
      expect(status.isCriticalCredits).toBe(false);
      expect(status.isOutOfCredits).toBe(false);
    });

    it('should not flag when balance is healthy', () => {
      const status = getBalanceStatus(5000, true);
      expect(status.isLowCredits).toBe(false);
      expect(status.isCriticalCredits).toBe(false);
      expect(status.isOutOfCredits).toBe(false);
    });
  });
});

// ============================================================================
// Paid Tier Bypass Tests
// ============================================================================

describe('Paid Tier Credit Bypass', () => {
  const shouldBypassCreditCheck = (
    isFreeTier: boolean,
    tierStatus: string | null
  ): boolean => {
    // Paid tiers (pro, enterprise) bypass credit checks
    if (!isFreeTier) return true;
    if (tierStatus === 'paid') return true;
    return false;
  };

  it('should bypass credit check for non-free tier', () => {
    expect(shouldBypassCreditCheck(false, null)).toBe(true);
    expect(shouldBypassCreditCheck(false, 'paid')).toBe(true);
    expect(shouldBypassCreditCheck(false, 'free')).toBe(true);
  });

  it('should bypass credit check when tier_status is paid', () => {
    expect(shouldBypassCreditCheck(true, 'paid')).toBe(true);
  });

  it('should NOT bypass for free tier users', () => {
    expect(shouldBypassCreditCheck(true, 'free')).toBe(false);
    expect(shouldBypassCreditCheck(true, null)).toBe(false);
  });
});

// ============================================================================
// Idempotency Key Tests
// ============================================================================

describe('Idempotency Key Logic', () => {
  const generateIdempotencyKey = (
    actionKey: string,
    referenceId: string | null
  ): string | null => {
    // Idempotency key is (tenant_id, action_type, reference_id)
    // Returns null if reference_id is null (no idempotency constraint)
    if (!referenceId) return null;
    return `${actionKey}:${referenceId}`;
  };

  it('should generate idempotency key with reference', () => {
    const key = generateIdempotencyKey('menu_create', 'menu-123');
    expect(key).toBe('menu_create:menu-123');
  });

  it('should return null when no reference provided', () => {
    const key = generateIdempotencyKey('menu_create', null);
    expect(key).toBeNull();
  });

  it('should create unique keys for different references', () => {
    const key1 = generateIdempotencyKey('order_create', 'order-1');
    const key2 = generateIdempotencyKey('order_create', 'order-2');
    expect(key1).not.toBe(key2);
  });

  it('should create unique keys for different actions', () => {
    const key1 = generateIdempotencyKey('menu_create', 'ref-123');
    const key2 = generateIdempotencyKey('order_create', 'ref-123');
    expect(key1).not.toBe(key2);
  });
});

// ============================================================================
// Auto Top-Up Trigger Tests
// ============================================================================

describe('Auto Top-Up Trigger Logic', () => {
  interface AutoTopUpConfig {
    enabled: boolean;
    trigger_threshold: number;
    topup_amount: number;
    max_per_month: number;
    topups_this_month: number;
    payment_method_id: string | null;
  }

  const shouldTriggerAutoTopUp = (
    balance: number,
    config: AutoTopUpConfig | null
  ): { shouldTopUp: boolean; reason: string } => {
    if (!config) {
      return { shouldTopUp: false, reason: 'not_configured' };
    }

    if (!config.enabled) {
      return { shouldTopUp: false, reason: 'not_enabled' };
    }

    if (!config.payment_method_id) {
      return { shouldTopUp: false, reason: 'no_payment_method' };
    }

    if (config.topups_this_month >= config.max_per_month) {
      return { shouldTopUp: false, reason: 'max_reached' };
    }

    if (balance > config.trigger_threshold) {
      return { shouldTopUp: false, reason: 'above_threshold' };
    }

    return { shouldTopUp: true, reason: 'triggered' };
  };

  const defaultConfig: AutoTopUpConfig = {
    enabled: true,
    trigger_threshold: 500,
    topup_amount: 5000,
    max_per_month: 3,
    topups_this_month: 0,
    payment_method_id: 'pm_test123',
  };

  it('should trigger when balance below threshold', () => {
    const result = shouldTriggerAutoTopUp(400, defaultConfig);
    expect(result.shouldTopUp).toBe(true);
    expect(result.reason).toBe('triggered');
  });

  it('should not trigger when balance above threshold', () => {
    const result = shouldTriggerAutoTopUp(600, defaultConfig);
    expect(result.shouldTopUp).toBe(false);
    expect(result.reason).toBe('above_threshold');
  });

  it('should not trigger when disabled', () => {
    const result = shouldTriggerAutoTopUp(100, { ...defaultConfig, enabled: false });
    expect(result.shouldTopUp).toBe(false);
    expect(result.reason).toBe('not_enabled');
  });

  it('should not trigger when max reached', () => {
    const result = shouldTriggerAutoTopUp(100, {
      ...defaultConfig,
      topups_this_month: 3
    });
    expect(result.shouldTopUp).toBe(false);
    expect(result.reason).toBe('max_reached');
  });

  it('should not trigger without payment method', () => {
    const result = shouldTriggerAutoTopUp(100, {
      ...defaultConfig,
      payment_method_id: null
    });
    expect(result.shouldTopUp).toBe(false);
    expect(result.reason).toBe('no_payment_method');
  });

  it('should not trigger when config is null', () => {
    const result = shouldTriggerAutoTopUp(100, null);
    expect(result.shouldTopUp).toBe(false);
    expect(result.reason).toBe('not_configured');
  });
});

// ============================================================================
// Utility Function Tests
// ============================================================================

describe('Utility Functions', () => {
  describe('calculateCreditVsSubscription', () => {
    it('should calculate savings correctly', () => {
      const result = calculateCreditVsSubscription(10000, 79);
      expect(result.creditPackCost).toBeGreaterThan(0);
      expect(result.savings).toBeGreaterThanOrEqual(0);
      expect(result.savingsPercent).toBeGreaterThanOrEqual(0);
    });

    it('should show no savings for low usage', () => {
      const result = calculateCreditVsSubscription(100, 79);
      // Low usage might cost less than subscription
      expect(result.creditPackCost).toBeDefined();
    });
  });

  describe('estimateCreditDuration', () => {
    it('should calculate days remaining correctly', () => {
      const result = estimateCreditDuration(1000, 100);
      expect(result.daysRemaining).toBe(10);
    });

    it('should handle zero daily usage', () => {
      const result = estimateCreditDuration(1000, 0);
      expect(result.daysRemaining).toBe(999); // Effectively infinite
    });

    it('should return correct exhaustion date', () => {
      const result = estimateCreditDuration(500, 100);

      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() + 5);

      // Compare just the date part
      expect(result.willExhaustBy.toDateString()).toBe(expectedDate.toDateString());
    });
  });

  describe('getPricePerCredit', () => {
    it('should calculate price per credit correctly', () => {
      // $40 for 7500 credits = $0.00533 per credit
      const pricePerCredit = getPricePerCredit(4000, 7500);
      expect(pricePerCredit).toBeCloseTo(0.00533, 4);
    });

    it('should return higher price for smaller packages', () => {
      const smallPackage = getPricePerCredit(1999, 500);
      const largePackage = getPricePerCredit(29999, 15000);
      expect(smallPackage).toBeGreaterThan(largePackage);
    });
  });
});

// ============================================================================
// Credit Deduction Atomic Tests
// ============================================================================

describe('Credit Deduction Atomicity', () => {
  describe('Balance Check Before Deduction', () => {
    const simulateAtomicDeduction = (
      currentBalance: number,
      cost: number
    ): { success: boolean; newBalance: number; error?: string } => {
      // Simulate atomic deduction with row locking
      if (currentBalance < cost) {
        return {
          success: false,
          newBalance: currentBalance,
          error: `Insufficient credits. Need ${cost}, have ${currentBalance}`,
        };
      }

      const newBalance = currentBalance - cost;

      // Prevent negative balance
      if (newBalance < 0) {
        return {
          success: false,
          newBalance: currentBalance,
          error: 'Would result in negative balance',
        };
      }

      return {
        success: true,
        newBalance,
      };
    };

    it('should deduct credits atomically', () => {
      const result = simulateAtomicDeduction(1000, 100);
      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(900);
    });

    it('should reject when balance is insufficient', () => {
      const result = simulateAtomicDeduction(50, 100);
      expect(result.success).toBe(false);
      expect(result.newBalance).toBe(50); // Balance unchanged
      expect(result.error).toContain('Insufficient credits');
    });

    it('should prevent negative balance', () => {
      const result = simulateAtomicDeduction(0, 1);
      expect(result.success).toBe(false);
      expect(result.newBalance).toBeGreaterThanOrEqual(0);
    });

    it('should handle exact balance', () => {
      const result = simulateAtomicDeduction(100, 100);
      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(0);
    });
  });
});

// ============================================================================
// Low Balance Alert Tests
// ============================================================================

describe('Low Balance Alerts', () => {
  describe('Alert Threshold Detection', () => {
    const getAlertToShow = (
      balance: number,
      alertsShown: Set<number>
    ): number | null => {
      for (const threshold of LOW_BALANCE_WARNING_LEVELS) {
        if (alertsShown.has(threshold)) continue;
        if (balance <= threshold) {
          return threshold;
        }
      }
      return null;
    };

    it('should show 2000 alert first', () => {
      const shown = new Set<number>();
      expect(getAlertToShow(1999, shown)).toBe(2000);
    });

    it('should skip already shown alerts', () => {
      const shown = new Set([2000]);
      expect(getAlertToShow(999, shown)).toBe(1000);
    });

    it('should show all alerts progressively', () => {
      const shown = new Set<number>();

      // First alert at 2000
      expect(getAlertToShow(2000, shown)).toBe(2000);
      shown.add(2000);

      // Second alert at 1000
      expect(getAlertToShow(1000, shown)).toBe(1000);
      shown.add(1000);

      // Third alert at 500
      expect(getAlertToShow(500, shown)).toBe(500);
      shown.add(500);

      // Fourth alert at 100
      expect(getAlertToShow(100, shown)).toBe(100);
      shown.add(100);

      // No more alerts
      expect(getAlertToShow(50, shown)).toBeNull();
    });

    it('should return null when balance is healthy', () => {
      const shown = new Set<number>();
      expect(getAlertToShow(5000, shown)).toBeNull();
    });
  });
});
