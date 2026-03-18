import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '@/test/utils/test-utils';
import { InvoicePaymentReminder } from '../InvoicePaymentReminder';

// Track insert calls
const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockImplementation(() => ({
      insert: mockInsert,
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
  },
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: vi.fn().mockReturnValue({
    tenant: { id: 'tenant-456', slug: 'test-tenant', business_name: 'Test Business' },
    loading: false,
    admin: { id: 'admin-456', email: 'admin@test.com' },
    tenantSlug: 'test-tenant',
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const defaultProps = {
  invoiceId: 'invoice-xyz',
  invoiceNumber: 'INV-002',
  clientEmail: 'client@example.com',
  dueDate: '2026-04-15',
  open: true,
  onOpenChange: vi.fn(),
};

describe('InvoicePaymentReminder (Send)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockResolvedValue({ data: null, error: null });
  });

  it('renders the dialog with correct title', () => {
    render(<InvoicePaymentReminder {...defaultProps} />);

    expect(screen.getByText('Send Payment Reminder')).toBeInTheDocument();
  });

  it('shows invoice number and client email in description', () => {
    render(<InvoicePaymentReminder {...defaultProps} />);

    expect(screen.getByText(/Invoice INV-002 • client@example\.com/)).toBeInTheDocument();
  });

  it('renders reminder type selector', () => {
    render(<InvoicePaymentReminder {...defaultProps} />);

    expect(screen.getByText('Reminder Type')).toBeInTheDocument();
  });

  it('renders message preview area', () => {
    render(<InvoicePaymentReminder {...defaultProps} />);

    expect(screen.getByText('Message Preview')).toBeInTheDocument();
  });

  it('shows default gentle reminder message', () => {
    render(<InvoicePaymentReminder {...defaultProps} />);

    expect(
      screen.getByText(/friendly reminder that Invoice INV-002/)
    ).toBeInTheDocument();
  });

  it('sends reminder and inserts into Supabase on click', async () => {
    const user = userEvent.setup();
    render(<InvoicePaymentReminder {...defaultProps} />);

    const sendButton = screen.getByRole('button', { name: /Send Reminder/ });
    await user.click(sendButton);

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: 'tenant-456',
          invoice_id: 'invoice-xyz',
          reminder_type: 'gentle',
          sent_to: 'client@example.com',
        })
      );
    });
  });

  it('shows success toast after sending', async () => {
    const { toast } = await import('sonner');
    const user = userEvent.setup();
    render(<InvoicePaymentReminder {...defaultProps} />);

    const sendButton = screen.getByRole('button', { name: /Send Reminder/ });
    await user.click(sendButton);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        'Payment reminder sent',
        expect.objectContaining({
          description: expect.stringContaining('client@example.com'),
        })
      );
    });
  });

  it('shows error toast on failure', async () => {
    mockInsert.mockResolvedValueOnce({
      data: null,
      error: { message: 'Insert failed' },
    });

    const { toast } = await import('sonner');
    const user = userEvent.setup();
    render(<InvoicePaymentReminder {...defaultProps} />);

    const sendButton = screen.getByRole('button', { name: /Send Reminder/ });
    await user.click(sendButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to send reminder');
    });
  });

  it('closes dialog after successful send', async () => {
    const user = userEvent.setup();
    render(<InvoicePaymentReminder {...defaultProps} />);

    const sendButton = screen.getByRole('button', { name: /Send Reminder/ });
    await user.click(sendButton);

    await waitFor(() => {
      expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('closes dialog when Cancel is clicked', async () => {
    const user = userEvent.setup();
    render(<InvoicePaymentReminder {...defaultProps} />);

    const cancelButton = screen.getByRole('button', { name: /Cancel/ });
    await user.click(cancelButton);

    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('does not render when open is false', () => {
    render(<InvoicePaymentReminder {...defaultProps} open={false} />);

    expect(screen.queryByText('Send Payment Reminder')).not.toBeInTheDocument();
  });
});
