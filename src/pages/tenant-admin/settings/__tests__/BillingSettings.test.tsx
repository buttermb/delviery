/**
 * BillingSettings — "Upgrade for Unlimited" button navigation test
 *
 * Verifies that a free-tier user clicking "Upgrade for Unlimited"
 * navigates to the select-plan page.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

// ============================================================================
// Mocks — must be before component import
// ============================================================================

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: { id: 'tenant-1', slug: 'test-shop', name: 'Test Shop' },
    isAuthenticated: true,
    accessToken: 'test-token',
  }),
}));

vi.mock('@/hooks/useSubscriptionStatus', () => ({
  useSubscriptionStatus: () => ({
    isTrial: false,
    needsPaymentMethod: false,
  }),
}));

vi.mock('@/hooks/useFeatureAccess', () => ({
  useFeatureAccess: () => ({
    currentTier: 'free' as const,
    currentTierName: 'Free',
  }),
}));

vi.mock('@/hooks/useCredits', () => ({
  useCredits: () => ({
    balance: 500,
    isFreeTier: true,
    isLowCredits: false,
    isCriticalCredits: false,
    isOutOfCredits: false,
    nextFreeGrantAt: null,
    lifetimeSpent: 500,
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }),
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
    }),
    removeChannel: vi.fn(),
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

vi.mock('@/lib/featureConfig', () => ({
  TIER_PRICES: { free: 0, starter: 49, professional: 149, enterprise: 399 },
  TIER_NAMES: { free: 'Free', starter: 'Starter', professional: 'Professional', enterprise: 'Enterprise' },
  getFeaturesByCategory: vi.fn().mockReturnValue([]),
}));

vi.mock('@/lib/tierMapping', () => ({
  businessTierToSubscriptionTier: vi.fn().mockReturnValue('free'),
}));

vi.mock('@/lib/credits', () => ({
  FREE_TIER_MONTHLY_CREDITS: 1000,
}));

vi.mock('@/components/credits', () => ({
  CreditBalance: () => <div data-testid="credit-balance">Balance</div>,
  CreditUsageStats: () => <div data-testid="credit-usage-stats">Usage</div>,
}));

vi.mock('@/components/billing/AddPaymentMethodDialog', () => ({
  AddPaymentMethodDialog: () => null,
}));

// ============================================================================
// Test helpers
// ============================================================================

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

async function renderBillingSettings() {
  const BillingSettings = (await import('@/pages/tenant-admin/settings/BillingSettings')).default;
  const queryClient = createTestQueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/test-shop/admin/settings/billing']}>
        <BillingSettings />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ============================================================================
// Tests
// ============================================================================

describe('BillingSettings', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('renders "Upgrade for Unlimited" button for free-tier users', async () => {
    await renderBillingSettings();

    const button = await screen.findByRole('button', { name: /upgrade for unlimited/i });
    expect(button).toBeInTheDocument();
  });

  it('navigates to select-plan when "Upgrade for Unlimited" is clicked', async () => {
    const user = userEvent.setup();
    await renderBillingSettings();

    const button = await screen.findByRole('button', { name: /upgrade for unlimited/i });
    await user.click(button);

    expect(mockNavigate).toHaveBeenCalledWith('/test-shop/admin/select-plan');
  });
});
