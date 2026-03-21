/**
 * useSubscriptionStatus Hook Tests
 * Verifies the hook correctly maps subscription statuses — especially
 * the 'trialing' variant — to the expected boolean flags.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useSubscriptionStatus } from '../useSubscriptionStatus';

// ── Mocks ──────────────────────────────────────────────────────────

const mockTenant = vi.fn();

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({ tenant: mockTenant() }),
}));

// ── Helpers ────────────────────────────────────────────────────────

interface TenantOverrides {
  subscription_status?: string;
  subscription_plan?: string;
  is_free_tier?: boolean;
  trial_ends_at?: string | null;
  payment_method_added?: boolean;
}

function makeTenant(overrides: TenantOverrides = {}) {
  return {
    id: 'tenant-1',
    business_name: 'Test Dispensary',
    slug: 'test',
    subscription_plan: 'Starter',
    subscription_status: 'active',
    trial_ends_at: null,
    payment_method_added: true,
    is_free_tier: false,
    limits: { customers: 100, menus: 5, products: 50, locations: 1, users: 5 },
    usage: { customers: 10, menus: 1, products: 5, locations: 1, users: 1 },
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────

describe('useSubscriptionStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTenant.mockReturnValue(undefined);
  });

  // ── 'trialing' variant handling ──────────────────────────────────

  describe('trialing status variant', () => {
    it('sets isTrial=true for "trialing"', () => {
      mockTenant.mockReturnValue(makeTenant({ subscription_status: 'trialing' }));
      const { result } = renderHook(() => useSubscriptionStatus());
      expect(result.current.isTrial).toBe(true);
    });

    it('sets isTrial=true for "trial"', () => {
      mockTenant.mockReturnValue(makeTenant({ subscription_status: 'trial' }));
      const { result } = renderHook(() => useSubscriptionStatus());
      expect(result.current.isTrial).toBe(true);
    });

    it('sets hasActiveSubscription=true for "trialing" when trial has not expired', () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      mockTenant.mockReturnValue(
        makeTenant({ subscription_status: 'trialing', trial_ends_at: futureDate }),
      );
      const { result } = renderHook(() => useSubscriptionStatus());
      expect(result.current.hasActiveSubscription).toBe(true);
    });

    it('sets hasActiveSubscription=false for "trialing" when trial has expired', () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      mockTenant.mockReturnValue(
        makeTenant({ subscription_status: 'trialing', trial_ends_at: pastDate }),
      );
      const { result } = renderHook(() => useSubscriptionStatus());
      expect(result.current.hasActiveSubscription).toBe(false);
    });

    it('sets isTrialExpired=true for "trialing" with past trial_ends_at', () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      mockTenant.mockReturnValue(
        makeTenant({ subscription_status: 'trialing', trial_ends_at: pastDate }),
      );
      const { result } = renderHook(() => useSubscriptionStatus());
      expect(result.current.isTrialExpired).toBeTruthy();
    });

    it('sets needsPaymentMethod=true for "trialing" without payment method', () => {
      mockTenant.mockReturnValue(
        makeTenant({ subscription_status: 'trialing', payment_method_added: false }),
      );
      const { result } = renderHook(() => useSubscriptionStatus());
      expect(result.current.needsPaymentMethod).toBe(true);
    });

    it('does NOT set isActive=true for "trialing" (isActive is only for "active")', () => {
      mockTenant.mockReturnValue(makeTenant({ subscription_status: 'trialing' }));
      const { result } = renderHook(() => useSubscriptionStatus());
      expect(result.current.isActive).toBe(false);
    });
  });

  // ── Active status ─────────────────────────────────────────────────

  describe('active status', () => {
    it('sets isActive=true and isTrial=false', () => {
      mockTenant.mockReturnValue(makeTenant({ subscription_status: 'active' }));
      const { result } = renderHook(() => useSubscriptionStatus());
      expect(result.current.isActive).toBe(true);
      expect(result.current.isTrial).toBe(false);
      expect(result.current.hasActiveSubscription).toBe(true);
    });
  });

  // ── Suspended / cancelled / past_due ──────────────────────────────

  describe('inactive statuses', () => {
    it('handles "suspended"', () => {
      mockTenant.mockReturnValue(makeTenant({ subscription_status: 'suspended' }));
      const { result } = renderHook(() => useSubscriptionStatus());
      expect(result.current.isSuspended).toBe(true);
      expect(result.current.hasActiveSubscription).toBe(false);
      expect(result.current.canUpgrade).toBe(false);
    });

    it('handles "cancelled"', () => {
      mockTenant.mockReturnValue(makeTenant({ subscription_status: 'cancelled' }));
      const { result } = renderHook(() => useSubscriptionStatus());
      expect(result.current.isCancelled).toBe(true);
      expect(result.current.canUpgrade).toBe(false);
    });

    it('handles "canceled" spelling variant', () => {
      mockTenant.mockReturnValue(makeTenant({ subscription_status: 'canceled' }));
      const { result } = renderHook(() => useSubscriptionStatus());
      expect(result.current.isCancelled).toBe(true);
    });

    it('handles "past_due"', () => {
      mockTenant.mockReturnValue(makeTenant({ subscription_status: 'past_due' }));
      const { result } = renderHook(() => useSubscriptionStatus());
      expect(result.current.isPastDue).toBe(true);
      expect(result.current.hasActiveSubscription).toBe(false);
    });
  });

  // ── Tier mapping ──────────────────────────────────────────────────

  describe('tier mapping', () => {
    it('maps enterprise plan', () => {
      mockTenant.mockReturnValue(makeTenant({ subscription_plan: 'Enterprise' }));
      const { result } = renderHook(() => useSubscriptionStatus());
      expect(result.current.isEnterprise).toBe(true);
      expect(result.current.currentTier).toBe('enterprise');
    });

    it('maps professional plan', () => {
      mockTenant.mockReturnValue(makeTenant({ subscription_plan: 'Professional' }));
      const { result } = renderHook(() => useSubscriptionStatus());
      expect(result.current.isProfessional).toBe(true);
      expect(result.current.currentTier).toBe('professional');
    });

    it('maps starter plan', () => {
      mockTenant.mockReturnValue(makeTenant({ subscription_plan: 'Starter' }));
      const { result } = renderHook(() => useSubscriptionStatus());
      expect(result.current.isStarter).toBe(true);
      expect(result.current.currentTier).toBe('starter');
    });

    it('defaults to starter when plan is undefined', () => {
      mockTenant.mockReturnValue(makeTenant({ subscription_plan: undefined }));
      const { result } = renderHook(() => useSubscriptionStatus());
      expect(result.current.currentTier).toBe('starter');
    });
  });

  // ── Free tier ─────────────────────────────────────────────────────

  describe('free tier', () => {
    it('sets isFreeTier and marks isStarter=false', () => {
      mockTenant.mockReturnValue(makeTenant({ is_free_tier: true }));
      const { result } = renderHook(() => useSubscriptionStatus());
      expect(result.current.isFreeTier).toBe(true);
      expect(result.current.isStarter).toBe(false);
    });
  });

  // ── No tenant ─────────────────────────────────────────────────────

  describe('no tenant', () => {
    it('returns safe defaults when tenant is undefined', () => {
      mockTenant.mockReturnValue(undefined);
      const { result } = renderHook(() => useSubscriptionStatus());
      expect(result.current.isFreeTier).toBe(false);
      expect(result.current.isTrial).toBe(false);
      expect(result.current.isActive).toBe(false);
      expect(result.current.hasActiveSubscription).toBe(false);
      expect(result.current.currentTier).toBe('starter');
    });
  });
});
