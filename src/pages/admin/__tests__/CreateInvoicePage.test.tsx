/**
 * CreateInvoicePage Tests
 * Tests for invoice creation form rendering, validation, and submission
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock dependencies before importing the component
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockReturnThis(),
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

vi.mock('@/hooks/crm/useAccountId', () => ({
  useAccountIdSafe: vi.fn().mockReturnValue('account-123'),
}));

vi.mock('@/hooks/crm/useInvoices', () => ({
  useCreateInvoice: vi.fn().mockReturnValue({
    mutateAsync: vi.fn().mockResolvedValue({
      id: 'invoice-new',
      invoice_number: 'INV-100',
      client_id: 'client-1',
    }),
    isPending: false,
  }),
}));

vi.mock('@/hooks/crm/useActivityLog', () => ({
  useLogActivity: vi.fn().mockReturnValue({
    mutate: vi.fn(),
  }),
}));

vi.mock('@/hooks/useCurrencyConvert', () => ({
  useCurrencyConvert: vi.fn().mockReturnValue({
    convertedAmount: null,
    rate: null,
    isLoading: false,
  }),
  useSupportedCurrencies: vi.fn().mockReturnValue({
    data: { USD: 'US Dollar', EUR: 'Euro', GBP: 'British Pound' },
    isLoading: false,
  }),
}));

vi.mock('@/hooks/useCredits', () => ({
  useCreditGatedAction: vi.fn().mockReturnValue({
    execute: vi.fn().mockImplementation(
      async (_actionKey: string, action: () => Promise<unknown>) => {
        return action();
      }
    ),
    isPerforming: false,
    isFreeTier: false,
  }),
}));

vi.mock('@/hooks/useCsrfToken', () => ({
  useCsrfToken: vi.fn().mockReturnValue({
    csrfToken: 'mock-csrf-token',
    validateToken: vi.fn().mockReturnValue(true),
  }),
}));

vi.mock('@/hooks/useUnsavedChanges', () => ({
  useUnsavedChanges: vi.fn().mockReturnValue({
    showBlockerDialog: false,
    confirmLeave: vi.fn(),
    cancelLeave: vi.fn(),
  }),
}));

vi.mock('@/lib/navigation/tenantNavigation', () => ({
  useTenantNavigation: vi.fn().mockReturnValue({
    navigateToAdmin: vi.fn(),
    navigate: vi.fn(),
    buildAdminUrl: vi.fn((path: string) => `/test-tenant/admin/${path}`),
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

vi.mock('@/components/unsaved-changes', () => ({
  UnsavedChangesDialog: () => null,
}));

vi.mock('@/components/crm/ClientSelector', () => ({
  ClientSelector: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <select
      data-testid="client-selector"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Select client</option>
      <option value="client-1">Test Client</option>
    </select>
  ),
}));

vi.mock('@/components/crm/LineItemsEditor', () => ({
  LineItemsEditor: ({ onChange }: { items: unknown[]; onChange: (items: unknown[]) => void }) => (
    <div data-testid="line-items-editor">
      <button
        type="button"
        data-testid="add-line-item"
        onClick={() => onChange([{ id: 'item-1', product_name: 'Widget', quantity: 2, unit_price: 50, line_total: 100 }])}
      >
        Add Item
      </button>
    </div>
  ),
}));

vi.mock('@/lib/utils/formatCurrency', () => ({
  formatCurrency: vi.fn((amount: number, _currency?: string) => `$${amount.toFixed(2)}`),
}));

// Import after mocks
import CreateInvoicePage from '../CreateInvoicePage';
import { toast } from 'sonner';
import { useAccountIdSafe } from '@/hooks/crm/useAccountId';
import { useCreateInvoice } from '@/hooks/crm/useInvoices';
import { useLogActivity } from '@/hooks/crm/useActivityLog';
import { useCreditGatedAction } from '@/hooks/useCredits';
import { useCsrfToken } from '@/hooks/useCsrfToken';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';

// Helper to get mock functions from the mocked hooks
const getMutateAsync = () => (useCreateInvoice as ReturnType<typeof vi.fn>)().mutateAsync as ReturnType<typeof vi.fn>;
const getLogActivityMutate = () => (useLogActivity as ReturnType<typeof vi.fn>)().mutate as ReturnType<typeof vi.fn>;
const getCreditExecute = () => (useCreditGatedAction as ReturnType<typeof vi.fn>)().execute as ReturnType<typeof vi.fn>;
const getNavigateToAdmin = () => (useTenantNavigation as ReturnType<typeof vi.fn>)().navigateToAdmin as ReturnType<typeof vi.fn>;
const getNavigate = () => (useTenantNavigation as ReturnType<typeof vi.fn>)().navigate as ReturnType<typeof vi.fn>;

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={createQueryClient()}>
    <MemoryRouter initialEntries={['/test-tenant/admin/crm/invoices/new']}>
      {children}
    </MemoryRouter>
  </QueryClientProvider>
);

describe('CreateInvoicePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mocks to defaults
    (useCreateInvoice as ReturnType<typeof vi.fn>).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({
        id: 'invoice-new',
        invoice_number: 'INV-100',
        client_id: 'client-1',
      }),
      isPending: false,
    });
    (useLogActivity as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: vi.fn(),
    });
    (useCreditGatedAction as ReturnType<typeof vi.fn>).mockReturnValue({
      execute: vi.fn().mockImplementation(
        async (_actionKey: string, action: () => Promise<unknown>) => action()
      ),
      isPerforming: false,
      isFreeTier: false,
    });
    (useTenantNavigation as ReturnType<typeof vi.fn>).mockReturnValue({
      navigateToAdmin: vi.fn(),
      navigate: vi.fn(),
      buildAdminUrl: vi.fn((path: string) => `/test-tenant/admin/${path}`),
    });
    (useAccountIdSafe as ReturnType<typeof vi.fn>).mockReturnValue('account-123');
    (useCsrfToken as ReturnType<typeof vi.fn>).mockReturnValue({
      csrfToken: 'mock-csrf-token',
      validateToken: vi.fn().mockReturnValue(true),
    });
  });

  describe('Rendering', () => {
    it('should render the page title', () => {
      render(<CreateInvoicePage />, { wrapper });
      expect(screen.getByRole('heading', { name: 'Create Invoice' })).toBeInTheDocument();
    });

    it('should render the page description', () => {
      render(<CreateInvoicePage />, { wrapper });
      expect(screen.getByText('Create a new invoice for a client.')).toBeInTheDocument();
    });

    it('should render back button with aria-label', () => {
      render(<CreateInvoicePage />, { wrapper });
      expect(screen.getByRole('button', { name: 'Back to invoices' })).toBeInTheDocument();
    });

    it('should render Invoice Details card', () => {
      render(<CreateInvoicePage />, { wrapper });
      expect(screen.getByText('Invoice Details')).toBeInTheDocument();
    });

    it('should render Additional Info card', () => {
      render(<CreateInvoicePage />, { wrapper });
      expect(screen.getByText('Additional Info')).toBeInTheDocument();
    });

    it('should render Line Items card', () => {
      render(<CreateInvoicePage />, { wrapper });
      expect(screen.getByText('Line Items')).toBeInTheDocument();
    });

    it('should render submit and cancel buttons', () => {
      render(<CreateInvoicePage />, { wrapper });
      expect(screen.getByRole('button', { name: /create invoice/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('should render CSRF hidden input', () => {
      render(<CreateInvoicePage />, { wrapper });
      const csrfInput = document.querySelector('input[name="csrf_token"]') as HTMLInputElement;
      expect(csrfInput).toBeInTheDocument();
      expect(csrfInput.value).toBe('mock-csrf-token');
    });

    it('should render currency selector with supported currencies', () => {
      render(<CreateInvoicePage />, { wrapper });
      expect(screen.getByText('Currency')).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('should navigate back to invoices on back button click', async () => {
      const user = userEvent.setup();
      render(<CreateInvoicePage />, { wrapper });

      await user.click(screen.getByRole('button', { name: 'Back to invoices' }));
      expect(getNavigateToAdmin()).toHaveBeenCalledWith('crm/invoices');
    });

    it('should navigate back to invoices on cancel click', async () => {
      const user = userEvent.setup();
      render(<CreateInvoicePage />, { wrapper });

      await user.click(screen.getByRole('button', { name: /cancel/i }));
      expect(getNavigateToAdmin()).toHaveBeenCalledWith('crm/invoices');
    });
  });

  describe('Form Validation', () => {
    it('should show error toast when submitting without line items', async () => {
      const user = userEvent.setup();
      render(<CreateInvoicePage />, { wrapper });

      // Select a client first
      const clientSelector = screen.getByTestId('client-selector');
      await user.selectOptions(clientSelector, 'client-1');

      // Submit without adding line items
      await user.click(screen.getByRole('button', { name: /create invoice/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Please add at least one line item');
      });
    });

    it('should show error toast when CSRF validation fails', async () => {
      const mockValidateToken = vi.fn().mockReturnValue(false);
      (useCsrfToken as ReturnType<typeof vi.fn>).mockReturnValue({
        csrfToken: 'mock-csrf-token',
        validateToken: mockValidateToken,
      });

      const user = userEvent.setup();
      render(<CreateInvoicePage />, { wrapper });

      // Select a client
      const clientSelector = screen.getByTestId('client-selector');
      await user.selectOptions(clientSelector, 'client-1');

      // Add line items
      await user.click(screen.getByTestId('add-line-item'));

      // Submit
      await user.click(screen.getByRole('button', { name: /create invoice/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          'Security validation failed. Please refresh the page and try again.'
        );
      });
    });
  });

  describe('Submit Button State', () => {
    it('should disable submit button when account is not available', () => {
      (useAccountIdSafe as ReturnType<typeof vi.fn>).mockReturnValue(null);
      render(<CreateInvoicePage />, { wrapper });

      expect(screen.getByRole('button', { name: /create invoice/i })).toBeDisabled();
    });

    it('should enable submit button when account is available', () => {
      (useAccountIdSafe as ReturnType<typeof vi.fn>).mockReturnValue('account-123');
      render(<CreateInvoicePage />, { wrapper });

      expect(screen.getByRole('button', { name: /create invoice/i })).toBeEnabled();
    });
  });

  describe('Totals Display', () => {
    it('should display subtotal, tax, and total', () => {
      render(<CreateInvoicePage />, { wrapper });

      expect(screen.getByText('Subtotal:')).toBeInTheDocument();
      expect(screen.getByText(/Tax \(\d+%\):/)).toBeInTheDocument();
      expect(screen.getByText('Total:')).toBeInTheDocument();
    });

    it('should show zero totals initially', () => {
      render(<CreateInvoicePage />, { wrapper });

      // With no line items, subtotal should be $0.00
      const subtotalElements = screen.getAllByText('$0.00');
      expect(subtotalElements.length).toBeGreaterThanOrEqual(2); // subtotal and tax
    });
  });

  describe('Form Submission', () => {
    it('should call createInvoice.mutateAsync on successful submission', async () => {
      const user = userEvent.setup();
      render(<CreateInvoicePage />, { wrapper });

      // Select a client
      const clientSelector = screen.getByTestId('client-selector');
      await user.selectOptions(clientSelector, 'client-1');

      // Add a line item
      await user.click(screen.getByTestId('add-line-item'));

      // Submit
      await user.click(screen.getByRole('button', { name: /create invoice/i }));

      await waitFor(() => {
        expect(getMutateAsync()).toHaveBeenCalledWith(
          expect.objectContaining({
            client_id: 'client-1',
            status: 'draft',
            line_items: expect.arrayContaining([
              expect.objectContaining({ product_name: 'Widget' }),
            ]),
          })
        );
      });
    });

    it('should log activity after successful creation', async () => {
      const user = userEvent.setup();
      render(<CreateInvoicePage />, { wrapper });

      // Select a client
      const clientSelector = screen.getByTestId('client-selector');
      await user.selectOptions(clientSelector, 'client-1');

      // Add a line item
      await user.click(screen.getByTestId('add-line-item'));

      // Submit
      await user.click(screen.getByRole('button', { name: /create invoice/i }));

      await waitFor(() => {
        expect(getLogActivityMutate()).toHaveBeenCalledWith(
          expect.objectContaining({
            client_id: 'client-1',
            activity_type: 'invoice_created',
            description: 'Invoice #INV-100 created',
            reference_id: 'invoice-new',
            reference_type: 'crm_invoices',
          })
        );
      });
    });

    it('should show success toast after creation', async () => {
      const user = userEvent.setup();
      render(<CreateInvoicePage />, { wrapper });

      // Select a client
      const clientSelector = screen.getByTestId('client-selector');
      await user.selectOptions(clientSelector, 'client-1');

      // Add a line item
      await user.click(screen.getByTestId('add-line-item'));

      // Submit
      await user.click(screen.getByRole('button', { name: /create invoice/i }));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Invoice created successfully');
      });
    });

    it('should navigate to invoice detail after creation', async () => {
      const user = userEvent.setup();
      render(<CreateInvoicePage />, { wrapper });

      // Select a client
      const clientSelector = screen.getByTestId('client-selector');
      await user.selectOptions(clientSelector, 'client-1');

      // Add a line item
      await user.click(screen.getByTestId('add-line-item'));

      // Submit
      await user.click(screen.getByRole('button', { name: /create invoice/i }));

      await waitFor(() => {
        expect(getNavigate()).toHaveBeenCalledWith('/test-tenant/admin/crm/invoices/invoice-new');
      });
    });

    it('should use credit gated action for invoice creation', async () => {
      const user = userEvent.setup();
      render(<CreateInvoicePage />, { wrapper });

      // Select a client
      const clientSelector = screen.getByTestId('client-selector');
      await user.selectOptions(clientSelector, 'client-1');

      // Add a line item
      await user.click(screen.getByTestId('add-line-item'));

      // Submit
      await user.click(screen.getByRole('button', { name: /create invoice/i }));

      await waitFor(() => {
        expect(getCreditExecute()).toHaveBeenCalledWith('invoice_create', expect.any(Function));
      });
    });

    it('should not pass account_id in payload (hook handles it)', async () => {
      const user = userEvent.setup();
      render(<CreateInvoicePage />, { wrapper });

      // Select a client
      const clientSelector = screen.getByTestId('client-selector');
      await user.selectOptions(clientSelector, 'client-1');

      // Add a line item
      await user.click(screen.getByTestId('add-line-item'));

      // Submit
      await user.click(screen.getByRole('button', { name: /create invoice/i }));

      await waitFor(() => {
        const payload = getMutateAsync().mock.calls[0][0];
        expect(payload).not.toHaveProperty('account_id');
      });
    });

    it('should convert empty notes to undefined', async () => {
      const user = userEvent.setup();
      render(<CreateInvoicePage />, { wrapper });

      // Select a client
      const clientSelector = screen.getByTestId('client-selector');
      await user.selectOptions(clientSelector, 'client-1');

      // Add a line item
      await user.click(screen.getByTestId('add-line-item'));

      // Submit without filling notes (default is "")
      await user.click(screen.getByRole('button', { name: /create invoice/i }));

      await waitFor(() => {
        const payload = getMutateAsync().mock.calls[0][0];
        expect(payload.notes).toBeUndefined();
      });
    });
  });
});
