import { describe, it, expect } from 'vitest';
import { PLAN_CONFIG } from '@/config/planPricing';
import { TIER_PRICES, TIER_NAMES } from '@/lib/featureConfig';

/**
 * These tests ensure pricing stays consistent across:
 * - src/config/planPricing.ts (PLAN_CONFIG — frontend source of truth)
 * - src/lib/featureConfig.ts (TIER_PRICES — feature gating)
 * - supabase/functions/start-trial/index.ts (PLAN_CONFIG — edge function)
 *
 * The edge function duplicates these values because Deno cannot import
 * from the frontend bundle. If any test here fails, update all three files.
 */

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

describe('Plan pricing consistency', () => {
  describe('PLAN_CONFIG matches expected prices', () => {
    it.each(['starter', 'professional', 'enterprise'] as const)(
      '%s monthly price matches',
      (plan) => {
        expect(PLAN_CONFIG[plan].priceMonthly).toBe(EXPECTED_PRICES[plan].monthly);
      }
    );

    it.each(['starter', 'professional', 'enterprise'] as const)(
      '%s yearly price matches',
      (plan) => {
        expect(PLAN_CONFIG[plan].priceYearly).toBe(EXPECTED_PRICES[plan].yearly);
      }
    );

    it.each(['starter', 'professional', 'enterprise'] as const)(
      '%s Stripe price ID matches',
      (plan) => {
        expect(PLAN_CONFIG[plan].stripePriceId).toBe(EXPECTED_STRIPE_PRICE_IDS[plan]);
      }
    );

    it.each(['starter', 'professional', 'enterprise'] as const)(
      '%s plan name matches',
      (plan) => {
        expect(PLAN_CONFIG[plan].name).toBe(EXPECTED_PLAN_NAMES[plan]);
      }
    );
  });

  describe('TIER_PRICES matches PLAN_CONFIG monthly prices', () => {
    it.each(['starter', 'professional', 'enterprise'] as const)(
      '%s TIER_PRICES equals PLAN_CONFIG.priceMonthly',
      (plan) => {
        expect(TIER_PRICES[plan]).toBe(PLAN_CONFIG[plan].priceMonthly);
      }
    );
  });

  describe('TIER_NAMES matches PLAN_CONFIG names', () => {
    it.each(['starter', 'professional', 'enterprise'] as const)(
      '%s TIER_NAMES equals PLAN_CONFIG.name',
      (plan) => {
        expect(TIER_NAMES[plan]).toBe(PLAN_CONFIG[plan].name);
      }
    );
  });

  describe('Free tier has zero pricing', () => {
    it('free plan monthly price is 0', () => {
      expect(PLAN_CONFIG.free.priceMonthly).toBe(0);
    });

    it('free plan yearly price is 0', () => {
      expect(PLAN_CONFIG.free.priceYearly).toBe(0);
    });

    it('free plan has no Stripe price ID', () => {
      expect(PLAN_CONFIG.free.stripePriceId).toBeNull();
    });
  });

  describe('Yearly prices are ~10x monthly (annual discount)', () => {
    it.each(['starter', 'professional', 'enterprise'] as const)(
      '%s yearly = monthly × 10',
      (plan) => {
        expect(PLAN_CONFIG[plan].priceYearly).toBe(PLAN_CONFIG[plan].priceMonthly * 10);
      }
    );
  });
});
