/**
 * Central Plan Configuration with Stripe IDs
 * Single source of truth for all plan pricing and Stripe integration.
 *
 * IMPORTANT: The start-trial edge function (supabase/functions/start-trial/index.ts)
 * duplicates these price IDs. Any changes here MUST be mirrored there, and vice versa.
 * See src/config/__tests__/planPricing.test.ts for the consistency test.
 */

export const PLAN_CONFIG = {
  free: {
    name: 'Free',
    priceMonthly: 0,
    priceYearly: 0,
    stripePriceId: null,
    stripePriceIdYearly: null,
    stripeProductId: null,
    description: 'Try everything with monthly credits',
    trialDays: 14,
  },
  starter: {
    name: 'Starter',
    priceMonthly: 79,
    priceYearly: 790,
    stripePriceId: 'price_1Sb3ioFWN1Z6rLwAPfzp99zP',
    stripePriceIdYearly: 'price_1Sb3ioFWN1Z6rLwAPfzp99zP', // TODO: update when yearly Stripe price exists
    stripeProductId: 'prod_TYA2kle7mkwTJo',
    description: 'Unlimited usage for small businesses',
    trialDays: 14,
  },
  professional: {
    name: 'Professional',
    priceMonthly: 150,
    priceYearly: 1500,
    stripePriceId: 'price_1Sb3ioFWN1Z6rLwAbjlE24yI',
    stripePriceIdYearly: 'price_1Sb3ioFWN1Z6rLwAbjlE24yI', // TODO: update when yearly Stripe price exists
    stripeProductId: 'prod_TYA2CWSnpNaui9',
    description: 'Ideal for growing businesses',
    trialDays: 14,
  },
  enterprise: {
    name: 'Enterprise',
    priceMonthly: 499,
    priceYearly: 4990,
    stripePriceId: 'price_1Sb3ipFWN1Z6rLwAKn1v6P5E',
    stripePriceIdYearly: 'price_1Sb3ipFWN1Z6rLwAKn1v6P5E', // TODO: update when yearly Stripe price exists
    stripeProductId: 'prod_TYA2f6LK7qu8i9',
    description: 'Complete solution for large operations',
    trialDays: 14,
  },
} as const;

export type PlanKey = keyof typeof PLAN_CONFIG;

export const getPlanConfig = (planKey: string | null): typeof PLAN_CONFIG[PlanKey] => {
  const normalizedKey = planKey?.toLowerCase() as PlanKey;
  return PLAN_CONFIG[normalizedKey] || PLAN_CONFIG.free;
};

export const isValidPlan = (planKey: string | null): planKey is PlanKey => {
  if (!planKey) return false;
  return planKey.toLowerCase() in PLAN_CONFIG;
};
