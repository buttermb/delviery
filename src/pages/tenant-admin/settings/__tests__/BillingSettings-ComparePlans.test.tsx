/**
 * BillingSettings "Compare plans" link tests
 *
 * Verifies the "Compare plans" link in usage meters:
 * - Appears when resource usage >= 80% and tier is not enterprise
 * - Hidden when usage < 80%
 * - Hidden on enterprise tier
 * - Clicking it opens the feature comparison section
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import BillingSettings from '../BillingSettings';

// --- Mutable mock state ---
let mockTenant: Record<string, unknown> = {};
let mockCurrentTier = 'professional';
let mockCurrentTierName = 'Professional';
let mockIsTrial = false;
let mockNeedsPaymentMethod = false;
let mockCreditBalance = 5000;
let mockIsFreeTier = false;

// --- Mocks ---
vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: mockTenant,
    tenantSlug: 'test-tenant',
  }),
}));

vi.mock('@/hooks/useFeatureAccess', () => ({
  useFeatureAccess: () => ({
    canAccess: () => true,
    currentTier: mockCurrentTier,
    currentTierName: mockCurrentTierName,
    currentTierPrice: 150,
    subscriptionValid: true,
    isTrialExpired: false,
    isSuspended: false,
    isCancelled: false,
    isPastDue: false,
  }),
}));

vi.mock('@/hooks/useSubscriptionStatus', () => ({
  useSubscriptionStatus: () => ({
    isTrial: mockIsTrial,
    needsPaymentMethod: mockNeedsPaymentMethod,
    isFreeTier: mockIsFreeTier,
    isActive: true,
    isSuspended: false,
    isCancelled: false,
    isPastDue: false,
    hasActiveSubscription: true,
  }),
}));

vi.mock('@/hooks/useCredits', () => ({
  useCredits: () => ({
    balance: mockCreditBalance,
    isFreeTier: mockIsFreeTier,
    isLoading: false,
    isLowCredits: false,
    isCriticalCredits: false,
    isOutOfCredits: false,
    nextFreeGrantAt: null,
    lifetimeSpent: 0,
    refetch: vi.fn(),
    canPerformAction: vi.fn(),
    performAction: vi.fn(),
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: { configured: true, valid: true }, error: null }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    }),
  },
}));

vi.mock('@/lib/tierMapping', () => ({
  businessTierToSubscriptionTier: (tier: string) => {
    const map: Record<string, string> = {
      street: 'starter', trap: 'starter',
      block: 'professional', hood: 'professional',
      empire: 'enterprise',
      starter: 'starter', professional: 'professional', enterprise: 'enterprise',
    };
    return map[tier] || 'starter';
  },
}));

vi.mock('@/lib/featureConfig', () => ({
  TIER_PRICES: { starter: 79, professional: 150, enterprise: 499 },
  TIER_NAMES: { starter: 'Starter', professional: 'Professional', enterprise: 'Enterprise' },
  getFeaturesByCategory: () => ({
    'Core': [
      { name: 'Dashboard', tier: 'starter' },
      { name: 'Analytics', tier: 'professional' },
    ],
  }),
}));

vi.mock('@/lib/formatters', () => ({
  formatCurrency: (v: number) => `$${v}`,
  formatSmartDate: (d: string | Date) => typeof d === 'string' ? d : d.toISOString(),
}));

vi.mock('@/lib/humanizeError', () => ({
  humanizeError: (e: unknown) => String(e),
}));

vi.mock('@/lib/credits', () => ({
  FREE_TIER_MONTHLY_CREDITS: 500,
}));

vi.mock('@/components/billing/AddPaymentMethodDialog', () => ({
  AddPaymentMethodDialog: () => null,
}));

vi.mock('@/components/credits', () => ({
  CreditBalance: () => null,
  CreditUsageStats: () => null,
}));

vi.mock('@/lib/queryKeys', () => ({
  queryKeys: {
    tenants: { all: ['tenants'] },
    stripeHealth: { all: ['stripeHealth'] },
    tenantInvoices: { byTenant: (id: string) => ['invoices', id] },
    subscriptionPlans: { all: ['subscriptionPlans'] },
  },
}));

// --- Helpers ---
function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function renderBillingSettings() {
  const queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <BillingSettings />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// --- Tests ---
describe('BillingSettings "Compare plans" link', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: professional tier with 80%+ usage on one resource
    mockCurrentTier = 'professional';
    mockCurrentTierName = 'Professional';
    mockIsTrial = false;
    mockNeedsPaymentMethod = false;
    mockCreditBalance = 5000;
    mockIsFreeTier = false;
    mockTenant = {
      id: 'tenant-1',
      slug: 'test-tenant',
      name: 'Test Dispensary',
      subscription_plan: 'professional',
      billing_cycle: 'monthly',
      created_at: '2025-01-01T00:00:00Z',
      payment_method_added: true,
      limits: { customers: 500, products: 1000 },
      usage: { customers: 450, products: 200 },
    };
  });

  it('shows "Compare plans" link when usage >= 80%', () => {
    renderBillingSettings();

    expect(screen.getByText('Compare plans')).toBeInTheDocument();
  });

  it('shows upgrade prompt text alongside the link', () => {
    renderBillingSettings();

    expect(screen.getByText(/Running low! Consider upgrading for more capacity/)).toBeInTheDocument();
  });

  it('does not show "Compare plans" when all usage is below 80%', () => {
    mockTenant = {
      ...mockTenant,
      usage: { customers: 100, products: 100 },
    };

    renderBillingSettings();

    expect(screen.queryByText('Compare plans')).not.toBeInTheDocument();
  });

  it('does not show "Compare plans" on enterprise tier', () => {
    mockCurrentTier = 'enterprise';
    mockCurrentTierName = 'Enterprise';
    mockTenant = {
      ...mockTenant,
      subscription_plan: 'enterprise',
      limits: { customers: -1, products: -1 },
      usage: { customers: 9999, products: 9999 },
    };

    renderBillingSettings();

    expect(screen.queryByText('Compare plans')).not.toBeInTheDocument();
  });

  it('does not show "Compare plans" when limits are unlimited (-1)', () => {
    mockTenant = {
      ...mockTenant,
      limits: { customers: -1, products: -1 },
      usage: { customers: 9999, products: 9999 },
    };

    renderBillingSettings();

    expect(screen.queryByText('Compare plans')).not.toBeInTheDocument();
  });

  it('opens feature comparison section when "Compare plans" is clicked', () => {
    renderBillingSettings();

    // Feature comparison should be collapsed initially
    expect(screen.queryByText('Core')).not.toBeInTheDocument();

    // Click "Compare plans"
    fireEvent.click(screen.getByText('Compare plans'));

    // The collapsible should now be open, showing feature categories
    expect(screen.getByText('Core')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('shows "Compare plans" for each resource at >= 80% usage', () => {
    mockTenant = {
      ...mockTenant,
      limits: { customers: 500, products: 1000, menus: 10 },
      usage: { customers: 450, products: 900, menus: 2 },
    };

    renderBillingSettings();

    // Two resources at >= 80% => two "Compare plans" links
    const links = screen.getAllByText('Compare plans');
    expect(links).toHaveLength(2);
  });

  it('shows "Compare plans" on starter tier when usage is high', () => {
    mockCurrentTier = 'starter';
    mockCurrentTierName = 'Starter';
    mockTenant = {
      ...mockTenant,
      subscription_plan: 'starter',
      limits: { customers: 50 },
      usage: { customers: 45 },
    };

    renderBillingSettings();

    expect(screen.getByText('Compare plans')).toBeInTheDocument();
  });

  it('does not show usage meters when tenant has no limits', () => {
    mockTenant = {
      ...mockTenant,
      limits: {},
      usage: {},
    };

    renderBillingSettings();

    expect(screen.queryByText('Usage This Month')).not.toBeInTheDocument();
    expect(screen.queryByText('Compare plans')).not.toBeInTheDocument();
  });
});
