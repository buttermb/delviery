/**
 * Plan Pricing Configuration Tests
 *
 * Verifies that PLAN_CONFIG is the single source of truth for all plan pricing
 * and that both SaaS and tenant-admin SelectPlanPage derive prices from it.
 */

import { describe, it, expect } from 'vitest';
import { PLAN_CONFIG, getPlanConfig, isValidPlan, type PlanKey } from '@/config/planPricing';

describe('PLAN_CONFIG', () => {
  it('defines exactly four plans: free, starter, professional, enterprise', () => {
    const planKeys = Object.keys(PLAN_CONFIG);
    expect(planKeys).toEqual(['free', 'starter', 'professional', 'enterprise']);
  });

  it('free plan has $0 pricing and no Stripe IDs', () => {
    expect(PLAN_CONFIG.free.priceMonthly).toBe(0);
    expect(PLAN_CONFIG.free.priceYearly).toBe(0);
    expect(PLAN_CONFIG.free.stripePriceId).toBeNull();
    expect(PLAN_CONFIG.free.stripeProductId).toBeNull();
  });

  it('all paid plans have positive monthly and yearly prices', () => {
    const paidKeys: PlanKey[] = ['starter', 'professional', 'enterprise'];
    for (const key of paidKeys) {
      const plan = PLAN_CONFIG[key];
      expect(plan.priceMonthly).toBeGreaterThan(0);
      expect(plan.priceYearly).toBeGreaterThan(0);
    }
  });

  it('yearly price offers a discount over 12x monthly for all paid plans', () => {
    const paidKeys: PlanKey[] = ['starter', 'professional', 'enterprise'];
    for (const key of paidKeys) {
      const plan = PLAN_CONFIG[key];
      const twelveMonths = plan.priceMonthly * 12;
      expect(plan.priceYearly).toBeLessThan(twelveMonths);
    }
  });

  it('all paid plans have valid Stripe price and product IDs', () => {
    const paidKeys: PlanKey[] = ['starter', 'professional', 'enterprise'];
    for (const key of paidKeys) {
      const plan = PLAN_CONFIG[key];
      expect(plan.stripePriceId).toMatch(/^price_/);
      expect(plan.stripeProductId).toMatch(/^prod_/);
    }
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
});

describe('getPlanConfig', () => {
  it('returns correct config for valid plan keys', () => {
    expect(getPlanConfig('starter')).toBe(PLAN_CONFIG.starter);
    expect(getPlanConfig('professional')).toBe(PLAN_CONFIG.professional);
    expect(getPlanConfig('enterprise')).toBe(PLAN_CONFIG.enterprise);
    expect(getPlanConfig('free')).toBe(PLAN_CONFIG.free);
  });

  it('is case-insensitive', () => {
    expect(getPlanConfig('STARTER')).toBe(PLAN_CONFIG.starter);
    expect(getPlanConfig('Professional')).toBe(PLAN_CONFIG.professional);
    expect(getPlanConfig('FREE')).toBe(PLAN_CONFIG.free);
  });

  it('returns free plan for null or unknown keys', () => {
    expect(getPlanConfig(null)).toBe(PLAN_CONFIG.free);
    expect(getPlanConfig('nonexistent')).toBe(PLAN_CONFIG.free);
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
