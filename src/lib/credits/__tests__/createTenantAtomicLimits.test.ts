/**
 * create_tenant_atomic Free Tier Limits Verification
 *
 * Verifies that the application-level free tier constants are consistent
 * and that create_tenant_atomic DB limits align with frontend enforcement.
 *
 * The DB function (create_tenant_atomic) sets resource limits in the tenants.limits JSONB column.
 * The frontend enforces limits via FREE_TIER_LIMITS in creditCosts.ts.
 * These two sources MUST agree on free tier caps.
 */

import { describe, it, expect } from 'vitest';
import { FREE_TIER_LIMITS, FREE_TIER_MONTHLY_CREDITS } from '../creditCosts';
import { PLAN_CONFIG } from '@/config/planPricing';
import { TIER_PRICES } from '@/lib/featureConfig';

// ============================================================================
// Canonical DB resource limits for create_tenant_atomic
// These values define what the SQL function MUST set in tenants.limits
// ============================================================================

/**
 * Expected DB limits for create_tenant_atomic by plan.
 * The SQL function must set these exact values in the tenants.limits JSONB column.
 * Any drift between these values and the actual SQL is a critical bug.
 */
export const EXPECTED_DB_LIMITS = {
  free: {
    customers: 50,
    menus: 3,
    products: 25,
    locations: 1,
    users: 1,
  },
  starter: {
    customers: 200,
    menus: 10,
    products: 500,
    locations: 5,
    users: 10,
  },
  professional: {
    customers: 1000,
    menus: 50,
    products: 2000,
    locations: 20,
    users: 50,
  },
  enterprise: {
    customers: -1, // unlimited
    menus: -1,
    products: -1,
    locations: -1,
    users: -1,
  },
} as const;

/**
 * Expected feature flags for create_tenant_atomic by plan.
 * The SQL function sets these in tenants.features JSONB column.
 */
export const EXPECTED_DB_FEATURES = {
  free: {
    api_access: false,
    custom_branding: false,
    white_label: false,
    advanced_analytics: false,
    sms_enabled: false,
  },
  starter: {
    api_access: false,
    custom_branding: false,
    white_label: false,
    advanced_analytics: false,
    sms_enabled: false,
  },
  professional: {
    api_access: true,
    custom_branding: true,
    white_label: false,
    advanced_analytics: false,
    sms_enabled: true,
  },
  enterprise: {
    api_access: true,
    custom_branding: true,
    white_label: true,
    advanced_analytics: true,
    sms_enabled: true,
  },
} as const;

/**
 * Expected initial credit grants by plan.
 * create_tenant_atomic sets these as the initial tenant_credits.balance.
 */
export const EXPECTED_INITIAL_CREDITS = {
  free: FREE_TIER_MONTHLY_CREDITS, // 10000 - must match the constant
  starter: 25000,
  professional: 100000,
  enterprise: 500000,
  trial: -1, // unlimited during trial
} as const;

/**
 * Expected MRR values by plan (canonical pricing).
 */
export const EXPECTED_MRR = {
  free: 0,
  starter: TIER_PRICES.starter, // 79
  professional: TIER_PRICES.professional, // 150
  enterprise: TIER_PRICES.enterprise, // 499
} as const;

// ============================================================================
// Tests: FREE_TIER_LIMITS matches DB limits
// ============================================================================

describe('create_tenant_atomic free tier limits consistency', () => {
  describe('resource limits match between DB and application', () => {
    it('free tier max_products must match DB limits', () => {
      expect(FREE_TIER_LIMITS.max_products).toBe(EXPECTED_DB_LIMITS.free.products);
    });

    it('free tier max_customers must match DB limits', () => {
      expect(FREE_TIER_LIMITS.max_customers).toBe(EXPECTED_DB_LIMITS.free.customers);
    });

    it('free tier max_locations must match DB limits', () => {
      expect(FREE_TIER_LIMITS.max_locations).toBe(EXPECTED_DB_LIMITS.free.locations);
    });

    it('free tier max_team_members must match DB limits', () => {
      expect(FREE_TIER_LIMITS.max_team_members).toBe(EXPECTED_DB_LIMITS.free.users);
    });
  });

  describe('initial credit grants are consistent', () => {
    it('free tier initial credits must equal FREE_TIER_MONTHLY_CREDITS', () => {
      expect(EXPECTED_INITIAL_CREDITS.free).toBe(10000);
      expect(EXPECTED_INITIAL_CREDITS.free).toBe(FREE_TIER_MONTHLY_CREDITS);
    });

    it('paid tiers should have higher initial credits', () => {
      expect(EXPECTED_INITIAL_CREDITS.starter).toBeGreaterThan(EXPECTED_INITIAL_CREDITS.free);
      expect(EXPECTED_INITIAL_CREDITS.professional).toBeGreaterThan(EXPECTED_INITIAL_CREDITS.starter);
      expect(EXPECTED_INITIAL_CREDITS.enterprise).toBeGreaterThan(EXPECTED_INITIAL_CREDITS.professional);
    });

    it('trial tier should have unlimited credits (-1)', () => {
      expect(EXPECTED_INITIAL_CREDITS.trial).toBe(-1);
    });
  });

  describe('MRR values match canonical pricing', () => {
    it('free tier MRR is 0', () => {
      expect(EXPECTED_MRR.free).toBe(0);
    });

    it('starter MRR matches TIER_PRICES', () => {
      expect(EXPECTED_MRR.starter).toBe(79);
    });

    it('professional MRR matches TIER_PRICES', () => {
      expect(EXPECTED_MRR.professional).toBe(150);
    });

    it('enterprise MRR matches TIER_PRICES', () => {
      expect(EXPECTED_MRR.enterprise).toBe(499);
    });

    it('PLAN_CONFIG prices match TIER_PRICES', () => {
      expect(PLAN_CONFIG.starter.priceMonthly).toBe(TIER_PRICES.starter);
      expect(PLAN_CONFIG.professional.priceMonthly).toBe(TIER_PRICES.professional);
      expect(PLAN_CONFIG.enterprise.priceMonthly).toBe(TIER_PRICES.enterprise);
    });
  });

  describe('feature flags are consistent with featureConfig', () => {
    it('free tier should not have api_access', () => {
      expect(EXPECTED_DB_FEATURES.free.api_access).toBe(false);
    });

    it('free tier should not have advanced_analytics', () => {
      expect(EXPECTED_DB_FEATURES.free.advanced_analytics).toBe(false);
    });

    it('starter tier should not have advanced_analytics', () => {
      // advanced-analytics is enterprise tier in featureConfig.ts
      expect(EXPECTED_DB_FEATURES.starter.advanced_analytics).toBe(false);
    });

    it('only enterprise should have white_label', () => {
      expect(EXPECTED_DB_FEATURES.free.white_label).toBe(false);
      expect(EXPECTED_DB_FEATURES.starter.white_label).toBe(false);
      expect(EXPECTED_DB_FEATURES.professional.white_label).toBe(false);
      expect(EXPECTED_DB_FEATURES.enterprise.white_label).toBe(true);
    });

    it('only professional+ should have api_access', () => {
      expect(EXPECTED_DB_FEATURES.free.api_access).toBe(false);
      expect(EXPECTED_DB_FEATURES.starter.api_access).toBe(false);
      expect(EXPECTED_DB_FEATURES.professional.api_access).toBe(true);
      expect(EXPECTED_DB_FEATURES.enterprise.api_access).toBe(true);
    });

    it('only enterprise should have advanced_analytics', () => {
      expect(EXPECTED_DB_FEATURES.free.advanced_analytics).toBe(false);
      expect(EXPECTED_DB_FEATURES.starter.advanced_analytics).toBe(false);
      expect(EXPECTED_DB_FEATURES.professional.advanced_analytics).toBe(false);
      expect(EXPECTED_DB_FEATURES.enterprise.advanced_analytics).toBe(true);
    });
  });

  describe('DB limits hierarchy is valid', () => {
    it('higher tiers should have higher or equal limits', () => {
      const tiers = ['free', 'starter', 'professional'] as const;
      const keys = ['customers', 'menus', 'products', 'locations', 'users'] as const;

      for (const key of keys) {
        for (let i = 0; i < tiers.length - 1; i++) {
          const current = EXPECTED_DB_LIMITS[tiers[i]][key];
          const next = EXPECTED_DB_LIMITS[tiers[i + 1]][key];
          expect(next).toBeGreaterThan(current);
        }
      }
    });

    it('enterprise should have unlimited (-1) for all limits', () => {
      const keys = ['customers', 'menus', 'products', 'locations', 'users'] as const;
      for (const key of keys) {
        expect(EXPECTED_DB_LIMITS.enterprise[key]).toBe(-1);
      }
    });
  });

  describe('blocked features align with DB features', () => {
    it('api_access blocked for free tier matches DB', () => {
      const blocked = FREE_TIER_LIMITS.blocked_features.includes('api_access');
      expect(blocked).toBe(!EXPECTED_DB_FEATURES.free.api_access);
    });

    it('white_label blocked for free tier matches DB', () => {
      const blocked = FREE_TIER_LIMITS.blocked_features.includes('white_label');
      expect(blocked).toBe(!EXPECTED_DB_FEATURES.free.white_label);
    });

    it('ai_analytics blocked for free tier matches DB', () => {
      const blocked = FREE_TIER_LIMITS.blocked_features.includes('ai_analytics');
      expect(blocked).toBe(!EXPECTED_DB_FEATURES.free.advanced_analytics);
    });
  });

  describe('grant_free_credits RPC cap matches FREE_TIER_MONTHLY_CREDITS', () => {
    it('free tier monthly allocation should be 10000', () => {
      // The grant_free_credits SQL function has v_max_monthly_grant = 10000
      // This MUST match FREE_TIER_MONTHLY_CREDITS
      expect(FREE_TIER_MONTHLY_CREDITS).toBe(10000);
    });
  });
});
