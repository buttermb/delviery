/**
 * Billing Tier Prices Consistency Tests
 *
 * Verifies that TIER_PRICES, PLAN_CONFIG, and pricing constants
 * remain consistent across the billing system.
 */

import { describe, it, expect } from 'vitest';
import { TIER_PRICES } from '@/lib/featureConfig';
import { PLAN_CONFIG } from '@/config/planPricing';

describe('Billing Tier Prices', () => {
  describe('TIER_PRICES values', () => {
    it('should have correct professional tier price', () => {
      expect(TIER_PRICES.professional).toBe(150);
    });

    it('should have correct starter tier price', () => {
      expect(TIER_PRICES.starter).toBe(79);
    });

    it('should have correct enterprise tier price', () => {
      expect(TIER_PRICES.enterprise).toBe(499);
    });
  });

  describe('PLAN_CONFIG consistency with TIER_PRICES', () => {
    it('should match professional monthly price', () => {
      expect(PLAN_CONFIG.professional.priceMonthly).toBe(TIER_PRICES.professional);
    });

    it('should match starter monthly price', () => {
      expect(PLAN_CONFIG.starter.priceMonthly).toBe(TIER_PRICES.starter);
    });

    it('should match enterprise monthly price', () => {
      expect(PLAN_CONFIG.enterprise.priceMonthly).toBe(TIER_PRICES.enterprise);
    });
  });

  describe('yearly pricing consistency', () => {
    it('professional yearly should be 10x monthly (2 months free)', () => {
      expect(PLAN_CONFIG.professional.priceYearly).toBe(TIER_PRICES.professional * 10);
    });

    it('starter yearly should be 10x monthly (2 months free)', () => {
      expect(PLAN_CONFIG.starter.priceYearly).toBe(TIER_PRICES.starter * 10);
    });

    it('enterprise yearly should be 10x monthly (2 months free)', () => {
      expect(PLAN_CONFIG.enterprise.priceYearly).toBe(TIER_PRICES.enterprise * 10);
    });
  });
});
