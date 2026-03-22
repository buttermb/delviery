/**
 * Billing Price Consistency Tests
 * Verifies that TIER_PRICES and PLAN_CONFIG stay in sync
 * and that billing constants use the correct pricing values.
 */

import { describe, it, expect } from 'vitest';
import { TIER_PRICES } from '@/lib/featureConfig';
import { PLAN_CONFIG } from '@/config/planPricing';

describe('Billing Price Consistency', () => {
  describe('TIER_PRICES matches PLAN_CONFIG monthly prices', () => {
    it('starter price should match', () => {
      expect(TIER_PRICES.starter).toBe(PLAN_CONFIG.starter.priceMonthly);
    });

    it('professional price should match', () => {
      expect(TIER_PRICES.professional).toBe(PLAN_CONFIG.professional.priceMonthly);
    });

    it('enterprise price should match', () => {
      expect(TIER_PRICES.enterprise).toBe(PLAN_CONFIG.enterprise.priceMonthly);
    });
  });

  describe('TIER_PRICES has expected values', () => {
    it('starter should be $79/mo', () => {
      expect(TIER_PRICES.starter).toBe(79);
    });

    it('professional should be $150/mo', () => {
      expect(TIER_PRICES.professional).toBe(150);
    });

    it('enterprise should be $499/mo', () => {
      expect(TIER_PRICES.enterprise).toBe(499);
    });
  });

  describe('PLAN_CONFIG yearly prices should be ~10x monthly', () => {
    it('starter yearly should be 10x monthly', () => {
      expect(PLAN_CONFIG.starter.priceYearly).toBe(PLAN_CONFIG.starter.priceMonthly * 10);
    });

    it('professional yearly should be 10x monthly', () => {
      expect(PLAN_CONFIG.professional.priceYearly).toBe(PLAN_CONFIG.professional.priceMonthly * 10);
    });

    it('enterprise yearly should be 10x monthly', () => {
      expect(PLAN_CONFIG.enterprise.priceYearly).toBe(PLAN_CONFIG.enterprise.priceMonthly * 10);
    });
  });

  describe('all tiers are defined', () => {
    it('TIER_PRICES should have starter, professional, enterprise', () => {
      expect(TIER_PRICES).toHaveProperty('starter');
      expect(TIER_PRICES).toHaveProperty('professional');
      expect(TIER_PRICES).toHaveProperty('enterprise');
    });

    it('PLAN_CONFIG should have free, starter, professional, enterprise', () => {
      expect(PLAN_CONFIG).toHaveProperty('free');
      expect(PLAN_CONFIG).toHaveProperty('starter');
      expect(PLAN_CONFIG).toHaveProperty('professional');
      expect(PLAN_CONFIG).toHaveProperty('enterprise');
    });
  });
});
