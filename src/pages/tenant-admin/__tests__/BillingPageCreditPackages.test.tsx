/**
 * BillingPage Credit Package Cards → CreditPurchaseModal
 *
 * Verifies that clicking any credit package card on the billing page
 * opens the CreditPurchaseModal for free-tier users.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ---------- mocks (hoisted before imports by vitest) ----------

const mockNavigate = vi.fn();

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
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
        signOut: vi.fn().mockResolvedValue({ error: null }),
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
      limits: {},
      usage: {},
    },
    isAdmin: true,
    isLoading: false,
  }),
}));

vi.mock('@/hooks/useCredits', () => ({
  useCredits: () => ({
    balance: 350,
    isFreeTier: true,
    isLowCredits: false,
    isCriticalCredits: false,
    isOutOfCredits: false,
    nextFreeGrantAt: null,
    lifetimeSpent: 150,
    hasCredits: true,
    isLoading: false,
    error: null,
    consumeCredits: vi.fn(),
    refreshBalance: vi.fn(),
  }),
}));

vi.mock('@/hooks/useFeatureAccess', () => ({
  useFeatureAccess: () => ({
    currentTier: 'free' as const,
    hasAccess: vi.fn().mockReturnValue(true),
    isLoading: false,
  }),
}));

vi.mock('@/hooks/useStripeRedirectHandler', () => ({
  useStripeRedirectHandler: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

vi.mock('@/lib/humanizeError', () => ({
  humanizeError: vi.fn((e: unknown) => String(e)),
}));

vi.mock('@/components/credits/CreditBalance', () => ({
  CreditBalance: () => <div data-testid="credit-balance-badge">350 credits</div>,
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
  IntegrationStatus: () => null,
}));

// Import component AFTER vi.mock declarations (vitest hoists mocks automatically)
import TenantAdminBillingPage from '../BillingPage';

// ---------- helpers ----------

function renderBillingPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/test-tenant/admin/billing']}>
        <TenantAdminBillingPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ---------- tests ----------

describe('BillingPage — Credit Package Cards open CreditPurchaseModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders credit package cards for free-tier users', () => {
    renderBillingPage();

    expect(screen.getByText('Credit Packages')).toBeInTheDocument();
    expect(screen.getByText('Pay As You Go')).toBeInTheDocument();
  });

  it('displays all CREDIT_PACKAGES from the config', () => {
    renderBillingPage();

    // CREDIT_PACKAGES: Quick Boost (500), Starter Pack (1,500), Growth Pack (5,000), Power Pack (15,000)
    expect(screen.getByText('500')).toBeInTheDocument();
    expect(screen.getByText('1,500')).toBeInTheDocument();
    expect(screen.getByText('5,000')).toBeInTheDocument();
    expect(screen.getByText('15,000')).toBeInTheDocument();
  });

  it('displays package prices correctly', () => {
    renderBillingPage();

    // Prices: priceCents / 100 = $19.99, $49.99, $129.99, $299.99
    expect(screen.getByText('$19.99')).toBeInTheDocument();
    expect(screen.getByText('$49.99')).toBeInTheDocument();
    expect(screen.getByText('$129.99')).toBeInTheDocument();
    expect(screen.getByText('$299.99')).toBeInTheDocument();
  });

  it('opens CreditPurchaseModal when clicking a credit package card', async () => {
    const user = userEvent.setup();
    renderBillingPage();

    // Modal should not be visible initially
    expect(screen.queryByText('Top Up Credits')).not.toBeInTheDocument();

    // Click the first credit package card (Quick Boost — 500 credits)
    const quickBoostCard = screen.getByText('500').closest('div[class*="cursor-pointer"]');
    expect(quickBoostCard).not.toBeNull();
    await user.click(quickBoostCard!);

    // Modal should now be visible
    expect(screen.getByText('Top Up Credits')).toBeInTheDocument();
    expect(screen.getByText('Purchase credits to continue using premium features.')).toBeInTheDocument();
  });

  it('opens CreditPurchaseModal when clicking any package card', async () => {
    const user = userEvent.setup();
    renderBillingPage();

    // Click the Growth Pack card (5,000 credits / $129.99)
    const growthPackCard = screen.getByText('$129.99').closest('div[class*="cursor-pointer"]');
    expect(growthPackCard).not.toBeNull();
    await user.click(growthPackCard!);

    // Modal should now show
    expect(screen.getByText('Top Up Credits')).toBeInTheDocument();
  });

  it('opens CreditPurchaseModal when clicking the "Buy Credits" button', async () => {
    const user = userEvent.setup();
    renderBillingPage();

    // The "Buy Credits" button in the Credit Balance section
    const buyCreditsButton = screen.getByRole('button', { name: /Buy Credits/i });
    await user.click(buyCreditsButton);

    expect(screen.getByText('Top Up Credits')).toBeInTheDocument();
  });

  it('CreditPurchaseModal shows all 4 package tiers with Buy Now buttons', async () => {
    const user = userEvent.setup();
    renderBillingPage();

    // Open the modal
    const buyCreditsButton = screen.getByRole('button', { name: /Buy Credits/i });
    await user.click(buyCreditsButton);

    // Modal packages from CreditPurchaseModal's internal PACKAGES constant
    expect(screen.getByText('Starter Pack')).toBeInTheDocument();
    expect(screen.getByText('Growth Pack')).toBeInTheDocument();
    expect(screen.getByText('Power Pack')).toBeInTheDocument();
    expect(screen.getByText('Enterprise Pack')).toBeInTheDocument();

    // 4 Buy Now buttons
    const buyButtons = screen.getAllByRole('button', { name: 'Buy Now' });
    expect(buyButtons).toHaveLength(4);
  });

  it('CreditPurchaseModal can be closed', async () => {
    const user = userEvent.setup();
    renderBillingPage();

    // Open modal
    const buyCreditsButton = screen.getByRole('button', { name: /Buy Credits/i });
    await user.click(buyCreditsButton);
    expect(screen.getByText('Top Up Credits')).toBeInTheDocument();

    // Close via the dialog close button (X button)
    const dialog = screen.getByRole('dialog');
    const closeButton = within(dialog).getByRole('button', { name: /close/i });
    await user.click(closeButton);

    // Modal should be gone
    expect(screen.queryByText('Top Up Credits')).not.toBeInTheDocument();
  });

  it('shows POPULAR badge on package with badge property', () => {
    renderBillingPage();

    // The Starter Pack in CREDIT_PACKAGES has badge: 'POPULAR'
    expect(screen.getByText('POPULAR')).toBeInTheDocument();
  });

  it('shows BEST VALUE badge on package with badge property', () => {
    renderBillingPage();

    // The Growth Pack in CREDIT_PACKAGES has badge: 'BEST VALUE'
    expect(screen.getByText('BEST VALUE')).toBeInTheDocument();
  });
});
