import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mockFrom },
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: vi.fn().mockReturnValue({
    tenant: { id: 'tenant-123', slug: 'test-tenant' },
    loading: false,
    admin: { id: 'admin-123' },
    tenantSlug: 'test-tenant',
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { InvoicePartialPaymentTracker } from '../InvoicePartialPaymentTracker';

const createQueryClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false } } });

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={createQueryClient()}>
    {children}
  </QueryClientProvider>
);

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  invoiceId: 'invoice-1',
  invoiceNumber: 'INV-001',
  totalAmount: 1000,
  paidAmount: 200,
  payments: [],
  onSuccess: vi.fn(),
};

function setupMockFrom() {
  const eqTenantUpdate = vi.fn().mockResolvedValue({ error: null });
  const eqInvoiceUpdate = vi.fn().mockReturnValue({ eq: eqTenantUpdate });
  const updateMock = vi.fn().mockReturnValue({ eq: eqInvoiceUpdate });

  const eqTenantSelect = vi.fn().mockReturnValue({
    maybeSingle: vi.fn().mockResolvedValue({
      data: { payment_history: [] },
      error: null,
    }),
  });
  const eqInvoiceSelect = vi.fn().mockReturnValue({ eq: eqTenantSelect });
  const selectMock = vi.fn().mockReturnValue({ eq: eqInvoiceSelect });

  mockFrom.mockReturnValue({ select: selectMock, update: updateMock });
}

describe('InvoicePartialPaymentTracker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMockFrom();
  });

  it('renders dialog with invoice number', () => {
    render(<InvoicePartialPaymentTracker {...defaultProps} />, { wrapper });
    expect(screen.getByText(/Payment Tracking - Invoice #INV-001/)).toBeInTheDocument();
  });

  it('does not show Coming Soon badge', () => {
    render(<InvoicePartialPaymentTracker {...defaultProps} />, { wrapper });
    expect(screen.queryByText('Coming Soon')).not.toBeInTheDocument();
  });

  it('displays payment summary with correct amounts', () => {
    render(<InvoicePartialPaymentTracker {...defaultProps} />, { wrapper });
    expect(screen.getByText('Payment Summary')).toBeInTheDocument();
    expect(screen.getByText('20.0%')).toBeInTheDocument();
  });

  it('shows Fully Paid badge when remaining is zero', () => {
    render(
      <InvoicePartialPaymentTracker {...defaultProps} paidAmount={1000} />,
      { wrapper }
    );
    expect(screen.getByText('Fully Paid')).toBeInTheDocument();
  });

  it('hides Record Payment button when fully paid', () => {
    render(
      <InvoicePartialPaymentTracker {...defaultProps} paidAmount={1000} />,
      { wrapper }
    );
    // When fully paid, the "Record Payment" outline button should not be visible
    // Only Close button remains
    const buttons = screen.getAllByRole('button');
    const recordPaymentButtons = buttons.filter(
      (btn) => btn.textContent?.trim() === 'Record Payment'
    );
    expect(recordPaymentButtons).toHaveLength(0);
  });

  it('shows Record Payment button when balance remaining', () => {
    render(<InvoicePartialPaymentTracker {...defaultProps} />, { wrapper });
    expect(screen.getByRole('button', { name: /record payment/i })).toBeInTheDocument();
  });

  it('opens add payment form when Record Payment is clicked', async () => {
    const user = userEvent.setup();
    render(<InvoicePartialPaymentTracker {...defaultProps} />, { wrapper });

    await user.click(screen.getByRole('button', { name: /record payment/i }));

    // The form card title says "Record Payment" and the form has Amount field
    expect(screen.getByLabelText('Amount')).toBeInTheDocument();
    expect(screen.getByLabelText('Payment Method')).toBeInTheDocument();
  });

  it('displays payment history when payments exist', () => {
    const payments = [
      {
        id: 'p1',
        amount: 200,
        payment_method: 'card',
        payment_date: '2025-01-15',
        notes: 'First payment',
        created_at: '2025-01-15T00:00:00Z',
      },
    ];

    render(
      <InvoicePartialPaymentTracker {...defaultProps} payments={payments} />,
      { wrapper }
    );

    expect(screen.getByText('Payment History')).toBeInTheDocument();
    expect(screen.getByText('First payment')).toBeInTheDocument();
  });

  it('calls supabase on form submission', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();

    // Setup chained mock
    const eqTenantMock = vi.fn().mockResolvedValue({ error: null });
    const eqInvoiceMock = vi.fn().mockReturnValue({ eq: eqTenantMock });
    const updateMock = vi.fn().mockReturnValue({ eq: eqInvoiceMock });
    const selectMock = vi.fn().mockReturnThis();
    const eqSelectTenant = vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({
        data: { payment_history: [] },
        error: null,
      }),
    });
    const eqSelectInvoice = vi.fn().mockReturnValue({ eq: eqSelectTenant });

    mockFrom.mockReturnValue({
      select: selectMock.mockReturnValue({ eq: eqSelectInvoice }),
      update: updateMock,
    });

    render(
      <InvoicePartialPaymentTracker {...defaultProps} onSuccess={onSuccess} />,
      { wrapper }
    );

    // Click Record Payment to show form
    await user.click(screen.getByRole('button', { name: /record payment/i }));

    // Submit the form (uses default values)
    const submitButton = screen.getAllByRole('button', { name: /record payment/i });
    await user.click(submitButton[submitButton.length - 1]);

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('crm_invoices');
    });
  });
});
