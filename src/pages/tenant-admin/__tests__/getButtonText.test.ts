/**
 * Tests for SelectPlanPage getButtonText utility.
 * Verifies all subscription states produce correct CTA text.
 */

import { describe, it, expect } from 'vitest';
import { getButtonText } from '@/pages/tenant-admin/getButtonText';

// Default params factory — active starter on monthly billing
function makeParams(overrides: Partial<Parameters<typeof getButtonText>[0]> = {}) {
  return {
    planTier: 'professional',
    price: 150,
    period: '/mo',
    currentTier: 'starter',
    isFreeTier: false,
    isTrial: false,
    isActive: true,
    isCancelled: false,
    isPastDue: false,
    isSuspended: false,
    skipTrial: false,
    ...overrides,
  };
}

describe('getButtonText', () => {
  describe('Current Plan detection', () => {
    it('returns "Current Plan" when planTier matches currentTier for active users', () => {
      const result = getButtonText(makeParams({
        planTier: 'starter',
        currentTier: 'starter',
        isActive: true,
      }));
      expect(result).toBe('Current Plan');
    });

    it('returns "Current Plan" for trial users viewing their current tier', () => {
      const result = getButtonText(makeParams({
        planTier: 'professional',
        currentTier: 'professional',
        isActive: false,
        isTrial: true,
      }));
      expect(result).toBe('Current Plan');
    });

    it('does NOT return "Current Plan" for free tier users', () => {
      const result = getButtonText(makeParams({
        planTier: 'starter',
        currentTier: 'starter',
        isFreeTier: true,
        isActive: false,
      }));
      expect(result).not.toBe('Current Plan');
    });

    it('does NOT return "Current Plan" for cancelled users viewing same tier', () => {
      const result = getButtonText(makeParams({
        planTier: 'starter',
        currentTier: 'starter',
        isActive: false,
        isCancelled: true,
      }));
      expect(result).not.toBe('Current Plan');
      expect(result).toContain('Resubscribe');
    });

    it('does NOT return "Current Plan" for suspended users viewing same tier', () => {
      const result = getButtonText(makeParams({
        planTier: 'starter',
        currentTier: 'starter',
        isActive: false,
        isSuspended: true,
      }));
      expect(result).not.toBe('Current Plan');
      expect(result).toContain('Reactivate');
    });
  });

  describe('Free Tier users', () => {
    it('shows trial text when skipTrial is false', () => {
      const result = getButtonText(makeParams({
        isFreeTier: true,
        isActive: false,
        skipTrial: false,
      }));
      expect(result).toBe('Start 14-Day Free Trial');
    });

    it('shows subscribe with price when skipTrial is true (monthly)', () => {
      const result = getButtonText(makeParams({
        isFreeTier: true,
        isActive: false,
        skipTrial: true,
        price: 150,
        period: '/mo',
      }));
      expect(result).toBe('Subscribe Now - $150/mo');
    });

    it('shows subscribe with price when skipTrial is true (yearly)', () => {
      const result = getButtonText(makeParams({
        isFreeTier: true,
        isActive: false,
        skipTrial: true,
        price: 1500,
        period: '/yr',
      }));
      expect(result).toBe('Subscribe Now - $1500/yr');
    });
  });

  describe('Cancelled users', () => {
    it('shows resubscribe with monthly price', () => {
      const result = getButtonText(makeParams({
        isActive: false,
        isCancelled: true,
        planTier: 'professional',
        price: 150,
        period: '/mo',
      }));
      expect(result).toBe('Resubscribe - $150/mo');
    });

    it('shows resubscribe with yearly price', () => {
      const result = getButtonText(makeParams({
        isActive: false,
        isCancelled: true,
        planTier: 'enterprise',
        price: 4990,
        period: '/yr',
      }));
      expect(result).toBe('Resubscribe - $4990/yr');
    });

    it('shows resubscribe even for same tier when cancelled', () => {
      const result = getButtonText(makeParams({
        planTier: 'starter',
        currentTier: 'starter',
        isActive: false,
        isCancelled: true,
        price: 79,
        period: '/mo',
      }));
      expect(result).toBe('Resubscribe - $79/mo');
    });
  });

  describe('Suspended users', () => {
    it('shows reactivate with price', () => {
      const result = getButtonText(makeParams({
        isActive: false,
        isSuspended: true,
        planTier: 'professional',
        price: 150,
        period: '/mo',
      }));
      expect(result).toBe('Reactivate - $150/mo');
    });

    it('shows reactivate even for same tier when suspended', () => {
      const result = getButtonText(makeParams({
        planTier: 'starter',
        currentTier: 'starter',
        isActive: false,
        isSuspended: true,
        price: 79,
        period: '/mo',
      }));
      expect(result).toBe('Reactivate - $79/mo');
    });
  });

  describe('Past Due users', () => {
    it('shows update payment with price', () => {
      const result = getButtonText(makeParams({
        isActive: false,
        isPastDue: true,
        planTier: 'professional',
        price: 150,
        period: '/mo',
      }));
      expect(result).toBe('Update Payment - $150/mo');
    });
  });

  describe('Trial users viewing different plans', () => {
    it('shows upgrade text for higher tier (skipTrial=false)', () => {
      const result = getButtonText(makeParams({
        isTrial: true,
        isActive: false,
        currentTier: 'starter',
        planTier: 'professional',
        skipTrial: false,
      }));
      expect(result).toBe('Upgrade Trial to Professional');
    });

    it('shows upgrade with price for higher tier (skipTrial=true)', () => {
      const result = getButtonText(makeParams({
        isTrial: true,
        isActive: false,
        currentTier: 'starter',
        planTier: 'professional',
        skipTrial: true,
        price: 150,
        period: '/mo',
      }));
      expect(result).toBe('Upgrade - $150/mo');
    });

    it('shows downgrade text for lower tier (skipTrial=false)', () => {
      const result = getButtonText(makeParams({
        isTrial: true,
        isActive: false,
        currentTier: 'enterprise',
        planTier: 'starter',
        skipTrial: false,
      }));
      expect(result).toBe('Downgrade Trial to Starter');
    });

    it('shows downgrade with price for lower tier (skipTrial=true)', () => {
      const result = getButtonText(makeParams({
        isTrial: true,
        isActive: false,
        currentTier: 'enterprise',
        planTier: 'starter',
        skipTrial: true,
        price: 79,
        period: '/mo',
      }));
      expect(result).toBe('Downgrade - $79/mo');
    });
  });

  describe('Active subscribers — upgrade/downgrade', () => {
    it('shows upgrade text for higher tier (monthly)', () => {
      const result = getButtonText(makeParams({
        isActive: true,
        currentTier: 'starter',
        planTier: 'professional',
        price: 150,
        period: '/mo',
      }));
      expect(result).toBe('Upgrade to $150/mo');
    });

    it('shows upgrade text for higher tier (yearly)', () => {
      const result = getButtonText(makeParams({
        isActive: true,
        currentTier: 'starter',
        planTier: 'enterprise',
        price: 4990,
        period: '/yr',
      }));
      expect(result).toBe('Upgrade to $4990/yr');
    });

    it('shows downgrade text for lower tier', () => {
      const result = getButtonText(makeParams({
        isActive: true,
        currentTier: 'enterprise',
        planTier: 'starter',
        price: 79,
        period: '/mo',
      }));
      expect(result).toBe('Downgrade to $79/mo');
    });

    it('shows downgrade from professional to starter', () => {
      const result = getButtonText(makeParams({
        isActive: true,
        currentTier: 'professional',
        planTier: 'starter',
        price: 790,
        period: '/yr',
      }));
      expect(result).toBe('Downgrade to $790/yr');
    });
  });

  describe('Fallback / unknown state', () => {
    it('returns generic subscribe text with skipTrial=true', () => {
      const result = getButtonText(makeParams({
        isActive: false,
        isTrial: false,
        isFreeTier: false,
        isCancelled: false,
        isPastDue: false,
        isSuspended: false,
        skipTrial: true,
        price: 150,
        period: '/mo',
      }));
      expect(result).toBe('Subscribe - $150/mo');
    });

    it('returns generic trial text with skipTrial=false', () => {
      const result = getButtonText(makeParams({
        isActive: false,
        isTrial: false,
        isFreeTier: false,
        isCancelled: false,
        isPastDue: false,
        isSuspended: false,
        skipTrial: false,
      }));
      expect(result).toBe('Start Free Trial');
    });
  });

  describe('Billing cycle formatting', () => {
    it('includes /mo for monthly billing', () => {
      const result = getButtonText(makeParams({
        isActive: true,
        currentTier: 'starter',
        planTier: 'professional',
        price: 150,
        period: '/mo',
      }));
      expect(result).toContain('/mo');
    });

    it('includes /yr for yearly billing', () => {
      const result = getButtonText(makeParams({
        isActive: true,
        currentTier: 'starter',
        planTier: 'professional',
        price: 1500,
        period: '/yr',
      }));
      expect(result).toContain('/yr');
    });
  });

  describe('Edge cases', () => {
    it('handles unknown planTier gracefully', () => {
      const result = getButtonText(makeParams({
        planTier: 'custom',
        currentTier: 'starter',
        isActive: true,
      }));
      // Unknown tier gets order 0 vs starter(1), so it's a "downgrade"
      expect(result).toContain('Downgrade');
    });

    it('handles unknown currentTier gracefully', () => {
      const result = getButtonText(makeParams({
        planTier: 'starter',
        currentTier: 'unknown' as string,
        isActive: true,
      }));
      // Current order 0 vs starter(1), so it's an "upgrade"
      expect(result).toContain('Upgrade');
    });
  });
});
