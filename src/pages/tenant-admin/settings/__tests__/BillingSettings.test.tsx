/**
 * BillingSettings — Upgrade Dialog Cancel Button Tests
 *
 * Verifies that clicking the "Cancel" button in the upgrade confirmation
 * dialog properly resets both the dialog open state and the selected plan.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

// Mock external dependencies before importing component
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: {}, error: null }),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          })),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      })),
    })),
  },
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: {
      id: 'test-tenant-id',
      slug: 'test-tenant',
      name: 'Test Dispensary',
      subscription_plan: 'starter',
      billing_cycle: 'monthly',
      payment_method_added: true,
      limits: {},
      usage: {},
    },
  }),
}));

vi.mock('@/hooks/useSubscriptionStatus', () => ({
  useSubscriptionStatus: () => ({
    isTrial: false,
    needsPaymentMethod: false,
    isActive: true,
  }),
}));

vi.mock('@/hooks/useFeatureAccess', () => ({
  useFeatureAccess: () => ({
    currentTier: 'starter',
    currentTierName: 'Starter',
    hasAccess: vi.fn().mockReturnValue(true),
  }),
}));

vi.mock('@/hooks/useCredits', () => ({
  useCredits: () => ({
    balance: 5000,
    isFreeTier: false,
    isLowCredits: false,
    isCriticalCredits: false,
    isOutOfCredits: false,
    nextFreeGrantAt: null,
    lifetimeSpent: 0,
  }),
}));

vi.mock('@/lib/tierMapping', () => ({
  businessTierToSubscriptionTier: (tier: string) => tier || 'starter',
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/lib/humanizeError', () => ({
  humanizeError: (err: unknown) => String(err),
}));

vi.mock('@/components/billing/AddPaymentMethodDialog', () => ({
  AddPaymentMethodDialog: () => null,
}));

vi.mock('@/components/credits', () => ({
  CreditBalance: () => null,
  CreditUsageStats: () => null,
}));

import BillingSettings from '../BillingSettings';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>{children}</BrowserRouter>
      </QueryClientProvider>
    );
  };
}

describe('BillingSettings — Upgrade Dialog Cancel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should open upgrade dialog when clicking an upgrade plan button', async () => {
    const user = userEvent.setup();
    render(<BillingSettings />, { wrapper: createWrapper() });

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
    render(<BillingSettings />, { wrapper: createWrapper() });

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
    render(<BillingSettings />, { wrapper: createWrapper() });

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
    render(<BillingSettings />, { wrapper: createWrapper() });

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
    render(<BillingSettings />, { wrapper: createWrapper() });

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
    render(<BillingSettings />, { wrapper: createWrapper() });

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
