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

import { InvoicePaymentReminder } from '../InvoicePaymentReminder';
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
  dueDate: '2025-02-15',
  onSuccess: vi.fn(),
};

describe('InvoicePaymentReminder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ insert: mockInsert });
  });

  it('renders dialog with invoice number', () => {
    render(<InvoicePaymentReminder {...defaultProps} />, { wrapper });
    expect(screen.getByText(/Payment Reminder - Invoice #INV-001/)).toBeInTheDocument();
  });

  it('does not show Coming Soon badge', () => {
    render(<InvoicePaymentReminder {...defaultProps} />, { wrapper });
    expect(screen.queryByText('Coming Soon')).not.toBeInTheDocument();
  });

  it('renders reminder form fields', () => {
    render(<InvoicePaymentReminder {...defaultProps} />, { wrapper });
    expect(screen.getByText('Send Reminder')).toBeInTheDocument();
    expect(screen.getByText('Delivery Method')).toBeInTheDocument();
    expect(screen.getByText('Custom Message (optional)')).toBeInTheDocument();
    expect(screen.getByText('Auto-send')).toBeInTheDocument();
  });

  it('shows due date in description', () => {
    render(<InvoicePaymentReminder {...defaultProps} />, { wrapper });
    expect(screen.getByText(/2025-02-15/)).toBeInTheDocument();
  });

  it('calls supabase insert on form submission', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();

    render(
      <InvoicePaymentReminder {...defaultProps} onSuccess={onSuccess} />,
      { wrapper }
    );

    // Submit the form
    await user.click(screen.getByRole('button', { name: /schedule reminder/i }));

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('invoice_payment_reminders');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: 'tenant-123',
          invoice_id: 'invoice-1',
          reminder_type: 'email',
          auto_send: true,
        })
      );
    });
  });

  it('shows success toast after successful submission', async () => {
    const user = userEvent.setup();

    render(<InvoicePaymentReminder {...defaultProps} />, { wrapper });

    await user.click(screen.getByRole('button', { name: /schedule reminder/i }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Payment reminder scheduled');
    });
  });

  it('calls onSuccess and closes dialog on success', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <InvoicePaymentReminder
        {...defaultProps}
        onSuccess={onSuccess}
        onOpenChange={onOpenChange}
      />,
      { wrapper }
    );

    await user.click(screen.getByRole('button', { name: /schedule reminder/i }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('shows error toast on submission failure', async () => {
    const user = userEvent.setup();
    mockInsert.mockResolvedValueOnce({ error: { message: 'DB error' } });

    render(<InvoicePaymentReminder {...defaultProps} />, { wrapper });

    await user.click(screen.getByRole('button', { name: /schedule reminder/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Failed to schedule payment reminder',
        expect.any(Object)
      );
    });
  });

  it('closes dialog when cancel is clicked', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <InvoicePaymentReminder {...defaultProps} onOpenChange={onOpenChange} />,
      { wrapper }
    );

    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
