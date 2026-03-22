/**
 * BillingSettings Cancel Dialog Tests
 * Tests the cancel subscription dialog's "Keep Subscription" button behavior
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/utils/test-utils';
import BillingSettings from '../BillingSettings';

// --- Mocks ---

const mockInvoke = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => Promise.resolve({ data: [], error: null }),
          }),
          single: () => Promise.resolve({ data: null, error: null }),
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        }),
        order: () => ({
          limit: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    }),
  },
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: {
      id: 'tenant-123',
      name: 'Test Dispensary',
      slug: 'test-dispensary',
      subscription_plan: 'professional',
      billing_cycle: 'monthly',
      payment_method_added: true,
      created_at: '2025-01-01T00:00:00Z',
      limits: {},
      usage: {},
    },
    loading: false,
    isAdmin: true,
  }),
}));

const mockUseSubscriptionStatus = vi.fn().mockReturnValue({
  isTrial: false,
  needsPaymentMethod: false,
  trialDaysLeft: 0,
});

vi.mock('@/hooks/useSubscriptionStatus', () => ({
  useSubscriptionStatus: (...args: unknown[]) => mockUseSubscriptionStatus(...args),
}));

const mockUseFeatureAccess = vi.fn().mockReturnValue({
  currentTier: 'professional',
  currentTierName: 'Professional',
  hasFeature: () => true,
  canAccess: () => true,
});

vi.mock('@/hooks/useFeatureAccess', () => ({
  useFeatureAccess: (...args: unknown[]) => mockUseFeatureAccess(...args),
}));

vi.mock('@/hooks/useCredits', () => ({
  useCredits: () => ({
    balance: 1000,
    isFreeTier: false,
    isLowCredits: false,
    isCriticalCredits: false,
    isOutOfCredits: false,
    nextFreeGrantAt: null,
    lifetimeSpent: 500,
  }),
}));

const mockBusinessTierToSubscriptionTier = vi.fn().mockImplementation(
  (tier: string) => tier || 'professional'
);

vi.mock('@/lib/tierMapping', () => ({
  businessTierToSubscriptionTier: (...args: unknown[]) =>
    mockBusinessTierToSubscriptionTier(...args),
}));

vi.mock('@/lib/featureConfig', () => ({
  TIER_PRICES: { starter: 0, professional: 99, enterprise: 299 },
  TIER_NAMES: { starter: 'Starter', professional: 'Professional', enterprise: 'Enterprise' },
  getFeaturesByCategory: () => ({}),
}));

vi.mock('@/lib/credits', () => ({
  FREE_TIER_MONTHLY_CREDITS: 100,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/lib/humanizeError', () => ({
  humanizeError: (err: unknown, fallback?: string) =>
    err instanceof Error ? err.message : fallback || 'Unknown error',
}));

vi.mock('@/lib/formatters', () => ({
  formatCurrency: (value: number) => `$${value}`,
  formatSmartDate: (date: string | Date) =>
    typeof date === 'string' ? date : date.toISOString(),
}));

vi.mock('@/lib/queryKeys', () => ({
  queryKeys: {
    tenants: { all: ['tenants'] },
    tenantInvoices: { byTenant: (id: string) => ['invoices', id] },
    subscriptionPlans: { all: ['subscription-plans'] },
    stripeHealth: { all: ['stripe-health'] },
  },
}));

vi.mock('@/components/billing/AddPaymentMethodDialog', () => ({
  AddPaymentMethodDialog: () => null,
}));

vi.mock('@/components/credits', () => ({
  CreditBalance: () => null,
  CreditUsageStats: () => null,
}));

vi.mock('@/components/settings/SettingsSection', () => ({
  SettingsSection: ({ children, title }: { children: React.ReactNode; title: string }) => (
    <div data-testid={`settings-section-${title}`}>{children}</div>
  ),
  SettingsCard: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="settings-card">{children}</div>
  ),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// --- Tests ---

describe('BillingSettings Cancel Dialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: Stripe health check returns configured
    mockInvoke.mockImplementation((fn: string) => {
      if (fn === 'check-stripe-config') {
        return Promise.resolve({
          data: { configured: true, valid: true, testMode: false },
          error: null,
        });
      }
      if (fn === 'invoice-management') {
        return Promise.resolve({ data: { invoices: [] }, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });
  });

  it('shows Cancel Subscription button for non-trial, non-starter users', async () => {
    render(<BillingSettings />);

    await waitFor(() => {
      expect(screen.getByText('Cancel Subscription')).toBeInTheDocument();
    });
  });

  it('opens cancel dialog when Cancel Subscription is clicked', async () => {
    render(<BillingSettings />);

    await waitFor(() => {
      expect(screen.getByText('Cancel Subscription')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Cancel Subscription'));

    await waitFor(() => {
      expect(screen.getByText('Keep Subscription')).toBeInTheDocument();
      expect(screen.getByText('Proceed to Cancel')).toBeInTheDocument();
    });
  });

  it('closes dialog when Keep Subscription is clicked without calling Stripe', async () => {
    render(<BillingSettings />);

    await waitFor(() => {
      expect(screen.getByText('Cancel Subscription')).toBeInTheDocument();
    });

    // Open the dialog
    fireEvent.click(screen.getByText('Cancel Subscription'));

    await waitFor(() => {
      expect(screen.getByText('Keep Subscription')).toBeInTheDocument();
    });

    // Click Keep Subscription
    fireEvent.click(screen.getByText('Keep Subscription'));

    // Dialog should close - Keep Subscription and Proceed to Cancel should no longer be visible
    await waitFor(() => {
      expect(screen.queryByText('Keep Subscription')).not.toBeInTheDocument();
      expect(screen.queryByText('Proceed to Cancel')).not.toBeInTheDocument();
    });

    // Stripe portal should NOT have been called
    expect(mockInvoke).not.toHaveBeenCalledWith(
      'stripe-customer-portal',
      expect.anything()
    );
  });

  it('shows dialog description text about cancellation', async () => {
    render(<BillingSettings />);

    await waitFor(() => {
      expect(screen.getByText('Cancel Subscription')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Cancel Subscription'));

    await waitFor(() => {
      expect(
        screen.getByText(/Are you sure you want to cancel your subscription/)
      ).toBeInTheDocument();
    });
  });

  it('can reopen dialog after dismissing with Keep Subscription', async () => {
    render(<BillingSettings />);

    await waitFor(() => {
      expect(screen.getByText('Cancel Subscription')).toBeInTheDocument();
    });

    // Open dialog
    fireEvent.click(screen.getByText('Cancel Subscription'));
    await waitFor(() => {
      expect(screen.getByText('Keep Subscription')).toBeInTheDocument();
    });

    // Dismiss
    fireEvent.click(screen.getByText('Keep Subscription'));
    await waitFor(() => {
      expect(screen.queryByText('Keep Subscription')).not.toBeInTheDocument();
    });

    // Reopen
    fireEvent.click(screen.getByText('Cancel Subscription'));
    await waitFor(() => {
      expect(screen.getByText('Keep Subscription')).toBeInTheDocument();
      expect(screen.getByText('Proceed to Cancel')).toBeInTheDocument();
    });
  });
});

describe('BillingSettings Cancel Dialog - hidden for starter/trial', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockImplementation((fn: string) => {
      if (fn === 'check-stripe-config') {
        return Promise.resolve({
          data: { configured: true, valid: true, testMode: false },
          error: null,
        });
      }
      if (fn === 'invoice-management') {
        return Promise.resolve({ data: { invoices: [] }, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });
  });

  it('hides Cancel Subscription button for trial users', async () => {
    mockUseSubscriptionStatus.mockReturnValue({
      isTrial: true,
      needsPaymentMethod: false,
      trialDaysLeft: 14,
    });

    render(<BillingSettings />);

    await waitFor(() => {
      expect(screen.getByText('Manage Subscription')).toBeInTheDocument();
    });

    // Cancel Subscription button should not exist for trial users
    const cancelButtons = screen.queryAllByText('Cancel Subscription');
    const buttonElements = cancelButtons.filter(
      (el) => el.tagName === 'BUTTON' || el.closest('button')
    );
    expect(buttonElements).toHaveLength(0);
  });

  it('hides Cancel Subscription button for starter tier', async () => {
    mockUseFeatureAccess.mockReturnValue({
      currentTier: 'starter',
      currentTierName: 'Starter',
      hasFeature: () => true,
      canAccess: () => true,
    });
    mockBusinessTierToSubscriptionTier.mockReturnValue('starter');

    render(<BillingSettings />);

    await waitFor(() => {
      expect(screen.getByText('Manage Subscription')).toBeInTheDocument();
    });

    const cancelButtons = screen.queryAllByText('Cancel Subscription');
    const buttonElements = cancelButtons.filter(
      (el) => el.tagName === 'BUTTON' || el.closest('button')
    );
    expect(buttonElements).toHaveLength(0);
  });
});
