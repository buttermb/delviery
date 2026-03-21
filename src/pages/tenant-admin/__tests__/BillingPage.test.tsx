/**
 * BillingPage Tests
 * Verifies the "Back to Dashboard" button navigates to the correct admin route
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

vi.mock('@/integrations/supabase/client', () => {
  const createChainMock = (resolvedValue = { data: null, error: null }) => {
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    chain.select = vi.fn().mockReturnValue(chain);
    chain.eq = vi.fn().mockReturnValue(chain);
    chain.neq = vi.fn().mockReturnValue(chain);
    chain.in = vi.fn().mockReturnValue(chain);
    chain.gte = vi.fn().mockReturnValue(chain);
    chain.lt = vi.fn().mockReturnValue(chain);
    chain.lte = vi.fn().mockReturnValue(chain);
    chain.not = vi.fn().mockReturnValue(chain);
    chain.order = vi.fn().mockReturnValue(chain);
    chain.limit = vi.fn().mockReturnValue(chain);
    chain.returns = vi.fn().mockResolvedValue(resolvedValue);
    chain.maybeSingle = vi.fn().mockResolvedValue(resolvedValue);
    chain.single = vi.fn().mockResolvedValue(resolvedValue);
    chain.then = vi.fn((resolve) => Promise.resolve(resolvedValue).then(resolve));
    return chain;
  };

  return {
    supabase: {
      from: vi.fn(() => createChainMock()),
      functions: {
        invoke: vi.fn().mockResolvedValue({ data: null, error: null }),
      },
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
      },
      channel: vi.fn().mockReturnValue({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnThis(),
      }),
      removeChannel: vi.fn(),
    },
  };
});

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: vi.fn().mockReturnValue({
    tenant: {
      id: 'tenant-123',
      slug: 'greenleaf',
      business_name: 'Greenleaf Dispensary',
      subscription_plan: 'professional',
      subscription_status: 'active',
      trial_ends_at: null,
      payment_method_added: true,
    },
    loading: false,
    admin: { id: 'admin-123', email: 'admin@test.com' },
    tenantSlug: 'greenleaf',
    logout: vi.fn(),
  }),
}));

vi.mock('@/hooks/useFeatureAccess', () => ({
  useFeatureAccess: vi.fn().mockReturnValue({
    currentTier: 'professional',
    hasAccess: vi.fn().mockReturnValue(true),
    canAccessFeature: vi.fn().mockReturnValue(true),
  }),
}));

vi.mock('@/hooks/useCredits', () => ({
  useCredits: vi.fn().mockReturnValue({
    balance: 100,
    isFreeTier: false,
    isLowCredits: false,
    isCriticalCredits: false,
    isOutOfCredits: false,
    nextFreeGrantAt: null,
    lifetimeSpent: 50,
  }),
}));

vi.mock('@/hooks/useStripeRedirectHandler', () => ({
  useStripeRedirectHandler: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: vi.fn().mockReturnValue({
    theme: 'light',
    setTheme: vi.fn(),
    systemPreference: 'light',
  }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock heavy child components
vi.mock('@/components/tenant-admin/TrialBanner', () => ({
  TrialBanner: () => null,
}));

vi.mock('@/components/tenant-admin/TrialCountdown', () => ({
  TrialCountdown: () => null,
}));

vi.mock('@/components/billing/AddPaymentMethodDialog', () => ({
  AddPaymentMethodDialog: () => null,
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
  FREE_TIER_MONTHLY_CREDITS: 1000,
  CREDIT_PACKAGES: [],
}));

import TenantAdminBillingPage from '../BillingPage';

function renderBillingPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <TenantAdminBillingPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('BillingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Back to Dashboard button', () => {
    it('renders the Back to Dashboard button', () => {
      renderBillingPage();

      const backButton = screen.getByRole('button', { name: /back to dashboard/i });
      expect(backButton).toBeInTheDocument();
    });

    it('navigates to the tenant admin dashboard when clicked', async () => {
      const user = userEvent.setup();

      renderBillingPage();

      const backButton = screen.getByRole('button', { name: /back to dashboard/i });
      await user.click(backButton);

      expect(mockNavigate).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith('/greenleaf/admin');
    });

    it('uses the tenant slug in the navigation path', async () => {
      const user = userEvent.setup();

      renderBillingPage();

      const backButton = screen.getByRole('button', { name: /back to dashboard/i });
      await user.click(backButton);

      const navigatedPath = mockNavigate.mock.calls[0][0] as string;
      expect(navigatedPath).toContain('greenleaf');
      expect(navigatedPath).toMatch(/^\/greenleaf\/admin$/);
    });
  });
});
