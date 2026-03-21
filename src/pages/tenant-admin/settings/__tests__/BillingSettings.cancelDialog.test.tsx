/**
 * BillingSettings Cancel Dialog — "Proceed to Cancel" button tests
 *
 * Verifies:
 * - Clicking "Proceed to Cancel" calls stripe-customer-portal edge function
 * - Dialog closes immediately on click
 * - Success path: opens Stripe portal URL in new tab, shows success toast
 * - Error path: shows error toast with humanized message
 * - Button is disabled while loading
 * - Cancel button visibility based on tier and trial status
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

// ---- Mutable mock config (changed per-test, read by hoisted vi.mock factories) ----

const mockConfig = {
  featureAccess: {
    currentTier: 'block' as string,
    currentTierName: 'Professional',
    currentTierPrice: 150,
  },
  subscriptionStatus: {
    isTrial: false,
    needsPaymentMethod: false,
  },
};

// ---- Mocks (hoisted — must not reference non-hoisted variables) ----

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: vi.fn() },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  },
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
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: {
      id: 'tenant-123',
      name: 'Test Tenant',
      slug: 'test-tenant',
      subscription_plan: 'professional',
      billing_cycle: 'monthly',
      limits: {},
      usage: {},
    },
    tenantSlug: 'test-tenant',
  }),
}));

vi.mock('@/hooks/useSubscriptionStatus', () => ({
  useSubscriptionStatus: () => ({
    isTrial: mockConfig.subscriptionStatus.isTrial,
    isActive: !mockConfig.subscriptionStatus.isTrial,
    isSuspended: false,
    isCancelled: false,
    isPastDue: false,
    isFreeTier: false,
    isEnterprise: false,
    isProfessional: true,
    isStarter: false,
    hasActiveSubscription: !mockConfig.subscriptionStatus.isTrial,
    needsPaymentMethod: mockConfig.subscriptionStatus.needsPaymentMethod,
  }),
}));

vi.mock('@/hooks/useFeatureAccess', () => ({
  useFeatureAccess: () => ({
    currentTier: mockConfig.featureAccess.currentTier,
    currentTierName: mockConfig.featureAccess.currentTierName,
    currentTierPrice: mockConfig.featureAccess.currentTierPrice,
    canAccess: () => true,
    subscriptionValid: true,
    isTrialExpired: false,
    isSuspended: false,
    isCancelled: false,
    isPastDue: false,
    getFeatureTier: vi.fn(),
    checkUpgrade: () => ({ required: false, targetTier: null, priceDifference: 0 }),
    getTierDisplayInfo: () => ({
      name: mockConfig.featureAccess.currentTierName,
      price: mockConfig.featureAccess.currentTierPrice,
    }),
    tenant: null,
  }),
}));

vi.mock('@/hooks/useCredits', () => ({
  useCredits: () => ({
    balance: 500,
    isFreeTier: false,
    isLowCredits: false,
    isCriticalCredits: false,
    isOutOfCredits: false,
    nextFreeGrantAt: null,
    lifetimeSpent: 0,
  }),
}));

vi.mock('@/lib/humanizeError', () => ({
  humanizeError: (error: unknown, fallback?: string) => {
    if (error instanceof Error) return error.message;
    return fallback ?? 'Unknown error';
  },
}));

vi.mock('@/lib/tierMapping', () => ({
  businessTierToSubscriptionTier: (tier: string) => {
    if (tier === 'block' || tier === 'hood') return 'professional';
    if (tier === 'empire') return 'enterprise';
    return 'starter';
  },
}));

vi.mock('@/lib/featureConfig', () => ({
  TIER_PRICES: { starter: 79, professional: 150, enterprise: 499 },
  TIER_NAMES: { starter: 'Starter', professional: 'Professional', enterprise: 'Enterprise' },
  getFeaturesByCategory: vi.fn().mockReturnValue({}),
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

// ---- Imports (after mocks) ----

import BillingSettings from '../BillingSettings';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const mockInvoke = vi.mocked(supabase.functions.invoke);
const mockToast = toast as unknown as { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

// ---- Helpers ----

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
  const user = userEvent.setup();

  const result = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <BillingSettings />
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return { ...result, user };
}

async function openCancelDialog(user: ReturnType<typeof userEvent.setup>) {
  const cancelBtn = await screen.findByRole('button', { name: /cancel subscription/i });
  await user.click(cancelBtn);
  await screen.findByText('Proceed to Cancel');
}

function stubEdgeFunctions(overrides?: Record<string, unknown>) {
  mockInvoke.mockImplementation((fnName: string) => {
    if (overrides && fnName in overrides) {
      return Promise.resolve(overrides[fnName]);
    }
    if (fnName === 'check-stripe-config') {
      return Promise.resolve({
        data: { configured: true, valid: true, testMode: false },
        error: null,
      });
    }
    if (fnName === 'invoice-management') {
      return Promise.resolve({ data: { invoices: [] }, error: null });
    }
    return Promise.resolve({ data: null, error: null });
  });
}

// ---- Tests ----

describe('BillingSettings — Cancel Dialog "Proceed to Cancel" button', () => {
  const mockWindowOpen = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mutable config to defaults
    mockConfig.featureAccess = {
      currentTier: 'block',
      currentTierName: 'Professional',
      currentTierPrice: 150,
    };
    mockConfig.subscriptionStatus = {
      isTrial: false,
      needsPaymentMethod: false,
    };
    stubEdgeFunctions();
    mockWindowOpen.mockReset();
    vi.spyOn(window, 'open').mockImplementation(mockWindowOpen);
  });

  it('calls stripe-customer-portal with tenant_id on click', async () => {
    stubEdgeFunctions({
      'stripe-customer-portal': {
        data: { url: 'https://billing.stripe.com/session/test' },
        error: null,
      },
    });

    const { user } = renderBillingSettings();
    await openCancelDialog(user);

    const proceedBtn = screen.getByRole('button', { name: /proceed to cancel/i });
    await user.click(proceedBtn);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('stripe-customer-portal', {
        body: { tenant_id: 'tenant-123' },
      });
    });
  });

  it('closes dialog immediately when Proceed to Cancel is clicked', async () => {
    let resolvePortal!: (value: unknown) => void;
    mockInvoke.mockImplementation((fnName: string) => {
      if (fnName === 'stripe-customer-portal') {
        return new Promise((resolve) => { resolvePortal = resolve; });
      }
      if (fnName === 'check-stripe-config') {
        return Promise.resolve({ data: { configured: true, valid: true, testMode: false }, error: null });
      }
      if (fnName === 'invoice-management') {
        return Promise.resolve({ data: { invoices: [] }, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const { user } = renderBillingSettings();
    await openCancelDialog(user);

    const proceedBtn = screen.getByRole('button', { name: /proceed to cancel/i });
    await user.click(proceedBtn);

    // Dialog should close immediately (before the edge function responds)
    await waitFor(() => {
      expect(screen.queryByText('Are you sure you want to cancel your subscription?')).not.toBeInTheDocument();
    });

    // Resolve the pending request to avoid dangling promises
    resolvePortal({ data: { url: 'https://billing.stripe.com/test' }, error: null });
  });

  it('opens Stripe portal URL in a new tab on success', async () => {
    const portalUrl = 'https://billing.stripe.com/session/portal-abc';

    stubEdgeFunctions({
      'stripe-customer-portal': { data: { url: portalUrl }, error: null },
    });

    const { user } = renderBillingSettings();
    await openCancelDialog(user);

    const proceedBtn = screen.getByRole('button', { name: /proceed to cancel/i });
    await user.click(proceedBtn);

    await waitFor(() => {
      expect(mockWindowOpen).toHaveBeenCalledWith(portalUrl, '_blank', 'noopener,noreferrer');
    });
  });

  it('shows success toast after opening Stripe portal', async () => {
    stubEdgeFunctions({
      'stripe-customer-portal': {
        data: { url: 'https://billing.stripe.com/session/ok' },
        error: null,
      },
    });

    const { user } = renderBillingSettings();
    await openCancelDialog(user);

    const proceedBtn = screen.getByRole('button', { name: /proceed to cancel/i });
    await user.click(proceedBtn);

    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith(
        'Manage Subscription',
        { description: 'Opening Stripe portal to manage your subscription...' },
      );
    });
  });

  it('shows error toast when edge function returns an error', async () => {
    stubEdgeFunctions({
      'stripe-customer-portal': {
        data: null,
        error: new Error('Edge function failed'),
      },
    });

    const { user } = renderBillingSettings();
    await openCancelDialog(user);

    const proceedBtn = screen.getByRole('button', { name: /proceed to cancel/i });
    await user.click(proceedBtn);

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(
        'Error',
        expect.objectContaining({ description: expect.any(String) }),
      );
    });
  });

  it('shows error toast when data contains error field', async () => {
    stubEdgeFunctions({
      'stripe-customer-portal': {
        data: { error: 'Stripe customer not found' },
        error: null,
      },
    });

    const { user } = renderBillingSettings();
    await openCancelDialog(user);

    const proceedBtn = screen.getByRole('button', { name: /proceed to cancel/i });
    await user.click(proceedBtn);

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(
        'Error',
        { description: 'Stripe customer not found' },
      );
    });
  });

  it('disables Cancel Subscription trigger button while loading', async () => {
    let resolvePortal!: (value: unknown) => void;
    mockInvoke.mockImplementation((fnName: string) => {
      if (fnName === 'stripe-customer-portal') {
        return new Promise((resolve) => { resolvePortal = resolve; });
      }
      if (fnName === 'check-stripe-config') {
        return Promise.resolve({ data: { configured: true, valid: true, testMode: false }, error: null });
      }
      if (fnName === 'invoice-management') {
        return Promise.resolve({ data: { invoices: [] }, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const { user } = renderBillingSettings();
    await openCancelDialog(user);

    const proceedBtn = screen.getByRole('button', { name: /proceed to cancel/i });
    await user.click(proceedBtn);

    // The dialog closes, but upgradeLoading is set — the trigger button should be disabled
    await waitFor(() => {
      const cancelTrigger = screen.getByRole('button', { name: /cancel subscription/i });
      expect(cancelTrigger).toBeDisabled();
    });

    // Resolve to clean up
    resolvePortal({ data: { url: 'https://billing.stripe.com/test' }, error: null });

    await waitFor(() => {
      const cancelTrigger = screen.getByRole('button', { name: /cancel subscription/i });
      expect(cancelTrigger).toBeEnabled();
    });
  });

  it('does not show Cancel Subscription button for starter tier', async () => {
    // Override to starter tier (street maps to starter)
    mockConfig.featureAccess = {
      currentTier: 'street',
      currentTierName: 'Starter',
      currentTierPrice: 79,
    };

    renderBillingSettings();

    // Wait for component to render
    await waitFor(() => {
      expect(screen.getByText(/manage subscription/i)).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /cancel subscription/i })).not.toBeInTheDocument();
  });

  it('does not show Cancel Subscription button during trial', async () => {
    mockConfig.subscriptionStatus = {
      isTrial: true,
      needsPaymentMethod: true,
    };

    renderBillingSettings();

    await waitFor(() => {
      expect(screen.getByText(/manage subscription/i)).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /cancel subscription/i })).not.toBeInTheDocument();
  });
});
