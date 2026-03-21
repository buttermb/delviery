/**
 * Plan Pricing Consistency Tests
 * Verifies that PLAN_CONFIG, TIER_NAMES, and TIER_PRICES stay in sync
 */

import { describe, it, expect } from 'vitest';
import { PLAN_CONFIG } from '../planPricing';
import { TIER_NAMES, TIER_PRICES } from '@/lib/featureConfig';

describe('Plan pricing consistency', () => {
  it('PLAN_CONFIG plan names match TIER_NAMES', () => {
    expect(PLAN_CONFIG.starter.name).toBe(TIER_NAMES.starter);
    expect(PLAN_CONFIG.professional.name).toBe(TIER_NAMES.professional);
    expect(PLAN_CONFIG.enterprise.name).toBe(TIER_NAMES.enterprise);
  });

  it('PLAN_CONFIG monthly prices match TIER_PRICES', () => {
    expect(PLAN_CONFIG.starter.priceMonthly).toBe(TIER_PRICES.starter);
    expect(PLAN_CONFIG.professional.priceMonthly).toBe(TIER_PRICES.professional);
    expect(PLAN_CONFIG.enterprise.priceMonthly).toBe(TIER_PRICES.enterprise);
  });

  it('PLAN_CONFIG covers all paid tiers in TIER_NAMES', () => {
    const tierKeys = Object.keys(TIER_NAMES);
    const paidPlanKeys = Object.keys(PLAN_CONFIG).filter((k) => k !== 'free');
    expect(paidPlanKeys).toEqual(expect.arrayContaining(tierKeys));
    expect(tierKeys).toEqual(expect.arrayContaining(paidPlanKeys));
  });

  it('yearly prices are less than 12x monthly for all paid plans', () => {
    const paidPlans = Object.entries(PLAN_CONFIG).filter(([key]) => key !== 'free');
    for (const [key, config] of paidPlans) {
      const annualAtMonthly = config.priceMonthly * 12;
      expect(config.priceYearly).toBeLessThan(annualAtMonthly);
      expect(config.priceYearly).toBeGreaterThan(0);
      // Verify ~17% savings (allow 15-20% range)
      const savingsPercent = ((annualAtMonthly - config.priceYearly) / annualAtMonthly) * 100;
      expect(savingsPercent).toBeGreaterThanOrEqual(15);
      expect(savingsPercent).toBeLessThanOrEqual(20);
    }
  });

  it('free tier has zero pricing', () => {
    expect(PLAN_CONFIG.free.priceMonthly).toBe(0);
    expect(PLAN_CONFIG.free.priceYearly).toBe(0);
  });

  it('all paid plans have Stripe price and product IDs', () => {
    const paidPlans = Object.entries(PLAN_CONFIG).filter(([key]) => key !== 'free');
    for (const [key, config] of paidPlans) {
      expect(config.stripePriceId).toBeTruthy();
      expect(config.stripeProductId).toBeTruthy();
    }
  });
});
