/**
 * BillingSettings Tests - Update Payment Method Button
 *
 * Verifies the "Update" payment method button behavior:
 * 1. Renders when payment_method_added is true
 * 2. Clicking invokes stripe-customer-portal edge function
 * 3. Shows loading spinner while processing
 * 4. Opens Stripe portal URL in new tab on success
 * 5. Shows error toast on failure
 * 6. Shows "Add Payment Method" when no payment method exists
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// --- Mocks ---

const mockNavigate = vi.fn();
const mockSetSearchParams = vi.fn();
const mockSearchParams = new URLSearchParams();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [mockSearchParams, mockSetSearchParams],
  };
});

const mockInvoke = vi.fn().mockResolvedValue({ data: null, error: null });

vi.mock('@/integrations/supabase/client', () => {
  const createChainMock = (resolvedValue: { data: unknown; error: unknown } = { data: [], error: null }) => {
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    chain.select = vi.fn().mockReturnValue(chain);
    chain.eq = vi.fn().mockReturnValue(chain);
    chain.order = vi.fn().mockReturnValue(chain);
    chain.limit = vi.fn().mockReturnValue(chain);
    chain.maybeSingle = vi.fn().mockResolvedValue(resolvedValue);
    chain.single = vi.fn().mockResolvedValue(resolvedValue);
    chain.then = vi.fn((resolve) => Promise.resolve(resolvedValue).then(resolve));
    return chain;
  };

  return {
    supabase: {
      from: vi.fn(() => createChainMock()),
      functions: { invoke: mockInvoke },
      channel: vi.fn().mockReturnValue({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnThis(),
      }),
      removeChannel: vi.fn(),
    },
  };
});

const mockTenant = {
  id: 'tenant-123',
  slug: 'test-tenant',
  business_name: 'Test Cannabis Co',
  subscription_plan: 'professional',
  subscription_status: 'active',
  trial_ends_at: null,
  payment_method_added: true,
  billing_cycle: 'monthly',
  mrr: 9900,
  limits: {},
  usage: {},
  is_free_tier: false,
  created_at: new Date().toISOString(),
};

const useTenantAdminAuthMock = vi.fn().mockReturnValue({
  tenant: mockTenant,
});

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: (...args: unknown[]) => useTenantAdminAuthMock(...args),
}));

vi.mock('@/hooks/useSubscriptionStatus', () => ({
  useSubscriptionStatus: () => ({
    isTrial: false,
    needsPaymentMethod: false,
    isCancelled: false,
    isActive: true,
    currentTier: 'professional',
  }),
}));

vi.mock('@/hooks/useFeatureAccess', () => ({
  useFeatureAccess: () => ({
    currentTier: 'block',
    currentTierName: 'Professional',
    hasAccess: () => true,
    getRequiredTier: () => 'starter',
    getUpgradeRequirement: () => null,
  }),
}));

vi.mock('@/hooks/useCredits', () => ({
  useCredits: () => ({
    balance: 10000,
    isFreeTier: false,
    isLowCredits: false,
    isCriticalCredits: false,
    isOutOfCredits: false,
    nextFreeGrantAt: null,
    lifetimeSpent: 0,
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
};

vi.mock('sonner', () => ({
  toast: mockToast,
}));

vi.mock('@/lib/humanizeError', () => ({
  humanizeError: (err: unknown, fallback?: string) => {
    if (err instanceof Error) return err.message;
    return fallback ?? 'An error occurred';
  },
}));

vi.mock('@/lib/tierMapping', () => ({
  businessTierToSubscriptionTier: (tier: string) => {
    if (tier === 'block' || tier === 'hood') return 'professional';
    if (tier === 'empire') return 'enterprise';
    return 'starter';
  },
}));

vi.mock('@/components/billing/AddPaymentMethodDialog', () => ({
  AddPaymentMethodDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="add-payment-dialog">Add Payment Dialog</div> : null,
}));

vi.mock('@/components/credits', () => ({
  CreditBalance: () => <div data-testid="credit-balance" />,
  CreditUsageStats: () => <div data-testid="credit-usage-stats" />,
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
        <BillingSettingsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// Lazy import after mocks
let BillingSettingsPage: typeof import('../BillingSettings').default;

beforeEach(async () => {
  vi.clearAllMocks();
  mockInvoke.mockResolvedValue({ data: null, error: null });
  useTenantAdminAuthMock.mockReturnValue({ tenant: { ...mockTenant, payment_method_added: true } });

  const mod = await import('../BillingSettings');
  BillingSettingsPage = mod.default;
});

// --- Tests ---

describe('BillingSettings - Update Payment Method Button', () => {
  describe('when payment method is added', () => {
    it('renders the Update button', () => {
      renderBillingSettings();

      const updateButton = screen.getByRole('button', { name: /update/i });
      expect(updateButton).toBeInTheDocument();
      expect(updateButton).toBeEnabled();
    });

    it('renders card ending in 4242', () => {
      renderBillingSettings();

      expect(screen.getByText(/•••• •••• •••• 4242/)).toBeInTheDocument();
    });

    it('renders Default badge', () => {
      renderBillingSettings();

      expect(screen.getByText('Default')).toBeInTheDocument();
    });

    it('invokes stripe-customer-portal on click and opens URL', async () => {
      const portalUrl = 'https://billing.stripe.com/session/test_portal';
      mockInvoke.mockImplementation(async (fnName: string) => {
        if (fnName === 'stripe-customer-portal') {
          return { data: { url: portalUrl }, error: null };
        }
        return { data: null, error: null };
      });

      const mockOpen = vi.fn();
      vi.stubGlobal('open', mockOpen);

      const user = userEvent.setup();
      renderBillingSettings();

      const updateButton = screen.getByRole('button', { name: /update/i });
      await user.click(updateButton);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('stripe-customer-portal', {
          body: { tenant_id: 'tenant-123' },
        });
      });

      await waitFor(() => {
        expect(mockOpen).toHaveBeenCalledWith(portalUrl, '_blank', 'noopener,noreferrer');
      });

      expect(mockToast.success).toHaveBeenCalledWith('Success', {
        description: 'Opening Stripe Customer Portal...',
      });

      vi.unstubAllGlobals();
    });

    it('shows error toast when stripe-customer-portal fails', async () => {
      mockInvoke.mockImplementation(async (fnName: string) => {
        if (fnName === 'stripe-customer-portal') {
          return { data: null, error: new Error('Stripe unavailable') };
        }
        return { data: null, error: null };
      });

      const user = userEvent.setup();
      renderBillingSettings();

      const updateButton = screen.getByRole('button', { name: /update/i });
      await user.click(updateButton);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Error', {
          description: expect.any(String),
        });
      });
    });

    it('shows error toast when response contains error field', async () => {
      mockInvoke.mockImplementation(async (fnName: string) => {
        if (fnName === 'stripe-customer-portal') {
          return { data: { error: 'No Stripe customer found' }, error: null };
        }
        return { data: null, error: null };
      });

      const user = userEvent.setup();
      renderBillingSettings();

      const updateButton = screen.getByRole('button', { name: /update/i });
      await user.click(updateButton);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Error', {
          description: 'No Stripe customer found',
        });
      });
    });

    it('re-enables the button after request completes', async () => {
      mockInvoke.mockImplementation(async (fnName: string) => {
        if (fnName === 'stripe-customer-portal') {
          return { data: { url: 'https://stripe.com/portal' }, error: null };
        }
        return { data: null, error: null };
      });

      const mockOpen = vi.fn();
      vi.stubGlobal('open', mockOpen);

      const user = userEvent.setup();
      renderBillingSettings();

      const updateButton = screen.getByRole('button', { name: /update/i });
      await user.click(updateButton);

      await waitFor(() => {
        expect(updateButton).toBeEnabled();
      });

      vi.unstubAllGlobals();
    });
  });

  describe('when no payment method is added', () => {
    beforeEach(() => {
      useTenantAdminAuthMock.mockReturnValue({
        tenant: { ...mockTenant, payment_method_added: false },
      });
    });

    it('does not render the Update button', () => {
      renderBillingSettings();

      const updateButtons = screen.queryAllByRole('button', { name: /^update$/i });
      expect(updateButtons).toHaveLength(0);
    });

    it('renders Add Payment Method button', () => {
      renderBillingSettings();

      expect(screen.getByRole('button', { name: /add payment method/i })).toBeInTheDocument();
    });

    it('renders "No payment method added" message', () => {
      renderBillingSettings();

      expect(screen.getByText(/no payment method added/i)).toBeInTheDocument();
    });

    it('opens AddPaymentMethodDialog when Add Payment Method is clicked', async () => {
      const user = userEvent.setup();
      renderBillingSettings();

      const addButton = screen.getByRole('button', { name: /add payment method/i });
      await user.click(addButton);

      await waitFor(() => {
        expect(screen.getByTestId('add-payment-dialog')).toBeInTheDocument();
      });
    });
  });

  describe('when tenant is not loaded', () => {
    beforeEach(() => {
      useTenantAdminAuthMock.mockReturnValue({ tenant: null });
    });

    it('does not crash and renders no payment method section', () => {
      renderBillingSettings();

      expect(screen.getByText(/no payment method added/i)).toBeInTheDocument();
    });
  });
});
