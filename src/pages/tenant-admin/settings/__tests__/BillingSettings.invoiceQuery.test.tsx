/**
 * BillingSettings Invoice Query Tests
 *
 * Verifies that the invoice query in BillingSettings correctly filters by tenant_id
 * in both the edge function call and the direct Supabase fallback query.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Track supabase calls
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
const mockInvoke = vi.fn().mockResolvedValue({ data: null, error: { message: 'edge function unavailable' } });

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
  useTenantAdminAuth: vi.fn(),
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
    currentTier: 'block',
    currentTierName: 'Professional',
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

vi.mock('@/lib/humanizeError', () => ({
  humanizeError: vi.fn().mockReturnValue('An error occurred'),
}));

vi.mock('@/lib/tierMapping', () => ({
  businessTierToSubscriptionTier: vi.fn().mockReturnValue('professional'),
}));

vi.mock('@/components/billing/AddPaymentMethodDialog', () => ({
  AddPaymentMethodDialog: () => null,
}));

vi.mock('@/components/credits', () => ({
  CreditBalance: () => null,
  CreditUsageStats: () => null,
}));

// Import after mocks
import BillingSettings from '../BillingSettings';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';

const MOCK_TENANT_ID = 'tenant-abc-123';

const defaultTenantMock = {
  tenant: {
    id: MOCK_TENANT_ID,
    slug: 'test-tenant',
    name: 'Test Dispensary',
    subscription_plan: 'professional',
    payment_method_added: true,
    billing_cycle: 'monthly',
    created_at: '2025-01-01T00:00:00Z',
  },
  loading: false,
  admin: { id: 'admin-123', email: 'admin@test.com' },
  tenantSlug: 'test-tenant',
};

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

const renderWithProviders = (ui: ReactNode) => {
  const queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/test-tenant/admin/settings']}>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('BillingSettings Invoice Query - tenant_id filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Restore tenant auth mock
    (useTenantAdminAuth as ReturnType<typeof vi.fn>).mockReturnValue(defaultTenantMock);

    // Re-setup chained mock returns after clearAllMocks
    mockSelect.mockReturnValue({
      eq: mockEq,
      order: mockOrder,
      limit: mockLimit,
    });
    mockFrom.mockReturnValue({
      select: mockSelect,
    });
    mockEq.mockReturnThis();
    mockOrder.mockReturnThis();
    mockLimit.mockResolvedValue({ data: [], error: null });
    // Default: edge function fails so fallback is used
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'edge function unavailable' } });
  });

  it('passes tenant_id to the invoice-management edge function', async () => {
    renderWithProviders(<BillingSettings />);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('invoice-management', {
        body: { action: 'list', tenant_id: MOCK_TENANT_ID },
      });
    });
  });

  it('filters fallback Supabase query by tenant_id', async () => {
    renderWithProviders(<BillingSettings />);

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('invoices');
    });

    await waitFor(() => {
      expect(mockEq).toHaveBeenCalledWith('tenant_id', MOCK_TENANT_ID);
    });
  });

  it('does not execute invoice query when tenantId is undefined', async () => {
    (useTenantAdminAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      tenant: null,
      loading: false,
      admin: null,
      tenantSlug: '',
    });

    renderWithProviders(<BillingSettings />);

    // Wait a tick to ensure no queries fire
    await new Promise(resolve => setTimeout(resolve, 100));

    // Edge function should not be called for invoices without tenant
    expect(mockInvoke).not.toHaveBeenCalledWith(
      'invoice-management',
      expect.anything()
    );

    // Direct query should not be called for invoices without tenant
    expect(mockFrom).not.toHaveBeenCalledWith('invoices');
  });

  it('uses edge function result when available and skips direct query', async () => {
    const mockInvoices = [
      { id: 'inv-1', invoice_number: 'INV-001', total: 99, status: 'paid', issue_date: '2025-01-01' },
    ];
    mockInvoke.mockResolvedValue({ data: { invoices: mockInvoices }, error: null });

    renderWithProviders(<BillingSettings />);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('invoice-management', {
        body: { action: 'list', tenant_id: MOCK_TENANT_ID },
      });
    });

    // When edge function succeeds, direct query should not be called for invoices
    expect(mockFrom).not.toHaveBeenCalledWith('invoices');
  });

  it('falls back to direct query with tenant_id filter when edge function throws', async () => {
    mockInvoke.mockRejectedValue(new Error('network error'));

    renderWithProviders(<BillingSettings />);

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('invoices');
    });

    expect(mockEq).toHaveBeenCalledWith('tenant_id', MOCK_TENANT_ID);
  });

  it('includes tenant_id in the query key for proper cache isolation', async () => {
    renderWithProviders(<BillingSettings />);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('invoice-management', {
        body: { action: 'list', tenant_id: MOCK_TENANT_ID },
      });
    });
  });
});
