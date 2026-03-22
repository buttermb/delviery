/**
 * SelectPlanPage — isUpgrade / isCurrentPlan logic tests
 *
 * Tests the pure exported helpers (isPlanUpgrade, isPlanCurrent, TIER_ORDER)
 * that drive button labels and card styling on the plan selection page.
 */

import { describe, it, expect } from 'vitest';
import {
  isPlanUpgrade,
  isPlanCurrent,
  TIER_ORDER,
  type Plan,
} from '@/pages/tenant-admin/selectPlanHelpers';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const makePlan = (id: string, name?: string): Plan => ({
  id,
  name: name ?? id.charAt(0).toUpperCase() + id.slice(1),
  priceMonthly: 0,
  priceYearly: 0,
  description: '',
  features: [],
});

const starter = makePlan('starter', 'Starter');
const professional = makePlan('professional', 'Professional');
const enterprise = makePlan('enterprise', 'Enterprise');

// ---------------------------------------------------------------------------
// TIER_ORDER
// ---------------------------------------------------------------------------

describe('TIER_ORDER', () => {
  it('ranks starter < professional < enterprise', () => {
    expect(TIER_ORDER['starter']).toBeLessThan(TIER_ORDER['professional']);
    expect(TIER_ORDER['professional']).toBeLessThan(TIER_ORDER['enterprise']);
  });

  it('contains exactly 3 tiers', () => {
    expect(Object.keys(TIER_ORDER)).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// isPlanUpgrade
// ---------------------------------------------------------------------------

describe('isPlanUpgrade', () => {
  describe('when current user is on free tier', () => {
    it('treats all paid plans as upgrades', () => {
      expect(isPlanUpgrade(starter, 'starter', true)).toBe(true);
      expect(isPlanUpgrade(professional, 'starter', true)).toBe(true);
      expect(isPlanUpgrade(enterprise, 'starter', true)).toBe(true);
    });
  });

  describe('when current user is on starter', () => {
    it('returns true for professional', () => {
      expect(isPlanUpgrade(professional, 'starter', false)).toBe(true);
    });

    it('returns true for enterprise', () => {
      expect(isPlanUpgrade(enterprise, 'starter', false)).toBe(true);
    });

    it('returns false for starter (same plan)', () => {
      expect(isPlanUpgrade(starter, 'starter', false)).toBe(false);
    });
  });

  describe('when current user is on professional', () => {
    it('returns true for enterprise', () => {
      expect(isPlanUpgrade(enterprise, 'professional', false)).toBe(true);
    });

    it('returns false for professional (same plan)', () => {
      expect(isPlanUpgrade(professional, 'professional', false)).toBe(false);
    });

    it('returns false for starter (downgrade)', () => {
      expect(isPlanUpgrade(starter, 'professional', false)).toBe(false);
    });
  });

  describe('when current user is on enterprise', () => {
    it('returns false for all plans (no upgrade possible)', () => {
      expect(isPlanUpgrade(starter, 'enterprise', false)).toBe(false);
      expect(isPlanUpgrade(professional, 'enterprise', false)).toBe(false);
      expect(isPlanUpgrade(enterprise, 'enterprise', false)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('handles unknown currentTier by defaulting to order 0', () => {
      // Unknown tier gets order 0, so all known plans are upgrades
      expect(isPlanUpgrade(starter, 'unknown_tier', false)).toBe(true);
      expect(isPlanUpgrade(enterprise, 'unknown_tier', false)).toBe(true);
    });

    it('handles unknown plan id by defaulting to order 0', () => {
      const unknownPlan = makePlan('platinum');
      // Unknown plan gets order 0, never higher than any known tier
      expect(isPlanUpgrade(unknownPlan, 'starter', false)).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// isPlanCurrent
// ---------------------------------------------------------------------------

describe('isPlanCurrent', () => {
  describe('when on free tier', () => {
    it('returns false for all paid plans', () => {
      expect(isPlanCurrent(starter, 'starter', true)).toBe(false);
      expect(isPlanCurrent(professional, 'starter', true)).toBe(false);
      expect(isPlanCurrent(enterprise, 'starter', true)).toBe(false);
    });
  });

  describe('when on a paid tier', () => {
    it('returns true when plan.id matches currentTier', () => {
      expect(isPlanCurrent(starter, 'starter', false)).toBe(true);
      expect(isPlanCurrent(professional, 'professional', false)).toBe(true);
      expect(isPlanCurrent(enterprise, 'enterprise', false)).toBe(true);
    });

    it('returns false when plan.id does not match currentTier', () => {
      expect(isPlanCurrent(starter, 'professional', false)).toBe(false);
      expect(isPlanCurrent(professional, 'enterprise', false)).toBe(false);
      expect(isPlanCurrent(enterprise, 'starter', false)).toBe(false);
    });
  });
});
