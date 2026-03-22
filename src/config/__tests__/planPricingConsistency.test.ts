/**
 * Plan Pricing Consistency Tests
 *
 * Verifies PLAN_CONFIG (planPricing.ts) and TIER_PRICES (featureConfig.ts)
 * stay in sync. These are two sources that must agree on monthly prices.
 *
 * The edge function (supabase/functions/start-trial/index.ts) duplicates
 * these values because Deno cannot import from the frontend bundle.
 * If any test here fails, update all three files.
 */

import { describe, it, expect } from 'vitest';
import { PLAN_CONFIG, getPlanConfig, isValidPlan, type PlanKey } from '@/config/planPricing';
import { TIER_PRICES, TIER_NAMES, type SubscriptionTier } from '@/lib/featureConfig';

// Expected values that MUST match the edge function PLAN_CONFIG
const EXPECTED_PRICES = {
  starter: { monthly: 79, yearly: 790 },
  professional: { monthly: 150, yearly: 1500 },
  enterprise: { monthly: 499, yearly: 4990 },
} as const;

const EXPECTED_STRIPE_PRICE_IDS = {
  starter: 'price_1Sb3ioFWN1Z6rLwAPfzp99zP',
  professional: 'price_1Sb3ioFWN1Z6rLwAbjlE24yI',
  enterprise: 'price_1Sb3ipFWN1Z6rLwAKn1v6P5E',
} as const;

const EXPECTED_PLAN_NAMES = {
  starter: 'Starter',
  professional: 'Professional',
  enterprise: 'Enterprise',
} as const;

// The start-trial edge function accepts exactly these plan IDs
const START_TRIAL_VALID_PLAN_IDS = ['starter', 'professional', 'enterprise'] as const;

// The start-trial edge function's local PLAN_CONFIG (duplicated there for Deno)
// If these values change in start-trial/index.ts, update here too.
const START_TRIAL_PLAN_CONFIG = {
  starter: { name: 'Starter', priceMonthly: 79, priceYearly: 790 },
  professional: { name: 'Professional', priceMonthly: 150, priceYearly: 1500 },
  enterprise: { name: 'Enterprise', priceMonthly: 499, priceYearly: 4990 },
} as const;

describe('PLAN_CONFIG and TIER_PRICES consistency', () => {
  it('starter monthly price matches', () => {
    expect(PLAN_CONFIG.starter.priceMonthly).toBe(TIER_PRICES.starter);
  });

  it('professional monthly price matches', () => {
    expect(PLAN_CONFIG.professional.priceMonthly).toBe(TIER_PRICES.professional);
  });

  it('enterprise monthly price matches', () => {
    expect(PLAN_CONFIG.enterprise.priceMonthly).toBe(TIER_PRICES.enterprise);
  });

  it('free plan has zero pricing', () => {
    expect(PLAN_CONFIG.free.priceMonthly).toBe(0);
    expect(PLAN_CONFIG.free.priceYearly).toBe(0);
  });

  it('all paid tiers in TIER_PRICES have a matching PLAN_CONFIG entry', () => {
    const tierKeys = Object.keys(TIER_PRICES) as Array<keyof typeof TIER_PRICES>;
    for (const tier of tierKeys) {
      expect(PLAN_CONFIG[tier]).toBeDefined();
      expect(PLAN_CONFIG[tier].priceMonthly).toBe(TIER_PRICES[tier]);
    }
  });
});

describe('PLAN_CONFIG matches expected prices (edge function sync)', () => {
  it.each(['starter', 'professional', 'enterprise'] as const)(
    '%s monthly price matches expected',
    (plan) => {
      expect(PLAN_CONFIG[plan].priceMonthly).toBe(EXPECTED_PRICES[plan].monthly);
    }
  );

  it.each(['starter', 'professional', 'enterprise'] as const)(
    '%s yearly price matches expected',
    (plan) => {
      expect(PLAN_CONFIG[plan].priceYearly).toBe(EXPECTED_PRICES[plan].yearly);
    }
  );

  it.each(['starter', 'professional', 'enterprise'] as const)(
    '%s Stripe price ID matches expected',
    (plan) => {
      expect(PLAN_CONFIG[plan].stripePriceId).toBe(EXPECTED_STRIPE_PRICE_IDS[plan]);
    }
  );

  it.each(['starter', 'professional', 'enterprise'] as const)(
    '%s plan name matches expected',
    (plan) => {
      expect(PLAN_CONFIG[plan].name).toBe(EXPECTED_PLAN_NAMES[plan]);
    }
  );
});

describe('PLAN_CONFIG and TIER_NAMES consistency', () => {
  it('starter name matches', () => {
    expect(PLAN_CONFIG.starter.name).toBe(TIER_NAMES.starter);
  });

  it('professional name matches', () => {
    expect(PLAN_CONFIG.professional.name).toBe(TIER_NAMES.professional);
  });

  it('enterprise name matches', () => {
    expect(PLAN_CONFIG.enterprise.name).toBe(TIER_NAMES.enterprise);
  });

  it('PLAN_CONFIG paid tiers match TIER_NAMES keys', () => {
    const paidPlanKeys = Object.keys(PLAN_CONFIG).filter((k) => k !== 'free');
    const tierNameKeys = Object.keys(TIER_NAMES);
    expect(paidPlanKeys.sort()).toEqual(tierNameKeys.sort());
  });

  it('all TIER_NAMES values are capitalized single words', () => {
    for (const name of Object.values(TIER_NAMES)) {
      expect(name).toMatch(/^[A-Z][a-z]+$/);
    }
  });
});

describe('Start-trial edge function sync', () => {
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
});

describe('PLAN_CONFIG yearly pricing', () => {
  it('yearly price is less than 12x monthly for all paid plans', () => {
    const paidPlans = ['starter', 'professional', 'enterprise'] as const;
    for (const plan of paidPlans) {
      const config = PLAN_CONFIG[plan];
      const monthlyAnnualized = config.priceMonthly * 12;
      expect(config.priceYearly).toBeLessThan(monthlyAnnualized);
    }
  });

  it('yearly savings are approximately 17% for all paid plans', () => {
    const paidPlans = ['starter', 'professional', 'enterprise'] as const;
    for (const plan of paidPlans) {
      const config = PLAN_CONFIG[plan];
      const monthlyAnnualized = config.priceMonthly * 12;
      const savings = (monthlyAnnualized - config.priceYearly) / monthlyAnnualized;
      // Allow ±1% tolerance around 16.67%
      expect(savings).toBeGreaterThan(0.15);
      expect(savings).toBeLessThan(0.18);
    }
  });

  it('starter yearly is $790', () => {
    expect(PLAN_CONFIG.starter.priceYearly).toBe(790);
  });

  it('professional yearly is $1500', () => {
    expect(PLAN_CONFIG.professional.priceYearly).toBe(1500);
  });

  it('enterprise yearly is $4990', () => {
    expect(PLAN_CONFIG.enterprise.priceYearly).toBe(4990);
  });
});

describe('PLAN_CONFIG Stripe IDs', () => {
  it('free plan has no Stripe IDs', () => {
    expect(PLAN_CONFIG.free.stripePriceId).toBeNull();
    expect(PLAN_CONFIG.free.stripeProductId).toBeNull();
  });

  it('all paid plans have Stripe price IDs', () => {
    const paidPlans = ['starter', 'professional', 'enterprise'] as const;
    for (const plan of paidPlans) {
      expect(PLAN_CONFIG[plan].stripePriceId).toBeTruthy();
      expect(PLAN_CONFIG[plan].stripePriceId).toMatch(/^price_/);
    }
  });

  it('all paid plans have Stripe product IDs', () => {
    const paidPlans = ['starter', 'professional', 'enterprise'] as const;
    for (const plan of paidPlans) {
      expect(PLAN_CONFIG[plan].stripeProductId).toBeTruthy();
      expect(PLAN_CONFIG[plan].stripeProductId).toMatch(/^prod_/);
    }
  });

  it('each paid plan has unique Stripe price ID', () => {
    const priceIds = [
      PLAN_CONFIG.starter.stripePriceId,
      PLAN_CONFIG.professional.stripePriceId,
      PLAN_CONFIG.enterprise.stripePriceId,
    ];
    expect(new Set(priceIds).size).toBe(3);
  });

  it('each paid plan has unique Stripe product ID', () => {
    const productIds = [
      PLAN_CONFIG.starter.stripeProductId,
      PLAN_CONFIG.professional.stripeProductId,
      PLAN_CONFIG.enterprise.stripeProductId,
    ];
    expect(new Set(productIds).size).toBe(3);
  });
});

describe('getPlanConfig helper', () => {
  it('returns correct config for valid plan keys', () => {
    expect(getPlanConfig('starter')).toBe(PLAN_CONFIG.starter);
    expect(getPlanConfig('professional')).toBe(PLAN_CONFIG.professional);
    expect(getPlanConfig('enterprise')).toBe(PLAN_CONFIG.enterprise);
    expect(getPlanConfig('free')).toBe(PLAN_CONFIG.free);
  });

  it('returns free config for null or unknown plan', () => {
    expect(getPlanConfig(null)).toBe(PLAN_CONFIG.free);
    expect(getPlanConfig('unknown')).toBe(PLAN_CONFIG.free);
  });

  it('handles case-insensitive lookups', () => {
    expect(getPlanConfig('Starter')).toBe(PLAN_CONFIG.starter);
    expect(getPlanConfig('PROFESSIONAL')).toBe(PLAN_CONFIG.professional);
  });
});

describe('isValidPlan helper', () => {
  it('returns true for valid plan keys', () => {
    expect(isValidPlan('free')).toBe(true);
    expect(isValidPlan('starter')).toBe(true);
    expect(isValidPlan('professional')).toBe(true);
    expect(isValidPlan('enterprise')).toBe(true);
  });

  it('returns false for null or unknown plans', () => {
    expect(isValidPlan(null)).toBe(false);
    expect(isValidPlan('unknown')).toBe(false);
    expect(isValidPlan('')).toBe(false);
  });
});
