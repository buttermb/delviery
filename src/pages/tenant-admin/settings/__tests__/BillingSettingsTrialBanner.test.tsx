import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test/utils/test-utils';

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();
const mockSetSearchParams = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams(), mockSetSearchParams],
  };
});

const mockTenant = {
  id: 'tenant-123',
  name: 'Test Dispensary',
  slug: 'test-dispensary',
  subscription_plan: 'professional',
  subscription_status: 'trialing',
  trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  payment_method_added: false,
  billing_cycle: 'monthly' as const,
  created_at: new Date().toISOString(),
};

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: mockTenant,
    tenantSlug: 'test-dispensary',
  }),
}));

let mockIsTrial = true;
let mockNeedsPaymentMethod = true;

vi.mock('@/hooks/useSubscriptionStatus', () => ({
  useSubscriptionStatus: () => ({
    isTrial: mockIsTrial,
    needsPaymentMethod: mockNeedsPaymentMethod,
    isFreeTier: false,
    isActive: false,
    currentTier: 'professional',
  }),
}));

vi.mock('@/hooks/useFeatureAccess', () => ({
  useFeatureAccess: () => ({
    currentTier: 'professional',
    currentTierName: 'Professional',
    canAccess: () => true,
  }),
}));

vi.mock('@/hooks/useCredits', () => ({
  useCredits: () => ({
    balance: 100,
    isFreeTier: false,
    isLowCredits: false,
    isCriticalCredits: false,
    isOutOfCredits: false,
    nextFreeGrantAt: null,
    lifetimeSpent: 0,
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: { configured: true, valid: true }, error: null }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => Promise.resolve({ data: [], error: null }),
          }),
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
    }),
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

vi.mock('@/lib/formatters', () => ({
  formatCurrency: (val: number) => `$${val}`,
  formatSmartDate: (date: string | Date) =>
    new Date(typeof date === 'string' ? date : date.toISOString()).toLocaleDateString(),
}));

vi.mock('@/lib/tierMapping', () => ({
  businessTierToSubscriptionTier: () => 'professional',
}));

vi.mock('@/components/billing/AddPaymentMethodDialog', () => ({
  AddPaymentMethodDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="payment-dialog">Payment Dialog</div> : null,
}));

vi.mock('@/components/credits', () => ({
  CreditBalance: () => null,
  CreditUsageStats: () => null,
}));

import BillingSettings from '@/pages/tenant-admin/settings/BillingSettings';

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('BillingSettings trial banner button', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsTrial = true;
    mockNeedsPaymentMethod = true;
    mockTenant.trial_ends_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    mockTenant.payment_method_added = false;
  });

  it('shows trial banner when subscription is in trial with days remaining', () => {
    render(<BillingSettings />);
    expect(screen.getByText(/days left in trial/i)).toBeInTheDocument();
  });

  it('shows "Add Payment Method" button in trial banner when payment method is missing', () => {
    mockNeedsPaymentMethod = true;

    render(<BillingSettings />);
    // Trial banner button has amber background; find it within the trial banner container
    const addPaymentBtns = screen.getAllByRole('button', { name: /add payment method/i });
    const trialBannerBtn = addPaymentBtns.find((btn) =>
      btn.className.includes('bg-amber-600')
    );
    expect(trialBannerBtn).toBeDefined();
  });

  it('opens payment dialog when trial banner "Add Payment Method" is clicked', () => {
    mockNeedsPaymentMethod = true;

    render(<BillingSettings />);
    const addPaymentBtns = screen.getAllByRole('button', { name: /add payment method/i });
    const trialBannerBtn = addPaymentBtns.find((btn) =>
      btn.className.includes('bg-amber-600')
    )!;
    fireEvent.click(trialBannerBtn);

    expect(screen.getByTestId('payment-dialog')).toBeInTheDocument();
  });

  it('shows "Upgrade Now" button when payment method exists', () => {
    mockNeedsPaymentMethod = false;
    mockTenant.payment_method_added = true;

    render(<BillingSettings />);
    const upgradeBtn = screen.getByRole('button', { name: /upgrade now/i });
    expect(upgradeBtn).toBeInTheDocument();
  });

  it('shows helper text prompting payment method when missing', () => {
    mockNeedsPaymentMethod = true;

    render(<BillingSettings />);
    expect(
      screen.getByText(/add a payment method to continue after trial/i)
    ).toBeInTheDocument();
  });

  it('shows helper text to upgrade when payment method exists', () => {
    mockNeedsPaymentMethod = false;
    mockTenant.payment_method_added = true;

    render(<BillingSettings />);
    expect(
      screen.getByText(/upgrade now to keep all features/i)
    ).toBeInTheDocument();
  });

  it('does not show trial banner when not in trial', () => {
    mockIsTrial = false;

    render(<BillingSettings />);
    expect(screen.queryByText(/days left in trial/i)).not.toBeInTheDocument();
  });

  it('does not show trial banner when trial has expired (0 days left)', () => {
    mockTenant.trial_ends_at = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    render(<BillingSettings />);
    expect(screen.queryByText(/days left in trial/i)).not.toBeInTheDocument();
  });
});
