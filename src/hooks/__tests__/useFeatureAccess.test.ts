/**
 * useFeatureAccess Hook Tests
 *
 * Verifies that useFeatureAccess correctly blocks access when:
 * - Trial has expired
 * - Subscription is suspended or cancelled
 * - Grace period has expired for past_due subscriptions
 *
 * And allows access when:
 * - Trial is still active
 * - Subscription is active
 * - Essential features are requested (always allowed)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// --- Mocks ---

const mockUseTenantAdminAuth = vi.fn();

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: (...args: unknown[]) => mockUseTenantAdminAuth(...args),
}));

vi.mock('@/utils/subscriptionStatus', async () => {
  const actual = await vi.importActual<typeof import('@/utils/subscriptionStatus')>('@/utils/subscriptionStatus');
  return actual;
});

import { useFeatureAccess } from '@/hooks/useFeatureAccess';

// --- Helpers ---

function makeTenant(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tenant-1',
    subscription_plan: 'professional',
    subscription_status: 'active',
    business_tier: null,
    trial_ends_at: null,
    grace_period_ends_at: null,
    ...overrides,
  };
}

function setupTenant(overrides: Record<string, unknown> = {}) {
  mockUseTenantAdminAuth.mockReturnValue({
    tenant: makeTenant(overrides),
    tenantSlug: 'test-slug',
  });
}

// --- Tests ---

describe('useFeatureAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: active professional subscription
    setupTenant();
  });

  // =========================================================================
  // Trial expiration (primary test target)
  // =========================================================================

  describe('trial expired', () => {
    it('blocks non-essential features when trial is expired', () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      setupTenant({
        subscription_status: 'trial',
        trial_ends_at: pastDate,
      });

      const { result } = renderHook(() => useFeatureAccess());

      expect(result.current.subscriptionValid).toBe(false);
      expect(result.current.isTrialExpired).toBeTruthy();
      expect(result.current.canAccess('products')).toBe(false);
      expect(result.current.canAccess('analytics')).toBe(false);
      expect(result.current.canAccess('live-orders')).toBe(false);
    });

    it('still allows essential features when trial is expired', () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      setupTenant({
        subscription_status: 'trial',
        trial_ends_at: pastDate,
      });

      const { result } = renderHook(() => useFeatureAccess());

      expect(result.current.canAccess('dashboard')).toBe(true);
      expect(result.current.canAccess('billing')).toBe(true);
      expect(result.current.canAccess('settings')).toBe(true);
      expect(result.current.canAccess('help')).toBe(true);
      expect(result.current.canAccess('hotbox')).toBe(true);
    });

    it('allows access when trial is still active', () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      setupTenant({
        subscription_status: 'trial',
        subscription_plan: 'starter',
        trial_ends_at: futureDate,
      });

      const { result } = renderHook(() => useFeatureAccess());

      expect(result.current.subscriptionValid).toBe(true);
      expect(result.current.isTrialExpired).toBeFalsy();
      expect(result.current.canAccess('products')).toBe(true);
      expect(result.current.canAccess('basic-orders')).toBe(true);
    });

    it('sets isTrialExpired flag correctly for expired trial', () => {
      const pastDate = new Date(Date.now() - 1000).toISOString();
      setupTenant({
        subscription_status: 'trial',
        trial_ends_at: pastDate,
      });

      const { result } = renderHook(() => useFeatureAccess());

      expect(result.current.isTrialExpired).toBeTruthy();
    });

    it('sets isTrialExpired to falsy for active trial', () => {
      const futureDate = new Date(Date.now() + 1000).toISOString();
      setupTenant({
        subscription_status: 'trial',
        trial_ends_at: futureDate,
      });

      const { result } = renderHook(() => useFeatureAccess());

      expect(result.current.isTrialExpired).toBeFalsy();
    });

    it('blocks when trial_ends_at is exactly in the past (boundary)', () => {
      // Trial ended 1ms ago
      const barelyPast = new Date(Date.now() - 1).toISOString();
      setupTenant({
        subscription_status: 'trial',
        trial_ends_at: barelyPast,
      });

      const { result } = renderHook(() => useFeatureAccess());

      expect(result.current.subscriptionValid).toBe(false);
      expect(result.current.canAccess('products')).toBe(false);
    });

    it('treats trial without trial_ends_at as valid', () => {
      setupTenant({
        subscription_status: 'trial',
        trial_ends_at: null,
      });

      const { result } = renderHook(() => useFeatureAccess());

      // No trial_ends_at means the trial expiration check is skipped
      expect(result.current.subscriptionValid).toBe(true);
    });
  });

  // =========================================================================
  // Suspended / cancelled subscriptions
  // =========================================================================

  describe('suspended subscription', () => {
    it('blocks non-essential features', () => {
      setupTenant({ subscription_status: 'suspended' });

      const { result } = renderHook(() => useFeatureAccess());

      expect(result.current.subscriptionValid).toBe(false);
      expect(result.current.isSuspended).toBe(true);
      expect(result.current.canAccess('products')).toBe(false);
    });

    it('still allows essential features', () => {
      setupTenant({ subscription_status: 'suspended' });

      const { result } = renderHook(() => useFeatureAccess());

      expect(result.current.canAccess('billing')).toBe(true);
      expect(result.current.canAccess('dashboard')).toBe(true);
    });
  });

  describe('cancelled subscription', () => {
    it('blocks with "cancelled" spelling', () => {
      setupTenant({ subscription_status: 'cancelled' });

      const { result } = renderHook(() => useFeatureAccess());

      expect(result.current.subscriptionValid).toBe(false);
      expect(result.current.isCancelled).toBe(true);
      expect(result.current.canAccess('products')).toBe(false);
    });

    it('blocks with "canceled" spelling', () => {
      setupTenant({ subscription_status: 'canceled' });

      const { result } = renderHook(() => useFeatureAccess());

      expect(result.current.subscriptionValid).toBe(false);
      expect(result.current.isCancelled).toBe(true);
      expect(result.current.canAccess('products')).toBe(false);
    });
  });

  // =========================================================================
  // Past due with grace period
  // =========================================================================

  describe('past_due subscription', () => {
    it('blocks when grace period has expired', () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      setupTenant({
        subscription_status: 'past_due',
        grace_period_ends_at: pastDate,
      });

      const { result } = renderHook(() => useFeatureAccess());

      expect(result.current.subscriptionValid).toBe(false);
      expect(result.current.isPastDue).toBe(true);
      expect(result.current.canAccess('products')).toBe(false);
    });

    it('allows access during active grace period', () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      setupTenant({
        subscription_status: 'past_due',
        grace_period_ends_at: futureDate,
      });

      const { result } = renderHook(() => useFeatureAccess());

      expect(result.current.subscriptionValid).toBe(true);
      expect(result.current.isPastDue).toBe(true);
      expect(result.current.canAccess('products')).toBe(true);
    });

    it('allows access when no grace_period_ends_at is set', () => {
      setupTenant({
        subscription_status: 'past_due',
        grace_period_ends_at: null,
      });

      const { result } = renderHook(() => useFeatureAccess());

      expect(result.current.subscriptionValid).toBe(true);
    });
  });

  // =========================================================================
  // Active subscription
  // =========================================================================

  describe('active subscription', () => {
    it('allows tier-appropriate features', () => {
      setupTenant({
        subscription_status: 'active',
        subscription_plan: 'professional',
      });

      const { result } = renderHook(() => useFeatureAccess());

      expect(result.current.subscriptionValid).toBe(true);
      expect(result.current.canAccess('products')).toBe(true);
      expect(result.current.canAccess('analytics')).toBe(true);
      expect(result.current.canAccess('live-orders')).toBe(true);
    });

    it('blocks features above current tier', () => {
      setupTenant({
        subscription_status: 'active',
        subscription_plan: 'starter',
      });

      const { result } = renderHook(() => useFeatureAccess());

      expect(result.current.subscriptionValid).toBe(true);
      // starter should not have professional features
      expect(result.current.canAccess('analytics')).toBe(false);
      // starter should not have enterprise features
      expect(result.current.canAccess('api-access')).toBe(false);
    });
  });

  // =========================================================================
  // No tenant / null status
  // =========================================================================

  describe('edge cases', () => {
    it('blocks when tenant is null', () => {
      mockUseTenantAdminAuth.mockReturnValue({
        tenant: null,
        tenantSlug: 'test-slug',
      });

      const { result } = renderHook(() => useFeatureAccess());

      expect(result.current.subscriptionValid).toBe(false);
      expect(result.current.canAccess('products')).toBe(false);
    });

    it('blocks when subscription_status is null', () => {
      setupTenant({ subscription_status: null });

      const { result } = renderHook(() => useFeatureAccess());

      expect(result.current.subscriptionValid).toBe(false);
    });

    it('essential features still allowed even with null tenant', () => {
      mockUseTenantAdminAuth.mockReturnValue({
        tenant: null,
        tenantSlug: 'test-slug',
      });

      const { result } = renderHook(() => useFeatureAccess());

      expect(result.current.canAccess('dashboard')).toBe(true);
      expect(result.current.canAccess('billing')).toBe(true);
    });
  });

  // =========================================================================
  // Tier mapping (business_tier → subscription tier)
  // =========================================================================

  describe('business tier mapping', () => {
    it('maps legacy business_tier when subscription_plan is missing', () => {
      setupTenant({
        subscription_plan: null,
        business_tier: 'empire',
        subscription_status: 'active',
      });

      const { result } = renderHook(() => useFeatureAccess());

      expect(result.current.currentTier).toBe('enterprise');
    });

    it('prefers subscription_plan over business_tier', () => {
      setupTenant({
        subscription_plan: 'starter',
        business_tier: 'empire',
        subscription_status: 'active',
      });

      const { result } = renderHook(() => useFeatureAccess());

      expect(result.current.currentTier).toBe('starter');
    });

    it('defaults to starter for unknown tiers', () => {
      setupTenant({
        subscription_plan: null,
        business_tier: 'unknown-value',
        subscription_status: 'active',
      });

      const { result } = renderHook(() => useFeatureAccess());

      expect(result.current.currentTier).toBe('starter');
    });
  });

  // =========================================================================
  // checkUpgrade helper
  // =========================================================================

  describe('checkUpgrade', () => {
    it('returns required: false when feature is accessible', () => {
      setupTenant({
        subscription_status: 'active',
        subscription_plan: 'professional',
      });

      const { result } = renderHook(() => useFeatureAccess());
      const upgrade = result.current.checkUpgrade('products');

      expect(upgrade.required).toBe(false);
      expect(upgrade.targetTier).toBeNull();
    });

    it('returns upgrade info when feature requires higher tier', () => {
      setupTenant({
        subscription_status: 'active',
        subscription_plan: 'starter',
      });

      const { result } = renderHook(() => useFeatureAccess());
      const upgrade = result.current.checkUpgrade('analytics');

      expect(upgrade.required).toBe(true);
      expect(upgrade.targetTier).toBe('professional');
      expect(upgrade.priceDifference).toBeGreaterThan(0);
    });

    it('canAccess blocks even when tier is sufficient but subscription expired', () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      setupTenant({
        subscription_status: 'trial',
        trial_ends_at: pastDate,
        subscription_plan: 'professional',
      });

      const { result } = renderHook(() => useFeatureAccess());

      // canAccess blocks because subscription is invalid, even though tier is sufficient
      expect(result.current.canAccess('products')).toBe(false);
      expect(result.current.subscriptionValid).toBe(false);
      // checkUpgrade only checks tier requirement — no tier upgrade needed
      const upgrade = result.current.checkUpgrade('products');
      expect(upgrade.required).toBe(false);
    });
  });
});
