import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    info: vi.fn(),
  }),
}));

const mockNavigateToAdmin = vi.fn();
vi.mock('@/lib/navigation/tenantNavigation', () => ({
  useTenantNavigation: () => ({
    navigateToAdmin: mockNavigateToAdmin,
  }),
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: { id: 'test-tenant-id', name: 'Test Tenant' },
    tenantSlug: 'test-tenant',
  }),
}));

const mockRecordFrontedPayment = vi.fn();
vi.mock('@/hooks/useRecordPayment', () => ({
  useRecordPayment: () => ({
    recordFrontedPayment: mockRecordFrontedPayment,
    isRecordingFrontedPayment: false,
  }),
}));

vi.mock('@/components/SEOHead', () => ({
  SEOHead: ({ title }: { title: string }) => <title>{title}</title>,
}));

const mockMaybeSingle = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: mockMaybeSingle,
    })),
  },
}));

import { toast } from 'sonner';
import RecordFrontedPayment from '../RecordFrontedPayment';

const defaultFrontedItem = {
  id: 'fronted-1',
  expected_revenue: 1000,
  payment_received: 250,
  product: { name: 'Test Product' },
  client: { id: 'client-1', business_name: 'Test Client', outstanding_balance: 750 },
};

function renderWithProviders(id = 'fronted-1') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/admin/fronted-inventory/${id}/record-payment`]}>
        <Routes>
          <Route path="/admin/fronted-inventory/:id/record-payment" element={<RecordFrontedPayment />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('RecordFrontedPayment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMaybeSingle.mockResolvedValue({ data: defaultFrontedItem, error: null });
  });

  it('renders the payment form after loading', async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('Outstanding Balance')).toBeInTheDocument();
    });

    expect(screen.getByText('Payment Details')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Record Payment' })).toBeInTheDocument();
  });

  it('shows loading spinner when no data loaded yet', () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    renderWithProviders();

    // Loading spinner is shown when frontedItem is null
    expect(screen.queryByText('Outstanding Balance')).not.toBeInTheDocument();
  });

  it('pre-fills amount with amount owed', async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('Payment Details')).toBeInTheDocument();
    });

    const amountInput = screen.getByPlaceholderText('0.00') as HTMLInputElement;
    // HTML number inputs may strip trailing zeros
    expect(parseFloat(amountInput.value)).toBe(750);
  });

  it('validates payment amount before submitting', async () => {
    const user = userEvent.setup();
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('Payment Details')).toBeInTheDocument();
    });

    const amountInput = screen.getByPlaceholderText('0.00');
    await user.clear(amountInput);
    await user.type(amountInput, '0');

    const submitButton = screen.getByRole('button', { name: /record payment/i });
    await user.click(submitButton);

    expect(toast.error).toHaveBeenCalledWith('Please enter a valid payment amount');
    expect(mockRecordFrontedPayment).not.toHaveBeenCalled();
  });

  it('calls recordFrontedPayment with correct params on submit', async () => {
    const user = userEvent.setup();
    mockRecordFrontedPayment.mockResolvedValue({
      success: true,
      newStatus: 'partial',
      paymentReceived: 500,
      remaining: 500,
      clientName: 'Test Client',
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('Payment Details')).toBeInTheDocument();
    });

    const amountInput = screen.getByPlaceholderText('0.00');
    await user.clear(amountInput);
    await user.type(amountInput, '250');

    const submitButton = screen.getByRole('button', { name: /record payment/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockRecordFrontedPayment).toHaveBeenCalledWith({
        frontedId: 'fronted-1',
        amount: 250,
        paymentMethod: 'cash',
        notes: undefined,
        reference: undefined,
        showToast: false,
      });
    });
  });

  it('shows success toast with client name and remaining amount', async () => {
    const user = userEvent.setup();
    mockRecordFrontedPayment.mockResolvedValue({
      success: true,
      newStatus: 'partial',
      paymentReceived: 500,
      remaining: 500,
      clientName: 'Test Client',
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('Payment Details')).toBeInTheDocument();
    });

    const submitButton = screen.getByRole('button', { name: /record payment/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining('Remaining:')
      );
    });
  });

  it('shows "Fully paid!" when remaining is 0', async () => {
    const user = userEvent.setup();
    mockRecordFrontedPayment.mockResolvedValue({
      success: true,
      newStatus: 'paid',
      paymentReceived: 1000,
      remaining: 0,
      clientName: 'Test Client',
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('Payment Details')).toBeInTheDocument();
    });

    const submitButton = screen.getByRole('button', { name: /record payment/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining('Fully paid!')
      );
    });
  });

  it('navigates to fronted inventory on success', async () => {
    const user = userEvent.setup();
    mockRecordFrontedPayment.mockResolvedValue({
      success: true,
      newStatus: 'paid',
      paymentReceived: 1000,
      remaining: 0,
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('Payment Details')).toBeInTheDocument();
    });

    const submitButton = screen.getByRole('button', { name: /record payment/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockNavigateToAdmin).toHaveBeenCalledWith('inventory/fronted');
    });
  });

  it('shows error toast on payment failure', async () => {
    const user = userEvent.setup();
    mockRecordFrontedPayment.mockRejectedValue(new Error('Insufficient funds'));

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('Payment Details')).toBeInTheDocument();
    });

    const submitButton = screen.getByRole('button', { name: /record payment/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Insufficient funds');
    });
  });

  it('shows generic error message for non-Error exceptions', async () => {
    const user = userEvent.setup();
    mockRecordFrontedPayment.mockRejectedValue('unknown error');

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('Payment Details')).toBeInTheDocument();
    });

    const submitButton = screen.getByRole('button', { name: /record payment/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to record payment');
    });
  });

  it('sets full amount when "Full Amount" button is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('Payment Details')).toBeInTheDocument();
    });

    const amountInput = screen.getByPlaceholderText('0.00') as HTMLInputElement;
    await user.clear(amountInput);
    await user.type(amountInput, '100');

    const fullAmountBtn = screen.getByRole('button', { name: /full amount/i });
    await user.click(fullAmountBtn);

    // HTML number inputs may strip trailing zeros
    expect(parseFloat(amountInput.value)).toBe(750);
  });
});
