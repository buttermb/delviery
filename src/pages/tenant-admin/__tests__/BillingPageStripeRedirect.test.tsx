import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

// ── Mocks (vi.mock is hoisted above imports) ─────────────────────────────────

// Use vi.hoisted to declare mock fns that vi.mock factories can reference
const {
  mockNavigate,
  mockSetSearchParams,
  mockRefreshTenant,
  mockInvoke,
  mockGetSession,
  mockToastSuccess,
  mockToastError,
  mockToastInfo,
} = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockSetSearchParams: vi.fn(),
  mockRefreshTenant: vi.fn().mockResolvedValue(undefined),
  mockInvoke: vi.fn(),
  mockGetSession: vi.fn().mockResolvedValue({
    data: { session: { user: { id: 'user-1' } } },
  }),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockToastInfo: vi.fn(),
}));

// Mutable ref for search params so tests can change it
let mockSearchParams = new URLSearchParams();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [mockSearchParams, mockSetSearchParams] as const,
  };
});

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    admin: { id: 'admin-1', email: 'admin@test.com' },
    tenant: {
      id: 'tenant-1',
      slug: 'test-tenant',
      subscription_plan: 'starter',
      subscription_status: 'active',
      payment_method_added: true,
      trial_ends_at: null,
      limits: {},
      usage: {},
    },
    refreshTenant: mockRefreshTenant,
    loading: false,
    isAuthenticated: true,
  }),
  TenantAdminAuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
    },
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  },
}));

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: mockToastSuccess,
    error: mockToastError,
    info: mockToastInfo,
    warning: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/hooks/useFeatureAccess', () => ({
  useFeatureAccess: () => ({
    currentTier: 'starter',
    hasFeature: () => true,
    isSubscriptionValid: true,
  }),
}));

vi.mock('@/hooks/useCredits', () => ({
  useCredits: () => ({
    balance: 500,
    isFreeTier: false,
    isLowCredits: false,
    isCriticalCredits: false,
    isOutOfCredits: false,
    nextFreeGrantAt: null,
    lifetimeSpent: 0,
  }),
}));

vi.mock('@/utils/safeStorage', () => ({
  safeStorage: {
    getItem: vi.fn().mockReturnValue('test-tenant'),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

vi.mock('@/lib/utils/checkEdgeFunctionError', () => ({
  checkEdgeFunctionError: vi.fn().mockReturnValue(null),
}));

vi.mock('@/components/tenant-admin/TrialBanner', () => ({
  TrialBanner: () => <div data-testid="trial-banner">TrialBanner</div>,
}));

vi.mock('@/components/tenant-admin/TrialCountdown', () => ({
  TrialCountdown: () => <div data-testid="trial-countdown">TrialCountdown</div>,
}));

vi.mock('@/components/billing/AddPaymentMethodDialog', () => ({
  AddPaymentMethodDialog: () => <div data-testid="add-payment-dialog">AddPaymentMethodDialog</div>,
}));

vi.mock('@/components/credits/CreditBalance', () => ({
  CreditBalance: () => <div data-testid="credit-balance">CreditBalance</div>,
}));

vi.mock('@/components/credits/CreditPurchaseModal', () => ({
  CreditPurchaseModal: () => <div data-testid="credit-purchase-modal">CreditPurchaseModal</div>,
}));

vi.mock('@/components/integrations/IntegrationStatus', () => ({
  IntegrationStatus: () => <div data-testid="integration-status">IntegrationStatus</div>,
}));

// Import AFTER all vi.mock calls (vi.mock is hoisted by vitest)
import BillingPage from '@/pages/tenant-admin/BillingPage';

// ── Helpers ──────────────────────────────────────────────────────────────────

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function setupDefaultInvokeMock() {
  mockInvoke.mockImplementation((fnName: string) => {
    if (fnName === 'check-stripe-config') {
      return Promise.resolve({
        data: { configured: true, valid: true, testMode: false },
        error: null,
      });
    }
    if (fnName === 'invoice-management') {
      return Promise.resolve({
        data: { invoices: [] },
        error: null,
      });
    }
    if (fnName === 'update-trial-status') {
      return Promise.resolve({
        data: { success: true },
        error: null,
      });
    }
    return Promise.resolve({ data: null, error: null });
  });
}

function renderBillingPage(initialParams = '') {
  mockSearchParams = new URLSearchParams(initialParams);
  setupDefaultInvokeMock();

  const queryClient = createTestQueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/test-tenant/admin/billing${initialParams ? `?${initialParams}` : ''}`]}>
        <BillingPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('BillingPage Stripe Checkout Redirect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('payment method success redirect (?success=true&payment_method=true)', () => {
    it('shows success toast when payment method params are present', async () => {
      renderBillingPage('success=true&payment_method=true');

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith(
          'Payment Method Added',
          expect.objectContaining({
            description: 'Your payment method has been successfully added.',
          })
        );
      });
    });

    it('cleans up URL params after processing', async () => {
      renderBillingPage('success=true&payment_method=true');

      await waitFor(() => {
        expect(mockSetSearchParams).toHaveBeenCalledWith({});
      });
    });
  });

  describe('trial success redirect (?success=true&trial=true)', () => {
    it('calls update-trial-status edge function', async () => {
      renderBillingPage('success=true&trial=true');

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('update-trial-status', expect.objectContaining({
          body: expect.objectContaining({
            payment_method_added: true,
          }),
        }));
      });
    });

    it('shows trial success toast', async () => {
      renderBillingPage('success=true&trial=true');

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith(
          'Payment method added successfully!',
          expect.objectContaining({
            description: 'Your 14-day trial has started.',
          })
        );
      });
    });

    it('navigates to dashboard after trial success', async () => {
      renderBillingPage('success=true&trial=true');

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(
          '/test-tenant/admin/dashboard',
          { replace: true }
        );
      });
    });
  });

  describe('no-conflict between handlers', () => {
    it('does not fire payment_method handler when only trial params present', async () => {
      renderBillingPage('success=true&trial=true');

      // Wait for trial handler to complete
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('update-trial-status', expect.anything());
      });

      // The payment_method useEffect should NOT have fired because
      // payment_method param is not in the URL
      expect(mockSetSearchParams).not.toHaveBeenCalledWith({});
    });

    it('does not fire trial handler when only payment_method params present', async () => {
      renderBillingPage('success=true&payment_method=true');

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith(
          'Payment Method Added',
          expect.anything()
        );
      });

      // The trial handler should NOT have called update-trial-status
      expect(mockInvoke).not.toHaveBeenCalledWith('update-trial-status', expect.anything());
    });

    it('does not fire either handler when success=false', async () => {
      renderBillingPage('success=false&payment_method=true');

      // Wait for component to mount
      await waitFor(() => {
        expect(screen.getByText('Billing & Subscription')).toBeInTheDocument();
      });

      expect(mockToastSuccess).not.toHaveBeenCalled();
      expect(mockSetSearchParams).not.toHaveBeenCalledWith({});
    });

    it('does not fire either handler when no success params present', async () => {
      renderBillingPage('');

      await waitFor(() => {
        expect(screen.getByText('Billing & Subscription')).toBeInTheDocument();
      });

      expect(mockToastSuccess).not.toHaveBeenCalled();
      expect(mockSetSearchParams).not.toHaveBeenCalledWith({});
    });
  });

  describe('renders billing page correctly on clean load', () => {
    it('renders heading and tabs', async () => {
      renderBillingPage('');

      await waitFor(() => {
        expect(screen.getByText('Billing & Subscription')).toBeInTheDocument();
      });

      // "Current Plan" appears both as tab and card title — use role selector for the tab
      expect(screen.getByRole('tab', { name: 'Current Plan' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Compare Plans' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Billing' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Integrations' })).toBeInTheDocument();
    });
  });
});
