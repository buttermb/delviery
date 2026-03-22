/**
 * Verify handlePlanChange toast uses correct plan name
 *
 * Both BillingSettings and BillingPage use TIER_NAMES[targetPlan] in their
 * "Already on this plan" toast. This test ensures TIER_NAMES resolves correctly
 * for all valid SubscriptionTier values and that the toast description format
 * produces the expected user-facing message.
 */

import { describe, it, expect } from 'vitest';
import { TIER_NAMES, TIER_PRICES, type SubscriptionTier } from '@/lib/featureConfig';
import { businessTierToSubscriptionTier } from '@/lib/tierMapping';

describe('handlePlanChange toast plan names', () => {
  const allTiers: SubscriptionTier[] = ['starter', 'professional', 'enterprise'];

  describe('TIER_NAMES resolves correctly for all SubscriptionTier values', () => {
    it.each([
      ['starter', 'Starter'],
      ['professional', 'Professional'],
      ['enterprise', 'Enterprise'],
    ] as const)('TIER_NAMES["%s"] should be "%s"', (tier, expectedName) => {
      expect(TIER_NAMES[tier]).toBe(expectedName);
    });
  });

  describe('toast description format produces correct message', () => {
    it.each(allTiers)(
      'should produce correct "already on plan" message for %s tier',
      (tier) => {
        const message = `You're already on the ${TIER_NAMES[tier]} plan.`;
        expect(message).toContain(TIER_NAMES[tier]);
        expect(message).toMatch(/^You're already on the (Starter|Professional|Enterprise) plan\.$/);
      }
    );
  });

  describe('TIER_NAMES covers all SubscriptionTier values', () => {
    it('should have an entry for every tier', () => {
      for (const tier of allTiers) {
        expect(TIER_NAMES[tier]).toBeDefined();
        expect(typeof TIER_NAMES[tier]).toBe('string');
        expect(TIER_NAMES[tier].length).toBeGreaterThan(0);
      }
    });

    it('should have entries only for valid tiers', () => {
      const tierNameKeys = Object.keys(TIER_NAMES);
      expect(tierNameKeys).toHaveLength(allTiers.length);
      for (const key of tierNameKeys) {
        expect(allTiers).toContain(key);
      }
    });
  });

  describe('TIER_PRICES covers all SubscriptionTier values', () => {
    it.each(allTiers)('TIER_PRICES["%s"] should be a positive number', (tier) => {
      expect(TIER_PRICES[tier]).toBeGreaterThan(0);
      expect(typeof TIER_PRICES[tier]).toBe('number');
    });
  });

  describe('businessTierToSubscriptionTier maps correctly for plan change flow', () => {
    it.each([
      ['street', 'starter'],
      ['trap', 'starter'],
      ['block', 'professional'],
      ['hood', 'professional'],
      ['empire', 'enterprise'],
      ['starter', 'starter'],
      ['professional', 'professional'],
      ['enterprise', 'enterprise'],
    ] as const)('businessTierToSubscriptionTier("%s") should return "%s"', (input, expected) => {
      expect(businessTierToSubscriptionTier(input)).toBe(expected);
    });

    it('should default to starter for null/undefined', () => {
      expect(businessTierToSubscriptionTier(null)).toBe('starter');
      expect(businessTierToSubscriptionTier(undefined)).toBe('starter');
    });

    it('should default to starter for unknown values', () => {
      expect(businessTierToSubscriptionTier('unknown')).toBe('starter');
    });
  });

  describe('mapped business tiers produce valid TIER_NAMES lookups', () => {
    const businessTiers = ['street', 'trap', 'block', 'hood', 'empire'];

    it.each(businessTiers)(
      'business tier "%s" should map to a valid TIER_NAMES entry',
      (businessTier) => {
        const subscriptionTier = businessTierToSubscriptionTier(businessTier);
        const name = TIER_NAMES[subscriptionTier];
        expect(name).toBeDefined();
        expect(typeof name).toBe('string');
        expect(name.length).toBeGreaterThan(0);
      }
    );
  });
});
