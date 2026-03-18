import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { InvoicePartialPaymentTracker } from '../InvoicePartialPaymentTracker';

// Use vi.hoisted so mocks can reference these before vi.mock hoisting
const { mockMaybeSingle, mockFrom, mockInvalidateOnEvent, mockToastSuccess, mockToastError } = vi.hoisted(() => {
  const mockMaybeSingle = vi.fn();

  const mockEq2 = vi.fn().mockImplementation(() => ({
    maybeSingle: mockMaybeSingle,
    eq: vi.fn().mockResolvedValue({ error: null }),
  }));

  const mockEq1 = vi.fn().mockImplementation(() => ({
    eq: mockEq2,
    maybeSingle: mockMaybeSingle,
  }));

  const mockFrom = vi.fn().mockImplementation(() => ({
    select: vi.fn().mockImplementation(() => ({
      eq: mockEq1,
    })),
    update: vi.fn().mockImplementation(() => ({
      eq: mockEq1,
    })),
  }));

  return {
    mockMaybeSingle,
    mockFrom,
    mockInvalidateOnEvent: vi.fn(),
    mockToastSuccess: vi.fn(),
    mockToastError: vi.fn(),
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mockFrom },
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: { id: 'tenant-123', slug: 'test-tenant', business_name: 'Test Business' },
    loading: false,
    admin: { id: 'admin-123', email: 'admin@test.com' },
    tenantSlug: 'test-tenant',
  }),
}));

vi.mock('@/lib/invalidation', () => ({
  invalidateOnEvent: (...args: unknown[]) => mockInvalidateOnEvent(...args),
}));

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/humanizeError', () => ({
  humanizeError: (err: unknown) =>
    err instanceof Error ? err.message : 'Something went wrong',
}));

vi.mock('@/lib/utils/formatCurrency', () => ({
  formatCurrency: (val: number) => `$${val.toFixed(2)}`,
}));

vi.mock('@/lib/constants/paymentMethods', () => ({
  INVOICE_PAYMENT_METHODS: [
    { value: 'cash', label: 'Cash' },
    { value: 'check', label: 'Check' },
    { value: 'bank_transfer', label: 'Bank Transfer' },
    { value: 'card', label: 'Card' },
    { value: 'other', label: 'Other' },
  ],
  formatPaymentMethod: (method: string) =>
    ({ cash: 'Cash', check: 'Check', bank_transfer: 'Bank Transfer', card: 'Card', other: 'Other' }[method] ?? method),
}));

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  invoiceId: 'invoice-123',
  invoiceNumber: 'INV-2026-001',
  totalAmount: 1000,
  paidAmount: 250,
  onSuccess: vi.fn(),
};

function renderComponent(props = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <InvoicePartialPaymentTracker {...defaultProps} {...props} />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

describe('InvoicePartialPaymentTracker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMaybeSingle.mockResolvedValue({
      data: { payment_history: [], client_id: 'client-abc' },
      error: null,
    });
  });

  describe('rendering', () => {
    it('renders the dialog with invoice number', () => {
      renderComponent();
      expect(screen.getByText(/Payment Tracking - Invoice #INV-2026-001/)).toBeInTheDocument();
    });

    it('displays payment summary with correct amounts', () => {
      renderComponent();
      expect(screen.getByText('$1000.00')).toBeInTheDocument();
      expect(screen.getByText('$250.00')).toBeInTheDocument();
      expect(screen.getByText('$750.00')).toBeInTheDocument();
    });

    it('shows progress percentage', () => {
      renderComponent();
      expect(screen.getByText('25.0%')).toBeInTheDocument();
    });

    it('shows Fully Paid badge when remaining is 0', () => {
      renderComponent({ paidAmount: 1000 });
      expect(screen.getByText('Fully Paid')).toBeInTheDocument();
    });

    it('hides payment form when fully paid', () => {
      renderComponent({ paidAmount: 1000 });
      expect(screen.queryByRole('button', { name: /Record Payment/i })).not.toBeInTheDocument();
    });

    it('shows Record Payment button when there is remaining balance', () => {
      renderComponent();
      expect(screen.getByRole('button', { name: /Record Payment/i })).toBeInTheDocument();
    });

    it('does not show Coming Soon badge', () => {
      renderComponent();
      expect(screen.queryByText('Coming Soon')).not.toBeInTheDocument();
    });

    it('renders payment method select placeholder', () => {
      renderComponent();
      expect(screen.getByText('Select method')).toBeInTheDocument();
    });
  });

  describe('payment history', () => {
    it('displays payment history section when data is returned', async () => {
      mockMaybeSingle.mockResolvedValue({
        data: {
          payment_history: [
            {
              amount: 250,
              method: 'cash',
              date: '2026-01-15',
              notes: 'First payment',
              recorded_at: '2026-01-15T10:00:00Z',
            },
          ],
          client_id: 'client-abc',
        },
        error: null,
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Payment History')).toBeInTheDocument();
      });
    });
  });

  describe('form validation', () => {
    it('shows max amount description', () => {
      renderComponent();
      expect(screen.getByText('Max: $750.00')).toBeInTheDocument();
    });
  });

  describe('dialog controls', () => {
    it('calls onOpenChange when Close button is clicked', async () => {
      const onOpenChange = vi.fn();
      renderComponent({ onOpenChange });

      // Get all Close buttons (Radix adds its own close button)
      const closeButtons = screen.getAllByRole('button', { name: 'Close' });
      // Click the visible footer Close button (last one)
      await userEvent.click(closeButtons[closeButtons.length - 1]);

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('does not render when open is false', () => {
      renderComponent({ open: false });
      expect(screen.queryByText(/Payment Tracking/)).not.toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('handles zero total amount without division by zero', () => {
      renderComponent({ totalAmount: 0, paidAmount: 0 });
      expect(screen.getByText('0.0%')).toBeInTheDocument();
    });

    it('handles overpayment gracefully', () => {
      renderComponent({ paidAmount: 1500 });
      expect(screen.getByText('Fully Paid')).toBeInTheDocument();
    });
  });
});
