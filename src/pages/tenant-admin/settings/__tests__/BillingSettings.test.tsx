/**
 * BillingSettings Tests
 * Verifies the Manage Subscription button invokes handleManageSubscription
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import BillingSettings from '../BillingSettings';

// --- Mocks ---

const mockInvoke = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
      })),
    })),
  },
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: {
      id: 'test-tenant-id',
      name: 'Test Tenant',
      slug: 'test-tenant',
      subscription_plan: 'professional',
      billing_cycle: 'monthly',
      payment_method_added: true,
      limits: {},
      usage: {},
    },
    tenantSlug: 'test-tenant',
  }),
}));

vi.mock('@/hooks/useSubscriptionStatus', () => ({
  useSubscriptionStatus: () => ({
    isTrial: false,
    needsPaymentMethod: false,
    isActive: true,
  }),
}));

vi.mock('@/hooks/useFeatureAccess', () => ({
  useFeatureAccess: () => ({
    currentTier: 'block',
    currentTierName: 'Professional',
  }),
}));

vi.mock('@/hooks/useCredits', () => ({
  useCredits: () => ({
    balance: 0,
    isFreeTier: false,
    isLowCredits: false,
    isCriticalCredits: false,
    isOutOfCredits: false,
    nextFreeGrantAt: null,
    lifetimeSpent: 0,
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/components/billing/AddPaymentMethodDialog', () => ({
  AddPaymentMethodDialog: () => null,
}));

vi.mock('@/components/credits', () => ({
  CreditBalance: () => null,
  CreditUsageStats: () => null,
}));

// --- Helpers ---

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function renderBillingSettings() {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/test-tenant/admin/settings']}>
        <BillingSettings />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// --- Tests ---

describe('BillingSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: edge functions return no data
    mockInvoke.mockResolvedValue({ data: null, error: null });
  });

  describe('Manage Subscription button', () => {
    it('should render the Manage Subscription button', () => {
      renderBillingSettings();

      const button = screen.getByRole('button', { name: /manage subscription/i });
      expect(button).toBeInTheDocument();
    });

    it('should call stripe-customer-portal edge function when clicked', async () => {
      mockInvoke.mockImplementation((fnName: string) => {
        if (fnName === 'stripe-customer-portal') {
          return Promise.resolve({
            data: { url: 'https://billing.stripe.com/session/test' },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      });

      renderBillingSettings();

      const button = screen.getByRole('button', { name: /manage subscription/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('stripe-customer-portal', {
          body: { tenant_id: 'test-tenant-id' },
        });
      });
    });

    it('should open Stripe portal URL in a new tab on success', async () => {
      const mockOpen = vi.fn();
      vi.spyOn(window, 'open').mockImplementation(mockOpen);

      mockInvoke.mockImplementation((fnName: string) => {
        if (fnName === 'stripe-customer-portal') {
          return Promise.resolve({
            data: { url: 'https://billing.stripe.com/session/test' },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      });

      renderBillingSettings();

      const button = screen.getByRole('button', { name: /manage subscription/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockOpen).toHaveBeenCalledWith(
          'https://billing.stripe.com/session/test',
          '_blank',
          'noopener,noreferrer',
        );
      });

      mockOpen.mockRestore();
    });

    it('should show success toast when portal URL is returned', async () => {
      vi.spyOn(window, 'open').mockImplementation(vi.fn());
      const { toast } = await import('sonner');

      mockInvoke.mockImplementation((fnName: string) => {
        if (fnName === 'stripe-customer-portal') {
          return Promise.resolve({
            data: { url: 'https://billing.stripe.com/session/test' },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      });

      renderBillingSettings();

      const button = screen.getByRole('button', { name: /manage subscription/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Success', {
          description: 'Opening Stripe Customer Portal...',
        });
      });

      vi.mocked(window.open).mockRestore();
    });

    it('should show error toast when edge function fails', async () => {
      const { toast } = await import('sonner');

      mockInvoke.mockImplementation((fnName: string) => {
        if (fnName === 'stripe-customer-portal') {
          return Promise.resolve({
            data: null,
            error: new Error('Network error'),
          });
        }
        return Promise.resolve({ data: null, error: null });
      });

      renderBillingSettings();

      const button = screen.getByRole('button', { name: /manage subscription/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });
    });
  });
});
