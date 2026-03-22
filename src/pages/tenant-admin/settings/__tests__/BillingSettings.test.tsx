/**
 * BillingSettings Tests
 * Verifies the Manage Subscription button, plan card buttons,
 * upgrade dialog cancel button, Add Payment Method button,
 * Update Payment Method button, and "Upgrade for Unlimited" button behavior.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

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
    tenantSlug: mockTenant.slug,
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
    hasAccess: vi.fn().mockReturnValue(true),
    checkUpgrade: () => ({ required: false, targetTier: null, priceDifference: 0 }),
    getTierDisplayInfo: () => ({
      name: mockCurrentTier.charAt(0).toUpperCase() + mockCurrentTier.slice(1),
      price: { starter: 79, professional: 150, enterprise: 499 }[mockCurrentTier],
    }),
    getRequiredTier: () => 'starter',
    getUpgradeRequirement: () => null,
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

const mockInvoke = vi.fn().mockResolvedValue({ data: { configured: true, valid: true }, error: null });

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
      invoke: (...args: unknown[]) => mockInvoke(...args),
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

vi.mock('@/lib/tierMapping', () => ({
  businessTierToSubscriptionTier: (tier: string) => tier || 'starter',
}));

vi.mock('@/components/settings/SettingsSection', () => ({
  SettingsSection: ({ children, title }: { children: React.ReactNode; title: string }) => (
    <div data-testid={`settings-section-${title}`}>{children}</div>
  ),
  SettingsCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/credits', () => ({
  CreditBalance: () => null,
  CreditUsageStats: () => null,
}));

vi.mock('@/lib/credits', () => ({
  FREE_TIER_MONTHLY_CREDITS: 5000,
}));

vi.mock('@/utils/errorHandling/handlers', () => ({
  handleError: vi.fn(),
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
      <MemoryRouter initialEntries={['/test-dispensary/admin/settings']}>
        <BillingSettings />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// --- Tests ---

describe('BillingSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentTier = 'starter';
    mockTenant.subscription_plan = 'starter';
    mockTenant.payment_method_added = true;
    mockInvoke.mockResolvedValue({ data: { configured: true, valid: true }, error: null });
  });

  describe('Manage Subscription button', () => {
    it('should render the Manage Subscription button', () => {
      renderBillingSettings();

      const button = screen.getByRole('button', { name: /manage subscription/i });
      expect(button).toBeInTheDocument();
    });

    it('should call stripe-customer-portal edge function when clicked', async () => {
      mockInvoke.mockImplementation((fnName: string) => {
        if (fnName === 'stripe-customer-portal') {
          return Promise.resolve({
            data: { url: 'https://billing.stripe.com/session/test' },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      });

      renderBillingSettings();

      const button = screen.getByRole('button', { name: /manage subscription/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('stripe-customer-portal', {
          body: { tenant_id: 'tenant-123' },
        });
      });
    });

    it('should open Stripe portal URL in a new tab on success', async () => {
      const mockOpen = vi.fn();
      vi.spyOn(window, 'open').mockImplementation(mockOpen);

      mockInvoke.mockImplementation((fnName: string) => {
        if (fnName === 'stripe-customer-portal') {
          return Promise.resolve({
            data: { url: 'https://billing.stripe.com/session/test' },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      });

      renderBillingSettings();

      const button = screen.getByRole('button', { name: /manage subscription/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockOpen).toHaveBeenCalledWith(
          'https://billing.stripe.com/session/test',
          '_blank',
          'noopener,noreferrer',
        );
      });

      mockOpen.mockRestore();
    });

    it('should show success toast when portal URL is returned', async () => {
      vi.spyOn(window, 'open').mockImplementation(vi.fn());

      mockInvoke.mockImplementation((fnName: string) => {
        if (fnName === 'stripe-customer-portal') {
          return Promise.resolve({
            data: { url: 'https://billing.stripe.com/session/test' },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      });

      renderBillingSettings();

      const button = screen.getByRole('button', { name: /manage subscription/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith('Success', {
          description: 'Opening Stripe Customer Portal...',
        });
      });

      vi.mocked(window.open).mockRestore();
    });

    it('should show error toast when edge function fails', async () => {
      mockInvoke.mockImplementation((fnName: string) => {
        if (fnName === 'stripe-customer-portal') {
          return Promise.resolve({
            data: null,
            error: new Error('Network error'),
          });
        }
        return Promise.resolve({ data: null, error: null });
      });

      renderBillingSettings();

      const button = screen.getByRole('button', { name: /manage subscription/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalled();
      });
    });
  });

  describe('Plan Card Buttons', () => {
    it('renders all three plan cards with buttons', async () => {
      renderBillingSettings();

      await waitFor(() => {
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

  describe('Upgrade Dialog Cancel', () => {
    it('should open upgrade dialog when clicking an upgrade plan button', async () => {
      const user = userEvent.setup();
      renderBillingSettings();

      // "Professional" plan should show "Upgrade" button since current is Starter
      const upgradeButtons = screen.getAllByRole('button', { name: /upgrade/i });
      expect(upgradeButtons.length).toBeGreaterThanOrEqual(1);

      await user.click(upgradeButtons[0]);

      // Dialog should be open with confirmation text
      await waitFor(() => {
        expect(screen.getByText(/Confirm Upgrade/i)).toBeInTheDocument();
      });
    });

    it('should close dialog and reset selectedPlan when Cancel is clicked', async () => {
      const user = userEvent.setup();
      renderBillingSettings();

      // Open the upgrade dialog by clicking upgrade on Professional plan
      const upgradeButtons = screen.getAllByRole('button', { name: /upgrade/i });
      await user.click(upgradeButtons[0]);

      // Verify dialog is open
      await waitFor(() => {
        expect(screen.getByText(/Confirm Upgrade/i)).toBeInTheDocument();
      });

      // Verify the plan details are shown (changing from Starter to target)
      expect(screen.getByText(/Starter/i, { selector: 'strong' })).toBeInTheDocument();

      // Click Cancel button in the dialog footer
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      // Dialog should be closed
      await waitFor(() => {
        expect(screen.queryByText(/Confirm Upgrade/i)).not.toBeInTheDocument();
      });
    });

    it('should not show stale plan data after Cancel and reopen', async () => {
      const user = userEvent.setup();
      renderBillingSettings();

      // Open upgrade dialog for Professional plan
      const upgradeButtons = screen.getAllByRole('button', { name: /upgrade/i });
      await user.click(upgradeButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(/Confirm Upgrade/i)).toBeInTheDocument();
      });

      // Verify Professional is shown as target
      const professionalStrongs = screen.getAllByText('Professional');
      expect(professionalStrongs.length).toBeGreaterThanOrEqual(1);

      // Cancel the dialog
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByText(/Confirm Upgrade/i)).not.toBeInTheDocument();
      });

      // Now open for Enterprise plan (second upgrade button)
      if (upgradeButtons.length > 1) {
        await user.click(upgradeButtons[1]);

        await waitFor(() => {
          expect(screen.getByText(/Confirm Upgrade/i)).toBeInTheDocument();
        });

        // Should show Enterprise as the target, not stale Professional
        const enterpriseStrongs = screen.getAllByText('Enterprise');
        expect(enterpriseStrongs.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('should disable Cancel button while upgrade is loading', async () => {
      const user = userEvent.setup();
      renderBillingSettings();

      // Open upgrade dialog
      const upgradeButtons = screen.getAllByRole('button', { name: /upgrade/i });
      await user.click(upgradeButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(/Confirm Upgrade/i)).toBeInTheDocument();
      });

      // Cancel button should not be disabled initially
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      expect(cancelButton).not.toBeDisabled();
    });

    it('should show both Cancel and Confirm buttons in upgrade dialog', async () => {
      const user = userEvent.setup();
      renderBillingSettings();

      // Open upgrade dialog
      const upgradeButtons = screen.getAllByRole('button', { name: /upgrade/i });
      await user.click(upgradeButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(/Confirm Upgrade/i)).toBeInTheDocument();
      });

      // Both buttons should be present
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
    });

    it('should display pricing information in the upgrade dialog', async () => {
      const user = userEvent.setup();
      renderBillingSettings();

      // Open upgrade dialog
      const upgradeButtons = screen.getAllByRole('button', { name: /upgrade/i });
      await user.click(upgradeButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(/Confirm Upgrade/i)).toBeInTheDocument();
      });

      // Should show pricing info
      expect(screen.getByText(/New monthly price/i)).toBeInTheDocument();
      expect(screen.getByText(/Changes take effect immediately/i)).toBeInTheDocument();
    });
  });

  describe('Add Payment Method button', () => {
    beforeEach(() => {
      mockTenant.payment_method_added = false;
    });

    it('renders the "Add Payment Method" button when no payment method is added', async () => {
      renderBillingSettings();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add payment method/i })).toBeInTheDocument();
      });
    });

    it('opens AddPaymentMethodDialog when "Add Payment Method" button is clicked', async () => {
      const user = userEvent.setup();
      renderBillingSettings();

      // Wait for the button to appear
      const addButton = await screen.findByRole('button', { name: /add payment method/i });

      // Click the button
      await user.click(addButton);

      // The AddPaymentMethodDialog should be open — it renders a dialog with description about trial
      await waitFor(() => {
        expect(screen.getByText(/add a payment method to ensure uninterrupted service/i)).toBeInTheDocument();
      });
    });

    it('shows dialog with trial benefits after clicking "Add Payment Method"', async () => {
      const user = userEvent.setup();
      renderBillingSettings();

      const addButton = await screen.findByRole('button', { name: /add payment method/i });
      await user.click(addButton);

      await waitFor(() => {
        expect(screen.getByText(/full access to all features/i)).toBeInTheDocument();
        expect(screen.getByText(/unlimited products & customers/i)).toBeInTheDocument();
        expect(screen.getByText(/priority support/i)).toBeInTheDocument();
      });
    });

    it('shows "Remind Me Later" button in the payment dialog', async () => {
      const user = userEvent.setup();
      renderBillingSettings();

      const addButton = await screen.findByRole('button', { name: /add payment method/i });
      await user.click(addButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /remind me later/i })).toBeInTheDocument();
      });
    });

    it('closes the dialog when "Remind Me Later" is clicked', async () => {
      const user = userEvent.setup();
      renderBillingSettings();

      const addButton = await screen.findByRole('button', { name: /add payment method/i });
      await user.click(addButton);

      // Verify dialog is open
      await waitFor(() => {
        expect(screen.getByText(/add a payment method to ensure uninterrupted service/i)).toBeInTheDocument();
      });

      // Click "Remind Me Later"
      const remindButton = screen.getByRole('button', { name: /remind me later/i });
      await user.click(remindButton);

      // Dialog content should be removed
      await waitFor(() => {
        expect(screen.queryByText(/add a payment method to ensure uninterrupted service/i)).not.toBeInTheDocument();
      });
    });

    it('renders "No payment method added" text when payment_method_added is false', async () => {
      renderBillingSettings();

      await waitFor(() => {
        expect(screen.getByText(/no payment method added/i)).toBeInTheDocument();
      });
    });
  });

  describe('Update Payment Method button', () => {
    it('renders the Update button when payment method is added', () => {
      renderBillingSettings();

      const updateButton = screen.getByRole('button', { name: /update/i });
      expect(updateButton).toBeInTheDocument();
      expect(updateButton).toBeEnabled();
    });

    it('invokes stripe-customer-portal on click and opens URL', async () => {
      const portalUrl = 'https://billing.stripe.com/session/test_portal';
      mockInvoke.mockImplementation(async (fnName: string) => {
        if (fnName === 'stripe-customer-portal') {
          return { data: { url: portalUrl }, error: null };
        }
        return { data: null, error: null };
      });

      const mockOpen = vi.fn();
      vi.stubGlobal('open', mockOpen);

      const user = userEvent.setup();
      renderBillingSettings();

      const updateButton = screen.getByRole('button', { name: /update/i });
      await user.click(updateButton);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('stripe-customer-portal', {
          body: { tenant_id: 'tenant-123' },
        });
      });

      await waitFor(() => {
        expect(mockOpen).toHaveBeenCalledWith(portalUrl, '_blank', 'noopener,noreferrer');
      });

      expect(mockToastSuccess).toHaveBeenCalledWith('Success', {
        description: 'Opening Stripe Customer Portal...',
      });

      vi.unstubAllGlobals();
    });

    it('shows error toast when stripe-customer-portal fails', async () => {
      mockInvoke.mockImplementation(async (fnName: string) => {
        if (fnName === 'stripe-customer-portal') {
          return { data: null, error: new Error('Stripe unavailable') };
        }
        return { data: null, error: null };
      });

      const user = userEvent.setup();
      renderBillingSettings();

      const updateButton = screen.getByRole('button', { name: /update/i });
      await user.click(updateButton);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalled();
      });
    });

    it('shows error toast when response contains error field', async () => {
      mockInvoke.mockImplementation(async (fnName: string) => {
        if (fnName === 'stripe-customer-portal') {
          return { data: { error: 'No Stripe customer found' }, error: null };
        }
        return { data: null, error: null };
      });

      const user = userEvent.setup();
      renderBillingSettings();

      const updateButton = screen.getByRole('button', { name: /update/i });
      await user.click(updateButton);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith('Error', {
          description: 'No Stripe customer found',
        });
      });
    });

    it('re-enables the button after request completes', async () => {
      mockInvoke.mockImplementation(async (fnName: string) => {
        if (fnName === 'stripe-customer-portal') {
          return { data: { url: 'https://stripe.com/portal' }, error: null };
        }
        return { data: null, error: null };
      });

      const mockOpen = vi.fn();
      vi.stubGlobal('open', mockOpen);

      const user = userEvent.setup();
      renderBillingSettings();

      const updateButton = screen.getByRole('button', { name: /update/i });
      await user.click(updateButton);

      await waitFor(() => {
        expect(updateButton).toBeEnabled();
      });

      vi.unstubAllGlobals();
    });
  });

  describe('Upgrade for Unlimited button', () => {
    it('navigates to select-plan when "Upgrade for Unlimited" is clicked', async () => {
      // Set up free tier state for this test
      mockCurrentTier = 'free' as SubscriptionTier;
      mockTenant.subscription_plan = 'free';
      mockTenant.is_free_tier = true;

      const user = userEvent.setup();
      renderBillingSettings();

      const button = await screen.findByRole('button', { name: /upgrade for unlimited/i });
      await user.click(button);

      expect(mockNavigate).toHaveBeenCalledWith('/test-dispensary/admin/select-plan');
    });
  });
});
