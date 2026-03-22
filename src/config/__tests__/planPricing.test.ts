/**
 * Plan Pricing Consistency Tests
 *
 * Validates that PLAN_CONFIG in planPricing.ts is internally consistent
 * and documents the expected Stripe price/product IDs so that any drift
 * is caught early.
 *
 * Also verifies consistency with TIER_NAMES and TIER_PRICES, and guards
 * against yearly price IDs duplicating monthly IDs (billing safety).
 */

import { describe, it, expect } from 'vitest';
import { PLAN_CONFIG, getPlanConfig, isValidPlan, type PlanKey } from '@/config/planPricing';
import { TIER_NAMES, TIER_PRICES } from '@/lib/featureConfig';

const paidPlans = ['starter', 'professional', 'enterprise'] as const;

describe('PLAN_CONFIG', () => {
  it('defines exactly four plans: free, starter, professional, enterprise', () => {
    const planKeys = Object.keys(PLAN_CONFIG);
    expect(planKeys).toHaveLength(4);
    expect(planKeys).toEqual(['free', 'starter', 'professional', 'enterprise']);
  });

  it('every plan has all required fields', () => {
    const requiredFields = [
      'name',
      'priceMonthly',
      'priceYearly',
      'stripePriceId',
      'stripePriceIdYearly',
      'stripeProductId',
      'description',
      'trialDays',
    ];

    for (const [key, plan] of Object.entries(PLAN_CONFIG)) {
      for (const field of requiredFields) {
        expect(plan).toHaveProperty(field);
      }
      expect(plan.name.toLowerCase()).toContain(key === 'free' ? 'free' : key);
    }
  });

  it('free plan has null Stripe IDs and zero pricing', () => {
    expect(PLAN_CONFIG.free.stripePriceId).toBeNull();
    expect(PLAN_CONFIG.free.stripePriceIdYearly).toBeNull();
    expect(PLAN_CONFIG.free.stripeProductId).toBeNull();
    expect(PLAN_CONFIG.free.priceMonthly).toBe(0);
    expect(PLAN_CONFIG.free.priceYearly).toBe(0);
  });

  it('all plans have a name and description', () => {
    for (const key of Object.keys(PLAN_CONFIG) as PlanKey[]) {
      const plan = PLAN_CONFIG[key];
      expect(plan.name).toBeTruthy();
      expect(plan.description).toBeTruthy();
    }
  });

  it('all plans have 14-day trial period', () => {
    for (const key of Object.keys(PLAN_CONFIG) as PlanKey[]) {
      expect(PLAN_CONFIG[key].trialDays).toBe(14);
    }
  });

  it('prices match expected values (guards against accidental changes)', () => {
    expect(PLAN_CONFIG.starter.priceMonthly).toBe(79);
    expect(PLAN_CONFIG.starter.priceYearly).toBe(790);
    expect(PLAN_CONFIG.professional.priceMonthly).toBe(150);
    expect(PLAN_CONFIG.professional.priceYearly).toBe(1500);
    expect(PLAN_CONFIG.enterprise.priceMonthly).toBe(499);
    expect(PLAN_CONFIG.enterprise.priceYearly).toBe(4990);
  });

  it('prices increase across tiers', () => {
    expect(PLAN_CONFIG.starter.priceMonthly).toBeLessThan(PLAN_CONFIG.professional.priceMonthly);
    expect(PLAN_CONFIG.professional.priceMonthly).toBeLessThan(PLAN_CONFIG.enterprise.priceMonthly);
    expect(PLAN_CONFIG.starter.priceYearly).toBeLessThan(PLAN_CONFIG.professional.priceYearly);
    expect(PLAN_CONFIG.professional.priceYearly).toBeLessThan(PLAN_CONFIG.enterprise.priceYearly);
  });

  describe('Stripe Price IDs', () => {
    it('all paid plans have monthly Stripe price IDs', () => {
      for (const key of paidPlans) {
        const plan = PLAN_CONFIG[key];
        expect(plan.stripePriceId).toBeTruthy();
        expect(plan.stripePriceId).toMatch(/^price_/);
      }
    });

    it('all paid plans have Stripe product IDs', () => {
      for (const key of paidPlans) {
        const plan = PLAN_CONFIG[key];
        expect(plan.stripeProductId).toBeTruthy();
        expect(plan.stripeProductId).toMatch(/^prod_/);
      }
    });

    it('monthly Stripe price IDs are unique across plans', () => {
      const priceIds = paidPlans
        .map(key => PLAN_CONFIG[key].stripePriceId)
        .filter(Boolean);
      const unique = [...new Set(priceIds)];
      expect(priceIds.length).toBe(unique.length);
    });

    it('yearly Stripe price IDs must not duplicate monthly IDs (prevents billing errors)', () => {
      // This is the critical safety test: if yearly IDs equal monthly IDs,
      // customers would be charged the wrong amount on the wrong interval.
      for (const key of paidPlans) {
        const plan = PLAN_CONFIG[key];
        if (plan.stripePriceIdYearly !== null) {
          expect(plan.stripePriceIdYearly).not.toBe(plan.stripePriceId);
        }
      }
    });
  });
});

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

  it('yearly savings are in the 15-20% range for all paid plans', () => {
    const allPaidPlans = Object.entries(PLAN_CONFIG).filter(([key]) => key !== 'free');
    for (const [, config] of allPaidPlans) {
      const annualAtMonthly = config.priceMonthly * 12;
      expect(config.priceYearly).toBeLessThan(annualAtMonthly);
      expect(config.priceYearly).toBeGreaterThan(0);
      const savingsPercent = ((annualAtMonthly - config.priceYearly) / annualAtMonthly) * 100;
      expect(savingsPercent).toBeGreaterThanOrEqual(15);
      expect(savingsPercent).toBeLessThanOrEqual(20);
    }
  });
});

describe('getPlanConfig', () => {
  it('returns correct config for valid plan keys', () => {
    expect(getPlanConfig('starter')).toBe(PLAN_CONFIG.starter);
    expect(getPlanConfig('professional')).toBe(PLAN_CONFIG.professional);
    expect(getPlanConfig('enterprise')).toBe(PLAN_CONFIG.enterprise);
    expect(getPlanConfig('free')).toBe(PLAN_CONFIG.free);
  });

  it('returns free plan for null', () => {
    expect(getPlanConfig(null)).toBe(PLAN_CONFIG.free);
  });

  it('returns free plan for unknown keys', () => {
    expect(getPlanConfig('nonexistent')).toBe(PLAN_CONFIG.free);
    expect(getPlanConfig('unknown')).toBe(PLAN_CONFIG.free);
    expect(getPlanConfig('')).toBe(PLAN_CONFIG.free);
  });

  it('is case-insensitive', () => {
    expect(getPlanConfig('STARTER')).toBe(PLAN_CONFIG.starter);
    expect(getPlanConfig('Professional')).toBe(PLAN_CONFIG.professional);
    expect(getPlanConfig('FREE')).toBe(PLAN_CONFIG.free);
    expect(getPlanConfig('PROFESSIONAL')).toBe(PLAN_CONFIG.professional);
  });
});

describe('isValidPlan', () => {
  it('returns true for valid plan keys', () => {
    expect(isValidPlan('free')).toBe(true);
    expect(isValidPlan('starter')).toBe(true);
    expect(isValidPlan('professional')).toBe(true);
    expect(isValidPlan('enterprise')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isValidPlan('STARTER')).toBe(true);
    expect(isValidPlan('Enterprise')).toBe(true);
  });

  it('returns false for null or invalid keys', () => {
    expect(isValidPlan(null)).toBe(false);
    expect(isValidPlan('invalid')).toBe(false);
    expect(isValidPlan('')).toBe(false);
  });
});
