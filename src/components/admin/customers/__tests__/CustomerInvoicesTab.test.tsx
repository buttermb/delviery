/**
 * CustomerInvoicesTab Tests
 * Tests for Send and Record Payment button handlers
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Hoist mock functions so they're available in vi.mock factories
const { mockNavigate, mockMarkAsSentMutate, mockRecordPaymentMutate } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockMarkAsSentMutate: vi.fn(),
  mockRecordPaymentMutate: vi.fn(),
}));

// Mock navigate
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ tenantSlug: 'test-tenant' }),
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }),
    },
  },
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: vi.fn().mockReturnValue({
    tenant: { id: 'tenant-123', slug: 'test-tenant', business_name: 'Test Business' },
    loading: false,
    admin: { id: 'admin-123', email: 'admin@test.com' },
    tenantSlug: 'test-tenant',
  }),
}));

vi.mock('@/hooks/useCustomerInvoices', () => ({
  useCustomerInvoices: vi.fn().mockReturnValue({
    useInvoicesQuery: vi.fn().mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    }),
    useMarkAsSent: vi.fn().mockReturnValue({
      mutate: mockMarkAsSentMutate,
      isPending: false,
    }),
    useRecordPayment: vi.fn().mockReturnValue({
      mutate: mockRecordPaymentMutate,
      isPending: false,
    }),
    useInvoiceStatsQuery: vi.fn().mockReturnValue({
      data: null,
      isLoading: false,
    }),
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
  },
}));

vi.mock('@/contexts/ThemeContext', () => ({
  ThemeProvider: ({ children }: { children: ReactNode }) => children,
  useTheme: vi.fn().mockReturnValue({
    theme: 'light',
    toggleTheme: vi.fn(),
  }),
}));

vi.mock('@/utils/safeStorage', () => ({
  safeStorage: {
    getItem: vi.fn().mockReturnValue(null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

// Import after mocks
import { CustomerInvoicesTab } from '../CustomerInvoicesTab';
import { useCustomerInvoices } from '@/hooks/useCustomerInvoices';
import { toast } from 'sonner';

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={createQueryClient()}>
    <MemoryRouter initialEntries={['/test-tenant/admin/customers/customer-1']}>
      {children}
    </MemoryRouter>
  </QueryClientProvider>
);

const mockInvoice = (overrides: Record<string, unknown> = {}) => ({
  id: 'inv-1',
  tenant_id: 'tenant-123',
  customer_id: 'customer-1',
  invoice_number: 'INV-001',
  status: 'unpaid',
  subtotal: 100,
  tax: 8.88,
  total: 108.88,
  amount_paid: 0,
  amount_due: 108.88,
  due_date: '2026-04-01',
  issue_date: '2026-03-01',
  paid_at: null,
  notes: null,
  line_items: null,
  created_at: '2026-03-01T00:00:00Z',
  updated_at: '2026-03-01T00:00:00Z',
  ...overrides,
});

describe('CustomerInvoicesTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Empty State', () => {
    it('should render empty state when no invoices exist', () => {
      render(<CustomerInvoicesTab customerId="customer-1" />, { wrapper });
      expect(screen.getByText('No Invoices Yet')).toBeInTheDocument();
    });
  });

  describe('Invoice List', () => {
    it('should render invoice cards when invoices exist', () => {
      (useCustomerInvoices as ReturnType<typeof vi.fn>).mockReturnValue({
        useInvoicesQuery: vi.fn().mockReturnValue({
          data: [mockInvoice()],
          isLoading: false,
          isError: false,
        }),
        useMarkAsSent: vi.fn().mockReturnValue({
          mutate: mockMarkAsSentMutate,
          isPending: false,
        }),
        useRecordPayment: vi.fn().mockReturnValue({
          mutate: mockRecordPaymentMutate,
          isPending: false,
        }),
      });

      render(<CustomerInvoicesTab customerId="customer-1" />, { wrapper });
      expect(screen.getByText(/INV-001/)).toBeInTheDocument();
    });
  });

  describe('Send Button', () => {
    it('should show Send button for draft invoices', () => {
      (useCustomerInvoices as ReturnType<typeof vi.fn>).mockReturnValue({
        useInvoicesQuery: vi.fn().mockReturnValue({
          data: [mockInvoice({ status: 'draft' })],
          isLoading: false,
          isError: false,
        }),
        useMarkAsSent: vi.fn().mockReturnValue({
          mutate: mockMarkAsSentMutate,
          isPending: false,
        }),
        useRecordPayment: vi.fn().mockReturnValue({
          mutate: mockRecordPaymentMutate,
          isPending: false,
        }),
      });

      render(<CustomerInvoicesTab customerId="customer-1" />, { wrapper });
      expect(screen.getByText('Send')).toBeInTheDocument();
    });

    it('should not show Send button for non-draft invoices', () => {
      (useCustomerInvoices as ReturnType<typeof vi.fn>).mockReturnValue({
        useInvoicesQuery: vi.fn().mockReturnValue({
          data: [mockInvoice({ status: 'unpaid' })],
          isLoading: false,
          isError: false,
        }),
        useMarkAsSent: vi.fn().mockReturnValue({
          mutate: mockMarkAsSentMutate,
          isPending: false,
        }),
        useRecordPayment: vi.fn().mockReturnValue({
          mutate: mockRecordPaymentMutate,
          isPending: false,
        }),
      });

      render(<CustomerInvoicesTab customerId="customer-1" />, { wrapper });
      expect(screen.queryByText('Send')).not.toBeInTheDocument();
    });

    it('should call markAsSent when Send is clicked', async () => {
      const user = userEvent.setup();

      (useCustomerInvoices as ReturnType<typeof vi.fn>).mockReturnValue({
        useInvoicesQuery: vi.fn().mockReturnValue({
          data: [mockInvoice({ status: 'draft' })],
          isLoading: false,
          isError: false,
        }),
        useMarkAsSent: vi.fn().mockReturnValue({
          mutate: mockMarkAsSentMutate,
          isPending: false,
        }),
        useRecordPayment: vi.fn().mockReturnValue({
          mutate: mockRecordPaymentMutate,
          isPending: false,
        }),
      });

      render(<CustomerInvoicesTab customerId="customer-1" />, { wrapper });

      await user.click(screen.getByText('Send'));

      expect(mockMarkAsSentMutate).toHaveBeenCalledWith('inv-1');
    });
  });

  describe('Record Payment Button', () => {
    it('should show Record Payment for unpaid invoices', () => {
      (useCustomerInvoices as ReturnType<typeof vi.fn>).mockReturnValue({
        useInvoicesQuery: vi.fn().mockReturnValue({
          data: [mockInvoice({ status: 'unpaid' })],
          isLoading: false,
          isError: false,
        }),
        useMarkAsSent: vi.fn().mockReturnValue({
          mutate: mockMarkAsSentMutate,
          isPending: false,
        }),
        useRecordPayment: vi.fn().mockReturnValue({
          mutate: mockRecordPaymentMutate,
          isPending: false,
        }),
      });

      render(<CustomerInvoicesTab customerId="customer-1" />, { wrapper });
      expect(screen.getByText('Record Payment')).toBeInTheDocument();
    });

    it('should not show Record Payment for paid invoices', () => {
      (useCustomerInvoices as ReturnType<typeof vi.fn>).mockReturnValue({
        useInvoicesQuery: vi.fn().mockReturnValue({
          data: [mockInvoice({ status: 'paid', paid_at: '2026-03-15T00:00:00Z' })],
          isLoading: false,
          isError: false,
        }),
        useMarkAsSent: vi.fn().mockReturnValue({
          mutate: mockMarkAsSentMutate,
          isPending: false,
        }),
        useRecordPayment: vi.fn().mockReturnValue({
          mutate: mockRecordPaymentMutate,
          isPending: false,
        }),
      });

      render(<CustomerInvoicesTab customerId="customer-1" />, { wrapper });
      expect(screen.queryByText('Record Payment')).not.toBeInTheDocument();
    });

    it('should open payment dialog on click', async () => {
      const user = userEvent.setup();

      (useCustomerInvoices as ReturnType<typeof vi.fn>).mockReturnValue({
        useInvoicesQuery: vi.fn().mockReturnValue({
          data: [mockInvoice({ status: 'unpaid' })],
          isLoading: false,
          isError: false,
        }),
        useMarkAsSent: vi.fn().mockReturnValue({
          mutate: mockMarkAsSentMutate,
          isPending: false,
        }),
        useRecordPayment: vi.fn().mockReturnValue({
          mutate: mockRecordPaymentMutate,
          isPending: false,
        }),
      });

      render(<CustomerInvoicesTab customerId="customer-1" />, { wrapper });

      await user.click(screen.getByText('Record Payment'));

      await waitFor(() => {
        expect(screen.getByText(/Invoice total/)).toBeInTheDocument();
      });
    });

    it('should show error when submitting invalid payment', async () => {
      const user = userEvent.setup();

      (useCustomerInvoices as ReturnType<typeof vi.fn>).mockReturnValue({
        useInvoicesQuery: vi.fn().mockReturnValue({
          data: [mockInvoice({ status: 'unpaid' })],
          isLoading: false,
          isError: false,
        }),
        useMarkAsSent: vi.fn().mockReturnValue({
          mutate: mockMarkAsSentMutate,
          isPending: false,
        }),
        useRecordPayment: vi.fn().mockReturnValue({
          mutate: mockRecordPaymentMutate,
          isPending: false,
        }),
      });

      render(<CustomerInvoicesTab customerId="customer-1" />, { wrapper });

      // Open dialog
      await user.click(screen.getByText('Record Payment'));

      await waitFor(() => {
        expect(screen.getByText(/Invoice total/)).toBeInTheDocument();
      });

      // Submit without entering amount
      const dialogButtons = screen.getAllByText('Record Payment');
      const submitButton = dialogButtons[dialogButtons.length - 1];
      await user.click(submitButton);

      expect(toast.error).toHaveBeenCalledWith('Please enter a valid payment amount');
    });
  });

  describe('View Button', () => {
    it('should navigate to invoice detail when View is clicked', async () => {
      const user = userEvent.setup();

      (useCustomerInvoices as ReturnType<typeof vi.fn>).mockReturnValue({
        useInvoicesQuery: vi.fn().mockReturnValue({
          data: [mockInvoice()],
          isLoading: false,
          isError: false,
        }),
        useMarkAsSent: vi.fn().mockReturnValue({
          mutate: mockMarkAsSentMutate,
          isPending: false,
        }),
        useRecordPayment: vi.fn().mockReturnValue({
          mutate: mockRecordPaymentMutate,
          isPending: false,
        }),
      });

      render(<CustomerInvoicesTab customerId="customer-1" />, { wrapper });

      await user.click(screen.getByText('View'));

      expect(mockNavigate).toHaveBeenCalledWith('/test-tenant/admin/invoices/inv-1');
    });
  });
});
