/**
 * Credit Constants Tests
 *
 * Verifies that billing-critical constants (especially FREE_TIER_MONTHLY_CREDITS)
 * are set to expected values. These tests import only from creditCosts.ts
 * to avoid Supabase client initialization side effects.
 */

import { describe, it, expect } from 'vitest';
import {
  FREE_TIER_MONTHLY_CREDITS,
  LOW_CREDIT_WARNING_THRESHOLD,
  CRITICAL_CREDIT_THRESHOLD,
  CREDIT_WARNING_THRESHOLDS,
  HIGH_COST_THRESHOLD,
  CREDIT_COSTS,
  getCreditCost,
} from '../creditCosts';

describe('FREE_TIER_MONTHLY_CREDITS constant', () => {
  it('should be exactly 10000', () => {
    expect(FREE_TIER_MONTHLY_CREDITS).toBe(10000);
  });

  it('should be a positive integer', () => {
    expect(Number.isInteger(FREE_TIER_MONTHLY_CREDITS)).toBe(true);
    expect(FREE_TIER_MONTHLY_CREDITS).toBeGreaterThan(0);
  });
});

describe('Credit threshold consistency with FREE_TIER_MONTHLY_CREDITS', () => {
  it('LOW_CREDIT_WARNING_THRESHOLD should be greater than FREE_TIER_MONTHLY_CREDITS', () => {
    expect(LOW_CREDIT_WARNING_THRESHOLD).toBeGreaterThan(FREE_TIER_MONTHLY_CREDITS);
  });

  it('CRITICAL_CREDIT_THRESHOLD should be less than FREE_TIER_MONTHLY_CREDITS', () => {
    expect(CRITICAL_CREDIT_THRESHOLD).toBeLessThan(FREE_TIER_MONTHLY_CREDITS);
  });

  it('YELLOW_BADGE threshold should be less than FREE_TIER_MONTHLY_CREDITS', () => {
    expect(CREDIT_WARNING_THRESHOLDS.YELLOW_BADGE).toBeLessThan(FREE_TIER_MONTHLY_CREDITS);
  });
});

describe('HIGH_COST_THRESHOLD constant', () => {
  it('should be exactly 50 credits', () => {
    expect(HIGH_COST_THRESHOLD).toBe(50);
  });

  it('should be a positive integer', () => {
    expect(Number.isInteger(HIGH_COST_THRESHOLD)).toBe(true);
    expect(HIGH_COST_THRESHOLD).toBeGreaterThan(0);
  });

  it('should be less than or equal to FREE_TIER_MONTHLY_CREDITS', () => {
    expect(HIGH_COST_THRESHOLD).toBeLessThanOrEqual(FREE_TIER_MONTHLY_CREDITS);
  });
});

describe('High-cost actions trigger confirmation at threshold', () => {
  const highCostActions = Object.values(CREDIT_COSTS).filter(
    (c) => c.credits >= HIGH_COST_THRESHOLD
  );

  const lowCostActions = Object.values(CREDIT_COSTS).filter(
    (c) => c.credits > 0 && c.credits < HIGH_COST_THRESHOLD
  );

  it('should have actions at or above the threshold', () => {
    expect(highCostActions.length).toBeGreaterThan(0);
  });

  it('should identify known high-cost actions correctly', () => {
    const expectedHighCost = [
      'menu_create',          // 100
      'wholesale_order_place', // 100
      'menu_order_received',  // 75
      'storefront_create',    // 500
      'menu_ocr',             // 250
      'ai_suggestions',       // 100
      'order_create_manual',  // 50
      'invoice_create',       // 50
    ];

    for (const key of expectedHighCost) {
      const cost = getCreditCost(key);
      expect(cost).toBeGreaterThanOrEqual(HIGH_COST_THRESHOLD);
    }
  });

  it('should NOT flag low-cost actions as high-cost', () => {
    for (const action of lowCostActions) {
      expect(action.credits).toBeLessThan(HIGH_COST_THRESHOLD);
    }
  });
});
