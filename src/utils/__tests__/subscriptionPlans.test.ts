/**
 * Tests verifying subscription plan limits and features match
 * the canonical values defined in create_tenant_atomic() SQL function.
 *
 * Source of truth: supabase/migrations/20260320000001_fix_subscription_pricing_consistency.sql
 */
import { describe, it, expect } from 'vitest';
import { PLAN_FEATURES, SUBSCRIPTION_PLANS, getPlanDetails, isProfessionalOrHigher, isEnterprise } from '@/utils/subscriptionPlans';
import { TIER_PRICES } from '@/lib/featureConfig';
import { PLAN_CONFIG } from '@/config/planPricing';

/**
 * Canonical limits from create_tenant_atomic() SQL function.
 * If these values change in the SQL, update here and fix the TypeScript sources.
 */
const SQL_CANONICAL = {
  free: {
    limits: { customers: 50, menus: 3, products: 100, locations: 2, users: 3 },
    features: { api_access: false, custom_branding: false, white_label: false, advanced_analytics: false, sms_enabled: false },
    mrr: 0,
    credits: 10000,
  },
  starter: {
    limits: { customers: 200, menus: 10, products: 500, locations: 5, users: 10 },
    features: { api_access: false, custom_branding: false, white_label: false, advanced_analytics: true, sms_enabled: false },
    mrr: 79,
    credits: 25000,
  },
  professional: {
    limits: { customers: 1000, menus: 50, products: 2000, locations: 20, users: 50 },
    features: { api_access: true, custom_branding: true, white_label: false, advanced_analytics: true, sms_enabled: true },
    mrr: 150,
    credits: 100000,
  },
  enterprise: {
    limits: { customers: -1, menus: -1, products: -1, locations: -1, users: -1 },
    features: { api_access: true, custom_branding: true, white_label: true, advanced_analytics: true, sms_enabled: true },
    mrr: 499,
    credits: 500000,
  },
} as const;

describe('Subscription Plans - Limits match create_tenant_atomic SQL', () => {
  describe('PLAN_FEATURES limits', () => {
    it('free plan limits match SQL', () => {
      expect(PLAN_FEATURES[SUBSCRIPTION_PLANS.FREE].limits).toEqual(SQL_CANONICAL.free.limits);
    });

    it('starter plan limits match SQL', () => {
      expect(PLAN_FEATURES[SUBSCRIPTION_PLANS.STARTER].limits).toEqual(SQL_CANONICAL.starter.limits);
    });

    it('professional plan limits match SQL', () => {
      expect(PLAN_FEATURES[SUBSCRIPTION_PLANS.PROFESSIONAL].limits).toEqual(SQL_CANONICAL.professional.limits);
    });

    it('enterprise plan limits match SQL (all unlimited)', () => {
      expect(PLAN_FEATURES[SUBSCRIPTION_PLANS.ENTERPRISE].limits).toEqual(SQL_CANONICAL.enterprise.limits);
    });
  });

  describe('PLAN_FEATURES feature flags', () => {
    it('free plan features match SQL', () => {
      expect(PLAN_FEATURES[SUBSCRIPTION_PLANS.FREE].features).toEqual(SQL_CANONICAL.free.features);
    });

    it('starter plan features match SQL', () => {
      expect(PLAN_FEATURES[SUBSCRIPTION_PLANS.STARTER].features).toEqual(SQL_CANONICAL.starter.features);
    });

    it('professional plan features match SQL', () => {
      expect(PLAN_FEATURES[SUBSCRIPTION_PLANS.PROFESSIONAL].features).toEqual(SQL_CANONICAL.professional.features);
    });

    it('enterprise plan features match SQL', () => {
      expect(PLAN_FEATURES[SUBSCRIPTION_PLANS.ENTERPRISE].features).toEqual(SQL_CANONICAL.enterprise.features);
    });
  });

  describe('Pricing consistency across all sources', () => {
    it('PLAN_FEATURES prices match canonical TIER_PRICES', () => {
      expect(PLAN_FEATURES[SUBSCRIPTION_PLANS.FREE].price).toBe(0);
      expect(PLAN_FEATURES[SUBSCRIPTION_PLANS.STARTER].price).toBe(TIER_PRICES.starter);
      expect(PLAN_FEATURES[SUBSCRIPTION_PLANS.PROFESSIONAL].price).toBe(TIER_PRICES.professional);
      expect(PLAN_FEATURES[SUBSCRIPTION_PLANS.ENTERPRISE].price).toBe(TIER_PRICES.enterprise);
    });

    it('PLAN_CONFIG prices match canonical TIER_PRICES', () => {
      expect(PLAN_CONFIG.free.priceMonthly).toBe(0);
      expect(PLAN_CONFIG.starter.priceMonthly).toBe(TIER_PRICES.starter);
      expect(PLAN_CONFIG.professional.priceMonthly).toBe(TIER_PRICES.professional);
      expect(PLAN_CONFIG.enterprise.priceMonthly).toBe(TIER_PRICES.enterprise);
    });

    it('canonical prices are 79/150/499', () => {
      expect(TIER_PRICES.starter).toBe(79);
      expect(TIER_PRICES.professional).toBe(150);
      expect(TIER_PRICES.enterprise).toBe(499);
    });
  });

  describe('Starter tier specific constraints', () => {
    const starter = PLAN_FEATURES[SUBSCRIPTION_PLANS.STARTER];

    it('has 200 customer limit', () => {
      expect(starter.limits.customers).toBe(200);
    });

    it('has 10 menu limit', () => {
      expect(starter.limits.menus).toBe(10);
    });

    it('has 500 product limit', () => {
      expect(starter.limits.products).toBe(500);
    });

    it('has 5 location limit', () => {
      expect(starter.limits.locations).toBe(5);
    });

    it('has 10 user limit', () => {
      expect(starter.limits.users).toBe(10);
    });

    it('has advanced_analytics enabled', () => {
      expect(starter.features.advanced_analytics).toBe(true);
    });

    it('does not have api_access', () => {
      expect(starter.features.api_access).toBe(false);
    });

    it('does not have custom_branding', () => {
      expect(starter.features.custom_branding).toBe(false);
    });

    it('does not have white_label', () => {
      expect(starter.features.white_label).toBe(false);
    });

    it('does not have sms_enabled', () => {
      expect(starter.features.sms_enabled).toBe(false);
    });

    it('is priced at $79/month', () => {
      expect(starter.price).toBe(79);
    });
  });

  describe('Plan hierarchy helpers', () => {
    it('getPlanDetails returns correct plan for known plans', () => {
      expect(getPlanDetails('starter').displayName).toBe('Starter');
      expect(getPlanDetails('professional').displayName).toBe('Professional');
      expect(getPlanDetails('enterprise').displayName).toBe('Enterprise');
    });

    it('getPlanDetails falls back to free for unknown plans', () => {
      expect(getPlanDetails('unknown').displayName).toBe('Free');
      expect(getPlanDetails('unknown').limits).toEqual(SQL_CANONICAL.free.limits);
    });

    it('isProfessionalOrHigher correctly identifies tiers', () => {
      expect(isProfessionalOrHigher('starter')).toBe(false);
      expect(isProfessionalOrHigher('free')).toBe(false);
      expect(isProfessionalOrHigher('professional')).toBe(true);
      expect(isProfessionalOrHigher('enterprise')).toBe(true);
    });

    it('isEnterprise correctly identifies tier', () => {
      expect(isEnterprise('starter')).toBe(false);
      expect(isEnterprise('professional')).toBe(false);
      expect(isEnterprise('enterprise')).toBe(true);
    });
  });

  describe('SUBSCRIPTION_PLANS constants', () => {
    it('includes free plan', () => {
      expect(SUBSCRIPTION_PLANS.FREE).toBe('free');
    });

    it('includes all paid plans', () => {
      expect(SUBSCRIPTION_PLANS.STARTER).toBe('starter');
      expect(SUBSCRIPTION_PLANS.PROFESSIONAL).toBe('professional');
      expect(SUBSCRIPTION_PLANS.ENTERPRISE).toBe('enterprise');
    });
  });
});
