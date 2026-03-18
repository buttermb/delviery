/**
 * CustomerInvoices Tests
 * Tests for invoice action buttons: Send Invoice, View Invoice, Record Payment
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

// Mock dependencies before importing the component
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
      range: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
    }),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
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
    useMarkAsSent: vi.fn().mockReturnValue({
      mutate: mockMarkAsSentMutate,
      isPending: false,
    }),
    useRecordPayment: vi.fn().mockReturnValue({
      mutate: mockRecordPaymentMutate,
      isPending: false,
    }),
    useInvoicesQuery: vi.fn().mockReturnValue({
      data: [],
      isLoading: false,
    }),
    useInvoiceStatsQuery: vi.fn().mockReturnValue({
      data: null,
      isLoading: false,
    }),
  }),
}));

vi.mock('@/utils/adminFunctionHelper', () => ({
  callAdminFunction: vi.fn().mockResolvedValue({ data: null, error: 'not available' }),
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
import CustomerInvoices from '../CustomerInvoices';
import { supabase } from '@/integrations/supabase/client';
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
    <MemoryRouter initialEntries={['/test-tenant/admin/customer-invoices']}>
      {children}
    </MemoryRouter>
  </QueryClientProvider>
);

const setupMockInvoices = (invoices: Array<{
  id: string;
  invoice_number: string;
  customer_id: string;
  status: string;
  total: number;
  due_date?: string;
  created_at: string;
}>) => {
  const fromMock = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue({
      data: invoices,
      error: null,
      count: invoices.length,
    }),
  });
  (supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
    if (table === 'customers') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [
            { id: 'customer-1', first_name: 'John', last_name: 'Doe', email: 'john@test.com' },
          ],
          error: null,
        }),
      };
    }
    return fromMock();
  });
};

describe('CustomerInvoices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Page Rendering', () => {
    it('should render page title', async () => {
      render(<CustomerInvoices />, { wrapper });
      expect(screen.getByText('Customer Invoices')).toBeInTheDocument();
    });

    it('should render Create Invoice button', async () => {
      render(<CustomerInvoices />, { wrapper });
      await waitFor(() => {
        const createButtons = screen.getAllByRole('button', { name: /create invoice/i });
        expect(createButtons.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Send Invoice Button', () => {
    it('should show Send Invoice button only for draft invoices', async () => {
      setupMockInvoices([
        {
          id: 'inv-1',
          invoice_number: 'INV-001',
          customer_id: 'customer-1',
          status: 'draft',
          total: 100,
          due_date: '2026-04-01',
          created_at: '2026-03-01T00:00:00Z',
        },
      ]);

      render(<CustomerInvoices />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Send Invoice')).toBeInTheDocument();
      });
    });

    it('should not show Send Invoice button for non-draft invoices', async () => {
      setupMockInvoices([
        {
          id: 'inv-1',
          invoice_number: 'INV-001',
          customer_id: 'customer-1',
          status: 'unpaid',
          total: 100,
          due_date: '2026-04-01',
          created_at: '2026-03-01T00:00:00Z',
        },
      ]);

      render(<CustomerInvoices />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText(/INV-001/)).toBeInTheDocument();
      });

      expect(screen.queryByText('Send Invoice')).not.toBeInTheDocument();
    });

    it('should call markAsSent mutation when Send Invoice is clicked', async () => {
      const user = userEvent.setup();

      setupMockInvoices([
        {
          id: 'inv-1',
          invoice_number: 'INV-001',
          customer_id: 'customer-1',
          status: 'draft',
          total: 100,
          due_date: '2026-04-01',
          created_at: '2026-03-01T00:00:00Z',
        },
      ]);

      render(<CustomerInvoices />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Send Invoice')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Send Invoice'));

      expect(mockMarkAsSentMutate).toHaveBeenCalledWith('inv-1', expect.any(Object));
    });
  });

  describe('View Invoice Button', () => {
    it('should navigate to invoice detail when View Invoice is clicked', async () => {
      const user = userEvent.setup();

      setupMockInvoices([
        {
          id: 'inv-1',
          invoice_number: 'INV-001',
          customer_id: 'customer-1',
          status: 'unpaid',
          total: 100,
          due_date: '2026-04-01',
          created_at: '2026-03-01T00:00:00Z',
        },
      ]);

      render(<CustomerInvoices />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('View Invoice')).toBeInTheDocument();
      });

      await user.click(screen.getByText('View Invoice'));

      expect(mockNavigate).toHaveBeenCalledWith('/test-tenant/admin/invoices/inv-1');
    });
  });

  describe('Record Payment Button', () => {
    it('should show Record Payment button for unpaid invoices', async () => {
      setupMockInvoices([
        {
          id: 'inv-1',
          invoice_number: 'INV-001',
          customer_id: 'customer-1',
          status: 'unpaid',
          total: 100,
          due_date: '2026-04-01',
          created_at: '2026-03-01T00:00:00Z',
        },
      ]);

      render(<CustomerInvoices />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Record Payment')).toBeInTheDocument();
      });
    });

    it('should not show Record Payment button for paid invoices', async () => {
      setupMockInvoices([
        {
          id: 'inv-1',
          invoice_number: 'INV-001',
          customer_id: 'customer-1',
          status: 'paid',
          total: 100,
          due_date: '2026-04-01',
          created_at: '2026-03-01T00:00:00Z',
        },
      ]);

      render(<CustomerInvoices />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText(/INV-001/)).toBeInTheDocument();
      });

      expect(screen.queryByText('Record Payment')).not.toBeInTheDocument();
    });

    it('should open payment dialog when Record Payment is clicked', async () => {
      const user = userEvent.setup();

      setupMockInvoices([
        {
          id: 'inv-1',
          invoice_number: 'INV-001',
          customer_id: 'customer-1',
          status: 'unpaid',
          total: 250.00,
          due_date: '2026-04-01',
          created_at: '2026-03-01T00:00:00Z',
        },
      ]);

      render(<CustomerInvoices />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Record Payment')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Record Payment'));

      // Payment dialog should appear with invoice total
      await waitFor(() => {
        expect(screen.getByText(/Invoice total: \$250\.00/)).toBeInTheDocument();
      });
    });

    it('should show error when submitting empty payment amount', async () => {
      const user = userEvent.setup();

      setupMockInvoices([
        {
          id: 'inv-1',
          invoice_number: 'INV-001',
          customer_id: 'customer-1',
          status: 'unpaid',
          total: 100,
          due_date: '2026-04-01',
          created_at: '2026-03-01T00:00:00Z',
        },
      ]);

      render(<CustomerInvoices />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Record Payment')).toBeInTheDocument();
      });

      // Open the dialog
      await user.click(screen.getByText('Record Payment'));

      // Click submit without entering amount
      const dialogButtons = screen.getAllByText('Record Payment');
      const submitButton = dialogButtons[dialogButtons.length - 1];
      await user.click(submitButton);

      expect(toast.error).toHaveBeenCalledWith('Please enter a valid payment amount');
    });
  });
});
