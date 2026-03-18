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
    tenant: { id: 'tenant-123', slug: 'test-tenant', business_name: 'Test Business' },
    loading: false,
    admin: { id: 'admin-123', email: 'admin@test.com' },
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
  open: true,
  onOpenChange: vi.fn(),
  invoiceId: 'invoice-abc',
  invoiceNumber: 'INV-001',
  dueDate: '2026-04-01',
  onSuccess: vi.fn(),
};

describe('InvoicePaymentReminder (Admin)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockResolvedValue({ data: null, error: null });
  });

  it('renders the dialog with correct title', () => {
    render(<InvoicePaymentReminder {...defaultProps} />);

    expect(screen.getByText(/Payment Reminder - Invoice #INV-001/)).toBeInTheDocument();
  });

  it('renders all form fields', () => {
    render(<InvoicePaymentReminder {...defaultProps} />);

    expect(screen.getByLabelText(/Send Reminder/)).toBeInTheDocument();
    expect(screen.getByText(/Delivery Method/)).toBeInTheDocument();
    expect(screen.getByText(/Custom Message/)).toBeInTheDocument();
    expect(screen.getByText(/Auto-send/)).toBeInTheDocument();
  });

  it('shows due date in description', () => {
    render(<InvoicePaymentReminder {...defaultProps} />);

    expect(screen.getByText(/Days before due date \(2026-04-01\)/)).toBeInTheDocument();
  });

  it('has default values for days_before_due and auto_send', () => {
    render(<InvoicePaymentReminder {...defaultProps} />);

    const daysInput = screen.getByLabelText(/Send Reminder/) as HTMLInputElement;
    expect(daysInput.value).toBe('3');
  });

  it('submits form and inserts into Supabase', async () => {
    const user = userEvent.setup();
    render(<InvoicePaymentReminder {...defaultProps} />);

    const submitButton = screen.getByRole('button', { name: /Schedule Reminder/ });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: 'tenant-123',
          invoice_id: 'invoice-abc',
          reminder_type: 'email',
          days_before_due: 3,
          auto_send: true,
          status: 'scheduled',
        })
      );
    });
  });

  it('calls onSuccess and onOpenChange after successful submission', async () => {
    const user = userEvent.setup();
    render(<InvoicePaymentReminder {...defaultProps} />);

    const submitButton = screen.getByRole('button', { name: /Schedule Reminder/ });
    await user.click(submitButton);

    await waitFor(() => {
      expect(defaultProps.onSuccess).toHaveBeenCalled();
      expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('shows success toast after successful submission', async () => {
    const { toast } = await import('sonner');
    const user = userEvent.setup();
    render(<InvoicePaymentReminder {...defaultProps} />);

    const submitButton = screen.getByRole('button', { name: /Schedule Reminder/ });
    await user.click(submitButton);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        'Payment reminder scheduled',
        expect.objectContaining({
          description: expect.stringContaining('3 days before due date'),
        })
      );
    });
  });

  it('shows error toast on Supabase error', async () => {
    mockInsert.mockResolvedValueOnce({
      data: null,
      error: { message: 'Database error', code: '42501' },
    });

    const { toast } = await import('sonner');
    const user = userEvent.setup();
    render(<InvoicePaymentReminder {...defaultProps} />);

    const submitButton = screen.getByRole('button', { name: /Schedule Reminder/ });
    await user.click(submitButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to schedule payment reminder');
    });
  });

  it('does not call onSuccess on error', async () => {
    mockInsert.mockResolvedValueOnce({
      data: null,
      error: { message: 'Database error' },
    });

    const user = userEvent.setup();
    render(<InvoicePaymentReminder {...defaultProps} />);

    const submitButton = screen.getByRole('button', { name: /Schedule Reminder/ });
    await user.click(submitButton);

    await waitFor(() => {
      expect(defaultProps.onSuccess).not.toHaveBeenCalled();
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

    expect(screen.queryByText(/Payment Reminder/)).not.toBeInTheDocument();
  });

  it('calculates scheduled_at based on days_before_due', async () => {
    const user = userEvent.setup();
    render(<InvoicePaymentReminder {...defaultProps} />);

    const submitButton = screen.getByRole('button', { name: /Schedule Reminder/ });
    await user.click(submitButton);

    await waitFor(() => {
      const insertCall = mockInsert.mock.calls[0][0];
      expect(insertCall.scheduled_at).toBeDefined();
      // scheduled_at should be 3 days before the due date
      const scheduled = new Date(insertCall.scheduled_at);
      const dueObj = new Date('2026-04-01');
      const diffMs = dueObj.getTime() - scheduled.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(3);
    });
  });
});
