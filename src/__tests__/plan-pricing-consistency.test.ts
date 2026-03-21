/**
 * Plan Pricing Consistency Tests
 *
 * Ensures PLAN_CONFIG (planPricing.ts) and TIER_PRICES (featureConfig.ts) stay
 * in sync. Any drift between these canonical sources would cause billing display
 * inconsistencies across SelectPlanPage, BillingPage, and BillingSettings.
 */

import { describe, it, expect } from 'vitest';
import { PLAN_CONFIG } from '@/config/planPricing';
import { TIER_PRICES, TIER_NAMES } from '@/lib/featureConfig';

const PAID_TIERS = ['starter', 'professional', 'enterprise'] as const;

describe('Plan pricing consistency', () => {
  it.each(PAID_TIERS)(
    'PLAN_CONFIG.%s.priceMonthly matches TIER_PRICES.%s',
    (tier) => {
      expect(PLAN_CONFIG[tier].priceMonthly).toBe(TIER_PRICES[tier]);
    },
  );

  it.each(PAID_TIERS)(
    'PLAN_CONFIG.%s.name matches TIER_NAMES.%s',
    (tier) => {
      expect(PLAN_CONFIG[tier].name).toBe(TIER_NAMES[tier]);
    },
  );

  it.each(PAID_TIERS)(
    'PLAN_CONFIG.%s yearly price equals ~10x monthly (2 months free)',
    (tier) => {
      const { priceMonthly, priceYearly } = PLAN_CONFIG[tier];
      expect(priceYearly).toBe(priceMonthly * 10);
    },
  );

  it('free tier has zero prices', () => {
    expect(PLAN_CONFIG.free.priceMonthly).toBe(0);
    expect(PLAN_CONFIG.free.priceYearly).toBe(0);
  });

  it('canonical prices are non-negative', () => {
    for (const tier of PAID_TIERS) {
      expect(PLAN_CONFIG[tier].priceMonthly).toBeGreaterThan(0);
      expect(PLAN_CONFIG[tier].priceYearly).toBeGreaterThan(0);
    }
  });

  it('tiers are in ascending price order', () => {
    expect(TIER_PRICES.starter).toBeLessThan(TIER_PRICES.professional);
    expect(TIER_PRICES.professional).toBeLessThan(TIER_PRICES.enterprise);
  });
});
