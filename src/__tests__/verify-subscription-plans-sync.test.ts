/**
 * Verify subscription_plans table sync migration
 *
 * Ensures canonical prices in TIER_PRICES, PLAN_CONFIG, PLAN_FEATURES,
 * start-trial edge function, and the SQL migration are all consistent.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { TIER_PRICES, TIER_NAMES } from '@/lib/featureConfig';
import { PLAN_CONFIG } from '@/config/planPricing';
import { PLAN_FEATURES, SUBSCRIPTION_PLANS } from '@/utils/subscriptionPlans';

const CANONICAL_PRICES = {
  starter: { monthly: 79, yearly: 790 },
  professional: { monthly: 150, yearly: 1500 },
  enterprise: { monthly: 499, yearly: 4990 },
} as const;

const CANONICAL_NAMES = {
  starter: 'Starter',
  professional: 'Professional',
  enterprise: 'Enterprise',
} as const;

describe('Subscription Plans Pricing Consistency', () => {
  describe('TIER_PRICES (featureConfig.ts)', () => {
    it('should have correct starter price', () => {
      expect(TIER_PRICES.starter).toBe(CANONICAL_PRICES.starter.monthly);
    });

    it('should have correct professional price', () => {
      expect(TIER_PRICES.professional).toBe(CANONICAL_PRICES.professional.monthly);
    });

    it('should have correct enterprise price', () => {
      expect(TIER_PRICES.enterprise).toBe(CANONICAL_PRICES.enterprise.monthly);
    });
  });

  describe('TIER_NAMES (featureConfig.ts)', () => {
    it('should have correct plan names', () => {
      expect(TIER_NAMES.starter).toBe(CANONICAL_NAMES.starter);
      expect(TIER_NAMES.professional).toBe(CANONICAL_NAMES.professional);
      expect(TIER_NAMES.enterprise).toBe(CANONICAL_NAMES.enterprise);
    });
  });

  describe('PLAN_CONFIG (planPricing.ts)', () => {
    it('should match TIER_PRICES for starter', () => {
      expect(PLAN_CONFIG.starter.priceMonthly).toBe(CANONICAL_PRICES.starter.monthly);
      expect(PLAN_CONFIG.starter.priceYearly).toBe(CANONICAL_PRICES.starter.yearly);
    });

    it('should match TIER_PRICES for professional', () => {
      expect(PLAN_CONFIG.professional.priceMonthly).toBe(CANONICAL_PRICES.professional.monthly);
      expect(PLAN_CONFIG.professional.priceYearly).toBe(CANONICAL_PRICES.professional.yearly);
    });

    it('should match TIER_PRICES for enterprise', () => {
      expect(PLAN_CONFIG.enterprise.priceMonthly).toBe(CANONICAL_PRICES.enterprise.monthly);
      expect(PLAN_CONFIG.enterprise.priceYearly).toBe(CANONICAL_PRICES.enterprise.yearly);
    });

    it('should have correct plan names', () => {
      expect(PLAN_CONFIG.starter.name).toBe(CANONICAL_NAMES.starter);
      expect(PLAN_CONFIG.professional.name).toBe(CANONICAL_NAMES.professional);
      expect(PLAN_CONFIG.enterprise.name).toBe(CANONICAL_NAMES.enterprise);
    });

    it('should have Stripe price IDs for all paid plans', () => {
      expect(PLAN_CONFIG.starter.stripePriceId).toBeTruthy();
      expect(PLAN_CONFIG.professional.stripePriceId).toBeTruthy();
      expect(PLAN_CONFIG.enterprise.stripePriceId).toBeTruthy();
    });

    it('should have null Stripe price ID for free plan', () => {
      expect(PLAN_CONFIG.free.stripePriceId).toBeNull();
    });
  });

  describe('PLAN_FEATURES (subscriptionPlans.ts)', () => {
    it('should match TIER_PRICES for starter', () => {
      expect(PLAN_FEATURES[SUBSCRIPTION_PLANS.STARTER].price).toBe(CANONICAL_PRICES.starter.monthly);
    });

    it('should match TIER_PRICES for professional', () => {
      expect(PLAN_FEATURES[SUBSCRIPTION_PLANS.PROFESSIONAL].price).toBe(CANONICAL_PRICES.professional.monthly);
    });

    it('should match TIER_PRICES for enterprise', () => {
      expect(PLAN_FEATURES[SUBSCRIPTION_PLANS.ENTERPRISE].price).toBe(CANONICAL_PRICES.enterprise.monthly);
    });

    it('should match TIER_NAMES for display names', () => {
      expect(PLAN_FEATURES[SUBSCRIPTION_PLANS.STARTER].displayName).toBe(CANONICAL_NAMES.starter);
      expect(PLAN_FEATURES[SUBSCRIPTION_PLANS.PROFESSIONAL].displayName).toBe(CANONICAL_NAMES.professional);
      expect(PLAN_FEATURES[SUBSCRIPTION_PLANS.ENTERPRISE].displayName).toBe(CANONICAL_NAMES.enterprise);
    });

    it('should have enterprise with unlimited limits (-1)', () => {
      const enterpriseLimits = PLAN_FEATURES[SUBSCRIPTION_PLANS.ENTERPRISE].limits;
      expect(enterpriseLimits.customers).toBe(-1);
      expect(enterpriseLimits.menus).toBe(-1);
      expect(enterpriseLimits.products).toBe(-1);
      expect(enterpriseLimits.locations).toBe(-1);
      expect(enterpriseLimits.users).toBe(-1);
    });

    it('should have ascending limits from starter to professional', () => {
      const starterLimits = PLAN_FEATURES[SUBSCRIPTION_PLANS.STARTER].limits;
      const proLimits = PLAN_FEATURES[SUBSCRIPTION_PLANS.PROFESSIONAL].limits;

      expect(proLimits.customers).toBeGreaterThan(starterLimits.customers);
      expect(proLimits.menus).toBeGreaterThan(starterLimits.menus);
      expect(proLimits.products).toBeGreaterThan(starterLimits.products);
      expect(proLimits.locations).toBeGreaterThan(starterLimits.locations);
      expect(proLimits.users).toBeGreaterThan(starterLimits.users);
    });
  });
});

describe('Subscription Plans Sync Migration SQL', () => {
  const migrationPath = join(
    process.cwd(),
    'supabase',
    'migrations',
    '20260320000001_fix_subscription_pricing_consistency.sql'
  );

  let migrationContent: string;

  try {
    migrationContent = readFileSync(migrationPath, 'utf-8');
  } catch {
    migrationContent = '';
  }

  it('should have valid SQL file', () => {
    expect(migrationContent).toBeTruthy();
  });

  it('should have balanced parentheses', () => {
    const openParens = (migrationContent.match(/\(/g) ?? []).length;
    const closeParens = (migrationContent.match(/\)/g) ?? []).length;
    expect(openParens).toBe(closeParens);
  });

  it('should have balanced quotes', () => {
    const cleaned = migrationContent
      .replace(/--.*$/gm, '')
      .replace(/\\'/g, '');

    const singleQuotes = (cleaned.match(/'/g) ?? []).length;
    expect(singleQuotes % 2).toBe(0);
  });

  describe('MRR values in create_tenant_atomic', () => {
    it('should set starter MRR to 79', () => {
      expect(migrationContent).toContain("WHEN v_subscription_plan = 'starter' THEN 79");
    });

    it('should set professional MRR to 150', () => {
      expect(migrationContent).toContain("WHEN v_subscription_plan = 'professional' THEN 150");
    });

    it('should set enterprise MRR to 499', () => {
      expect(migrationContent).toContain("WHEN v_subscription_plan = 'enterprise' THEN 499");
    });

    it('should set free tier MRR to 0', () => {
      expect(migrationContent).toContain('WHEN v_is_free_tier THEN 0');
    });
  });

  describe('Stale MRR fix updates', () => {
    it('should fix starter MRR from 99 to 79', () => {
      expect(migrationContent).toMatch(
        /UPDATE\s+public\.tenants\s+SET\s+mrr\s*=\s*79\s+WHERE\s+subscription_plan\s*=\s*'starter'\s+AND\s+mrr\s*=\s*99/
      );
    });

    it('should fix professional MRR from 299 to 150', () => {
      expect(migrationContent).toMatch(
        /UPDATE\s+public\.tenants\s+SET\s+mrr\s*=\s*150\s+WHERE\s+subscription_plan\s*=\s*'professional'\s+AND\s+mrr\s*=\s*299/
      );
    });

    it('should fix enterprise MRR from 999/799 to 499', () => {
      expect(migrationContent).toMatch(
        /UPDATE\s+public\.tenants\s+SET\s+mrr\s*=\s*499\s+WHERE\s+subscription_plan\s*=\s*'enterprise'/
      );
    });
  });

  describe('subscription_plans table sync', () => {
    it('should update both price and price_monthly for starter', () => {
      expect(migrationContent).toMatch(
        /SET\s+price\s*=\s*79,\s*price_monthly\s*=\s*79,\s*price_yearly\s*=\s*790/
      );
    });

    it('should update both price and price_monthly for professional', () => {
      expect(migrationContent).toMatch(
        /SET\s+price\s*=\s*150,\s*price_monthly\s*=\s*150,\s*price_yearly\s*=\s*1500/
      );
    });

    it('should update both price and price_monthly for enterprise', () => {
      expect(migrationContent).toMatch(
        /SET\s+price\s*=\s*499,\s*price_monthly\s*=\s*499,\s*price_yearly\s*=\s*4990/
      );
    });

    it('should only update when prices differ (idempotent)', () => {
      expect(migrationContent).toContain('IS DISTINCT FROM');
    });
  });

  describe('create_tenant_atomic function', () => {
    it('should be SECURITY DEFINER', () => {
      expect(migrationContent).toMatch(/SECURITY\s+DEFINER/);
    });

    it('should SET search_path = public', () => {
      expect(migrationContent).toMatch(/SET\s+search_path\s*=\s*public/);
    });

    it('should handle trial plan with trialing status', () => {
      expect(migrationContent).toContain("v_subscription_status := 'trialing'");
    });

    it('should set 14-day trial period', () => {
      expect(migrationContent).toContain("NOW() + INTERVAL '14 days'");
    });

    it('should grant unlimited credits (-1) for trial', () => {
      expect(migrationContent).toContain('v_initial_credits := -1;');
    });

    it('should default trial to starter plan', () => {
      expect(migrationContent).toContain("v_subscription_plan := 'starter'; -- Default trial is starter plan");
    });
  });

  describe('Annual pricing math', () => {
    it('should have yearly prices roughly 2 months free (16.67% savings)', () => {
      for (const [, prices] of Object.entries(CANONICAL_PRICES)) {
        const fullYearlyPrice = prices.monthly * 12;
        const savings = fullYearlyPrice - prices.yearly;
        const savingsPercent = (savings / fullYearlyPrice) * 100;
        expect(savingsPercent).toBeCloseTo(16.67, 0);
      }
    });
  });
});

describe('Start-trial Edge Function Pricing', () => {
  const edgeFunctionPath = join(
    process.cwd(),
    'supabase',
    'functions',
    'start-trial',
    'index.ts'
  );

  let edgeFunctionContent: string;

  try {
    edgeFunctionContent = readFileSync(edgeFunctionPath, 'utf-8');
  } catch {
    edgeFunctionContent = '';
  }

  it('should have valid edge function file', () => {
    expect(edgeFunctionContent).toBeTruthy();
  });

  it('should have starter priceMonthly matching TIER_PRICES', () => {
    expect(edgeFunctionContent).toMatch(/starter:\s*\{[^}]*priceMonthly:\s*79/s);
  });

  it('should have professional priceMonthly matching TIER_PRICES', () => {
    expect(edgeFunctionContent).toMatch(/professional:\s*\{[^}]*priceMonthly:\s*150/s);
  });

  it('should have enterprise priceMonthly matching TIER_PRICES', () => {
    expect(edgeFunctionContent).toMatch(/enterprise:\s*\{[^}]*priceMonthly:\s*499/s);
  });

  it('should have yearly prices matching PLAN_CONFIG', () => {
    expect(edgeFunctionContent).toMatch(/starter:\s*\{[^}]*priceYearly:\s*790/s);
    expect(edgeFunctionContent).toMatch(/professional:\s*\{[^}]*priceYearly:\s*1500/s);
    expect(edgeFunctionContent).toMatch(/enterprise:\s*\{[^}]*priceYearly:\s*4990/s);
  });

  it('should have Stripe price IDs matching PLAN_CONFIG', () => {
    expect(edgeFunctionContent).toContain(PLAN_CONFIG.starter.stripePriceId);
    expect(edgeFunctionContent).toContain(PLAN_CONFIG.professional.stripePriceId);
    expect(edgeFunctionContent).toContain(PLAN_CONFIG.enterprise.stripePriceId);
  });
});
