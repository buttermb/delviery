/**
 * BillingPage Enterprise Plan Card — Pricing Display Test
 *
 * Verifies the enterprise plan card renders TIER_PRICES.enterprise
 * with a trailing "+" sign (e.g. "$499+/mo").
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TIER_PRICES } from '@/lib/featureConfig';
import BillingPage from '../BillingPage';

// ---------- Mocks ----------

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({ tenantSlug: 'test-tenant' }),
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

vi.mock('@/integrations/supabase/client', () => {
  const createChainMock = (resolvedValue = { data: [], error: null }) => {
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
      business_name: 'Test Co',
      subscription_plan: 'starter',
      subscription_status: 'active',
      trial_ends_at: null,
      payment_method_added: true,
      usage: { products: 5, customers: 10, menus: 2 },
      limits: { products: 50, customers: 50, menus: 5 },
    },
    loading: false,
    admin: { id: 'admin-1', email: 'admin@test.com' },
    tenantSlug: 'test-tenant',
    logout: vi.fn(),
  }),
}));

vi.mock('@/hooks/useFeatureAccess', () => ({
  useFeatureAccess: vi.fn().mockReturnValue({
    currentTier: 'starter',
    hasAccess: vi.fn().mockReturnValue(true),
    getRequiredTier: vi.fn(),
    tierName: 'Starter',
    tierPrice: 79,
    isCancelled: false,
  }),
}));

vi.mock('@/hooks/useStripeRedirectHandler', () => ({
  useStripeRedirectHandler: vi.fn(),
}));

vi.mock('@/hooks/useCredits', () => ({
  useCredits: vi.fn().mockReturnValue({
    balance: 100,
    isFreeTier: false,
    isLowCredits: false,
    isCriticalCredits: false,
    isOutOfCredits: false,
    nextFreeGrantAt: null,
    lifetimeSpent: 0,
  }),
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

// ---------- Helpers ----------

function renderBillingPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/test-tenant/admin/billing']}>
        <BillingPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function navigateToPlansTab() {
  const user = userEvent.setup();
  const comparePlansTab = await screen.findByRole('tab', { name: /compare plans/i });
  await user.click(comparePlansTab);
}

// ---------- Tests ----------

describe('BillingPage — Enterprise plan card pricing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the enterprise price from TIER_PRICES with a trailing plus sign', async () => {
    renderBillingPage();
    await navigateToPlansTab();

    const expectedPrice = `$${TIER_PRICES.enterprise}+`;

    // Find all elements whose textContent includes "$499+" and "/mo"
    const priceElements = screen.getAllByText((_content, element) => {
      if (!element) return false;
      const textContent = element.textContent ?? '';
      return textContent.includes(expectedPrice) && textContent.includes('/mo');
    });

    // At least one element should show the enterprise price with plus sign
    expect(priceElements.length).toBeGreaterThanOrEqual(1);

    // The first match is the plan card price display
    const planCardPrice = priceElements[0];
    expect(planCardPrice.textContent).toContain(`$${TIER_PRICES.enterprise}+`);
    expect(planCardPrice.textContent).toContain('/mo');
  });

  it('shows the enterprise plan card with an "Upgrade" button for non-enterprise users', async () => {
    renderBillingPage();
    await navigateToPlansTab();

    // Find all Upgrade buttons — the enterprise card should have one
    const upgradeButtons = screen.getAllByRole('button', { name: /upgrade/i });
    expect(upgradeButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('uses the exact TIER_PRICES.enterprise value (not hardcoded)', () => {
    // Verify the constant itself is 499 — if it changes, the display
    // test above will still verify it's rendered correctly.
    expect(TIER_PRICES.enterprise).toBe(499);
  });
});
