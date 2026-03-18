import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { mockInsert, mockFrom } = vi.hoisted(() => ({
  mockInsert: vi.fn().mockResolvedValue({ error: null }),
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

import { InvoiceCreditNoteSystem } from '../InvoiceCreditNoteSystem';
import { toast } from 'sonner';

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
  invoiceAmount: 1000,
  creditNotes: [],
  onSuccess: vi.fn(),
};

describe('InvoiceCreditNoteSystem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ insert: mockInsert });
  });

  it('renders dialog with invoice number', () => {
    render(<InvoiceCreditNoteSystem {...defaultProps} />, { wrapper });
    expect(screen.getByText(/Credit Notes - Invoice #INV-001/)).toBeInTheDocument();
  });

  it('does not show Coming Soon badge', () => {
    render(<InvoiceCreditNoteSystem {...defaultProps} />, { wrapper });
    expect(screen.queryByText('Coming Soon')).not.toBeInTheDocument();
  });

  it('displays credit summary', () => {
    render(<InvoiceCreditNoteSystem {...defaultProps} />, { wrapper });
    expect(screen.getByText('Credit Summary')).toBeInTheDocument();
    expect(screen.getByText('Invoice Amount')).toBeInTheDocument();
    expect(screen.getByText('Total Credits')).toBeInTheDocument();
  });

  it('shows Issue Credit Note button', () => {
    render(<InvoiceCreditNoteSystem {...defaultProps} />, { wrapper });
    expect(screen.getByRole('button', { name: /issue credit note/i })).toBeInTheDocument();
  });

  it('opens create form when Issue Credit Note is clicked', async () => {
    const user = userEvent.setup();
    render(<InvoiceCreditNoteSystem {...defaultProps} />, { wrapper });

    await user.click(screen.getByRole('button', { name: /issue credit note/i }));

    expect(screen.getByLabelText('Credit Amount')).toBeInTheDocument();
    // "Reason" label exists in the form
    expect(screen.getByText('Reason', { selector: 'label' })).toBeInTheDocument();
    expect(screen.getByLabelText('Notes')).toBeInTheDocument();
  });

  it('displays existing credit notes', () => {
    const creditNotes = [
      {
        id: 'cn-1',
        credit_note_number: 'CN-INV-001-20250115',
        credit_amount: 100,
        reason: 'return',
        notes: 'Returned item',
        issue_date: '2025-01-15',
        status: 'issued' as const,
        created_at: '2025-01-15T00:00:00Z',
      },
    ];

    render(
      <InvoiceCreditNoteSystem {...defaultProps} creditNotes={creditNotes} />,
      { wrapper }
    );

    expect(screen.getByText('Credit Notes (1)')).toBeInTheDocument();
    expect(screen.getByText('#CN-INV-001-20250115')).toBeInTheDocument();
    // Credit note reason is displayed alongside the amount
    expect(screen.getByText(/Product Return/)).toBeInTheDocument();
    expect(screen.getByText('Returned item')).toBeInTheDocument();
  });

  it('calls supabase insert on form submission', async () => {
    const user = userEvent.setup();

    render(<InvoiceCreditNoteSystem {...defaultProps} />, { wrapper });

    // Open form
    await user.click(screen.getByRole('button', { name: /issue credit note/i }));

    // Fill in amount
    const amountInput = screen.getByLabelText('Credit Amount');
    await user.clear(amountInput);
    await user.type(amountInput, '100');

    // Fill in notes
    const notesInput = screen.getByLabelText('Notes');
    await user.type(notesInput, 'Test credit note');

    // Submit
    const submitButtons = screen.getAllByRole('button', { name: /issue credit note/i });
    await user.click(submitButtons[submitButtons.length - 1]);

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('invoice_credit_notes');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: 'tenant-123',
          invoice_id: 'invoice-1',
          amount: 100,
          reason: 'return',
          notes: 'Test credit note',
        })
      );
    });
  });

  it('shows success toast after successful submission', async () => {
    const user = userEvent.setup();

    render(<InvoiceCreditNoteSystem {...defaultProps} />, { wrapper });

    await user.click(screen.getByRole('button', { name: /issue credit note/i }));

    const amountInput = screen.getByLabelText('Credit Amount');
    await user.clear(amountInput);
    await user.type(amountInput, '50');

    const submitButtons = screen.getAllByRole('button', { name: /issue credit note/i });
    await user.click(submitButtons[submitButtons.length - 1]);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalled();
    });
  });

  it('shows error toast on submission failure', async () => {
    const user = userEvent.setup();
    mockInsert.mockResolvedValueOnce({ error: { message: 'DB error' } });

    render(<InvoiceCreditNoteSystem {...defaultProps} />, { wrapper });

    await user.click(screen.getByRole('button', { name: /issue credit note/i }));

    const amountInput = screen.getByLabelText('Credit Amount');
    await user.clear(amountInput);
    await user.type(amountInput, '50');

    const submitButtons = screen.getAllByRole('button', { name: /issue credit note/i });
    await user.click(submitButtons[submitButtons.length - 1]);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Failed to create credit note',
        expect.any(Object)
      );
    });
  });

  it('closes dialog when Close button is clicked', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <InvoiceCreditNoteSystem {...defaultProps} onOpenChange={onOpenChange} />,
      { wrapper }
    );

    // There are two "Close" buttons (visible + X icon sr-only), click the visible one
    const closeButtons = screen.getAllByRole('button', { name: /close/i });
    await user.click(closeButtons[0]);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
