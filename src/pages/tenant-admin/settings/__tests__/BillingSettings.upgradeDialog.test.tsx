/**
 * BillingSettings Upgrade Dialog Tests
 *
 * Verifies that clicking the 'Confirm' button in the upgrade dialog
 * calls confirmPlanChange, which triggers the update-subscription mutation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import BillingSettings from '../BillingSettings';

// --- Mocks ---

const mockInvoke = vi.fn().mockResolvedValue({ data: null, error: null });

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => Promise.resolve({ data: [], error: null }),
          }),
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        }),
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
      }),
    }),
    channel: () => ({
      on: () => ({ subscribe: () => ({ unsubscribe: vi.fn() }) }),
    }),
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
      created_at: '2025-01-01T00:00:00Z',
      limits: {},
      usage: {},
    },
    tenantSlug: 'test-tenant',
  }),
}));

vi.mock('@/hooks/useSubscriptionStatus', () => ({
  useSubscriptionStatus: () => ({
    isTrial: false,
    needsPaymentMethod: false,
    isActive: true,
    daysLeft: null,
  }),
}));

vi.mock('@/hooks/useFeatureAccess', () => ({
  useFeatureAccess: () => ({
    currentTier: 'starter',
    currentTierName: 'Starter',
    hasFeature: () => true,
  }),
}));

vi.mock('@/hooks/useCredits', () => ({
  useCredits: () => ({
    balance: 1000,
    isFreeTier: false,
    isLowCredits: false,
    isCriticalCredits: false,
    isOutOfCredits: false,
    nextFreeGrantAt: null,
    lifetimeSpent: 0,
  }),
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
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/lib/tierMapping', () => ({
  businessTierToSubscriptionTier: (tier: string) => {
    if (tier === 'starter') return 'starter';
    if (tier === 'professional') return 'professional';
    if (tier === 'enterprise') return 'enterprise';
    return 'starter';
  },
}));

vi.mock('@/components/billing/AddPaymentMethodDialog', () => ({
  AddPaymentMethodDialog: () => null,
}));

vi.mock('@/components/credits', () => ({
  CreditBalance: () => null,
  CreditUsageStats: () => null,
}));

// --- Helpers ---

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
}

function renderBillingSettings() {
  const queryClient = createQueryClient();

  // Pre-populate subscription plans cache so the confirm logic can find the target plan
  queryClient.setQueryData(['subscription-plans'], [
    {
      id: 'plan-starter-uuid',
      name: 'starter',
      display_name: 'Starter',
      description: 'Core features',
      price_monthly: 79,
      is_active: true,
      limits: {},
      features: [],
    },
    {
      id: 'plan-professional-uuid',
      name: 'professional',
      display_name: 'Professional',
      description: 'Team features',
      price_monthly: 150,
      is_active: true,
      limits: {},
      features: [],
    },
    {
      id: 'plan-enterprise-uuid',
      name: 'enterprise',
      display_name: 'Enterprise',
      description: 'Full platform',
      price_monthly: 499,
      is_active: true,
      limits: {},
      features: [],
    },
  ]);

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <BillingSettings />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

// --- Tests ---

describe('BillingSettings Upgrade Dialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock: check-stripe-config succeeds, others return empty
    mockInvoke.mockImplementation((fnName: string) => {
      if (fnName === 'check-stripe-config') {
        return Promise.resolve({
          data: { configured: true, valid: true, testMode: false },
          error: null,
        });
      }
      if (fnName === 'invoice-management') {
        return Promise.resolve({ data: { invoices: [] }, error: null });
      }
      if (fnName === 'update-subscription') {
        return Promise.resolve({ data: { url: 'https://checkout.stripe.com/test' }, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });
  });

  it('opens upgrade dialog and Confirm button calls confirmPlanChange (update-subscription)', async () => {
    renderBillingSettings();

    // Wait for the plans section to render — find the "Upgrade" button for Professional
    const upgradeButtons = await screen.findAllByRole('button', { name: /upgrade/i });
    expect(upgradeButtons.length).toBeGreaterThanOrEqual(1);

    // Click the first Upgrade button (Professional plan since current is Starter)
    fireEvent.click(upgradeButtons[0]);

    // Dialog should open with "Confirm Upgrade" title
    const dialogTitle = await screen.findByText('Confirm Upgrade');
    expect(dialogTitle).toBeInTheDocument();

    // Find and click the Confirm button in the dialog
    const confirmButton = screen.getByRole('button', { name: 'Confirm' });
    expect(confirmButton).toBeInTheDocument();

    fireEvent.click(confirmButton);

    // Verify update-subscription was called with the professional plan ID
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('update-subscription', {
        body: {
          tenant_id: 'test-tenant-id',
          plan_id: 'plan-professional-uuid',
        },
      });
    });
  });

  it('dialog shows plan change description with current and target plan info', async () => {
    renderBillingSettings();

    // Click Upgrade on Professional plan
    const upgradeButtons = await screen.findAllByRole('button', { name: /upgrade/i });
    fireEvent.click(upgradeButtons[0]);

    // Dialog should show the "Confirm Upgrade" title
    const dialogTitle = await screen.findByText('Confirm Upgrade');
    expect(dialogTitle).toBeInTheDocument();

    // Dialog description mentions changing from current to target plan
    expect(screen.getByText(/You are changing from/)).toBeInTheDocument();
    // Shows "Changes take effect immediately" notice
    expect(screen.getByText(/Changes take effect immediately/)).toBeInTheDocument();
  });

  it('does not call update-subscription when Cancel is clicked', async () => {
    renderBillingSettings();

    const upgradeButtons = await screen.findAllByRole('button', { name: /upgrade/i });
    fireEvent.click(upgradeButtons[0]);

    await screen.findByText('Confirm Upgrade');

    // Click Cancel
    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelButton);

    // Dialog should close — Confirm Upgrade no longer visible
    await waitFor(() => {
      expect(screen.queryByText('Confirm Upgrade')).not.toBeInTheDocument();
    });

    // update-subscription should NOT have been called
    const updateCalls = mockInvoke.mock.calls.filter(
      (call: unknown[]) => call[0] === 'update-subscription'
    );
    expect(updateCalls).toHaveLength(0);
  });
});
