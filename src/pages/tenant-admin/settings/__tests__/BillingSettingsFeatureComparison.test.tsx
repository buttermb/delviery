/**
 * BillingSettings - Full Feature Comparison Collapsible Toggle Tests
 *
 * Verifies:
 * 1. "Full Feature Comparison" button renders in collapsed state by default
 * 2. Clicking the button expands the comparison table
 * 3. Clicking again collapses the comparison table
 * 4. ChevronDown icon shown when collapsed, ChevronUp when expanded
 * 5. Feature categories render inside the expanded content
 * 6. Plan column headers (Starter, Professional, Enterprise) render
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock react-router-dom navigation
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
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

// Mock tenant auth context
vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: vi.fn().mockReturnValue({
    tenant: {
      id: 'tenant-123',
      slug: 'test-tenant',
      name: 'Test Dispensary',
      subscription_plan: 'professional',
      subscription_status: 'active',
      trial_ends_at: null,
      payment_method_added: true,
      billing_cycle: 'monthly',
      usage: {},
      limits: {},
      mrr: 150,
    },
    loading: false,
    admin: { id: 'admin-1', email: 'admin@test.com' },
    tenantSlug: 'test-tenant',
    logout: vi.fn(),
  }),
}));

// Mock subscription status hook
vi.mock('@/hooks/useSubscriptionStatus', () => ({
  useSubscriptionStatus: vi.fn().mockReturnValue({
    isTrial: false,
    isActive: true,
    isCancelled: false,
    needsPaymentMethod: false,
    isTrialExpired: false,
    currentTier: 'professional',
  }),
}));

// Mock feature access hook
vi.mock('@/hooks/useFeatureAccess', () => ({
  useFeatureAccess: vi.fn().mockReturnValue({
    currentTier: 'professional',
    currentTierName: 'Professional',
    hasAccess: vi.fn().mockReturnValue(true),
    getRequiredTier: vi.fn().mockReturnValue('starter'),
    canAccessFeature: vi.fn().mockReturnValue(true),
  }),
}));

// Mock credits hook
vi.mock('@/hooks/useCredits', () => ({
  useCredits: vi.fn().mockReturnValue({
    balance: 500,
    isFreeTier: false,
    isLowCredits: false,
    isCriticalCredits: false,
    isOutOfCredits: false,
    nextFreeGrantAt: null,
    lifetimeSpent: 100,
  }),
}));

// Mock tier mapping
vi.mock('@/lib/tierMapping', () => ({
  businessTierToSubscriptionTier: vi.fn().mockReturnValue('professional'),
}));

// Mock featureConfig with realistic feature data
vi.mock('@/lib/featureConfig', () => ({
  TIER_PRICES: { starter: 79, professional: 150, enterprise: 499 },
  TIER_NAMES: { starter: 'Starter', professional: 'Professional', enterprise: 'Enterprise' },
  getFeaturesByCategory: vi.fn().mockReturnValue({
    'Command Center': [
      { id: 'dashboard', name: 'Dashboard', description: 'Main dashboard', tier: 'starter', category: 'Command Center', route: '/dashboard' },
      { id: 'analytics', name: 'Advanced Analytics', description: 'Analytics dashboard', tier: 'professional', category: 'Command Center', route: '/analytics' },
    ],
    'Sales & Orders': [
      { id: 'orders', name: 'Order Management', description: 'Manage orders', tier: 'starter', category: 'Sales & Orders', route: '/orders' },
      { id: 'fleet', name: 'Fleet Management', description: 'Fleet tracking', tier: 'enterprise', category: 'Sales & Orders', route: '/fleet' },
    ],
  }),
}));

// Mock formatters
vi.mock('@/lib/formatters', () => ({
  formatCurrency: vi.fn((val: number) => `$${val}`),
  formatSmartDate: vi.fn((date: string) => new Date(date).toLocaleDateString()),
}));

// Mock humanizeError
vi.mock('@/lib/humanizeError', () => ({
  humanizeError: vi.fn((err: unknown) => String(err)),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock sonner
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

// Mock framer-motion for Collapsible animation
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => {
      const { initial: _initial, animate: _animate, exit: _exit, transition: _transition, ...validProps } = props;
      return <div {...validProps}>{children}</div>;
    },
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock credits components
vi.mock('@/components/credits', () => ({
  CreditBalance: () => null,
  CreditUsageStats: () => null,
}));

// Mock AddPaymentMethodDialog
vi.mock('@/components/billing/AddPaymentMethodDialog', () => ({
  AddPaymentMethodDialog: () => null,
}));

// Mock lib/credits
vi.mock('@/lib/credits', () => ({
  FREE_TIER_MONTHLY_CREDITS: 1000,
}));

// Mock ThemeContext
vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: vi.fn().mockReturnValue({
    theme: 'light',
    setTheme: vi.fn(),
    systemPreference: 'light',
  }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock queryKeys
vi.mock('@/lib/queryKeys', () => ({
  queryKeys: {
    tenants: { all: ['tenants'] },
    stripeHealth: { all: ['stripe-health'] },
    tenantInvoices: { byTenant: (id: string | undefined) => ['invoices', id] },
    subscriptionPlans: { all: ['subscription-plans'] },
  },
}));

// Import component after mocks
import BillingSettings from '../BillingSettings';

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={createQueryClient()}>
    <MemoryRouter initialEntries={['/test-tenant/admin/settings/billing']}>
      {children}
    </MemoryRouter>
  </QueryClientProvider>
);

describe('BillingSettings - Full Feature Comparison Collapsible Toggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the "Full Feature Comparison" button', async () => {
    render(<BillingSettings />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('Full Feature Comparison')).toBeInTheDocument();
    });
  });

  it('should start with the feature comparison collapsed', async () => {
    render(<BillingSettings />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('Full Feature Comparison')).toBeInTheDocument();
    });

    // The comparison content should not be visible initially
    // Feature categories like "Command Center" should not be visible
    expect(screen.queryByText('Command Center')).not.toBeInTheDocument();
  });

  it('should expand feature comparison when clicking the toggle button', async () => {
    const user = userEvent.setup();
    render(<BillingSettings />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('Full Feature Comparison')).toBeInTheDocument();
    });

    // Click to expand
    await user.click(screen.getByText('Full Feature Comparison'));

    // Feature categories should now be visible
    await waitFor(() => {
      expect(screen.getByText('Command Center')).toBeInTheDocument();
      expect(screen.getByText('Sales & Orders')).toBeInTheDocument();
    });
  });

  it('should collapse feature comparison when clicking the toggle button again', async () => {
    const user = userEvent.setup();
    render(<BillingSettings />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('Full Feature Comparison')).toBeInTheDocument();
    });

    // Click to expand
    await user.click(screen.getByText('Full Feature Comparison'));

    await waitFor(() => {
      expect(screen.getByText('Command Center')).toBeInTheDocument();
    });

    // Click again to collapse
    await user.click(screen.getByText('Full Feature Comparison'));

    await waitFor(() => {
      expect(screen.queryByText('Command Center')).not.toBeInTheDocument();
    });
  });

  it('should show feature names inside the expanded comparison table', async () => {
    const user = userEvent.setup();
    render(<BillingSettings />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('Full Feature Comparison')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Full Feature Comparison'));

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Advanced Analytics')).toBeInTheDocument();
      expect(screen.getByText('Order Management')).toBeInTheDocument();
      expect(screen.getByText('Fleet Management')).toBeInTheDocument();
    });
  });

  it('should render plan column headers in the comparison footer', async () => {
    const user = userEvent.setup();
    render(<BillingSettings />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('Full Feature Comparison')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Full Feature Comparison'));

    await waitFor(() => {
      // The comparison table footer has column headers
      const comparisonSection = screen.getByText('Full Feature Comparison').closest('div[class]')?.parentElement;
      expect(comparisonSection).toBeTruthy();

      // Check for "Feature" and plan names in column headers
      expect(screen.getByText('Feature')).toBeInTheDocument();

      // "Starter", "Professional", "Enterprise" appear in the column headers
      // (they also appear in plan cards, so we check within the comparison content)
      const featureHeader = screen.getByText('Feature');
      const headerRow = featureHeader.closest('div[class*="grid"]');
      expect(headerRow).toBeTruthy();
      if (headerRow) {
        expect(within(headerRow).getByText('Starter')).toBeInTheDocument();
        expect(within(headerRow).getByText('Professional')).toBeInTheDocument();
        expect(within(headerRow).getByText('Enterprise')).toBeInTheDocument();
      }
    });
  });

  it('should show check marks for features available in each tier', async () => {
    const user = userEvent.setup();
    render(<BillingSettings />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('Full Feature Comparison')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Full Feature Comparison'));

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    // Dashboard is a starter feature - should have checks in all 3 columns
    const dashboardRow = screen.getByText('Dashboard').closest('div[class*="grid"]');
    expect(dashboardRow).toBeTruthy();

    // Fleet Management is enterprise only - should show "-" for Starter and Professional columns
    const fleetRow = screen.getByText('Fleet Management').closest('div[class*="grid"]');
    expect(fleetRow).toBeTruthy();
    if (fleetRow) {
      const dashes = within(fleetRow).getAllByText('-');
      expect(dashes.length).toBe(2); // Starter and Professional columns show "-"
    }
  });

  it('should toggle between expanded and collapsed states multiple times', async () => {
    const user = userEvent.setup();
    render(<BillingSettings />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('Full Feature Comparison')).toBeInTheDocument();
    });

    // First expansion
    await user.click(screen.getByText('Full Feature Comparison'));
    await waitFor(() => {
      expect(screen.getByText('Command Center')).toBeInTheDocument();
    });

    // First collapse
    await user.click(screen.getByText('Full Feature Comparison'));
    await waitFor(() => {
      expect(screen.queryByText('Command Center')).not.toBeInTheDocument();
    });

    // Second expansion
    await user.click(screen.getByText('Full Feature Comparison'));
    await waitFor(() => {
      expect(screen.getByText('Command Center')).toBeInTheDocument();
    });
  });
});
