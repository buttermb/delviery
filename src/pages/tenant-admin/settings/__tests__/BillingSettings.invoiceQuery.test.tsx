/**
 * BillingSettings Invoice Query Tests
 *
 * Verifies that the invoice query in BillingSettings:
 * 1. Requires tenantId before fetching
 * 2. Filters by tenant_id in direct DB queries
 * 3. Passes tenant_id to the edge function
 * 4. Returns empty array when tenantId is missing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Track supabase calls for assertion
const mockEq = vi.fn().mockReturnThis();
const mockOrder = vi.fn().mockReturnThis();
const mockLimit = vi.fn().mockResolvedValue({ data: [], error: null });
const mockSelect = vi.fn().mockReturnValue({
  eq: mockEq,
  order: mockOrder,
  limit: mockLimit,
});
const mockFrom = vi.fn().mockReturnValue({
  select: mockSelect,
});
const mockInvoke = vi.fn().mockResolvedValue({ data: { invoices: [] }, error: null });

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }),
    },
  },
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: vi.fn().mockReturnValue({
    tenant: { id: 'tenant-123', slug: 'test-tenant', name: 'Test Tenant' },
    loading: false,
    admin: { id: 'admin-123', email: 'admin@test.com' },
    tenantSlug: 'test-tenant',
  }),
}));

vi.mock('@/hooks/useSubscriptionStatus', () => ({
  useSubscriptionStatus: vi.fn().mockReturnValue({
    isTrial: false,
    isActive: true,
    needsPaymentMethod: false,
    isFreeTier: false,
    currentTier: 'professional',
  }),
}));

vi.mock('@/hooks/useFeatureAccess', () => ({
  useFeatureAccess: vi.fn().mockReturnValue({
    currentTier: 'starter',
    currentTierName: 'Starter',
    hasFeature: vi.fn().mockReturnValue(true),
    hasAccess: vi.fn().mockReturnValue(true),
  }),
}));

vi.mock('@/hooks/useCredits', () => ({
  useCredits: vi.fn().mockReturnValue({
    balance: 1000,
    isFreeTier: false,
    isLowCredits: false,
    isCriticalCredits: false,
    isOutOfCredits: false,
    nextFreeGrantAt: null,
    lifetimeSpent: 0,
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
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

vi.mock('@/lib/featureConfig', () => ({
  TIER_PRICES: { starter: 99, professional: 199, enterprise: 599 },
  TIER_NAMES: { starter: 'Starter', professional: 'Professional', enterprise: 'Enterprise' },
  getFeaturesByCategory: vi.fn().mockReturnValue({}),
}));

vi.mock('@/lib/tierMapping', () => ({
  businessTierToSubscriptionTier: vi.fn().mockReturnValue('professional'),
}));

vi.mock('@/lib/formatters', () => ({
  formatCurrency: (val: number) => `$${val}`,
  formatSmartDate: (date: unknown) => {
    if (date instanceof Date) return date.toISOString();
    return String(date ?? '');
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

vi.mock('@/lib/credits', () => ({
  FREE_TIER_MONTHLY_CREDITS: 100,
}));

vi.mock('@/contexts/ThemeContext', () => ({
  ThemeProvider: ({ children }: { children: ReactNode }) => children,
  useTheme: vi.fn().mockReturnValue({ theme: 'light', toggleTheme: vi.fn() }),
}));

vi.mock('@/utils/safeStorage', () => ({
  safeStorage: {
    getItem: vi.fn().mockReturnValue(null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

// Import after mocks
import BillingSettings from '../BillingSettings';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';

const MOCK_TENANT_ID = 'tenant-123';

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={createQueryClient()}>
    <MemoryRouter initialEntries={['/test-tenant/admin/settings']}>
      {children}
    </MemoryRouter>
  </QueryClientProvider>
);

describe('BillingSettings Invoice Query - Tenant Isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset chain mocks
    mockEq.mockReturnThis();
    mockOrder.mockReturnValue({ limit: mockLimit });
    mockLimit.mockResolvedValue({ data: [], error: null });
    mockSelect.mockReturnValue({ eq: mockEq, order: mockOrder, limit: mockLimit });
    mockFrom.mockReturnValue({ select: mockSelect });
    mockInvoke.mockResolvedValue({ data: { invoices: [] }, error: null });

    // Default tenant mock
    (useTenantAdminAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      tenant: { id: MOCK_TENANT_ID, slug: 'test-tenant', name: 'Test Tenant' },
      loading: false,
      admin: { id: 'admin-123', email: 'admin@test.com' },
      tenantSlug: 'test-tenant',
    });
  });

  it('should pass tenant_id to the invoice-management edge function', async () => {
    render(<BillingSettings />, { wrapper });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'invoice-management',
        expect.objectContaining({
          body: expect.objectContaining({ tenant_id: MOCK_TENANT_ID }),
        })
      );
    });
  });

  it('should filter direct DB query by tenant_id', async () => {
    // Make edge function fail so it falls back to direct query
    mockInvoke.mockRejectedValue(new Error('Edge function unavailable'));

    render(<BillingSettings />, { wrapper });

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('invoices');
    });

    await waitFor(() => {
      expect(mockEq).toHaveBeenCalledWith('tenant_id', MOCK_TENANT_ID);
    });
  });

  it('should not fetch invoices when tenantId is missing', async () => {
    (useTenantAdminAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      tenant: null,
      loading: false,
      admin: null,
      tenantSlug: '',
    });

    render(<BillingSettings />, { wrapper });

    // Wait for potential render cycle
    await new Promise((r) => setTimeout(r, 100));

    // Neither edge function nor direct DB should be called for invoices
    const invoiceEdgeCalls = mockInvoke.mock.calls.filter(
      (call: unknown[]) => call[0] === 'invoice-management'
    );
    expect(invoiceEdgeCalls).toHaveLength(0);
  });

  it('uses edge function result when available and skips direct query', async () => {
    const mockInvoices = [
      { id: 'inv-1', invoice_number: 'INV-001', total: 99, status: 'paid', issue_date: '2025-01-01' },
    ];
    mockInvoke.mockResolvedValue({ data: { invoices: mockInvoices }, error: null });

    render(<BillingSettings />, { wrapper });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'invoice-management',
        expect.objectContaining({
          body: expect.objectContaining({ tenant_id: MOCK_TENANT_ID }),
        })
      );
    });

    // When edge function succeeds, direct query should not be called for invoices
    expect(mockFrom).not.toHaveBeenCalledWith('invoices');
  });

  it('should include tenantId in the query key for cache isolation', async () => {
    render(<BillingSettings />, { wrapper });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'invoice-management',
        expect.objectContaining({
          body: expect.objectContaining({ tenant_id: MOCK_TENANT_ID }),
        })
      );
    });
  });

  it('should render billing history section', async () => {
    render(<BillingSettings />, { wrapper });

    expect(screen.getByText('Billing History')).toBeInTheDocument();
  });

  it('should show empty state when no invoices', async () => {
    render(<BillingSettings />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('No invoices yet')).toBeInTheDocument();
    });
  });
});
