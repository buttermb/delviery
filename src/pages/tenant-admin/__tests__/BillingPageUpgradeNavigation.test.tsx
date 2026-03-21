/**
 * BillingPage "Upgrade for Unlimited" Navigation Test
 *
 * Verifies that clicking the "Upgrade for Unlimited" button on the
 * BillingPage navigates free-tier users to the select-plan page.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';

// --- Mocks ---

vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock tenant auth context
const mockTenant = {
  id: 'tenant-123',
  slug: 'test-dispensary',
  subscription_plan: 'free',
  subscription_status: 'active',
  payment_method_added: false,
  trial_ends_at: null,
  limits: {},
  usage: {},
};

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: mockTenant,
    admin: { email: 'admin@test.com', userId: 'user-123', role: 'owner' },
    token: 'valid-token',
    loading: false,
    isAuthenticated: true,
    tenantSlug: 'test-dispensary',
    login: vi.fn(),
    logout: vi.fn(),
    refreshAuthToken: vi.fn(),
    refreshTenant: vi.fn(),
    mfaRequired: false,
    mfaFactorId: null,
    verifyMfa: vi.fn(),
  }),
}));

// Mock useFeatureAccess to return free tier
vi.mock('@/hooks/useFeatureAccess', () => ({
  useFeatureAccess: () => ({
    currentTier: 'street',
    hasAccess: vi.fn().mockReturnValue(false),
    checkFeature: vi.fn().mockReturnValue(false),
    isLoading: false,
  }),
}));

// Mock useCredits to show free tier state
vi.mock('@/hooks/useCredits', () => ({
  useCredits: () => ({
    balance: 5000,
    isFreeTier: true,
    isLowCredits: false,
    isCriticalCredits: false,
    isOutOfCredits: false,
    nextFreeGrantAt: null,
    lifetimeSpent: 0,
    isLoading: false,
    hasCredits: true,
  }),
}));

// Mock useStripeRedirectHandler
vi.mock('@/hooks/useStripeRedirectHandler', () => ({
  useStripeRedirectHandler: vi.fn(),
}));

// Mock supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: { configured: true, valid: true }, error: null }),
    },
  },
}));

// Mock tierMapping
vi.mock('@/lib/tierMapping', () => ({
  businessTierToSubscriptionTier: () => 'starter',
}));

// Mock featureConfig
vi.mock('@/lib/featureConfig', () => ({
  TIER_NAMES: { starter: 'Starter', professional: 'Professional', enterprise: 'Enterprise' },
  TIER_PRICES: { starter: 79, professional: 199, enterprise: 499 },
  getFeaturesByCategory: () => ({}),
}));

// Mock credits config
vi.mock('@/lib/credits', () => ({
  FREE_TIER_MONTHLY_CREDITS: 10000,
  CREDIT_PACKAGES: [
    { id: 'pack-1', credits: 1000, priceCents: 999, badge: null },
  ],
  LOW_BALANCE_WARNING_LEVELS: [2000, 1000, 500, 100],
}));

// Mock formatters
vi.mock('@/lib/utils/formatCurrency', () => ({
  formatCurrency: (val: number) => `$${val}`,
}));

vi.mock('@/lib/formatters', () => ({
  formatSmartDate: (date: string) => date,
}));

// Mock queryKeys
vi.mock('@/lib/queryKeys', () => ({
  queryKeys: {
    stripeHealth: { all: ['stripe-health'] },
    tenantInvoices: { byTenant: (id: string) => ['tenant-invoices', id] },
    subscriptionPlans: { all: ['subscription-plans'] },
    superAdminTenantDetail: { subscriptionPlan: (plan: string) => ['subscription-plan', plan] },
    tenants: { all: ['tenants'] },
  },
}));

// Mock CreditBalance component
vi.mock('@/components/credits/CreditBalance', () => ({
  CreditBalance: () => <div data-testid="credit-balance-badge">Balance</div>,
}));

// Mock CreditPurchaseModal
vi.mock('@/components/credits/CreditPurchaseModal', () => ({
  CreditPurchaseModal: () => null,
}));

// Mock TrialBanner & TrialCountdown
vi.mock('@/components/tenant-admin/TrialBanner', () => ({
  TrialBanner: () => null,
}));

vi.mock('@/components/tenant-admin/TrialCountdown', () => ({
  TrialCountdown: () => null,
}));

// Mock AddPaymentMethodDialog
vi.mock('@/components/billing/AddPaymentMethodDialog', () => ({
  AddPaymentMethodDialog: () => null,
}));

// Mock IntegrationStatus
vi.mock('@/components/integrations/IntegrationStatus', () => ({
  IntegrationStatus: () => null,
}));

// --- Helpers ---

function LocationDisplay() {
  const location = useLocation();
  return (
    <div data-testid="location-display">
      <span data-testid="location-pathname">{location.pathname}</span>
    </div>
  );
}

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

function TestWrapper({ children, initialEntries }: { children: ReactNode; initialEntries: string[] }) {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        {children}
        <LocationDisplay />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

// Import component after mocks
import TenantAdminBillingPage from '../BillingPage';

// --- Tests ---

describe('BillingPage - Upgrade for Unlimited navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the "Upgrade for Unlimited" button for free-tier users', async () => {
    render(
      <TestWrapper initialEntries={['/test-dispensary/admin/billing']}>
        <Routes>
          <Route path="/:tenantSlug/admin/billing" element={<TenantAdminBillingPage />} />
          <Route path="/:tenantSlug/admin/select-plan" element={<div data-testid="select-plan-page">Select Plan</div>} />
        </Routes>
      </TestWrapper>
    );

    await waitFor(() => {
      const upgradeButton = screen.getByRole('button', { name: /upgrade for unlimited/i });
      expect(upgradeButton).toBeInTheDocument();
    });
  });

  it('should navigate to select-plan page when "Upgrade for Unlimited" is clicked', async () => {
    render(
      <TestWrapper initialEntries={['/test-dispensary/admin/billing']}>
        <Routes>
          <Route path="/:tenantSlug/admin/billing" element={<TenantAdminBillingPage />} />
          <Route path="/:tenantSlug/admin/select-plan" element={<div data-testid="select-plan-page">Select Plan</div>} />
        </Routes>
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /upgrade for unlimited/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /upgrade for unlimited/i }));

    await waitFor(() => {
      const pathname = screen.getByTestId('location-pathname');
      expect(pathname.textContent).toBe('/test-dispensary/admin/select-plan');
    });
  });

  it('should use tenant slug in the navigation path', async () => {
    render(
      <TestWrapper initialEntries={['/test-dispensary/admin/billing']}>
        <Routes>
          <Route path="/:tenantSlug/admin/billing" element={<TenantAdminBillingPage />} />
          <Route path="/:tenantSlug/admin/select-plan" element={<div data-testid="select-plan-page">Select Plan</div>} />
        </Routes>
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /upgrade for unlimited/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /upgrade for unlimited/i }));

    await waitFor(() => {
      const pathname = screen.getByTestId('location-pathname');
      // Verify the path includes the tenant slug, not a hardcoded route
      expect(pathname.textContent).toContain('/test-dispensary/');
      expect(pathname.textContent).toContain('/admin/select-plan');
    });
  });

  it('should render the select-plan page after navigation', async () => {
    render(
      <TestWrapper initialEntries={['/test-dispensary/admin/billing']}>
        <Routes>
          <Route path="/:tenantSlug/admin/billing" element={<TenantAdminBillingPage />} />
          <Route path="/:tenantSlug/admin/select-plan" element={<div data-testid="select-plan-page">Select Plan</div>} />
        </Routes>
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /upgrade for unlimited/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /upgrade for unlimited/i }));

    await waitFor(() => {
      expect(screen.getByTestId('select-plan-page')).toBeInTheDocument();
    });
  });
});
