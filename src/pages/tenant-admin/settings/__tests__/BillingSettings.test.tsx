/**
 * BillingSettings Tests
 * Verifies the "Add Payment Method" button opens the AddPaymentMethodDialog
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

// Mock react-router-dom navigation
const mockNavigate = vi.fn();
const mockSetSearchParams = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams(), mockSetSearchParams],
  };
});

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: { configured: true, valid: true }, error: null }),
    },
  },
}));

// Mock tenant auth
vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: {
      id: 'tenant-123',
      slug: 'test-shop',
      name: 'Test Shop',
      subscription_plan: 'starter',
      payment_method_added: false,
      billing_cycle: 'monthly',
    },
    tenantSlug: 'test-shop',
    loading: false,
    admin: { id: 'admin-1', email: 'admin@test.com' },
  }),
}));

// Mock subscription status
vi.mock('@/hooks/useSubscriptionStatus', () => ({
  useSubscriptionStatus: () => ({
    isTrial: false,
    isActive: true,
    needsPaymentMethod: false,
    isFreeTier: false,
    currentTier: 'starter',
    status: 'active',
  }),
}));

// Mock feature access
vi.mock('@/hooks/useFeatureAccess', () => ({
  useFeatureAccess: () => ({
    currentTier: 'starter',
    currentTierName: 'Starter',
    hasAccess: () => true,
  }),
}));

// Mock credits
vi.mock('@/hooks/useCredits', () => ({
  useCredits: () => ({
    balance: 5000,
    isFreeTier: false,
    isLowCredits: false,
    isCriticalCredits: false,
    isOutOfCredits: false,
    nextFreeGrantAt: null,
    lifetimeSpent: 100,
  }),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock humanizeError
vi.mock('@/lib/humanizeError', () => ({
  humanizeError: (err: unknown) => String(err),
}));

// Mock credits components
vi.mock('@/components/credits', () => ({
  CreditBalance: () => <div data-testid="credit-balance">Credits</div>,
  CreditUsageStats: () => <div data-testid="credit-usage">Usage</div>,
}));

// Mock credits lib
vi.mock('@/lib/credits', () => ({
  FREE_TIER_MONTHLY_CREDITS: 10000,
}));

// Mock tierMapping
vi.mock('@/lib/tierMapping', () => ({
  businessTierToSubscriptionTier: () => 'starter',
}));

// Mock featureConfig
vi.mock('@/lib/featureConfig', () => ({
  TIER_PRICES: { starter: 99, professional: 199, enterprise: 599 },
  TIER_NAMES: { starter: 'Starter', professional: 'Professional', enterprise: 'Enterprise' },
  getFeaturesByCategory: () => ({}),
}));

// Mock formatters
vi.mock('@/lib/formatters', () => ({
  formatCurrency: (val: number) => `$${val}`,
  formatSmartDate: (d: string | Date) => typeof d === 'string' ? d : d.toISOString(),
}));

// Mock queryKeys
vi.mock('@/lib/queryKeys', () => ({
  queryKeys: {
    stripeHealth: { all: ['stripe-health'] },
    tenantInvoices: { byTenant: (id: string) => ['invoices', id] },
    subscriptionPlans: { all: ['subscription-plans'] },
    tenants: { all: ['tenants'] },
  },
}));

// Mock error handling
vi.mock('@/utils/errorHandling/handlers', () => ({
  handleError: vi.fn(),
}));

import BillingSettings from '../BillingSettings';

function renderBillingSettings() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <BillingSettings />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('BillingSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    // The AddPaymentMethodDialog should be open — it renders a dialog with title "Add Payment Method"
    // and description about trial
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
