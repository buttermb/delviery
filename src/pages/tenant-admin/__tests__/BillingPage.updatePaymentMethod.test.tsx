/**
 * BillingPage - Update Payment Method Button Tests
 * Verifies:
 * - Button renders when payment_method_added is true
 * - Loading spinner shows when upgradeLoading (during portal invocation)
 * - Button is disabled during loading
 * - handlePaymentMethod invokes stripe-customer-portal edge function
 * - Success: opens portal URL in new tab
 * - Error: shows error toast and resets loading state
 * - Auth check: shows error if no session
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

// --- Hoisted mocks (available inside vi.mock factories) ---

const { mockInvoke, mockGetSession, mockToast, mockTenant } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
  mockGetSession: vi.fn(),
  mockToast: { success: vi.fn(), error: vi.fn() },
  mockTenant: {
    id: 'test-tenant-id',
    name: 'Test Dispensary',
    slug: 'test-dispensary',
    payment_method_added: true as boolean | null,
    subscription_status: 'active',
    subscription_plan: 'starter',
    trial_ends_at: null as string | null,
    limits: {} as Record<string, number>,
    usage: {} as Record<string, number>,
  },
}));

// --- Mocks ---

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
    auth: { getSession: () => mockGetSession() },
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => Promise.resolve({ data: [], error: null }),
          }),
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
    }),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('sonner', () => ({ toast: mockToast }));

vi.mock('@/lib/queryKeys', () => ({
  queryKeys: {
    stripeHealth: { all: ['stripe-health'] },
    tenantInvoices: { byTenant: (id: string | undefined) => ['invoices', id] },
    subscriptionPlans: { all: ['subscription-plans'] },
    superAdminTenantDetail: { subscriptionPlan: (plan: string | undefined) => ['plan', plan] },
    tenants: { all: ['tenants'] },
  },
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: mockTenant,
  }),
}));

vi.mock('@/hooks/useFeatureAccess', () => ({
  useFeatureAccess: () => ({
    currentTier: 'starter',
  }),
}));

vi.mock('@/hooks/useStripeRedirectHandler', () => ({
  useStripeRedirectHandler: vi.fn(),
}));

vi.mock('@/hooks/useCredits', () => ({
  useCredits: () => ({
    balance: 1000,
    isFreeTier: false,
    isLowCredits: false,
    isCriticalCredits: false,
    isOutOfCredits: false,
    nextFreeGrantAt: null,
    lifetimeSpent: 0,
  }),
}));

vi.mock('@/components/billing/AddPaymentMethodDialog', () => ({
  AddPaymentMethodDialog: () => <div data-testid="add-payment-dialog" />,
}));

vi.mock('@/components/tenant-admin/TrialBanner', () => ({
  TrialBanner: () => null,
}));

vi.mock('@/components/tenant-admin/TrialCountdown', () => ({
  TrialCountdown: () => null,
}));

vi.mock('@/components/integrations/IntegrationStatus', () => ({
  IntegrationStatus: () => null,
}));

vi.mock('@/components/credits/CreditBalance', () => ({
  CreditBalance: () => null,
}));

vi.mock('@/components/credits/CreditPurchaseModal', () => ({
  CreditPurchaseModal: () => null,
}));

vi.mock('@/lib/credits', () => ({
  FREE_TIER_MONTHLY_CREDITS: 5000,
  CREDIT_PACKAGES: [],
}));

vi.mock('@/lib/featureConfig', () => ({
  TIER_NAMES: { free: 'Free', starter: 'Starter', professional: 'Professional', enterprise: 'Enterprise' },
  TIER_PRICES: { free: 0, starter: 49, professional: 149, enterprise: 349 },
  getFeaturesByCategory: () => ({}),
}));

vi.mock('@/lib/tierMapping', () => ({
  businessTierToSubscriptionTier: (tier: string) => tier,
}));

vi.mock('@/lib/utils/formatCurrency', () => ({
  formatCurrency: (val: number) => `$${val.toFixed(2)}`,
}));

vi.mock('@/lib/formatters', () => ({
  formatSmartDate: (date: string) => date,
}));

// Import after mocks
import BillingPage from '../BillingPage';

// --- Test helpers ---

const mockWindowOpen = vi.fn();

function renderBillingPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <BillingPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

// --- Tests ---

describe('BillingPage - Update Payment Method button', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTenant.payment_method_added = true;
    window.open = mockWindowOpen;

    // Default: authenticated session
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'test-token', user: { id: 'user-1' } } },
    });

    // Default: edge function returns a portal URL
    mockInvoke.mockImplementation((fnName: string) => {
      if (fnName === 'stripe-customer-portal') {
        return Promise.resolve({ data: { url: 'https://billing.stripe.com/session/test123' }, error: null });
      }
      if (fnName === 'check-stripe-config') {
        return Promise.resolve({ data: { configured: true, valid: true }, error: null });
      }
      if (fnName === 'invoice-management') {
        return Promise.resolve({ data: { invoices: [] }, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });
  });

  it('renders "Update Payment Method" button when payment method is on file', async () => {
    renderBillingPage();

    await waitFor(() => {
      expect(screen.getByText('Update Payment Method')).toBeInTheDocument();
    });
  });

  it('renders "Add Payment Method" button when no payment method exists', async () => {
    mockTenant.payment_method_added = false;
    renderBillingPage();

    await waitFor(() => {
      expect(screen.getByText('Add Payment Method')).toBeInTheDocument();
    });

    expect(screen.queryByText('Update Payment Method')).not.toBeInTheDocument();
  });

  it('calls stripe-customer-portal edge function on click', async () => {
    renderBillingPage();

    await waitFor(() => {
      expect(screen.getByText('Update Payment Method')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Update Payment Method'));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('stripe-customer-portal', {
        body: { tenant_id: 'test-tenant-id' },
      });
    });
  });

  it('opens portal URL in new tab on success', async () => {
    renderBillingPage();

    await waitFor(() => {
      expect(screen.getByText('Update Payment Method')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Update Payment Method'));

    await waitFor(() => {
      expect(mockWindowOpen).toHaveBeenCalledWith(
        'https://billing.stripe.com/session/test123',
        '_blank',
        'noopener,noreferrer'
      );
    });

    expect(mockToast.success).toHaveBeenCalledWith('Success', {
      description: 'Opening Stripe Customer Portal...',
    });
  });

  it('shows error toast when edge function returns an error', async () => {
    mockInvoke.mockImplementation((fnName: string) => {
      if (fnName === 'stripe-customer-portal') {
        return Promise.resolve({ data: null, error: new Error('Portal creation failed') });
      }
      if (fnName === 'check-stripe-config') {
        return Promise.resolve({ data: { configured: true, valid: true }, error: null });
      }
      if (fnName === 'invoice-management') {
        return Promise.resolve({ data: { invoices: [] }, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    renderBillingPage();

    await waitFor(() => {
      expect(screen.getByText('Update Payment Method')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Update Payment Method'));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error', {
        description: expect.stringContaining('Portal creation failed'),
      });
    });

    expect(mockWindowOpen).not.toHaveBeenCalled();
  });

  it('shows error toast when response body contains error', async () => {
    mockInvoke.mockImplementation((fnName: string) => {
      if (fnName === 'stripe-customer-portal') {
        return Promise.resolve({ data: { error: 'Stripe not configured for this tenant' }, error: null });
      }
      if (fnName === 'check-stripe-config') {
        return Promise.resolve({ data: { configured: true, valid: true }, error: null });
      }
      if (fnName === 'invoice-management') {
        return Promise.resolve({ data: { invoices: [] }, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    renderBillingPage();

    await waitFor(() => {
      expect(screen.getByText('Update Payment Method')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Update Payment Method'));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error', {
        description: 'Stripe not configured for this tenant',
      });
    });

    expect(mockWindowOpen).not.toHaveBeenCalled();
  });

  it('shows error toast when no URL is returned', async () => {
    mockInvoke.mockImplementation((fnName: string) => {
      if (fnName === 'stripe-customer-portal') {
        return Promise.resolve({ data: { message: 'ok but no url' }, error: null });
      }
      if (fnName === 'check-stripe-config') {
        return Promise.resolve({ data: { configured: true, valid: true }, error: null });
      }
      if (fnName === 'invoice-management') {
        return Promise.resolve({ data: { invoices: [] }, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    renderBillingPage();

    await waitFor(() => {
      expect(screen.getByText('Update Payment Method')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Update Payment Method'));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error', {
        description: 'No portal URL returned from Stripe',
      });
    });
  });

  it('shows auth error when session is missing', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    renderBillingPage();

    await waitFor(() => {
      expect(screen.getByText('Update Payment Method')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Update Payment Method'));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Not Authenticated', {
        description: 'Please log in to manage payment methods.',
      });
    });

    expect(mockInvoke).not.toHaveBeenCalledWith('stripe-customer-portal', expect.anything());
  });

  it('button is disabled while loading', async () => {
    // Make the portal call hang to keep loading state active
    let resolvePortal: (value: unknown) => void;
    const portalPromise = new Promise((resolve) => { resolvePortal = resolve; });

    mockInvoke.mockImplementation((fnName: string) => {
      if (fnName === 'stripe-customer-portal') {
        return portalPromise;
      }
      if (fnName === 'check-stripe-config') {
        return Promise.resolve({ data: { configured: true, valid: true }, error: null });
      }
      if (fnName === 'invoice-management') {
        return Promise.resolve({ data: { invoices: [] }, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    renderBillingPage();

    await waitFor(() => {
      expect(screen.getByText('Update Payment Method')).toBeInTheDocument();
    });

    const button = screen.getByText('Update Payment Method').closest('button')!;
    expect(button).not.toBeDisabled();

    fireEvent.click(button);

    // Button should become disabled during loading
    await waitFor(() => {
      expect(button).toBeDisabled();
    });

    // Resolve the portal call to clean up
    resolvePortal!({ data: { url: 'https://test.com' }, error: null });

    // After resolve, button should re-enable
    await waitFor(() => {
      expect(button).not.toBeDisabled();
    });
  });

  it('displays payment method info text when payment method is on file', async () => {
    renderBillingPage();

    await waitFor(() => {
      expect(screen.getByText('Payment method on file')).toBeInTheDocument();
    });
  });
});
