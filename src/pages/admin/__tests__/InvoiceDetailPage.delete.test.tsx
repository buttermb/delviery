/**
 * InvoiceDetailPage Delete Tests
 * Verifies delete button only appears for draft invoices
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock dependencies
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      delete: vi.fn().mockReturnThis(),
    }),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }),
    },
  },
}));

vi.mock('@/contexts/TenantContext', () => ({
  useTenant: vi.fn().mockReturnValue({
    tenant: { id: 'tenant-123', slug: 'test-tenant', business_name: 'Test Business', state: 'CA', phone: '555-1234', owner_email: 'owner@test.com' },
  }),
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: vi.fn().mockReturnValue({
    tenant: { id: 'tenant-123', slug: 'test-tenant', business_name: 'Test Business' },
    loading: false,
    admin: { id: 'admin-123', email: 'admin@test.com' },
    tenantSlug: 'test-tenant',
  }),
}));

vi.mock('@/hooks/crm/useAccountId', () => ({
  useAccountIdSafe: vi.fn().mockReturnValue('account-123'),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/contexts/ThemeContext', () => ({
  ThemeProvider: ({ children }: { children: ReactNode }) => children,
  useTheme: vi.fn().mockReturnValue({ theme: 'light', toggleTheme: vi.fn() }),
}));

vi.mock('@/utils/safeStorage', () => ({
  safeStorage: { getItem: vi.fn().mockReturnValue(null), setItem: vi.fn(), removeItem: vi.fn() },
}));

vi.mock('@/contexts/BreadcrumbContext', () => ({
  useBreadcrumbLabel: vi.fn(),
}));

vi.mock('@/lib/navigation/tenantNavigation', () => ({
  useTenantNavigation: vi.fn().mockReturnValue({
    navigateToAdmin: vi.fn(),
  }),
}));

vi.mock('@/hooks/useCredits', () => ({
  useCreditGatedAction: vi.fn(() => ({
    execute: vi.fn().mockResolvedValue(null),
    isPerforming: false,
    isFreeTier: true,
  })),
}));

vi.mock('@/hooks/useRelatedEntities', () => ({
  useRelatedInvoicePreOrders: vi.fn().mockReturnValue({
    items: [],
    isLoading: false,
    error: null,
    fetchItems: vi.fn(),
  }),
}));

const createMockInvoice = (status: string) => ({
  id: 'invoice-1',
  account_id: 'account-123',
  client_id: 'client-1',
  invoice_number: 'INV-001',
  invoice_date: '2025-01-01',
  due_date: '2025-02-01',
  issue_date: '2025-01-01',
  line_items: [{ id: 'item-1', description: 'Test item', quantity: 1, unit_price: 100, line_total: 100 }],
  subtotal: 100,
  tax_rate: 10,
  tax_amount: 10,
  tax: 10,
  total: 110,
  amount_paid: 0,
  payment_history: [],
  status,
  paid_at: null,
  public_token: 'token-123',
  created_from_pre_order_id: null,
  notes: null,
  currency: 'USD',
  exchange_rate: null,
  original_currency_total: null,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
  client: { id: 'client-1', name: 'Test Client', email: 'client@test.com', phone: null },
});

vi.mock('@/hooks/crm/useInvoices', () => ({
  useInvoices: vi.fn().mockReturnValue({
    useInvoiceQuery: vi.fn().mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    }),
    useMarkInvoiceSent: vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false }),
    useVoidInvoice: vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false }),
    useDuplicateInvoice: vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false }),
    useDeleteInvoice: vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false }),
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useParams: vi.fn().mockReturnValue({ tenantSlug: 'test-tenant', invoiceId: 'invoice-1' }),
  };
});

import { useInvoices } from '@/hooks/crm/useInvoices';
import InvoiceDetailPage from '../InvoiceDetailPage';

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={createQueryClient()}>
    <MemoryRouter initialEntries={['/test-tenant/admin/crm/invoices/invoice-1']}>
      {children}
    </MemoryRouter>
  </QueryClientProvider>
);

describe('InvoiceDetailPage Delete Button', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show delete button for draft invoices', () => {
    (useInvoices as ReturnType<typeof vi.fn>).mockReturnValue({
      useInvoiceQuery: vi.fn().mockReturnValue({
        data: createMockInvoice('draft'),
        isLoading: false,
        error: null,
      }),
      useMarkInvoiceSent: vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false }),
      useVoidInvoice: vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false }),
      useDuplicateInvoice: vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false }),
      useDeleteInvoice: vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false }),
    });

    render(<InvoiceDetailPage />, { wrapper });

    expect(screen.getByLabelText('Delete invoice')).toBeInTheDocument();
  });

  it('should not show delete button for sent invoices', () => {
    (useInvoices as ReturnType<typeof vi.fn>).mockReturnValue({
      useInvoiceQuery: vi.fn().mockReturnValue({
        data: createMockInvoice('sent'),
        isLoading: false,
        error: null,
      }),
      useMarkInvoiceSent: vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false }),
      useVoidInvoice: vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false }),
      useDuplicateInvoice: vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false }),
      useDeleteInvoice: vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false }),
    });

    render(<InvoiceDetailPage />, { wrapper });

    expect(screen.queryByLabelText('Delete invoice')).not.toBeInTheDocument();
  });

  it('should not show delete button for paid invoices', () => {
    (useInvoices as ReturnType<typeof vi.fn>).mockReturnValue({
      useInvoiceQuery: vi.fn().mockReturnValue({
        data: createMockInvoice('paid'),
        isLoading: false,
        error: null,
      }),
      useMarkInvoiceSent: vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false }),
      useVoidInvoice: vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false }),
      useDuplicateInvoice: vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false }),
      useDeleteInvoice: vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false }),
    });

    render(<InvoiceDetailPage />, { wrapper });

    expect(screen.queryByLabelText('Delete invoice')).not.toBeInTheDocument();
  });

  it('should not show delete button for overdue invoices', () => {
    (useInvoices as ReturnType<typeof vi.fn>).mockReturnValue({
      useInvoiceQuery: vi.fn().mockReturnValue({
        data: createMockInvoice('overdue'),
        isLoading: false,
        error: null,
      }),
      useMarkInvoiceSent: vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false }),
      useVoidInvoice: vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false }),
      useDuplicateInvoice: vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false }),
      useDeleteInvoice: vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false }),
    });

    render(<InvoiceDetailPage />, { wrapper });

    expect(screen.queryByLabelText('Delete invoice')).not.toBeInTheDocument();
  });

  it('should not show delete button for cancelled invoices', () => {
    (useInvoices as ReturnType<typeof vi.fn>).mockReturnValue({
      useInvoiceQuery: vi.fn().mockReturnValue({
        data: createMockInvoice('cancelled'),
        isLoading: false,
        error: null,
      }),
      useMarkInvoiceSent: vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false }),
      useVoidInvoice: vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false }),
      useDuplicateInvoice: vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false }),
      useDeleteInvoice: vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false }),
    });

    render(<InvoiceDetailPage />, { wrapper });

    expect(screen.queryByLabelText('Delete invoice')).not.toBeInTheDocument();
  });
});
