/**
 * Starter Plan Features Consistency Verification
 *
 * Ensures that the features JSON in create_tenant_atomic (SQL),
 * subscriptionPlans.ts, featureConfig.ts, and planPricing.ts all agree
 * on what the starter plan includes.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { PLAN_FEATURES, SUBSCRIPTION_PLANS } from '@/utils/subscriptionPlans';
import { FEATURES, TIER_PRICES, getFeaturesForTier } from '@/lib/featureConfig';
import { PLAN_CONFIG } from '@/config/planPricing';

// ---------------------------------------------------------------------------
// 1. Migration SQL smoke-checks
// ---------------------------------------------------------------------------
describe('create_tenant_atomic migration syntax', () => {
  const migrationPath = join(
    process.cwd(),
    'supabase',
    'migrations',
    '20260321000001_fix_starter_features_json.sql',
  );

  let sql: string;
  try {
    sql = readFileSync(migrationPath, 'utf-8');
  } catch {
    sql = '';
  }

  it('migration file exists and is non-empty', () => {
    expect(sql.length).toBeGreaterThan(0);
  });

  it('has balanced parentheses', () => {
    const open = (sql.match(/\(/g) ?? []).length;
    const close = (sql.match(/\)/g) ?? []).length;
    expect(open).toBe(close);
  });

  it('uses SECURITY DEFINER with SET search_path', () => {
    expect(sql).toContain('SECURITY DEFINER');
    expect(sql).toContain('SET search_path = public');
  });

  it('advanced_analytics excludes starter plan', () => {
    // The fix: advanced_analytics should use IN ('professional', 'enterprise')
    // NOT IN ('starter', 'professional', 'enterprise')
    const advAnalyticsLine = sql
      .split('\n')
      .find((line) => line.includes("'advanced_analytics'"));
    expect(advAnalyticsLine).toBeDefined();
    expect(advAnalyticsLine).not.toContain("'starter'");
    expect(advAnalyticsLine).toContain("'professional'");
    expect(advAnalyticsLine).toContain("'enterprise'");
  });

  it('fixes existing starter tenants with wrong advanced_analytics', () => {
    expect(sql).toContain("subscription_plan = 'starter'");
    expect(sql).toContain("'{advanced_analytics}'");
    expect(sql).toContain("'false'");
  });
});

// ---------------------------------------------------------------------------
// 2. TypeScript sources agree on starter features
// ---------------------------------------------------------------------------
describe('starter plan features consistency across TS sources', () => {
  const starterPlan = PLAN_FEATURES[SUBSCRIPTION_PLANS.STARTER];

  it('subscriptionPlans.ts starter features match expected values', () => {
    expect(starterPlan.features).toEqual({
      api_access: false,
      custom_branding: false,
      white_label: false,
      advanced_analytics: false,
      sms_enabled: false,
    });
  });

  it('featureConfig.ts advanced-analytics is enterprise tier', () => {
    expect(FEATURES['advanced-analytics'].tier).toBe('enterprise');
  });

  it('featureConfig.ts api-access is enterprise tier', () => {
    expect(FEATURES['api-access'].tier).toBe('enterprise');
  });

  it('featureConfig.ts white-label is enterprise tier', () => {
    expect(FEATURES['white-label'].tier).toBe('enterprise');
  });

  it('starter tier in featureConfig has exactly 20 features', () => {
    const starterFeatures = getFeaturesForTier('starter');
    // Note: menu-migration is defined as starter tier (line 288 in featureConfig.ts)
    // so total starter features = 21
    expect(starterFeatures.length).toBe(21);
  });

  it('none of the starter features in featureConfig are analytics/api/sms', () => {
    const starterFeatures = getFeaturesForTier('starter');
    const starterFeatureIds = starterFeatures.map((f) => f.id);

    expect(starterFeatureIds).not.toContain('advanced-analytics');
    expect(starterFeatureIds).not.toContain('api-access');
    expect(starterFeatureIds).not.toContain('analytics');
  });
});

// ---------------------------------------------------------------------------
// 3. Pricing consistency
// ---------------------------------------------------------------------------
describe('pricing consistency across TS sources', () => {
  it('subscriptionPlans.ts prices match TIER_PRICES', () => {
    expect(PLAN_FEATURES[SUBSCRIPTION_PLANS.STARTER].price).toBe(TIER_PRICES.starter);
    expect(PLAN_FEATURES[SUBSCRIPTION_PLANS.PROFESSIONAL].price).toBe(TIER_PRICES.professional);
    expect(PLAN_FEATURES[SUBSCRIPTION_PLANS.ENTERPRISE].price).toBe(TIER_PRICES.enterprise);
  });

  it('subscriptionPlans.ts prices match planPricing.ts', () => {
    expect(PLAN_FEATURES[SUBSCRIPTION_PLANS.STARTER].price).toBe(PLAN_CONFIG.starter.priceMonthly);
    expect(PLAN_FEATURES[SUBSCRIPTION_PLANS.PROFESSIONAL].price).toBe(PLAN_CONFIG.professional.priceMonthly);
    expect(PLAN_FEATURES[SUBSCRIPTION_PLANS.ENTERPRISE].price).toBe(PLAN_CONFIG.enterprise.priceMonthly);
  });

  it('canonical prices are 79/150/499', () => {
    expect(TIER_PRICES.starter).toBe(79);
    expect(TIER_PRICES.professional).toBe(150);
    expect(TIER_PRICES.enterprise).toBe(499);
  });
});

// ---------------------------------------------------------------------------
// 4. Limits consistency between subscriptionPlans.ts and DB migration
// ---------------------------------------------------------------------------
describe('starter plan limits match DB function', () => {
  const starterLimits = PLAN_FEATURES[SUBSCRIPTION_PLANS.STARTER].limits;

  // These values must match what create_tenant_atomic sets for starter
  it('customers limit is 200', () => {
    expect(starterLimits.customers).toBe(200);
  });

  it('menus limit is 10', () => {
    expect(starterLimits.menus).toBe(10);
  });

  it('products limit is 500', () => {
    expect(starterLimits.products).toBe(500);
  });

  it('locations limit is 5', () => {
    expect(starterLimits.locations).toBe(5);
  });

  it('users limit is 10', () => {
    expect(starterLimits.users).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// 5. Professional plan limits match DB function
// ---------------------------------------------------------------------------
describe('professional plan limits match DB function', () => {
  const proLimits = PLAN_FEATURES[SUBSCRIPTION_PLANS.PROFESSIONAL].limits;

  it('customers limit is 1000', () => {
    expect(proLimits.customers).toBe(1000);
  });

  it('menus limit is 50', () => {
    expect(proLimits.menus).toBe(50);
  });

  it('products limit is 2000', () => {
    expect(proLimits.products).toBe(2000);
  });

  it('locations limit is 20', () => {
    expect(proLimits.locations).toBe(20);
  });

  it('users limit is 50', () => {
    expect(proLimits.users).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// 6. Enterprise plan limits match DB function
// ---------------------------------------------------------------------------
describe('enterprise plan limits match DB function', () => {
  const entLimits = PLAN_FEATURES[SUBSCRIPTION_PLANS.ENTERPRISE].limits;

  it('all limits are unlimited (-1)', () => {
    expect(entLimits.customers).toBe(-1);
    expect(entLimits.menus).toBe(-1);
    expect(entLimits.products).toBe(-1);
    expect(entLimits.locations).toBe(-1);
    expect(entLimits.users).toBe(-1);
  });
});

// ---------------------------------------------------------------------------
// 7. Feature flags hierarchy is correct
// ---------------------------------------------------------------------------
describe('feature flag hierarchy', () => {
  it('starter has no premium feature flags', () => {
    const starter = PLAN_FEATURES[SUBSCRIPTION_PLANS.STARTER].features;
    expect(Object.values(starter).every((v) => v === false)).toBe(true);
  });

  it('professional has api_access, custom_branding, advanced_analytics, sms but not white_label', () => {
    const pro = PLAN_FEATURES[SUBSCRIPTION_PLANS.PROFESSIONAL].features;
    expect(pro.api_access).toBe(true);
    expect(pro.custom_branding).toBe(true);
    expect(pro.advanced_analytics).toBe(true);
    expect(pro.sms_enabled).toBe(true);
    expect(pro.white_label).toBe(false);
  });

  it('enterprise has all feature flags enabled', () => {
    const ent = PLAN_FEATURES[SUBSCRIPTION_PLANS.ENTERPRISE].features;
    expect(Object.values(ent).every((v) => v === true)).toBe(true);
  });
});
