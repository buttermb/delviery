import { describe, it, expect } from 'vitest';
import { PLAN_CONFIG, getPlanConfig, isValidPlan } from '@/config/planPricing';

describe('PLAN_CONFIG', () => {
  it('free plan name is "Free"', () => {
    expect(PLAN_CONFIG.free.name).toBe('Free');
  });

  it('free plan has zero pricing', () => {
    expect(PLAN_CONFIG.free.priceMonthly).toBe(0);
    expect(PLAN_CONFIG.free.priceYearly).toBe(0);
  });

  it('free plan has no Stripe IDs', () => {
    expect(PLAN_CONFIG.free.stripePriceId).toBeNull();
    expect(PLAN_CONFIG.free.stripeProductId).toBeNull();
  });

  it('all paid plans have Stripe IDs', () => {
    const paidPlans = ['starter', 'professional', 'enterprise'] as const;
    for (const plan of paidPlans) {
      expect(PLAN_CONFIG[plan].stripePriceId).toBeTruthy();
      expect(PLAN_CONFIG[plan].stripeProductId).toBeTruthy();
    }
  });
});

describe('getPlanConfig', () => {
  it('returns free config for null input', () => {
    expect(getPlanConfig(null)).toBe(PLAN_CONFIG.free);
  });

  it('returns free config for unknown plan', () => {
    expect(getPlanConfig('unknown')).toBe(PLAN_CONFIG.free);
  });

  it('returns correct config for valid plan keys', () => {
    expect(getPlanConfig('free')).toBe(PLAN_CONFIG.free);
    expect(getPlanConfig('starter')).toBe(PLAN_CONFIG.starter);
    expect(getPlanConfig('professional')).toBe(PLAN_CONFIG.professional);
    expect(getPlanConfig('enterprise')).toBe(PLAN_CONFIG.enterprise);
  });

  it('is case-insensitive', () => {
    expect(getPlanConfig('FREE')).toBe(PLAN_CONFIG.free);
    expect(getPlanConfig('Starter')).toBe(PLAN_CONFIG.starter);
  });
});

describe('isValidPlan', () => {
  it('returns false for null', () => {
    expect(isValidPlan(null)).toBe(false);
  });

  it('returns false for unknown plan', () => {
    expect(isValidPlan('unknown')).toBe(false);
  });

  it('returns true for valid plan keys', () => {
    expect(isValidPlan('free')).toBe(true);
    expect(isValidPlan('starter')).toBe(true);
    expect(isValidPlan('professional')).toBe(true);
    expect(isValidPlan('enterprise')).toBe(true);
  });
});
