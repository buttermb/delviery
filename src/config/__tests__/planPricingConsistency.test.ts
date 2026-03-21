import { describe, it, expect } from 'vitest';
import { PLAN_CONFIG, type PlanKey } from '@/config/planPricing';
import { TIER_NAMES, TIER_PRICES, type SubscriptionTier } from '@/lib/featureConfig';

/**
 * These tests verify that plan configuration stays consistent across
 * all sources: frontend PLAN_CONFIG, TIER_NAMES, TIER_PRICES, and
 * what the start-trial edge function expects.
 *
 * If any of these fail, the start-trial flow may silently break.
 */

// The start-trial edge function accepts exactly these plan IDs
const START_TRIAL_VALID_PLAN_IDS = ['starter', 'professional', 'enterprise'] as const;

// The start-trial edge function's local PLAN_CONFIG (duplicated there for Deno)
// If these values change in start-trial/index.ts, update here too.
const START_TRIAL_PLAN_CONFIG = {
  starter: { name: 'Starter', priceMonthly: 79, priceYearly: 790 },
  professional: { name: 'Professional', priceMonthly: 150, priceYearly: 1500 },
  enterprise: { name: 'Enterprise', priceMonthly: 499, priceYearly: 4990 },
} as const;

describe('Plan configuration consistency', () => {
  it('PLAN_CONFIG paid tiers match TIER_NAMES keys', () => {
    const paidPlanKeys = Object.keys(PLAN_CONFIG).filter((k) => k !== 'free');
    const tierNameKeys = Object.keys(TIER_NAMES);

    expect(paidPlanKeys.sort()).toEqual(tierNameKeys.sort());
  });

  it('PLAN_CONFIG names match TIER_NAMES values', () => {
    for (const tier of Object.keys(TIER_NAMES) as SubscriptionTier[]) {
      const planConfig = PLAN_CONFIG[tier as PlanKey];
      expect(planConfig).toBeDefined();
      expect(planConfig.name).toBe(TIER_NAMES[tier]);
    }
  });

  it('PLAN_CONFIG prices match TIER_PRICES', () => {
    for (const tier of Object.keys(TIER_PRICES) as SubscriptionTier[]) {
      const planConfig = PLAN_CONFIG[tier as PlanKey];
      expect(planConfig).toBeDefined();
      expect(planConfig.priceMonthly).toBe(TIER_PRICES[tier]);
    }
  });

  it('start-trial valid plan IDs match PLAN_CONFIG paid tiers', () => {
    const paidPlanKeys = Object.keys(PLAN_CONFIG).filter((k) => k !== 'free');
    expect(paidPlanKeys.sort()).toEqual([...START_TRIAL_VALID_PLAN_IDS].sort());
  });

  it('start-trial PLAN_CONFIG names match frontend PLAN_CONFIG names', () => {
    for (const planId of START_TRIAL_VALID_PLAN_IDS) {
      const frontendPlan = PLAN_CONFIG[planId as PlanKey];
      const edgePlan = START_TRIAL_PLAN_CONFIG[planId];

      expect(frontendPlan.name).toBe(edgePlan.name);
    }
  });

  it('start-trial PLAN_CONFIG prices match frontend PLAN_CONFIG prices', () => {
    for (const planId of START_TRIAL_VALID_PLAN_IDS) {
      const frontendPlan = PLAN_CONFIG[planId as PlanKey];
      const edgePlan = START_TRIAL_PLAN_CONFIG[planId];

      expect(frontendPlan.priceMonthly).toBe(edgePlan.priceMonthly);
      expect(frontendPlan.priceYearly).toBe(edgePlan.priceYearly);
    }
  });

  it('all TIER_NAMES values are capitalized single words', () => {
    for (const name of Object.values(TIER_NAMES)) {
      expect(name).toMatch(/^[A-Z][a-z]+$/);
    }
  });

  it('PLAN_CONFIG free tier exists and has zero pricing', () => {
    expect(PLAN_CONFIG.free).toBeDefined();
    expect(PLAN_CONFIG.free.priceMonthly).toBe(0);
    expect(PLAN_CONFIG.free.priceYearly).toBe(0);
    expect(PLAN_CONFIG.free.stripePriceId).toBeNull();
  });

  it('all paid plans have Stripe price IDs', () => {
    for (const planId of START_TRIAL_VALID_PLAN_IDS) {
      const plan = PLAN_CONFIG[planId as PlanKey];
      expect(plan.stripePriceId).toBeTruthy();
      expect(typeof plan.stripePriceId).toBe('string');
    }
  });
});
