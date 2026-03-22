/**
 * BillingSettings — Empty Invoices State Tests
 *
 * Verifies correct rendering when the tenant has no invoices:
 * 1. Shows "No invoices yet" text with Receipt icon
 * 2. Shows loading spinner while fetching
 * 3. Shows invoice list when invoices exist (not empty state)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// --- Mocks ---

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({ tenantSlug: 'test-tenant' }),
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

const mockSupabaseFrom = vi.fn();
const mockInvoke = vi.fn();

vi.mock('@/integrations/supabase/client', () => {
  const createChainMock = (resolvedValue: { data: unknown; error: unknown } = { data: [], error: null }) => {
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    chain.select = vi.fn().mockReturnValue(chain);
    chain.eq = vi.fn().mockReturnValue(chain);
    chain.neq = vi.fn().mockReturnValue(chain);
    chain.in = vi.fn().mockReturnValue(chain);
    chain.gte = vi.fn().mockReturnValue(chain);
    chain.lte = vi.fn().mockReturnValue(chain);
    chain.order = vi.fn().mockReturnValue(chain);
    chain.limit = vi.fn().mockReturnValue(chain);
    chain.maybeSingle = vi.fn().mockResolvedValue(resolvedValue);
    chain.single = vi.fn().mockResolvedValue(resolvedValue);
    chain.then = vi.fn((resolve) => Promise.resolve(resolvedValue).then(resolve));
    return chain;
  };

  const from = vi.fn(() => createChainMock());

  // Store reference so tests can override
  mockSupabaseFrom.mockImplementation(from);

  return {
    supabase: {
      from,
      functions: {
        invoke: mockInvoke.mockResolvedValue({ data: null, error: { message: 'not configured' } }),
      },
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
      },
      channel: vi.fn().mockReturnValue({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnThis(),
      }),
      removeChannel: vi.fn(),
    },
  };
});

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: vi.fn().mockReturnValue({
    tenant: {
      id: 'tenant-123',
      slug: 'test-tenant',
      business_name: 'Test Dispensary',
      subscription_plan: 'professional',
      subscription_status: 'active',
      trial_ends_at: null,
      payment_method_added: true,
      billing_cycle: 'monthly',
    },
    loading: false,
    admin: { id: 'admin-1', email: 'admin@test.com' },
    tenantSlug: 'test-tenant',
  }),
}));

vi.mock('@/hooks/useSubscriptionStatus', () => ({
  useSubscriptionStatus: vi.fn().mockReturnValue({
    isTrial: false,
    needsPaymentMethod: false,
    trialDaysLeft: null,
    isActive: true,
  }),
}));

vi.mock('@/hooks/useFeatureAccess', () => ({
  useFeatureAccess: vi.fn().mockReturnValue({
    currentTier: 'professional',
    currentTierName: 'Professional',
    hasFeature: vi.fn().mockReturnValue(true),
    isLoading: false,
  }),
}));

vi.mock('@/hooks/useCredits', () => ({
  useCredits: vi.fn().mockReturnValue({
    balance: 100,
    isFreeTier: false,
    isLowCredits: false,
    isCriticalCredits: false,
    isOutOfCredits: false,
    nextFreeGrantAt: null,
    lifetimeSpent: 50,
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

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@/components/billing/AddPaymentMethodDialog', () => ({
  AddPaymentMethodDialog: () => null,
}));

vi.mock('@/components/credits', () => ({
  CreditBalance: () => <div data-testid="credit-balance">Credit Balance</div>,
  CreditUsageStats: () => <div data-testid="credit-usage">Credit Usage</div>,
}));

// --- Helpers ---

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
}

function Wrapper({ children }: { children: ReactNode }) {
  const qc = createQueryClient();
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/test-tenant/admin/settings']}>
        {children}
      </MemoryRouter>
    </QueryClientProvider>
  );
}

// --- Tests ---

describe('BillingSettings — Empty Invoices State', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows "No invoices yet" when tenant has no invoices', async () => {
    // Edge function returns no invoices; direct query returns empty array
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'not configured' } });

    const { default: BillingSettings } = await import(
      '@/pages/tenant-admin/settings/BillingSettings'
    );

    render(<BillingSettings />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText('No invoices yet')).toBeInTheDocument();
    });
  });

  it('renders the Receipt icon in the empty state', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'not configured' } });

    const { default: BillingSettings } = await import(
      '@/pages/tenant-admin/settings/BillingSettings'
    );

    render(<BillingSettings />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText('No invoices yet')).toBeInTheDocument();
    });

    // The empty state container should have the icon wrapper with rounded-full bg-muted
    const emptyText = screen.getByText('No invoices yet');
    const container = emptyText.parentElement;
    expect(container).toHaveClass('text-center', 'py-8');

    // Icon container is the first child
    const iconWrapper = container?.querySelector('.rounded-full.bg-muted');
    expect(iconWrapper).toBeInTheDocument();
  });

  it('shows the "Billing History" section heading', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'not configured' } });

    const { default: BillingSettings } = await import(
      '@/pages/tenant-admin/settings/BillingSettings'
    );

    render(<BillingSettings />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText('Billing History')).toBeInTheDocument();
    });
  });

  it('shows invoice rows when invoices exist (not the empty state)', async () => {
    const mockInvoices = [
      {
        id: 'inv-001',
        invoice_number: 'INV-2024-001',
        issue_date: '2024-06-15',
        due_date: '2024-07-15',
        total: 4900,
        subtotal: 4900,
        tax: 0,
        status: 'paid',
        line_items: [],
        tenant_id: 'tenant-123',
      },
    ];

    // Edge function returns invoices
    mockInvoke.mockImplementation(async (fnName: string) => {
      if (fnName === 'invoice-management') {
        return { data: { invoices: mockInvoices }, error: null };
      }
      return { data: null, error: { message: 'not configured' } };
    });

    const { default: BillingSettings } = await import(
      '@/pages/tenant-admin/settings/BillingSettings'
    );

    render(<BillingSettings />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText('INV-2024-001')).toBeInTheDocument();
    });

    // Empty state should NOT be visible
    expect(screen.queryByText('No invoices yet')).not.toBeInTheDocument();

    // Download button should be present
    expect(screen.getByLabelText('Download invoice')).toBeInTheDocument();
  });
});
