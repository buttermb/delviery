/**
 * BillingPage creditPurchaseOpen state management tests
 *
 * Verifies:
 * 1. CreditPurchaseModal is not rendered for non-free-tier users
 * 2. CreditPurchaseModal starts closed for free-tier users
 * 3. "Buy Credits" button opens CreditPurchaseModal
 * 4. Credit package card clicks open CreditPurchaseModal
 * 5. CreditPurchaseModal receives correct open/onOpenChange props
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Track navigation
const mockNavigate = vi.fn();

// --- Mocks ---

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

vi.mock('@/integrations/supabase/client', () => {
  const createChainMock = (resolvedValue: { data: unknown; error: unknown } = { data: [], error: null }) => {
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
      functions: {
        invoke: vi.fn().mockResolvedValue({ data: null, error: null }),
      },
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
        getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'test' } }, error: null }),
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
      slug: 'test-tenant',
      business_name: 'Test Cannabis Co',
      subscription_plan: 'free',
      subscription_status: 'active',
      trial_ends_at: null,
      payment_method_added: false,
      usage: {},
      limits: {},
      is_free_tier: true,
    },
    loading: false,
    admin: { id: 'admin-123', email: 'admin@test.com' },
    tenantSlug: 'test-tenant',
    logout: vi.fn(),
  }),
}));

vi.mock('@/hooks/useFeatureAccess', () => ({
  useFeatureAccess: vi.fn().mockReturnValue({
    currentTier: 'starter',
    currentTierName: 'Starter',
    currentTierPrice: 79,
    canAccess: vi.fn().mockReturnValue(true),
    subscriptionValid: true,
    isTrialExpired: false,
    isSuspended: false,
    isCancelled: false,
    isPastDue: false,
  }),
}));

const mockUseCredits = vi.fn();
vi.mock('@/hooks/useCredits', () => ({
  useCredits: () => mockUseCredits(),
}));

vi.mock('@/hooks/useStripeRedirectHandler', () => ({
  useStripeRedirectHandler: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock TrialBanner, TrialCountdown, IntegrationStatus, CreditBalance to simplify
vi.mock('@/components/tenant-admin/TrialBanner', () => ({
  TrialBanner: () => null,
}));
vi.mock('@/components/tenant-admin/TrialCountdown', () => ({
  TrialCountdown: () => null,
}));
vi.mock('@/components/integrations/IntegrationStatus', () => ({
  IntegrationStatus: () => <div data-testid="integration-status" />,
}));
vi.mock('@/components/credits/CreditBalance', () => ({
  CreditBalance: () => <div data-testid="credit-balance" />,
}));

// Import after mocks
import TenantAdminBillingPage from '../BillingPage';

function renderBillingPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <TenantAdminBillingPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('BillingPage creditPurchaseOpen state management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('when user is on free tier', () => {
    beforeEach(() => {
      mockUseCredits.mockReturnValue({
        balance: 300,
        isFreeTier: true,
        isLowCredits: false,
        isCriticalCredits: false,
        isOutOfCredits: false,
        nextFreeGrantAt: null,
        lifetimeSpent: 200,
      });
    });

    it('should not show CreditPurchaseModal on initial render', () => {
      renderBillingPage();

      // The modal dialog title should not be visible when closed
      expect(screen.queryByText('Top Up Credits')).not.toBeInTheDocument();
    });

    it('should show "Buy Credits" button for free-tier users', () => {
      renderBillingPage();

      expect(screen.getByText('Buy Credits')).toBeInTheDocument();
    });

    it('should open CreditPurchaseModal when "Buy Credits" button is clicked', async () => {
      const user = userEvent.setup();
      renderBillingPage();

      // Initially modal is closed
      expect(screen.queryByText('Top Up Credits')).not.toBeInTheDocument();

      // Click Buy Credits button
      const buyCreditsButton = screen.getByText('Buy Credits');
      await user.click(buyCreditsButton);

      // Modal should now be open
      expect(screen.getByText('Top Up Credits')).toBeInTheDocument();
    });

    it('should open CreditPurchaseModal when credit package card is clicked', async () => {
      const user = userEvent.setup();
      renderBillingPage();

      // Initially modal is closed
      expect(screen.queryByText('Top Up Credits')).not.toBeInTheDocument();

      // Click a credit package card - find by the package credits text
      const creditCards = screen.getAllByText('credits');
      // Click the first credit package card (the parent div with cursor-pointer)
      const firstPackageCard = creditCards[0].closest('.cursor-pointer');
      expect(firstPackageCard).toBeTruthy();
      await user.click(firstPackageCard!);

      // Modal should now be open
      expect(screen.getByText('Top Up Credits')).toBeInTheDocument();
    });

    it('should render credit packages section with CREDIT_PACKAGES', () => {
      renderBillingPage();

      // Credit Packages section should be visible
      expect(screen.getByText('Credit Packages')).toBeInTheDocument();
      expect(screen.getByText('Pay As You Go')).toBeInTheDocument();
    });
  });

  describe('when user is NOT on free tier', () => {
    beforeEach(() => {
      mockUseCredits.mockReturnValue({
        balance: 0,
        isFreeTier: false,
        isLowCredits: false,
        isCriticalCredits: false,
        isOutOfCredits: false,
        nextFreeGrantAt: null,
        lifetimeSpent: 0,
      });
    });

    it('should not render CreditPurchaseModal at all', () => {
      renderBillingPage();

      // No "Buy Credits" button
      expect(screen.queryByText('Buy Credits')).not.toBeInTheDocument();
      // No credit packages section
      expect(screen.queryByText('Credit Packages')).not.toBeInTheDocument();
      // No modal
      expect(screen.queryByText('Top Up Credits')).not.toBeInTheDocument();
    });

    it('should not show Credit Balance section', () => {
      renderBillingPage();

      expect(screen.queryByText('Credit Balance')).not.toBeInTheDocument();
    });
  });

  describe('modal close behavior', () => {
    beforeEach(() => {
      mockUseCredits.mockReturnValue({
        balance: 300,
        isFreeTier: true,
        isLowCredits: false,
        isCriticalCredits: false,
        isOutOfCredits: false,
        nextFreeGrantAt: null,
        lifetimeSpent: 200,
      });
    });

    it('should close modal via onOpenChange (e.g., Escape key)', async () => {
      const user = userEvent.setup();
      renderBillingPage();

      // Open modal
      await user.click(screen.getByText('Buy Credits'));
      expect(screen.getByText('Top Up Credits')).toBeInTheDocument();

      // Press Escape to close
      await user.keyboard('{Escape}');

      // Modal should be closed
      expect(screen.queryByText('Top Up Credits')).not.toBeInTheDocument();
    });
  });
});
