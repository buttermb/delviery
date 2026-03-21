/**
 * BillingPage Starter Plan Pricing Tests
 *
 * Verifies the starter plan card on the BillingPage displays
 * the correct price from TIER_PRICES.starter ($79/mo).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TIER_PRICES } from '@/lib/featureConfig';

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

// Mock supabase client
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
      subscription_plan: 'starter',
      subscription_status: 'active',
      trial_ends_at: null,
      payment_method_added: true,
      usage: { products: 10, customers: 20, menus: 2 },
      limits: { products: 100, customers: 50, menus: 3 },
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
    hasAccess: vi.fn().mockReturnValue(true),
    isSubscriptionValid: vi.fn().mockReturnValue(true),
    getTierFeatures: vi.fn().mockReturnValue([]),
    getFeaturesByCategory: vi.fn().mockReturnValue({}),
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
    lifetimeSpent: 50,
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

// Import after mocks
import TenantAdminBillingPage from '@/pages/tenant-admin/BillingPage';

let queryClient: QueryClient;

function renderBillingPage() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <TenantAdminBillingPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('BillingPage Starter Plan Pricing', () => {
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    vi.clearAllMocks();
  });

  it('renders the starter plan price from TIER_PRICES.starter', async () => {
    renderBillingPage();

    // Navigate to Compare Plans tab
    const plansTab = await screen.findByRole('tab', { name: /plans/i });
    await userEvent.click(plansTab);

    // Verify the starter price is displayed correctly using the TIER_PRICES constant
    await waitFor(() => {
      const priceText = `$${TIER_PRICES.starter}`;
      expect(screen.getByText((_content, element) => {
        return element?.textContent?.includes(priceText) === true &&
               element?.textContent?.includes('/mo') === true &&
               element?.classList?.contains('font-bold') === true;
      })).toBeInTheDocument();
    });
  });

  it('displays starter plan price as $79/mo', async () => {
    renderBillingPage();

    // Navigate to Compare Plans tab
    const plansTab = await screen.findByRole('tab', { name: /plans/i });
    await userEvent.click(plansTab);

    // The starter card should show $79/mo (TIER_PRICES.starter = 79)
    await waitFor(() => {
      // Find the element that contains "$79" and "/mo"
      const priceElements = screen.getAllByText((_content, element) => {
        const text = element?.textContent || '';
        return text.includes('$79') && text.includes('/mo');
      });
      expect(priceElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('TIER_PRICES.starter matches the hardcoded value in the test', () => {
    // This ensures the constant hasn't been accidentally changed
    expect(TIER_PRICES.starter).toBe(79);
  });

  it('shows "Current Plan" badge when user is on starter tier', async () => {
    renderBillingPage();

    // Navigate to Compare Plans tab
    const plansTab = await screen.findByRole('tab', { name: /plans/i });
    await userEvent.click(plansTab);

    await waitFor(() => {
      expect(screen.getByText('Current')).toBeInTheDocument();
    });
  });

  it('shows "Current Plan" button for starter plan when user is on starter tier', async () => {
    renderBillingPage();

    // Navigate to Compare Plans tab
    const plansTab = await screen.findByRole('tab', { name: /plans/i });
    await userEvent.click(plansTab);

    await waitFor(() => {
      const currentPlanButtons = screen.getAllByText('Current Plan');
      expect(currentPlanButtons.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('displays the starter plan title as a heading', async () => {
    renderBillingPage();

    // Navigate to Compare Plans tab
    const plansTab = await screen.findByRole('tab', { name: /plans/i });
    await userEvent.click(plansTab);

    await waitFor(() => {
      // Find specifically the CardTitle heading with "Starter"
      const starterHeadings = screen.getAllByText('Starter');
      const headingElement = starterHeadings.find(
        (el) => el.tagName === 'H3' && el.classList.contains('text-2xl')
      );
      expect(headingElement).toBeDefined();
    });
  });
});
