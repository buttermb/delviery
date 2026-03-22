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
} from '../creditCosts';

describe('FREE_TIER_MONTHLY_CREDITS constant', () => {
  it('should be exactly 500', () => {
    expect(FREE_TIER_MONTHLY_CREDITS).toBe(500);
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

  it('YELLOW_BADGE threshold should equal FREE_TIER_MONTHLY_CREDITS', () => {
    expect(CREDIT_WARNING_THRESHOLDS.YELLOW_BADGE).toBe(FREE_TIER_MONTHLY_CREDITS);
  });
});
