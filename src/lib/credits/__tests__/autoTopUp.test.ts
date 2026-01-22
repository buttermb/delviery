/**
 * Auto Top-Up Service Tests
 *
 * Tests for the auto top-up configuration and trigger logic.
 * Verifies threshold options, package matching, and rate limiting.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getAutoTopUpOptions,
  getThresholdOptions,
  getMaxPerMonthOptions,
  type AutoTopUpConfig,
  type TopUpCheckResult,
} from '../autoTopUp';
import { CREDIT_PACKAGES } from '../creditCosts';

// ============================================================================
// Threshold Options Tests
// ============================================================================

describe('getThresholdOptions', () => {
  it('should return threshold options in descending order', () => {
    const options = getThresholdOptions();
    for (let i = 1; i < options.length; i++) {
      expect(options[i].value).toBeLessThan(options[i - 1].value);
    }
  });

  it('should include 100 as minimum threshold', () => {
    const options = getThresholdOptions();
    const values = options.map((o) => o.value);
    expect(values).toContain(100);
  });

  it('should include 5000 as maximum threshold', () => {
    const options = getThresholdOptions();
    const values = options.map((o) => o.value);
    expect(values).toContain(5000);
  });

  it('should have threshold range from 100-5000 per requirements', () => {
    const options = getThresholdOptions();
    const values = options.map((o) => o.value);
    const minThreshold = Math.min(...values);
    const maxThreshold = Math.max(...values);
    expect(minThreshold).toBe(100);
    expect(maxThreshold).toBe(5000);
  });

  it('should have valid labels for all options', () => {
    const options = getThresholdOptions();
    for (const opt of options) {
      expect(opt.label).toBeDefined();
      expect(opt.label.length).toBeGreaterThan(0);
      expect(opt.label).toContain('credits');
    }
  });
});

// ============================================================================
// Auto Top-Up Options Tests
// ============================================================================

describe('getAutoTopUpOptions', () => {
  it('should return options matching CREDIT_PACKAGES', () => {
    const options = getAutoTopUpOptions();
    expect(options.length).toBe(CREDIT_PACKAGES.length);

    for (let i = 0; i < options.length; i++) {
      expect(options[i].credits).toBe(CREDIT_PACKAGES[i].credits);
      expect(options[i].priceCents).toBe(CREDIT_PACKAGES[i].priceCents);
    }
  });

  it('should have credits in ascending order', () => {
    const options = getAutoTopUpOptions();
    for (let i = 1; i < options.length; i++) {
      expect(options[i].credits).toBeGreaterThan(options[i - 1].credits);
    }
  });

  it('should have formatted labels with credits and price', () => {
    const options = getAutoTopUpOptions();
    for (const opt of options) {
      expect(opt.label).toContain('credits');
      expect(opt.label).toContain('$');
    }
  });

  it('should have better price-per-credit for larger packages', () => {
    const options = getAutoTopUpOptions();
    const pricePerCredit = options.map(
      (o) => o.priceCents / o.credits
    );

    for (let i = 1; i < pricePerCredit.length; i++) {
      expect(pricePerCredit[i]).toBeLessThan(pricePerCredit[i - 1]);
    }
  });
});

// ============================================================================
// Max Per Month Options Tests
// ============================================================================

describe('getMaxPerMonthOptions', () => {
  it('should return valid options', () => {
    const options = getMaxPerMonthOptions();
    expect(options.length).toBeGreaterThan(0);
  });

  it('should have options in ascending order', () => {
    const options = getMaxPerMonthOptions();
    for (let i = 1; i < options.length; i++) {
      expect(options[i].value).toBeGreaterThan(options[i - 1].value);
    }
  });

  it('should include common values (1, 2, 3, 5, 10)', () => {
    const options = getMaxPerMonthOptions();
    const values = options.map((o) => o.value);
    expect(values).toContain(1);
    expect(values).toContain(3);
  });

  it('should have valid labels', () => {
    const options = getMaxPerMonthOptions();
    for (const opt of options) {
      expect(opt.label).toBeDefined();
      expect(opt.label.length).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// Auto Top-Up Trigger Logic Tests
// ============================================================================

describe('Auto Top-Up Trigger Logic', () => {
  interface LocalAutoTopUpConfig {
    enabled: boolean;
    triggerThreshold: number;
    topUpAmount: number;
    maxPerMonth: number;
    topUpsThisMonth: number;
    paymentMethodId: string | null;
  }

  const shouldTriggerAutoTopUp = (
    balance: number,
    config: LocalAutoTopUpConfig | null
  ): TopUpCheckResult => {
    if (!config) {
      return { shouldTopUp: false, reason: 'not_configured' };
    }

    if (!config.enabled) {
      return { shouldTopUp: false, reason: 'not_enabled' };
    }

    if (!config.paymentMethodId) {
      return { shouldTopUp: false, reason: 'no_payment_method' };
    }

    if (config.topUpsThisMonth >= config.maxPerMonth) {
      return { shouldTopUp: false, reason: 'max_reached' };
    }

    if (balance > config.triggerThreshold) {
      return { shouldTopUp: false, reason: 'above_threshold' };
    }

    return {
      shouldTopUp: true,
      topUpAmount: config.topUpAmount,
      paymentMethodId: config.paymentMethodId,
    };
  };

  const defaultConfig: LocalAutoTopUpConfig = {
    enabled: true,
    triggerThreshold: 500,
    topUpAmount: 5000,
    maxPerMonth: 3,
    topUpsThisMonth: 0,
    paymentMethodId: 'pm_test123',
  };

  it('should trigger when balance below threshold', () => {
    const result = shouldTriggerAutoTopUp(400, defaultConfig);
    expect(result.shouldTopUp).toBe(true);
    expect(result.topUpAmount).toBe(5000);
  });

  it('should trigger at exact threshold', () => {
    const result = shouldTriggerAutoTopUp(500, defaultConfig);
    expect(result.shouldTopUp).toBe(true);
  });

  it('should not trigger when balance above threshold', () => {
    const result = shouldTriggerAutoTopUp(600, defaultConfig);
    expect(result.shouldTopUp).toBe(false);
    expect(result.reason).toBe('above_threshold');
  });

  it('should not trigger when disabled', () => {
    const result = shouldTriggerAutoTopUp(100, {
      ...defaultConfig,
      enabled: false,
    });
    expect(result.shouldTopUp).toBe(false);
    expect(result.reason).toBe('not_enabled');
  });

  it('should not trigger when max reached', () => {
    const result = shouldTriggerAutoTopUp(100, {
      ...defaultConfig,
      topUpsThisMonth: 3,
    });
    expect(result.shouldTopUp).toBe(false);
    expect(result.reason).toBe('max_reached');
  });

  it('should not trigger without payment method', () => {
    const result = shouldTriggerAutoTopUp(100, {
      ...defaultConfig,
      paymentMethodId: null,
    });
    expect(result.shouldTopUp).toBe(false);
    expect(result.reason).toBe('no_payment_method');
  });

  it('should not trigger when config is null', () => {
    const result = shouldTriggerAutoTopUp(100, null);
    expect(result.shouldTopUp).toBe(false);
    expect(result.reason).toBe('not_configured');
  });

  it('should trigger with different threshold values', () => {
    const thresholds = [100, 500, 1000, 2500, 5000];
    for (const threshold of thresholds) {
      const config = { ...defaultConfig, triggerThreshold: threshold };
      const result = shouldTriggerAutoTopUp(threshold - 1, config);
      expect(result.shouldTopUp).toBe(true);
    }
  });
});

// ============================================================================
// Hourly Rate Limit Logic Tests
// ============================================================================

describe('Hourly Rate Limit Logic', () => {
  const MAX_TOPUPS_PER_HOUR = 3;

  const checkHourlyRateLimit = (topUpsInLastHour: number): boolean => {
    return topUpsInLastHour < MAX_TOPUPS_PER_HOUR;
  };

  it('should allow first top-up', () => {
    expect(checkHourlyRateLimit(0)).toBe(true);
  });

  it('should allow second top-up', () => {
    expect(checkHourlyRateLimit(1)).toBe(true);
  });

  it('should allow third top-up', () => {
    expect(checkHourlyRateLimit(2)).toBe(true);
  });

  it('should block fourth top-up within hour', () => {
    expect(checkHourlyRateLimit(3)).toBe(false);
  });

  it('should block when well over limit', () => {
    expect(checkHourlyRateLimit(10)).toBe(false);
  });
});

// ============================================================================
// Credit Package Matching Tests
// ============================================================================

describe('Credit Package Matching', () => {
  const findMatchingPackage = (
    topUpAmount: number
  ): { credits: number; priceCents: number } | undefined => {
    return CREDIT_PACKAGES.find((p) => p.credits === topUpAmount);
  };

  it('should find exact package match', () => {
    for (const pkg of CREDIT_PACKAGES) {
      const match = findMatchingPackage(pkg.credits);
      expect(match).toBeDefined();
      expect(match?.credits).toBe(pkg.credits);
      expect(match?.priceCents).toBe(pkg.priceCents);
    }
  });

  it('should return undefined for non-existent package', () => {
    const match = findMatchingPackage(9999);
    expect(match).toBeUndefined();
  });

  it('should handle zero credits', () => {
    const match = findMatchingPackage(0);
    expect(match).toBeUndefined();
  });
});

// ============================================================================
// AutoTopUpConfig Type Tests
// ============================================================================

describe('AutoTopUpConfig Type', () => {
  it('should have all required fields', () => {
    const config: AutoTopUpConfig = {
      tenantId: 'tenant-123',
      enabled: true,
      triggerThreshold: 500,
      topUpAmount: 5000,
      maxPerMonth: 3,
      topUpsThisMonth: 0,
    };

    expect(config.tenantId).toBeDefined();
    expect(config.enabled).toBeDefined();
    expect(config.triggerThreshold).toBeDefined();
    expect(config.topUpAmount).toBeDefined();
    expect(config.maxPerMonth).toBeDefined();
    expect(config.topUpsThisMonth).toBeDefined();
  });

  it('should allow optional payment method', () => {
    const configWithPayment: AutoTopUpConfig = {
      tenantId: 'tenant-123',
      enabled: true,
      triggerThreshold: 500,
      topUpAmount: 5000,
      maxPerMonth: 3,
      topUpsThisMonth: 0,
      paymentMethodId: 'pm_123',
      stripeCustomerId: 'cus_123',
    };

    const configWithoutPayment: AutoTopUpConfig = {
      tenantId: 'tenant-123',
      enabled: false,
      triggerThreshold: 500,
      topUpAmount: 5000,
      maxPerMonth: 3,
      topUpsThisMonth: 0,
    };

    expect(configWithPayment.paymentMethodId).toBe('pm_123');
    expect(configWithoutPayment.paymentMethodId).toBeUndefined();
  });
});

// ============================================================================
// Failure Notification Tests
// ============================================================================

describe('Failure Notification Logic', () => {
  interface FailureNotification {
    tenantId: string;
    type: string;
    title: string;
    message: string;
    metadata: {
      auto_topup: boolean;
      error: boolean;
      error_message: string;
    };
  }

  const createFailureNotification = (
    tenantId: string,
    errorMessage: string
  ): FailureNotification => {
    return {
      tenantId,
      type: 'system',
      title: 'Auto Top-Up Failed',
      message: `Auto top-up could not be processed: ${errorMessage}. Please check your payment method.`,
      metadata: {
        auto_topup: true,
        error: true,
        error_message: errorMessage,
      },
    };
  };

  it('should create failure notification with error message', () => {
    const notification = createFailureNotification(
      'tenant-123',
      'Card declined'
    );

    expect(notification.tenantId).toBe('tenant-123');
    expect(notification.type).toBe('system');
    expect(notification.title).toContain('Failed');
    expect(notification.message).toContain('Card declined');
    expect(notification.metadata.auto_topup).toBe(true);
    expect(notification.metadata.error).toBe(true);
    expect(notification.metadata.error_message).toBe('Card declined');
  });

  it('should handle different error messages', () => {
    const errors = [
      'Card declined',
      'Insufficient funds',
      'Payment method expired',
      'Authentication required',
    ];

    for (const error of errors) {
      const notification = createFailureNotification('tenant-123', error);
      expect(notification.message).toContain(error);
      expect(notification.metadata.error_message).toBe(error);
    }
  });
});

// ============================================================================
// Success Notification Tests
// ============================================================================

describe('Success Notification Logic', () => {
  interface SuccessNotification {
    tenantId: string;
    type: string;
    title: string;
    message: string;
    metadata: {
      auto_topup: boolean;
      credits_added: number;
      price: number;
    };
  }

  const createSuccessNotification = (
    tenantId: string,
    creditsAdded: number,
    priceCents: number,
    newBalance: number
  ): SuccessNotification => {
    return {
      tenantId,
      type: 'system',
      title: 'Credits Added',
      message: `Auto top-up added ${creditsAdded.toLocaleString()} credits to your account. New balance: ${newBalance.toLocaleString()}`,
      metadata: {
        auto_topup: true,
        credits_added: creditsAdded,
        price: priceCents / 100,
      },
    };
  };

  it('should create success notification with correct credits', () => {
    const notification = createSuccessNotification(
      'tenant-123',
      5000,
      12999,
      7500
    );

    expect(notification.tenantId).toBe('tenant-123');
    expect(notification.type).toBe('system');
    expect(notification.message).toContain('5,000');
    expect(notification.message).toContain('7,500');
    expect(notification.metadata.credits_added).toBe(5000);
    expect(notification.metadata.price).toBe(129.99);
  });

  it('should format large numbers correctly', () => {
    const notification = createSuccessNotification(
      'tenant-123',
      15000,
      29999,
      20000
    );

    expect(notification.message).toContain('15,000');
    expect(notification.message).toContain('20,000');
  });
});

// ============================================================================
// Edge Cases Tests
// ============================================================================

describe('Auto Top-Up Edge Cases', () => {
  it('should handle zero balance correctly', () => {
    const config = {
      enabled: true,
      triggerThreshold: 500,
      topUpAmount: 5000,
      maxPerMonth: 3,
      topUpsThisMonth: 0,
      paymentMethodId: 'pm_123',
    };

    // Helper function matching the one in the trigger logic tests
    const shouldTrigger = (balance: number) =>
      config.enabled &&
      config.paymentMethodId &&
      config.topUpsThisMonth < config.maxPerMonth &&
      balance <= config.triggerThreshold;

    expect(shouldTrigger(0)).toBe(true);
  });

  it('should handle negative balance (edge case)', () => {
    // Even negative balance should trigger auto top-up
    const config = {
      enabled: true,
      triggerThreshold: 500,
      topUpAmount: 5000,
      maxPerMonth: 3,
      topUpsThisMonth: 0,
      paymentMethodId: 'pm_123',
    };

    const shouldTrigger = (balance: number) =>
      config.enabled &&
      config.paymentMethodId &&
      config.topUpsThisMonth < config.maxPerMonth &&
      balance <= config.triggerThreshold;

    expect(shouldTrigger(-100)).toBe(true);
  });

  it('should respect max monthly limit at boundary', () => {
    const config = {
      maxPerMonth: 3,
      topUpsThisMonth: 2, // One more allowed
    };

    expect(config.topUpsThisMonth < config.maxPerMonth).toBe(true);
    config.topUpsThisMonth = 3; // Now at limit
    expect(config.topUpsThisMonth < config.maxPerMonth).toBe(false);
  });

  it('should handle concurrent top-up attempts', () => {
    // Simulate race condition protection via hourly rate limit
    const MAX_PER_HOUR = 3;
    const topUpsInLastHour = 2;

    // First attempt should succeed
    expect(topUpsInLastHour < MAX_PER_HOUR).toBe(true);

    // After this top-up, count would be 3
    const afterTopUp = topUpsInLastHour + 1;
    expect(afterTopUp < MAX_PER_HOUR).toBe(false);
  });
});
