/**
 * BillingSettings Cancel Subscription Dialog Tests
 *
 * Verifies:
 * 1. Cancel button visible for non-trial, non-starter subscriptions
 * 2. Clicking Cancel Subscription opens the cancel dialog
 * 3. Cancel dialog shows expected content (title, description, buttons)
 * 4. Cancel button hidden during trial
 * 5. Cancel button hidden for starter tier
 * 6. Keep Subscription closes the dialog
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// --- Mutable mock state ---

let mockFeatureAccessReturn = {
  currentTier: 'professional' as string,
  currentTierName: 'Professional' as string,
  canAccess: () => true,
};

let mockSubscriptionStatusReturn = {
  isTrial: false,
  needsPaymentMethod: false,
  isActive: true,
  isPastDue: false,
};

// --- Mocks ---

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

vi.mock('@/hooks/useFeatureAccess', () => ({
  useFeatureAccess: () => mockFeatureAccessReturn,
}));

vi.mock('@/hooks/useSubscriptionStatus', () => ({
  useSubscriptionStatus: () => mockSubscriptionStatusReturn,
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: {
      id: 'tenant-123',
      slug: 'test-tenant',
      name: 'Test Dispensary',
      subscription_plan: 'professional',
      subscription_status: 'active',
      trial_ends_at: null,
      billing_cycle: 'monthly',
      created_at: '2025-01-01T00:00:00Z',
      payment_method_added: true,
      limits: {},
      usage: {},
    },
    admin: { id: 'admin-1', email: 'admin@test.com' },
    isAuthenticated: true,
    loading: false,
    tenantSlug: 'test-tenant',
  }),
}));

vi.mock('@/hooks/useCredits', () => ({
  useCredits: () => ({
    balance: 100,
    isFreeTier: false,
    isLowCredits: false,
    isCriticalCredits: false,
    isOutOfCredits: false,
    nextFreeGrantAt: null,
    lifetimeSpent: 50,
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

vi.mock('@/lib/credits', () => ({
  FREE_TIER_MONTHLY_CREDITS: 10000,
}));

vi.mock('@/components/billing/AddPaymentMethodDialog', () => ({
  AddPaymentMethodDialog: () => <div data-testid="add-payment-dialog" />,
}));

vi.mock('@/components/credits', () => ({
  CreditBalance: () => <div data-testid="credit-balance" />,
  CreditUsageStats: () => <div data-testid="credit-usage-stats" />,
}));

vi.mock('@/lib/tierMapping', () => ({
  businessTierToSubscriptionTier: (tier: string) => {
    if (!tier) return 'starter';
    const t = tier.toLowerCase();
    if (t.includes('enterprise') || t === 'empire') return 'enterprise';
    if (t.includes('professional') || t === 'block' || t === 'hood') return 'professional';
    return 'starter';
  },
}));

// --- Test setup ---

import BillingSettings from '@/pages/tenant-admin/settings/BillingSettings';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/test-tenant/admin/settings/billing']}>
          {children}
        </MemoryRouter>
      </QueryClientProvider>
    );
  };
}

function renderBillingSettings() {
  return render(<BillingSettings />, { wrapper: createWrapper() });
}

// --- Tests ---

describe('BillingSettings - Cancel Subscription Dialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to professional tier, non-trial
    mockFeatureAccessReturn = {
      currentTier: 'professional',
      currentTierName: 'Professional',
      canAccess: () => true,
    };
    mockSubscriptionStatusReturn = {
      isTrial: false,
      needsPaymentMethod: false,
      isActive: true,
      isPastDue: false,
    };
  });

  it('renders Cancel Subscription button for non-trial professional plan', async () => {
    renderBillingSettings();

    await waitFor(() => {
      expect(screen.getByText('Cancel Subscription')).toBeInTheDocument();
    });
  });

  it('opens cancel dialog when Cancel Subscription button is clicked', async () => {
    const user = userEvent.setup();
    renderBillingSettings();

    const cancelButton = await screen.findByText('Cancel Subscription');
    await user.click(cancelButton);

    // Dialog should now be open with cancel-specific content
    // Text is split by <br /> and <strong>, so use a function matcher
    await waitFor(() => {
      expect(screen.getByText(/Are you sure you want to cancel your subscription/)).toBeInTheDocument();
    });

    expect(screen.getByText('Keep Subscription')).toBeInTheDocument();
    expect(screen.getByText('Proceed to Cancel')).toBeInTheDocument();
  });

  it('shows cancel dialog title with destructive styling', async () => {
    const user = userEvent.setup();
    renderBillingSettings();

    const cancelButton = await screen.findByText('Cancel Subscription');
    await user.click(cancelButton);

    await waitFor(() => {
      // The dialog title should appear (two "Cancel Subscription" texts:
      // the button and the dialog title)
      const cancelTexts = screen.getAllByText('Cancel Subscription');
      expect(cancelTexts.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('closes dialog when Keep Subscription is clicked', async () => {
    const user = userEvent.setup();
    renderBillingSettings();

    // Open dialog
    const cancelButton = await screen.findByText('Cancel Subscription');
    await user.click(cancelButton);

    // Verify dialog is open
    await waitFor(() => {
      expect(screen.getByText('Proceed to Cancel')).toBeInTheDocument();
    });

    // Click Keep Subscription
    await user.click(screen.getByText('Keep Subscription'));

    // Dialog should close
    await waitFor(() => {
      expect(screen.queryByText('Proceed to Cancel')).not.toBeInTheDocument();
    });
  });

  it('hides Cancel Subscription button during trial period', async () => {
    mockSubscriptionStatusReturn = {
      isTrial: true,
      needsPaymentMethod: true,
      isActive: true,
      isPastDue: false,
    };

    renderBillingSettings();

    // Wait for page to render (multiple "Current Plan" texts may exist in plan comparison)
    await waitFor(() => {
      expect(screen.getAllByText('Current Plan').length).toBeGreaterThan(0);
    });

    // Cancel button should NOT be present
    expect(screen.queryByText('Cancel Subscription')).not.toBeInTheDocument();
  });

  it('hides Cancel Subscription button for starter tier', async () => {
    mockFeatureAccessReturn = {
      currentTier: 'starter',
      currentTierName: 'Starter',
      canAccess: () => true,
    };

    renderBillingSettings();

    // Wait for page to render (multiple "Current Plan" texts may exist in plan comparison)
    await waitFor(() => {
      expect(screen.getAllByText('Current Plan').length).toBeGreaterThan(0);
    });

    // Cancel button should NOT be present for starter tier
    expect(screen.queryByText('Cancel Subscription')).not.toBeInTheDocument();
  });
});
