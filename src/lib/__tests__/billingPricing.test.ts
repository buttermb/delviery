/**
 * Billing Pricing Tests
 * Verifies that TIER_PRICES (source of truth) stays consistent with PLAN_CONFIG
 * and that BillingSettings PLANS array can safely reference TIER_PRICES for all tiers.
 */

import { describe, it, expect } from 'vitest';
import { TIER_PRICES, TIER_NAMES } from '../featureConfig';
import { PLAN_CONFIG } from '@/config/planPricing';

describe('TIER_PRICES consistency', () => {
  it('should define pricing for all three subscription tiers', () => {
    expect(TIER_PRICES).toHaveProperty('starter');
    expect(TIER_PRICES).toHaveProperty('professional');
    expect(TIER_PRICES).toHaveProperty('enterprise');
  });

  it('should have positive numeric prices for all tiers', () => {
    expect(typeof TIER_PRICES.starter).toBe('number');
    expect(typeof TIER_PRICES.professional).toBe('number');
    expect(typeof TIER_PRICES.enterprise).toBe('number');
    expect(TIER_PRICES.starter).toBeGreaterThan(0);
    expect(TIER_PRICES.professional).toBeGreaterThan(0);
    expect(TIER_PRICES.enterprise).toBeGreaterThan(0);
  });

  it('should have enterprise priced higher than professional', () => {
    expect(TIER_PRICES.enterprise).toBeGreaterThan(TIER_PRICES.professional);
  });

  it('should have professional priced higher than starter', () => {
    expect(TIER_PRICES.professional).toBeGreaterThan(TIER_PRICES.starter);
  });

  it('should have enterprise price of 499', () => {
    expect(TIER_PRICES.enterprise).toBe(499);
  });

  it('should have professional price of 150', () => {
    expect(TIER_PRICES.professional).toBe(150);
  });

  it('should have starter price of 79', () => {
    expect(TIER_PRICES.starter).toBe(79);
  });
});

describe('TIER_PRICES matches PLAN_CONFIG', () => {
  it('should have starter price matching PLAN_CONFIG', () => {
    expect(TIER_PRICES.starter).toBe(PLAN_CONFIG.starter.priceMonthly);
  });

  it('should have professional price matching PLAN_CONFIG', () => {
    expect(TIER_PRICES.professional).toBe(PLAN_CONFIG.professional.priceMonthly);
  });

  it('should have enterprise price matching PLAN_CONFIG', () => {
    expect(TIER_PRICES.enterprise).toBe(PLAN_CONFIG.enterprise.priceMonthly);
  });
});

describe('TIER_NAMES consistency', () => {
  it('should define names for all three subscription tiers', () => {
    expect(TIER_NAMES.starter).toBe('Starter');
    expect(TIER_NAMES.professional).toBe('Professional');
    expect(TIER_NAMES.enterprise).toBe('Enterprise');
  });

  it('should match PLAN_CONFIG names', () => {
    expect(TIER_NAMES.starter).toBe(PLAN_CONFIG.starter.name);
    expect(TIER_NAMES.professional).toBe(PLAN_CONFIG.professional.name);
    expect(TIER_NAMES.enterprise).toBe(PLAN_CONFIG.enterprise.name);
  });
});
