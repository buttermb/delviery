/**
 * BillingSettings Plan Card Buttons Tests
 * Verifies that plan card buttons call handlePlanChange correctly
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { SubscriptionTier } from '@/lib/featureConfig';

// --- Mutable mock state ---

let mockCurrentTier: SubscriptionTier = 'starter';

const mockTenant: Record<string, unknown> = {
  id: 'tenant-123',
  name: 'Test Dispensary',
  slug: 'test-dispensary',
  created_at: '2025-01-01T00:00:00Z',
  payment_method_added: true,
  billing_cycle: 'monthly',
  subscription_plan: 'starter',
  subscription_status: 'active',
  trial_ends_at: null,
  is_free_tier: false,
  mrr: 79,
  limits: {},
  usage: {},
};

// --- Mocks (must be before component import) ---

const mockToastInfo = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    info: (...args: unknown[]) => mockToastInfo(...args),
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/humanizeError', () => ({
  humanizeError: (err: unknown) => String(err),
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: mockTenant,
    tenantId: mockTenant.id,
    isAuthenticated: true,
    loading: false,
  }),
}));

vi.mock('@/hooks/useFeatureAccess', () => ({
  useFeatureAccess: () => ({
    currentTier: mockCurrentTier,
    currentTierName: mockCurrentTier.charAt(0).toUpperCase() + mockCurrentTier.slice(1),
    currentTierPrice: { starter: 79, professional: 150, enterprise: 499 }[mockCurrentTier],
    canAccess: () => true,
    checkUpgrade: () => ({ required: false, targetTier: null, priceDifference: 0 }),
    getTierDisplayInfo: () => ({
      name: mockCurrentTier.charAt(0).toUpperCase() + mockCurrentTier.slice(1),
      price: { starter: 79, professional: 150, enterprise: 499 }[mockCurrentTier],
    }),
  }),
}));

vi.mock('@/hooks/useSubscriptionStatus', () => ({
  useSubscriptionStatus: () => ({
    isFreeTier: false,
    isEnterprise: mockCurrentTier === 'enterprise',
    isProfessional: mockCurrentTier === 'professional',
    isStarter: mockCurrentTier === 'starter',
    isTrial: false,
    isActive: true,
    isSuspended: false,
    isCancelled: false,
    isPastDue: false,
    hasActiveSubscription: true,
    canUpgrade: mockCurrentTier !== 'enterprise',
    canDowngrade: mockCurrentTier !== 'starter',
    needsPaymentMethod: false,
    isTrialExpired: false,
    currentTier: mockCurrentTier,
    status: 'active',
    tenant: mockTenant,
  }),
}));

vi.mock('@/hooks/useCredits', () => ({
  useCredits: () => ({
    balance: 5000,
    isFreeTier: false,
    isLoading: false,
    error: null,
    isLowCredits: false,
    isCriticalCredits: false,
    isOutOfCredits: false,
    nextFreeGrantAt: null,
    lifetimeSpent: 0,
    canAfford: () => true,
    performAction: vi.fn(),
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: { configured: true, valid: true }, error: null }),
    },
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnValue('SUBSCRIBED'),
    }),
    removeChannel: vi.fn(),
  },
}));

vi.mock('@/lib/formatters', () => ({
  formatCurrency: (value: number) => `$${value}`,
  formatSmartDate: (date: string | Date | null | undefined) => {
    if (!date) return '—';
    if (date instanceof Date) return date.toISOString().slice(0, 10);
    return String(date);
  },
}));

vi.mock('@/lib/featureConfig', async () => {
  const actual = await vi.importActual<typeof import('@/lib/featureConfig')>('@/lib/featureConfig');
  return {
    ...actual,
    getFeaturesByCategory: () => ({}),
  };
});

vi.mock('@/lib/queryKeys', () => ({
  queryKeys: {
    tenants: { all: ['tenants'] },
    stripeHealth: { all: ['stripe-health'] },
    tenantInvoices: { byTenant: (id: string) => ['tenant-invoices', id] },
    subscriptionPlans: { all: ['subscription-plans'] },
    credits: { all: ['credits'] },
  },
}));

vi.mock('@/components/settings/SettingsSection', () => ({
  SettingsSection: ({ children, title }: { children: React.ReactNode; title: string }) => (
    <div data-testid={`settings-section-${title}`}>{children}</div>
  ),
  SettingsCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/billing/AddPaymentMethodDialog', () => ({
  AddPaymentMethodDialog: () => null,
}));

vi.mock('@/components/credits', () => ({
  CreditBalance: () => null,
  CreditUsageStats: () => null,
}));

vi.mock('@/lib/credits', () => ({
  FREE_TIER_MONTHLY_CREDITS: 5000,
}));

import BillingSettings from '../BillingSettings';

// --- Helpers ---

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function renderBillingSettings() {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <BillingSettings />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// --- Tests ---

describe('BillingSettings Plan Card Buttons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentTier = 'starter';
    mockTenant.subscription_plan = 'starter';
  });

  it('renders all three plan cards with buttons', async () => {
    renderBillingSettings();

    await waitFor(() => {
      // Each plan name appears in the Available Plans section
      expect(screen.getAllByText('Starter').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Professional').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Enterprise').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('marks starter plan button as "Current Plan" and disables it', async () => {
    renderBillingSettings();

    await waitFor(() => {
      const currentButtons = screen.getAllByRole('button', { name: /Current Plan/i });
      expect(currentButtons.length).toBeGreaterThanOrEqual(1);
      expect(currentButtons[0]).toBeDisabled();
    });
  });

  it('shows "Upgrade" for plans above current tier', async () => {
    renderBillingSettings();

    await waitFor(() => {
      const upgradeButtons = screen.getAllByRole('button', { name: /^Upgrade$/i });
      expect(upgradeButtons.length).toBe(2); // Professional and Enterprise
    });
  });

  it('calls handlePlanChange and opens upgrade dialog when clicking Professional', async () => {
    renderBillingSettings();

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /^Upgrade$/i }).length).toBe(2);
    });

    const upgradeButtons = screen.getAllByRole('button', { name: /^Upgrade$/i });
    fireEvent.click(upgradeButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Confirm Upgrade')).toBeInTheDocument();
    });
  });

  it('calls handlePlanChange and opens upgrade dialog when clicking Enterprise', async () => {
    renderBillingSettings();

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /^Upgrade$/i }).length).toBe(2);
    });

    const upgradeButtons = screen.getAllByRole('button', { name: /^Upgrade$/i });
    fireEvent.click(upgradeButtons[1]);

    await waitFor(() => {
      expect(screen.getByText('Confirm Upgrade')).toBeInTheDocument();
    });
  });

  it('disables the current plan button so handlePlanChange cannot fire for same tier', async () => {
    renderBillingSettings();

    await waitFor(() => {
      const currentButtons = screen.getAllByRole('button', { name: /Current Plan/i });
      expect(currentButtons.length).toBeGreaterThanOrEqual(1);
    });

    const currentButton = screen.getAllByRole('button', { name: /Current Plan/i })[0];
    expect(currentButton).toBeDisabled();
  });

  describe('when current tier is professional', () => {
    beforeEach(() => {
      mockCurrentTier = 'professional';
      mockTenant.subscription_plan = 'professional';
    });

    it('shows Downgrade for Starter and Upgrade for Enterprise', async () => {
      renderBillingSettings();

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: /^Downgrade$/i }).length).toBe(1);
        expect(screen.getAllByRole('button', { name: /^Upgrade$/i }).length).toBe(1);
        expect(screen.getAllByRole('button', { name: /Current Plan/i }).length).toBeGreaterThanOrEqual(1);
      });
    });

    it('calls handlePlanChange with starter when clicking Downgrade', async () => {
      renderBillingSettings();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^Downgrade$/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /^Downgrade$/i }));

      await waitFor(() => {
        expect(screen.getByText('Confirm Downgrade')).toBeInTheDocument();
      });
    });

    it('calls handlePlanChange with enterprise when clicking Upgrade', async () => {
      renderBillingSettings();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^Upgrade$/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /^Upgrade$/i }));

      await waitFor(() => {
        expect(screen.getByText('Confirm Upgrade')).toBeInTheDocument();
      });
    });
  });

  describe('when current tier is enterprise', () => {
    beforeEach(() => {
      mockCurrentTier = 'enterprise';
      mockTenant.subscription_plan = 'enterprise';
    });

    it('shows Downgrade for Starter and Professional', async () => {
      renderBillingSettings();

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: /^Downgrade$/i }).length).toBe(2);
        expect(screen.getAllByRole('button', { name: /Current Plan/i }).length).toBeGreaterThanOrEqual(1);
      });
    });

    it('disables the Enterprise current plan button', async () => {
      renderBillingSettings();

      await waitFor(() => {
        const currentButtons = screen.getAllByRole('button', { name: /Current Plan/i });
        expect(currentButtons[0]).toBeDisabled();
      });
    });
  });
});
