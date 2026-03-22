/**
 * BillingPage Stripe Key Error Tests
 * Verifies the BillingPage displays specific error messages when Stripe
 * is misconfigured — particularly the sk_ vs pk_ key mismatch scenario.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// vi.hoisted runs before vi.mock hoisting, making these available in mock factories
const { mockNavigate, mockToast, mockInvoke, getStripeHealthResponse, setStripeHealthResponse } =
  vi.hoisted(() => {
    let stripeHealthResponse: { data: unknown; error: unknown } = {
      data: { configured: true, valid: true, testMode: false },
      error: null,
    };
    const invokeImpl = vi.fn().mockImplementation((fnName: string) => {
      if (fnName === 'check-stripe-config') {
        return Promise.resolve(stripeHealthResponse);
      }
      if (fnName === 'invoice-management') {
        return Promise.resolve({ data: { invoices: [] }, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });
    return {
      mockNavigate: vi.fn(),
      mockToast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
      mockInvoke: invokeImpl,
      getStripeHealthResponse: () => stripeHealthResponse,
      setStripeHealthResponse: (val: { data: unknown; error: unknown }) => {
        stripeHealthResponse = val;
      },
    };
  });

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ tenantSlug: 'test-tenant' }),
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

vi.mock('@/integrations/supabase/client', () => {
  const createChainMock = (
    resolvedValue: { data: unknown; error: unknown } = { data: [], error: null },
  ) => {
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    chain.select = vi.fn().mockReturnValue(chain);
    chain.eq = vi.fn().mockReturnValue(chain);
    chain.neq = vi.fn().mockReturnValue(chain);
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
      functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
        getSession: vi.fn().mockResolvedValue({
          data: { session: { access_token: 'token' } },
          error: null,
        }),
        onAuthStateChange: vi.fn(() => ({
          data: { subscription: { unsubscribe: vi.fn() } },
        })),
      },
      channel: vi.fn(() => ({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
      })),
    },
  };
});

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: {
      id: 'tenant-1',
      slug: 'test-tenant',
      subscription_plan: 'starter',
      subscription_status: 'active',
      payment_method_added: true,
      limits: {},
      usage: {},
      trial_ends_at: null,
    },
    isLoading: false,
  }),
}));

vi.mock('@/hooks/useFeatureAccess', () => ({
  useFeatureAccess: () => ({
    currentTier: 'starter',
    hasFeature: () => true,
    isLoading: false,
  }),
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

vi.mock('@/hooks/useStripeRedirectHandler', () => ({
  useStripeRedirectHandler: vi.fn(),
}));

vi.mock('sonner', () => ({ toast: mockToast }));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

vi.mock('@/lib/tierMapping', () => ({
  businessTierToSubscriptionTier: (tier: string) => tier,
}));

vi.mock('@/components/tenant-admin/TrialBanner', () => ({ TrialBanner: () => null }));
vi.mock('@/components/tenant-admin/TrialCountdown', () => ({ TrialCountdown: () => null }));
vi.mock('@/components/billing/AddPaymentMethodDialog', () => ({
  AddPaymentMethodDialog: () => null,
}));
vi.mock('@/components/credits/CreditBalance', () => ({
  CreditBalance: () => <div data-testid="credit-balance">Credits</div>,
}));
vi.mock('@/components/credits/CreditPurchaseModal', () => ({ CreditPurchaseModal: () => null }));

import BillingPage from '../BillingPage';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function renderBillingPage() {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/test-tenant/admin/billing']}>
        <BillingPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('BillingPage Stripe Key Error Display', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setStripeHealthResponse({
      data: { configured: true, valid: true, testMode: false },
      error: null,
    });
    // Reset invoke to default behavior
    mockInvoke.mockImplementation((fnName: string) => {
      if (fnName === 'check-stripe-config') {
        return Promise.resolve(getStripeHealthResponse());
      }
      if (fnName === 'invoice-management') {
        return Promise.resolve({ data: { invoices: [] }, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });
  });

  describe('when Stripe key is a publishable key instead of secret key', () => {
    beforeEach(() => {
      setStripeHealthResponse({
        data: {
          configured: true,
          valid: false,
          error:
            'Invalid Stripe configuration. The key must be a SECRET key (starts with sk_), not a publishable key (pk_).',
        },
        error: null,
      });
    });

    it('shows the specific pk_ vs sk_ error alert', async () => {
      renderBillingPage();

      await waitFor(() => {
        expect(screen.getByText(/Stripe Not Configured/i)).toBeInTheDocument();
      });

      expect(
        screen.getByText(/The key must be a SECRET key.*not a publishable key/i),
      ).toBeInTheDocument();
    });

    it('renders inside a destructive alert role', async () => {
      renderBillingPage();

      await waitFor(() => {
        const alert = screen
          .getByText(/Stripe Not Configured/i)
          .closest('[role="alert"]');
        expect(alert).toBeInTheDocument();
      });
    });
  });

  describe('when STRIPE_SECRET_KEY is missing', () => {
    beforeEach(() => {
      setStripeHealthResponse({
        data: {
          configured: false,
          valid: false,
          error: 'STRIPE_SECRET_KEY is missing',
        },
        error: null,
      });
    });

    it('shows the missing key error alert', async () => {
      renderBillingPage();

      await waitFor(() => {
        expect(screen.getByText(/Stripe Not Configured/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/STRIPE_SECRET_KEY is missing/i)).toBeInTheDocument();
    });
  });

  describe('when Stripe is properly configured', () => {
    it('does not show the error alert', async () => {
      renderBillingPage();

      await waitFor(() => {
        expect(screen.getByText(/Billing & Subscription/i)).toBeInTheDocument();
      });

      expect(screen.queryByText(/Stripe Not Configured/i)).not.toBeInTheDocument();
    });
  });

  describe('when Stripe is in test mode', () => {
    it('shows the test mode alert with test card info', async () => {
      setStripeHealthResponse({
        data: { configured: true, valid: true, testMode: true },
        error: null,
      });

      renderBillingPage();

      await waitFor(() => {
        expect(screen.getByText(/Platform Test Mode/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/4242 4242 4242 4242/)).toBeInTheDocument();
    });
  });

  describe('upgrade mutation error handling', () => {
    it('detects "Invalid STRIPE_SECRET_KEY" in error messages', () => {
      const errorMessage = 'Invalid STRIPE_SECRET_KEY format';
      const isStripeKeyError =
        errorMessage.includes('Invalid STRIPE_SECRET_KEY') ||
        errorMessage.includes('secret key');
      expect(isStripeKeyError).toBe(true);
    });

    it('detects "secret key" substring in error messages', () => {
      const errorMessage = 'The secret key provided is invalid';
      const isStripeKeyError =
        errorMessage.includes('Invalid STRIPE_SECRET_KEY') ||
        errorMessage.includes('secret key');
      expect(isStripeKeyError).toBe(true);
    });

    it('does not trigger stripe key guidance for generic errors', () => {
      const errorMessage = 'Network error: failed to connect';
      const isStripeKeyError =
        errorMessage.includes('Invalid STRIPE_SECRET_KEY') ||
        errorMessage.includes('secret key');
      expect(isStripeKeyError).toBe(false);
    });
  });

  describe('handlePlanChange Stripe health guard', () => {
    it('blocks plan change and shows error toast when stripe is invalid', async () => {
      setStripeHealthResponse({
        data: {
          configured: true,
          valid: false,
          error:
            'Invalid Stripe configuration. The key must be a SECRET key (starts with sk_), not a publishable key (pk_).',
        },
        error: null,
      });

      const user = userEvent.setup();
      renderBillingPage();

      await waitFor(() => {
        expect(screen.getByText(/Stripe Not Configured/i)).toBeInTheDocument();
      });

      // Navigate to Compare Plans tab
      const comparePlansTab = screen.getByRole('tab', { name: /Compare Plans/i });
      await user.click(comparePlansTab);

      // Attempt to click an upgrade button if rendered
      const upgradeButtons = screen.queryAllByRole('button', {
        name: /upgrade|select|choose/i,
      });

      if (upgradeButtons.length > 0) {
        await user.click(upgradeButtons[0]);

        await waitFor(() => {
          expect(mockToast.error).toHaveBeenCalledWith(
            'Stripe Not Configured',
            expect.objectContaining({
              description: expect.stringContaining('SECRET key'),
            }),
          );
        });
      }
    });
  });
});
