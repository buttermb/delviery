/**
 * Plan Pricing Consistency Tests
 *
 * Validates that PLAN_CONFIG in planPricing.ts is internally consistent
 * and documents the expected Stripe price/product IDs so that any drift
 * between the frontend config and the start-trial edge function is caught.
 *
 * The edge function (supabase/functions/start-trial/index.ts) duplicates
 * these IDs because Deno edge functions cannot import from the frontend
 * src tree. If a test here fails after updating planPricing.ts, you MUST
 * also update the edge function's PLAN_CONFIG.
 */

import { describe, it, expect } from 'vitest';
import { PLAN_CONFIG, getPlanConfig, isValidPlan } from '@/config/planPricing';
import * as fs from 'fs';
import * as path from 'path';

// Expected Stripe IDs — the canonical reference for both frontend and edge function
const EXPECTED_STRIPE_IDS = {
  starter: {
    stripePriceId: 'price_1Sb3ioFWN1Z6rLwAPfzp99zP',
    stripePriceIdYearly: 'price_1Sb3ioFWN1Z6rLwAPfzp99zP',
    stripeProductId: 'prod_TYA2kle7mkwTJo',
  },
  professional: {
    stripePriceId: 'price_1Sb3ioFWN1Z6rLwAbjlE24yI',
    stripePriceIdYearly: 'price_1Sb3ioFWN1Z6rLwAbjlE24yI',
    stripeProductId: 'prod_TYA2CWSnpNaui9',
  },
  enterprise: {
    stripePriceId: 'price_1Sb3ipFWN1Z6rLwAKn1v6P5E',
    stripePriceIdYearly: 'price_1Sb3ipFWN1Z6rLwAKn1v6P5E',
    stripeProductId: 'prod_TYA2f6LK7qu8i9',
  },
} as const;

describe('PLAN_CONFIG', () => {
  it('contains all expected plan keys', () => {
    expect(Object.keys(PLAN_CONFIG)).toEqual(
      expect.arrayContaining(['free', 'starter', 'professional', 'enterprise'])
    );
  });

  it('free plan has null Stripe IDs', () => {
    expect(PLAN_CONFIG.free.stripePriceId).toBeNull();
    expect(PLAN_CONFIG.free.stripePriceIdYearly).toBeNull();
    expect(PLAN_CONFIG.free.stripeProductId).toBeNull();
    expect(PLAN_CONFIG.free.priceMonthly).toBe(0);
    expect(PLAN_CONFIG.free.priceYearly).toBe(0);
  });

  describe.each(['starter', 'professional', 'enterprise'] as const)(
    '%s plan Stripe IDs',
    (plan) => {
      it('has the expected monthly Stripe price ID', () => {
        expect(PLAN_CONFIG[plan].stripePriceId).toBe(EXPECTED_STRIPE_IDS[plan].stripePriceId);
      });

      it('has the expected yearly Stripe price ID', () => {
        expect(PLAN_CONFIG[plan].stripePriceIdYearly).toBe(EXPECTED_STRIPE_IDS[plan].stripePriceIdYearly);
      });

      it('has the expected Stripe product ID', () => {
        expect(PLAN_CONFIG[plan].stripeProductId).toBe(EXPECTED_STRIPE_IDS[plan].stripeProductId);
      });

      it('has a valid Stripe price ID format (price_*)', () => {
        expect(PLAN_CONFIG[plan].stripePriceId).toMatch(/^price_/);
        expect(PLAN_CONFIG[plan].stripePriceIdYearly).toMatch(/^price_/);
      });

      it('has a valid Stripe product ID format (prod_*)', () => {
        expect(PLAN_CONFIG[plan].stripeProductId).toMatch(/^prod_/);
      });

      it('has positive pricing', () => {
        expect(PLAN_CONFIG[plan].priceMonthly).toBeGreaterThan(0);
        expect(PLAN_CONFIG[plan].priceYearly).toBeGreaterThan(0);
      });

      it('yearly price is less than 12x monthly (discount)', () => {
        expect(PLAN_CONFIG[plan].priceYearly).toBeLessThanOrEqual(
          PLAN_CONFIG[plan].priceMonthly * 12
        );
      });

      it('has 14-day trial', () => {
        expect(PLAN_CONFIG[plan].trialDays).toBe(14);
      });
    }
  );
});

describe('getPlanConfig', () => {
  it('returns correct config for valid plan keys', () => {
    expect(getPlanConfig('starter')).toBe(PLAN_CONFIG.starter);
    expect(getPlanConfig('professional')).toBe(PLAN_CONFIG.professional);
    expect(getPlanConfig('enterprise')).toBe(PLAN_CONFIG.enterprise);
  });

  it('returns free plan for null', () => {
    expect(getPlanConfig(null)).toBe(PLAN_CONFIG.free);
  });

  it('returns free plan for unknown keys', () => {
    expect(getPlanConfig('unknown')).toBe(PLAN_CONFIG.free);
    expect(getPlanConfig('')).toBe(PLAN_CONFIG.free);
  });

  it('is case-insensitive', () => {
    expect(getPlanConfig('Starter')).toBe(PLAN_CONFIG.starter);
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

  it('returns false for invalid keys', () => {
    expect(isValidPlan(null)).toBe(false);
    expect(isValidPlan('invalid')).toBe(false);
    expect(isValidPlan('')).toBe(false);
  });
});

describe('start-trial edge function consistency', () => {
  it('edge function PLAN_CONFIG contains matching Stripe price IDs', () => {
    const edgeFnPath = path.resolve(
      __dirname,
      '../../../supabase/functions/start-trial/index.ts'
    );
    const edgeFnSource = fs.readFileSync(edgeFnPath, 'utf-8');

    for (const [plan, ids] of Object.entries(EXPECTED_STRIPE_IDS)) {
      expect(
        edgeFnSource,
        `edge function missing monthly price ID for ${plan}`
      ).toContain(ids.stripePriceId);

      expect(
        edgeFnSource,
        `edge function missing product ID for ${plan}`
      ).toContain(ids.stripeProductId);
    }
  });

  it('edge function PLAN_CONFIG has matching plan names', () => {
    const edgeFnPath = path.resolve(
      __dirname,
      '../../../supabase/functions/start-trial/index.ts'
    );
    const edgeFnSource = fs.readFileSync(edgeFnPath, 'utf-8');

    const paidPlans = ['starter', 'professional', 'enterprise'] as const;
    for (const plan of paidPlans) {
      expect(
        edgeFnSource,
        `edge function missing plan name '${PLAN_CONFIG[plan].name}'`
      ).toContain(`name: '${PLAN_CONFIG[plan].name}'`);
    }
  });

  it('edge function PLAN_CONFIG has matching prices', () => {
    const edgeFnPath = path.resolve(
      __dirname,
      '../../../supabase/functions/start-trial/index.ts'
    );
    const edgeFnSource = fs.readFileSync(edgeFnPath, 'utf-8');

    const paidPlans = ['starter', 'professional', 'enterprise'] as const;
    for (const plan of paidPlans) {
      expect(
        edgeFnSource,
        `edge function missing monthly price ${PLAN_CONFIG[plan].priceMonthly} for ${plan}`
      ).toContain(`priceMonthly: ${PLAN_CONFIG[plan].priceMonthly}`);

      expect(
        edgeFnSource,
        `edge function missing yearly price ${PLAN_CONFIG[plan].priceYearly} for ${plan}`
      ).toContain(`priceYearly: ${PLAN_CONFIG[plan].priceYearly}`);
    }
  });
});
