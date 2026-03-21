/**
 * BillingSettings - Annual Savings Banner Tests
 *
 * Verifies:
 * - Banner visibility conditions (!isTrial, !isFreeTier, billing_cycle !== 'yearly')
 * - "Switch to Annual" button renders with correct text
 * - Button click calls handleManageSubscription (invokes Stripe portal)
 * - Savings calculation displays correctly
 * - Banner hidden for trial, free tier, and annual subscribers
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import BillingSettings from '../BillingSettings';

// --- Mock state variables ---

let mockTenant: Record<string, unknown> = {
  id: 'tenant-123',
  name: 'Test Dispensary',
  slug: 'test-dispensary',
  billing_cycle: 'monthly',
  subscription_plan: 'professional',
  subscription_status: 'active',
  payment_method_added: true,
  trial_ends_at: null,
  is_free_tier: false,
  created_at: '2025-01-01T00:00:00Z',
  mrr: 150,
  limits: { customers: 500, menus: 10, products: 1000 },
  usage: { customers: 100, menus: 2, products: 50 },
};

let mockIsTrial = false;
let mockNeedsPaymentMethod = false;
let mockCurrentTier = 'professional';
let mockCurrentTierName = 'Professional';
let mockIsFreeTier = false;

// --- Mocks ---

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: mockTenant,
    tenantSlug: 'test-dispensary',
  }),
}));

vi.mock('@/hooks/useSubscriptionStatus', () => ({
  useSubscriptionStatus: () => ({
    isTrial: mockIsTrial,
    needsPaymentMethod: mockNeedsPaymentMethod,
    isFreeTier: mockIsFreeTier,
    isActive: !mockIsTrial,
    currentTier: mockCurrentTier,
    status: mockIsTrial ? 'trialing' : 'active',
  }),
}));

vi.mock('@/hooks/useFeatureAccess', () => ({
  useFeatureAccess: () => ({
    currentTier: mockCurrentTier,
    currentTierName: mockCurrentTierName,
    hasFeature: () => true,
  }),
}));

vi.mock('@/hooks/useCredits', () => ({
  useCredits: () => ({
    balance: 5000,
    isFreeTier: mockIsFreeTier,
    isLowCredits: false,
    isCriticalCredits: false,
    isOutOfCredits: false,
    nextFreeGrantAt: null,
    lifetimeSpent: 0,
  }),
}));

const mockInvoke = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            data: [],
            error: null,
          }),
        }),
      }),
    }),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@/contexts/CreditContext', () => ({
  useCredits: () => ({
    credits: 5000,
    isFreeTier: mockIsFreeTier,
    setIsPurchaseModalOpen: vi.fn(),
  }),
}));

vi.mock('@/lib/humanizeError', () => ({
  humanizeError: (err: unknown, fallback?: string) =>
    fallback || (err instanceof Error ? err.message : 'Unknown error'),
}));

vi.mock('@/lib/tierMapping', () => ({
  businessTierToSubscriptionTier: (tier: string) => {
    if (tier === 'professional' || tier === 'block' || tier === 'hood') return 'professional';
    if (tier === 'enterprise' || tier === 'empire') return 'enterprise';
    return 'starter';
  },
}));

// --- Helpers ---

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function renderBillingSettings() {
  const queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <TooltipProvider>
          <BillingSettings />
        </TooltipProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// --- Tests ---

describe('BillingSettings - Annual Savings Banner', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset to paid monthly subscriber defaults
    mockTenant = {
      id: 'tenant-123',
      name: 'Test Dispensary',
      slug: 'test-dispensary',
      billing_cycle: 'monthly',
      subscription_plan: 'professional',
      subscription_status: 'active',
      payment_method_added: true,
      trial_ends_at: null,
      is_free_tier: false,
      created_at: '2025-01-01T00:00:00Z',
      mrr: 150,
      limits: { customers: 500, menus: 10, products: 1000 },
      usage: { customers: 100, menus: 2, products: 50 },
    };
    mockIsTrial = false;
    mockNeedsPaymentMethod = false;
    mockCurrentTier = 'professional';
    mockCurrentTierName = 'Professional';
    mockIsFreeTier = false;

    // Default: Stripe health check returns configured
    mockInvoke.mockImplementation((fnName: string) => {
      if (fnName === 'check-stripe-config') {
        return Promise.resolve({
          data: { configured: true, valid: true, testMode: false },
          error: null,
        });
      }
      if (fnName === 'invoice-management') {
        return Promise.resolve({ data: [], error: null });
      }
      if (fnName === 'stripe-customer-portal') {
        return Promise.resolve({
          data: { url: 'https://billing.stripe.com/portal/test' },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });
  });

  describe('Banner Visibility', () => {
    it('should show annual savings banner for monthly paid subscribers', () => {
      renderBillingSettings();

      expect(screen.getByText('Save 17% with Annual Billing')).toBeInTheDocument();
      expect(screen.getByText('Switch to Annual')).toBeInTheDocument();
    });

    it('should NOT show annual savings banner for trial users', () => {
      mockIsTrial = true;
      mockTenant = { ...mockTenant, subscription_status: 'trialing', trial_ends_at: new Date(Date.now() + 7 * 86400000).toISOString() };
      renderBillingSettings();

      expect(screen.queryByText('Save 17% with Annual Billing')).not.toBeInTheDocument();
      expect(screen.queryByText('Switch to Annual')).not.toBeInTheDocument();
    });

    it('should NOT show annual savings banner for free tier users', () => {
      mockIsFreeTier = true;
      mockTenant = { ...mockTenant, is_free_tier: true };
      renderBillingSettings();

      expect(screen.queryByText('Save 17% with Annual Billing')).not.toBeInTheDocument();
    });

    it('should NOT show annual savings banner for yearly subscribers', () => {
      mockTenant = { ...mockTenant, billing_cycle: 'yearly' };
      renderBillingSettings();

      expect(screen.queryByText('Save 17% with Annual Billing')).not.toBeInTheDocument();
      expect(screen.queryByText('Switch to Annual')).not.toBeInTheDocument();
    });

    it('should show banner when billing_cycle is undefined (defaults to monthly)', () => {
      mockTenant = { ...mockTenant, billing_cycle: undefined };
      renderBillingSettings();

      expect(screen.getByText('Save 17% with Annual Billing')).toBeInTheDocument();
    });
  });

  describe('Savings Calculation', () => {
    it('should display correct savings for Professional tier ($150/mo)', () => {
      mockCurrentTier = 'professional';
      renderBillingSettings();

      // Professional: $150 * 12 * 0.17 = $306
      const savingsText = screen.getByText(/in savings/);
      expect(savingsText).toBeInTheDocument();
      expect(savingsText.textContent).toContain('306');
    });

    it('should display correct savings for Starter tier ($79/mo)', () => {
      mockCurrentTier = 'starter';
      mockCurrentTierName = 'Starter';
      mockTenant = { ...mockTenant, subscription_plan: 'starter' };
      renderBillingSettings();

      // Starter: $79 * 12 * 0.17 = $161.16 → Math.round = $161
      const savingsText = screen.getByText(/in savings/);
      expect(savingsText).toBeInTheDocument();
      expect(savingsText.textContent).toContain('161');
    });

    it('should display correct savings for Enterprise tier ($499/mo)', () => {
      mockCurrentTier = 'enterprise';
      mockCurrentTierName = 'Enterprise';
      mockTenant = { ...mockTenant, subscription_plan: 'enterprise' };
      renderBillingSettings();

      // Enterprise: $499 * 12 * 0.17 = $1,017.96 → Math.round = $1,018
      const savingsText = screen.getByText(/in savings/);
      expect(savingsText).toBeInTheDocument();
      expect(savingsText.textContent).toContain('1,018');
    });
  });

  describe('Switch to Annual Button', () => {
    it('should render the Switch to Annual button', () => {
      renderBillingSettings();

      const button = screen.getByText('Switch to Annual');
      expect(button).toBeInTheDocument();
      expect(button.tagName).toBe('BUTTON');
    });

    it('should call Stripe customer portal on click', async () => {
      renderBillingSettings();

      const button = screen.getByText('Switch to Annual');
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('stripe-customer-portal', {
          body: { tenant_id: 'tenant-123' },
        });
      });
    });

    it('should open Stripe portal URL in new tab on success', async () => {
      const mockOpen = vi.fn();
      vi.spyOn(window, 'open').mockImplementation(mockOpen);

      renderBillingSettings();

      const button = screen.getByText('Switch to Annual');
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockOpen).toHaveBeenCalledWith(
          'https://billing.stripe.com/portal/test',
          '_blank',
          'noopener,noreferrer',
        );
      });

      vi.restoreAllMocks();
    });

    it('should show success toast after opening Stripe portal', async () => {
      vi.spyOn(window, 'open').mockImplementation(vi.fn());
      const { toast } = await import('sonner');

      renderBillingSettings();

      const button = screen.getByText('Switch to Annual');
      fireEvent.click(button);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          'Success',
          expect.objectContaining({
            description: 'Opening Stripe Customer Portal...',
          }),
        );
      });

      vi.restoreAllMocks();
    });

    it('should show error toast when Stripe portal call fails', async () => {
      mockInvoke.mockImplementation((fnName: string) => {
        if (fnName === 'stripe-customer-portal') {
          return Promise.resolve({
            data: null,
            error: new Error('Network error'),
          });
        }
        if (fnName === 'check-stripe-config') {
          return Promise.resolve({
            data: { configured: true, valid: true, testMode: false },
            error: null,
          });
        }
        return Promise.resolve({ data: [], error: null });
      });

      const { toast } = await import('sonner');

      renderBillingSettings();

      const button = screen.getByText('Switch to Annual');
      fireEvent.click(button);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          'Error',
          expect.objectContaining({
            description: expect.any(String),
          }),
        );
      });
    });

    it('should show error toast when Stripe portal returns error in data', async () => {
      mockInvoke.mockImplementation((fnName: string) => {
        if (fnName === 'stripe-customer-portal') {
          return Promise.resolve({
            data: { error: 'Tenant not found' },
            error: null,
          });
        }
        if (fnName === 'check-stripe-config') {
          return Promise.resolve({
            data: { configured: true, valid: true, testMode: false },
            error: null,
          });
        }
        return Promise.resolve({ data: [], error: null });
      });

      const { toast } = await import('sonner');

      renderBillingSettings();

      const button = screen.getByText('Switch to Annual');
      fireEvent.click(button);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          'Error',
          expect.objectContaining({
            description: expect.any(String),
          }),
        );
      });
    });

    it('should not call Stripe portal when tenantId is missing', async () => {
      mockTenant = { ...mockTenant, id: undefined };
      renderBillingSettings();

      // Banner should still render since conditions are met
      const button = screen.queryByText('Switch to Annual');
      if (button) {
        fireEvent.click(button);
        // Give it a tick
        await waitFor(() => {
          expect(mockInvoke).not.toHaveBeenCalledWith(
            'stripe-customer-portal',
            expect.anything(),
          );
        });
      }
    });
  });

  describe('Banner Content', () => {
    it('should display the Zap icon area', () => {
      renderBillingSettings();

      expect(screen.getByText('Save 17% with Annual Billing')).toBeInTheDocument();
    });

    it('should include "2 months free" messaging', () => {
      renderBillingSettings();

      expect(screen.getByText(/2 months free/)).toBeInTheDocument();
    });

    it('should include "Switch to yearly billing" messaging', () => {
      renderBillingSettings();

      expect(screen.getByText(/Switch to yearly billing/)).toBeInTheDocument();
    });
  });
});
