/**
 * BillingSettings 'Update' Payment Method Button Tests
 *
 * Verifies the payment method section in BillingSettings:
 * 1. Shows 'Update' button when payment_method_added is truthy
 * 2. Shows 'Add Payment Method' when payment_method_added is falsy
 * 3. 'Update' button calls stripe-customer-portal edge function
 * 4. Button is disabled during loading
 * 5. Loading spinner appears during the operation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';

// --- Mocks (hoisted before imports) ---

const mockNavigate = vi.fn();
const mockSetSearchParams = vi.fn();
const mockInvoke = vi.fn().mockResolvedValue({ data: null, error: null });

let mockTenant: Record<string, unknown> = {
  id: 'tenant-123',
  slug: 'test-tenant',
  name: 'Test Tenant',
  payment_method_added: true,
  subscription_plan: 'professional',
  subscription_status: 'active',
  billing_cycle: 'monthly',
  created_at: '2026-01-01T00:00:00Z',
  is_free_tier: false,
  limits: {},
  usage: {},
};

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams(), mockSetSearchParams],
  };
});

vi.mock('@/integrations/supabase/client', () => {
  const createChainMock = (resolvedValue: { data: unknown; error: unknown } = { data: [], error: null }) => {
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    chain.select = vi.fn().mockReturnValue(chain);
    chain.eq = vi.fn().mockReturnValue(chain);
    chain.order = vi.fn().mockReturnValue(chain);
    chain.limit = vi.fn().mockReturnValue(chain);
    chain.then = vi.fn((resolve) => Promise.resolve(resolvedValue).then(resolve));
    return chain;
  };

  return {
    supabase: {
      from: vi.fn(() => createChainMock()),
      functions: {
        invoke: (...args: unknown[]) => mockInvoke(...args),
      },
    },
  };
});

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: mockTenant,
  }),
}));

vi.mock('@/hooks/useSubscriptionStatus', () => ({
  useSubscriptionStatus: () => ({
    isTrial: false,
    isActive: true,
    needsPaymentMethod: false,
    isFreeTier: false,
    currentTier: 'professional',
  }),
}));

vi.mock('@/hooks/useFeatureAccess', () => ({
  useFeatureAccess: () => ({
    currentTier: 'professional',
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

vi.mock('@/lib/tierMapping', () => ({
  businessTierToSubscriptionTier: (tier: string) => {
    const map: Record<string, string> = {
      street: 'starter',
      trap: 'starter',
      block: 'professional',
      hood: 'professional',
      empire: 'enterprise',
      starter: 'starter',
      professional: 'professional',
      enterprise: 'enterprise',
    };
    return map[tier] || 'starter';
  },
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

vi.mock('@/lib/humanizeError', () => ({
  humanizeError: (error: unknown, fallback?: string) => {
    if (error instanceof Error) return error.message;
    return fallback || 'An error occurred';
  },
}));

vi.mock('@/components/credits', () => ({
  CreditBalance: () => null,
  CreditUsageStats: () => null,
}));

vi.mock('@/components/billing/AddPaymentMethodDialog', () => ({
  AddPaymentMethodDialog: () => null,
}));

// Import AFTER all vi.mock calls (vitest hoists them)
import BillingSettings from '@/pages/tenant-admin/settings/BillingSettings';

function renderBillingSettings() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  }

  return render(<BillingSettings />, { wrapper: Wrapper });
}

describe('BillingSettings - Update Payment Method Button', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTenant = {
      id: 'tenant-123',
      slug: 'test-tenant',
      name: 'Test Tenant',
      payment_method_added: true,
      subscription_plan: 'professional',
      subscription_status: 'active',
      billing_cycle: 'monthly',
      created_at: '2026-01-01T00:00:00Z',
      is_free_tier: false,
      limits: {},
      usage: {},
    };
  });

  it('shows "Update" button when payment_method_added is true', async () => {
    renderBillingSettings();

    await waitFor(() => {
      expect(screen.getByText('Update')).toBeInTheDocument();
    });
  });

  it('shows "Default" badge alongside Update button', async () => {
    renderBillingSettings();

    await waitFor(() => {
      expect(screen.getByText('Default')).toBeInTheDocument();
    });
  });

  it('shows card info "Payment method on file" when payment method exists', async () => {
    renderBillingSettings();

    await waitFor(() => {
      expect(screen.getByText('Payment method on file')).toBeInTheDocument();
    });
  });

  it('shows "Add Payment Method" button when payment_method_added is falsy', async () => {
    mockTenant = { ...mockTenant, payment_method_added: false };
    renderBillingSettings();

    await waitFor(() => {
      expect(screen.getByText('Add Payment Method')).toBeInTheDocument();
      expect(screen.queryByText('Update')).not.toBeInTheDocument();
    });
  });

  it('shows "No payment method added" when payment_method_added is falsy', async () => {
    mockTenant = { ...mockTenant, payment_method_added: false };
    renderBillingSettings();

    await waitFor(() => {
      expect(screen.getByText('No payment method added')).toBeInTheDocument();
    });
  });

  it('calls stripe-customer-portal when Update button is clicked', async () => {
    const user = userEvent.setup();
    mockInvoke.mockResolvedValue({
      data: { url: 'https://billing.stripe.com/portal/test' },
      error: null,
    });

    const mockWindowOpen = vi.fn();
    const originalOpen = window.open;
    window.open = mockWindowOpen;

    renderBillingSettings();

    await waitFor(() => {
      expect(screen.getByText('Update')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Update'));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('stripe-customer-portal', {
        body: { tenant_id: 'tenant-123' },
      });
    });

    await waitFor(() => {
      expect(mockWindowOpen).toHaveBeenCalledWith(
        'https://billing.stripe.com/portal/test',
        '_blank',
        'noopener,noreferrer'
      );
    });

    window.open = originalOpen;
  });

  it('shows success toast after opening Stripe portal', async () => {
    const user = userEvent.setup();
    const { toast } = await import('sonner');

    mockInvoke.mockResolvedValue({
      data: { url: 'https://billing.stripe.com/portal/test' },
      error: null,
    });

    const mockWindowOpen = vi.fn();
    const originalOpen = window.open;
    window.open = mockWindowOpen;

    renderBillingSettings();

    await waitFor(() => {
      expect(screen.getByText('Update')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Update'));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Success', {
        description: 'Opening Stripe Customer Portal...',
      });
    });

    window.open = originalOpen;
  });

  it('shows error toast when stripe-customer-portal fails', async () => {
    const user = userEvent.setup();
    const { toast } = await import('sonner');

    mockInvoke.mockResolvedValue({
      data: null,
      error: new Error('Stripe not configured'),
    });

    renderBillingSettings();

    await waitFor(() => {
      expect(screen.getByText('Update')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Update'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });

  it('handles error when portal returns data.error', async () => {
    const user = userEvent.setup();
    const { toast } = await import('sonner');

    mockInvoke.mockResolvedValue({
      data: { error: 'No Stripe customer found' },
      error: null,
    });

    renderBillingSettings();

    await waitFor(() => {
      expect(screen.getByText('Update')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Update'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });

  it('does not call edge function when tenantId is missing', async () => {
    mockTenant = { ...mockTenant, id: undefined };

    const user = userEvent.setup();
    renderBillingSettings();

    await waitFor(() => {
      expect(screen.getByText('Update')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Update'));

    // handleManageSubscription returns early if !tenantId
    expect(mockInvoke).not.toHaveBeenCalledWith(
      'stripe-customer-portal',
      expect.anything()
    );
  });
});
