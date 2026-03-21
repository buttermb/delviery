/**
 * BillingPage Buy Credits Tests
 * Verifies that the "Buy Credits" button opens CreditPurchaseModal
 * and the modal displays correctly for free tier users.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Track navigation calls
const mockNavigate = vi.fn();

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ tenantSlug: 'test-tenant' }),
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => {
  const createChainMock = (resolvedValue: { data: unknown; error: unknown } = { data: [], error: null }) => {
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
        getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'test-token' } }, error: null }),
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
        signOut: vi.fn().mockResolvedValue({ error: null }),
        onAuthStateChange: vi.fn().mockReturnValue({
          data: { subscription: { unsubscribe: vi.fn() } },
        }),
      },
      channel: vi.fn().mockReturnValue({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnThis(),
      }),
      removeChannel: vi.fn(),
    },
  };
});

// Mock tenant admin auth context - free tier user
vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: vi.fn().mockReturnValue({
    tenant: {
      id: 'tenant-123',
      slug: 'test-tenant',
      business_name: 'Test Cannabis Co',
      subscription_plan: 'starter',
      subscription_status: 'active',
      trial_ends_at: null,
      payment_method_added: true,
      limits: {},
      usage: {},
      is_free_tier: true,
    },
    tenantSlug: 'test-tenant',
    isAuthenticated: true,
    accessToken: 'test-token',
    isLoading: false,
  }),
}));

// Mock useFeatureAccess to return starter tier
vi.mock('@/hooks/useFeatureAccess', () => ({
  useFeatureAccess: vi.fn().mockReturnValue({
    currentTier: 'starter',
    hasAccess: vi.fn().mockReturnValue(true),
    getRequiredTier: vi.fn().mockReturnValue('starter'),
  }),
}));

// Mock useCredits to return free tier state
vi.mock('@/hooks/useCredits', () => ({
  useCredits: vi.fn().mockReturnValue({
    balance: 3500,
    isFreeTier: true,
    isLoading: false,
    error: null,
    isLowCredits: false,
    isCriticalCredits: false,
    isOutOfCredits: false,
    lifetimeStats: { earned: 5000, spent: 1500, purchased: 0, expired: 0, refunded: 0 },
    subscription: { status: 'active', isFreeTier: true, creditsPerPeriod: 5000, currentPeriodEnd: null, cancelAtPeriodEnd: false },
    lifetimeEarned: 5000,
    lifetimeSpent: 1500,
    nextFreeGrantAt: null,
    percentUsed: 30,
    hasCredits: vi.fn().mockReturnValue(true),
    canPerformAction: vi.fn().mockResolvedValue(true),
    performAction: vi.fn(),
    refetch: vi.fn(),
    invalidate: vi.fn(),
  }),
}));

// Mock useStripeRedirectHandler
vi.mock('@/hooks/useStripeRedirectHandler', () => ({
  useStripeRedirectHandler: vi.fn(),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

// Mock humanizeError
vi.mock('@/lib/humanizeError', () => ({
  humanizeError: vi.fn((err: unknown) => String(err)),
}));

// Mock CreditContext (used by CreditBalance component)
vi.mock('@/contexts/CreditContext', () => ({
  useCredits: vi.fn().mockReturnValue({
    credits: 3500,
    isFreeTier: true,
    isLoading: false,
    error: null,
    balance: 3500,
    isLowCredits: false,
    isCriticalCredits: false,
    isOutOfCredits: false,
    showLowCreditWarning: false,
    dismissLowCreditWarning: vi.fn(),
    isPurchaseModalOpen: false,
    setIsPurchaseModalOpen: vi.fn(),
    deductCredits: vi.fn().mockReturnValue(true),
    addCredits: vi.fn(),
    lifetimeStats: { earned: 5000, spent: 1500, purchased: 0, expired: 0, refunded: 0 },
    subscription: { status: 'active', isFreeTier: true, creditsPerPeriod: 5000, currentPeriodEnd: null, cancelAtPeriodEnd: false },
    lifetimeEarned: 5000,
    lifetimeSpent: 1500,
    nextFreeGrantAt: null,
    percentUsed: 30,
    hasCredits: vi.fn().mockReturnValue(true),
    canPerformAction: vi.fn().mockResolvedValue(true),
    performAction: vi.fn(),
    refetch: vi.fn(),
    invalidate: vi.fn(),
  }),
  CreditProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock tierMapping
vi.mock('@/lib/tierMapping', () => ({
  businessTierToSubscriptionTier: vi.fn().mockReturnValue('starter'),
}));

// Mock child components that have deep dependency trees
vi.mock('@/components/credits/CreditBalance', () => ({
  CreditBalance: ({ variant }: { variant?: string }) => (
    <div data-testid="credit-balance-badge">CreditBalance ({variant})</div>
  ),
}));

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
  IntegrationStatus: () => <div data-testid="integration-status">IntegrationStatus</div>,
}));

// Import after mocks
import TenantAdminBillingPage from '../BillingPage';

// Test helpers
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
        <TenantAdminBillingPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('BillingPage - Buy Credits Button', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the Buy Credits button for free tier users', async () => {
    renderBillingPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /buy credits/i })).toBeInTheDocument();
    });
  });

  it('should render the Credit Balance section for free tier users', async () => {
    renderBillingPage();

    await waitFor(() => {
      expect(screen.getByText('Credit Balance')).toBeInTheDocument();
    });
  });

  it('should open CreditPurchaseModal when Buy Credits button is clicked', async () => {
    const user = userEvent.setup();
    renderBillingPage();

    // Wait for Buy Credits button to appear
    const buyCreditsButton = await screen.findByRole('button', { name: /buy credits/i });

    // Click the button
    await user.click(buyCreditsButton);

    // Verify the CreditPurchaseModal is open by checking for its title
    await waitFor(() => {
      expect(screen.getByText('Top Up Credits')).toBeInTheDocument();
    });
  });

  it('should display credit packages inside the modal after clicking Buy Credits', async () => {
    const user = userEvent.setup();
    renderBillingPage();

    const buyCreditsButton = await screen.findByRole('button', { name: /buy credits/i });
    await user.click(buyCreditsButton);

    // Verify package labels appear in the modal
    await waitFor(() => {
      expect(screen.getByText('Starter Pack')).toBeInTheDocument();
      expect(screen.getByText('Growth Pack')).toBeInTheDocument();
      expect(screen.getByText('Power Pack')).toBeInTheDocument();
      expect(screen.getByText('Enterprise Pack')).toBeInTheDocument();
    });
  });

  it('should display Buy Now buttons inside the modal', async () => {
    const user = userEvent.setup();
    renderBillingPage();

    const buyCreditsButton = await screen.findByRole('button', { name: /buy credits/i });
    await user.click(buyCreditsButton);

    await waitFor(() => {
      const buyNowButtons = screen.getAllByRole('button', { name: 'Buy Now' });
      expect(buyNowButtons).toHaveLength(4);
    });
  });

  it('should display modal description text', async () => {
    const user = userEvent.setup();
    renderBillingPage();

    const buyCreditsButton = await screen.findByRole('button', { name: /buy credits/i });
    await user.click(buyCreditsButton);

    await waitFor(() => {
      expect(screen.getByText('Purchase credits to continue using premium features.')).toBeInTheDocument();
    });
  });

  it('should display the credit balance amount', async () => {
    renderBillingPage();

    await waitFor(() => {
      expect(screen.getByText('3,500')).toBeInTheDocument();
    });
  });
});
