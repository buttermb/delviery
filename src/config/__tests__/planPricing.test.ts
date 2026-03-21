/**
 * Plan Pricing Configuration Tests
 * Verifies plan config integrity, price consistency, and yearly billing safety
 */

import { describe, it, expect } from 'vitest';
import { PLAN_CONFIG, getPlanConfig, isValidPlan } from '@/config/planPricing';

describe('PLAN_CONFIG', () => {
  const paidPlans = ['starter', 'professional', 'enterprise'] as const;

  describe('Plan Structure', () => {
    it('should have exactly 4 plans (free + 3 paid)', () => {
      const planKeys = Object.keys(PLAN_CONFIG);
      expect(planKeys).toHaveLength(4);
      expect(planKeys).toEqual(['free', 'starter', 'professional', 'enterprise']);
    });

    it('every plan should have all required fields', () => {
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
        // Name should match key (capitalized)
        expect(plan.name.toLowerCase()).toContain(key === 'free' ? 'free' : key);
      }
    });
  });

  describe('Free Plan', () => {
    it('should have zero pricing and no Stripe IDs', () => {
      const free = PLAN_CONFIG.free;
      expect(free.priceMonthly).toBe(0);
      expect(free.priceYearly).toBe(0);
      expect(free.stripePriceId).toBeNull();
      expect(free.stripePriceIdYearly).toBeNull();
      expect(free.stripeProductId).toBeNull();
    });
  });

  describe('Paid Plan Pricing', () => {
    it('starter: $79/mo, $790/yr', () => {
      expect(PLAN_CONFIG.starter.priceMonthly).toBe(79);
      expect(PLAN_CONFIG.starter.priceYearly).toBe(790);
    });

    it('professional: $150/mo, $1500/yr', () => {
      expect(PLAN_CONFIG.professional.priceMonthly).toBe(150);
      expect(PLAN_CONFIG.professional.priceYearly).toBe(1500);
    });

    it('enterprise: $499/mo, $4990/yr', () => {
      expect(PLAN_CONFIG.enterprise.priceMonthly).toBe(499);
      expect(PLAN_CONFIG.enterprise.priceYearly).toBe(4990);
    });

    it('yearly pricing should offer ~17% discount over monthly * 12', () => {
      for (const key of paidPlans) {
        const plan = PLAN_CONFIG[key];
        const monthlyAnnualized = plan.priceMonthly * 12;
        const discount = 1 - (plan.priceYearly / monthlyAnnualized);
        // Should be approximately 17% discount (between 15% and 20%)
        expect(discount).toBeGreaterThanOrEqual(0.15);
        expect(discount).toBeLessThanOrEqual(0.20);
      }
    });

    it('prices should increase across tiers', () => {
      expect(PLAN_CONFIG.starter.priceMonthly).toBeLessThan(PLAN_CONFIG.professional.priceMonthly);
      expect(PLAN_CONFIG.professional.priceMonthly).toBeLessThan(PLAN_CONFIG.enterprise.priceMonthly);
      expect(PLAN_CONFIG.starter.priceYearly).toBeLessThan(PLAN_CONFIG.professional.priceYearly);
      expect(PLAN_CONFIG.professional.priceYearly).toBeLessThan(PLAN_CONFIG.enterprise.priceYearly);
    });
  });

  describe('Stripe Price IDs', () => {
    it('all paid plans should have monthly Stripe price IDs', () => {
      for (const key of paidPlans) {
        const plan = PLAN_CONFIG[key];
        expect(plan.stripePriceId).toBeTruthy();
        expect(plan.stripePriceId).toMatch(/^price_/);
      }
    });

    it('all paid plans should have Stripe product IDs', () => {
      for (const key of paidPlans) {
        const plan = PLAN_CONFIG[key];
        expect(plan.stripeProductId).toBeTruthy();
        expect(plan.stripeProductId).toMatch(/^prod_/);
      }
    });

    it('monthly Stripe price IDs should be unique across plans', () => {
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

  describe('Trial Configuration', () => {
    it('all plans should have 14-day trial', () => {
      for (const plan of Object.values(PLAN_CONFIG)) {
        expect(plan.trialDays).toBe(14);
      }
    });
  });
});

describe('getPlanConfig', () => {
  it('should return correct config for valid plan keys', () => {
    expect(getPlanConfig('starter').name).toBe('Starter');
    expect(getPlanConfig('professional').name).toBe('Professional');
    expect(getPlanConfig('enterprise').name).toBe('Enterprise');
    expect(getPlanConfig('free').name).toBe('Free');
  });

  it('should be case-insensitive', () => {
    expect(getPlanConfig('STARTER').name).toBe('Starter');
    expect(getPlanConfig('Professional').name).toBe('Professional');
  });

  it('should return free plan for null or unknown keys', () => {
    expect(getPlanConfig(null).name).toBe('Free');
    expect(getPlanConfig('nonexistent').name).toBe('Free');
  });
});

describe('isValidPlan', () => {
  it('should return true for valid plan keys', () => {
    expect(isValidPlan('free')).toBe(true);
    expect(isValidPlan('starter')).toBe(true);
    expect(isValidPlan('professional')).toBe(true);
    expect(isValidPlan('enterprise')).toBe(true);
  });

  it('should return false for null or invalid keys', () => {
    expect(isValidPlan(null)).toBe(false);
    expect(isValidPlan('invalid')).toBe(false);
    expect(isValidPlan('')).toBe(false);
  });
});
