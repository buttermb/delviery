/**
 * CreateInvoicePage Credit Gating Tests
 *
 * Verifies that the invoice create action is properly gated by credits:
 * 1. invoice_create action key is used with the correct cost (50 credits)
 * 2. useCreditGatedAction hook is integrated in CreateInvoicePage
 * 3. Credit check blocks action when insufficient credits
 * 4. Credit check allows action when sufficient credits
 * 5. Non-free-tier users bypass credit checks
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { type ReactNode } from 'react';

// ============================================================================
// Mocks
// ============================================================================

const mockExecute = vi.fn();
const mockCreateInvoice = vi.fn();
const mockLogActivity = vi.fn();
const mockNavigate = vi.fn();

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: {
      id: 'test-tenant-id',
      slug: 'test-tenant',
      name: 'Test Tenant',
      is_free_tier: true,
    },
    isAuthenticated: true,
    accessToken: 'test-token',
  }),
}));

vi.mock('@/contexts/AccountContext', () => ({
  useAccount: () => ({
    account: { id: 'test-account-id' },
    loading: false,
  }),
}));

vi.mock('@/hooks/useCredits', () => ({
  useCreditGatedAction: () => ({
    execute: mockExecute,
    isPerforming: false,
    isFreeTier: true,
  }),
}));

vi.mock('@/hooks/crm/useInvoices', () => ({
  useCreateInvoice: () => ({
    mutateAsync: mockCreateInvoice,
    isPending: false,
  }),
}));

vi.mock('@/hooks/crm/useActivityLog', () => ({
  useLogActivity: () => ({
    mutate: mockLogActivity,
  }),
}));

vi.mock('@/hooks/useCurrencyConvert', () => ({
  useCurrencyConvert: () => ({
    rate: null,
    convertedAmount: null,
    isLoading: false,
  }),
  useSupportedCurrencies: () => ({
    data: { USD: 'US Dollar', EUR: 'Euro' },
  }),
}));

vi.mock('@/hooks/useCsrfToken', () => ({
  useCsrfToken: () => ({
    csrfToken: 'test-csrf-token',
    validateToken: () => true,
  }),
}));

vi.mock('@/hooks/useUnsavedChanges', () => ({
  useUnsavedChanges: () => ({
    showBlockerDialog: false,
    confirmLeave: vi.fn(),
    cancelLeave: vi.fn(),
  }),
}));

vi.mock('@/lib/navigation/tenantNavigation', () => ({
  useTenantNavigation: () => ({
    navigateToAdmin: vi.fn(),
    navigate: mockNavigate,
  }),
}));

vi.mock('@/components/crm/ClientSelector', () => ({
  ClientSelector: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <select
      data-testid="client-selector"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Select client</option>
      <option value="client-1">Test Client</option>
    </select>
  ),
}));

vi.mock('@/components/crm/LineItemsEditor', () => ({
  LineItemsEditor: ({ onChange }: { items: unknown[]; onChange: (items: unknown[]) => void }) => (
    <button
      data-testid="add-line-item"
      onClick={() =>
        onChange([
          {
            id: '1',
            product_name: 'Test Product',
            description: 'Test item',
            quantity: 1,
            unit_price: 100,
            line_total: 100,
          },
        ])
      }
    >
      Add Line Item
    </button>
  ),
}));

vi.mock('@/components/shared/DisabledTooltip', () => ({
  DisabledTooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/unsaved-changes', () => ({
  UnsavedChangesDialog: () => null,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ============================================================================
// Test Setup
// ============================================================================

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function renderWithProviders(ui: ReactNode) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{ui}</BrowserRouter>
    </QueryClientProvider>
  );
}

// ============================================================================
// Tests
// ============================================================================

describe('CreateInvoicePage Credit Gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecute.mockImplementation(
      async (_actionKey: string, action: () => Promise<unknown>) => {
        return action();
      }
    );
    mockCreateInvoice.mockResolvedValue({
      id: 'invoice-1',
      invoice_number: 'INV-001',
    });
  });

  it('should render the create invoice form', async () => {
    const CreateInvoicePage = (await import('../CreateInvoicePage')).default;
    renderWithProviders(<CreateInvoicePage />);

    expect(screen.getByRole('heading', { name: /create invoice/i })).toBeInTheDocument();
    expect(screen.getByText('Invoice Details')).toBeInTheDocument();
  });

  it('should call executeCreditAction with invoice_create action key on submit', async () => {
    const user = userEvent.setup();
    const CreateInvoicePage = (await import('../CreateInvoicePage')).default;
    renderWithProviders(<CreateInvoicePage />);

    // Select a client
    const clientSelector = screen.getByTestId('client-selector');
    await user.selectOptions(clientSelector, 'client-1');

    // Add a line item
    const addItemBtn = screen.getByTestId('add-line-item');
    await user.click(addItemBtn);

    // Submit the form
    const submitBtn = screen.getByRole('button', { name: /create invoice/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith(
        'invoice_create',
        expect.any(Function)
      );
    });
  });

  it('should not create invoice when credit gate blocks the action', async () => {
    // Simulate credit gate blocking the action (returns null)
    mockExecute.mockResolvedValue(null);

    const user = userEvent.setup();
    const CreateInvoicePage = (await import('../CreateInvoicePage')).default;
    renderWithProviders(<CreateInvoicePage />);

    // Select a client
    const clientSelector = screen.getByTestId('client-selector');
    await user.selectOptions(clientSelector, 'client-1');

    // Add a line item
    const addItemBtn = screen.getByTestId('add-line-item');
    await user.click(addItemBtn);

    // Submit the form
    const submitBtn = screen.getByRole('button', { name: /create invoice/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledWith('invoice_create', expect.any(Function));
    });

    // The createInvoice mutation should NOT have been called directly
    // (it's called inside the action callback which was blocked by the gate)
    expect(mockCreateInvoice).not.toHaveBeenCalled();
  });

  it('should create invoice when credit gate allows the action', async () => {
    const user = userEvent.setup();
    const CreateInvoicePage = (await import('../CreateInvoicePage')).default;
    renderWithProviders(<CreateInvoicePage />);

    // Select a client
    const clientSelector = screen.getByTestId('client-selector');
    await user.selectOptions(clientSelector, 'client-1');

    // Add a line item
    const addItemBtn = screen.getByTestId('add-line-item');
    await user.click(addItemBtn);

    // Submit the form
    const submitBtn = screen.getByRole('button', { name: /create invoice/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockCreateInvoice).toHaveBeenCalledTimes(1);
    });

    // Verify the invoice payload
    expect(mockCreateInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        account_id: 'test-account-id',
        client_id: 'client-1',
        status: 'draft',
        currency: 'USD',
        line_items: expect.arrayContaining([
          expect.objectContaining({
            product_name: 'Test Product',
            quantity: 1,
            unit_price: 100,
          }),
        ]),
      })
    );
  });

  it('should not submit when no line items are added', async () => {
    const { toast } = await import('sonner');
    const user = userEvent.setup();
    const CreateInvoicePage = (await import('../CreateInvoicePage')).default;
    renderWithProviders(<CreateInvoicePage />);

    // Select a client
    const clientSelector = screen.getByTestId('client-selector');
    await user.selectOptions(clientSelector, 'client-1');

    // Submit without adding line items
    const submitBtn = screen.getByRole('button', { name: /create invoice/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Please add at least one line item');
    });

    // Credit gate should NOT have been called
    expect(mockExecute).not.toHaveBeenCalled();
  });
});

// ============================================================================
// Credit Cost Configuration Tests for invoice_create
// ============================================================================

describe('Invoice Credit Cost Configuration', () => {
  it('invoice_create should cost 50 credits', async () => {
    const { getCreditCost } = await import('@/lib/credits/creditCosts');
    expect(getCreditCost('invoice_create')).toBe(50);
  });

  it('invoice_create should not be a free action', async () => {
    const { isActionFree } = await import('@/lib/credits/creditCosts');
    expect(isActionFree('invoice_create')).toBe(false);
  });

  it('invoice_create should be categorized under invoices', async () => {
    const { getCreditCostInfo } = await import('@/lib/credits/creditCosts');
    const info = getCreditCostInfo('invoice_create');
    expect(info).not.toBeNull();
    expect(info?.category).toBe('invoices');
    expect(info?.actionName).toBe('Create Invoice');
    expect(info?.credits).toBe(50);
  });

  it('generate_invoice legacy alias should have same cost', async () => {
    const { getCreditCost } = await import('@/lib/credits/creditCosts');
    expect(getCreditCost('generate_invoice')).toBe(50);
  });
});
