/**
 * ConvertToInvoiceDialog Credit Gating Tests
 *
 * Verifies that invoice creation from menu orders is gated by credits:
 * 1. invoice_create action key is used with 50 credit cost
 * 2. useCreditGatedAction hook wraps the conversion action
 * 3. Credit check blocks conversion when insufficient credits
 * 4. Credit check allows conversion when sufficient credits
 * 5. Credit cost badge (50) is displayed on the submit button
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { ConvertToInvoiceDialog, type ConvertToInvoiceDialogProps } from '../ConvertToInvoiceDialog';

// ============================================================================
// Mocks
// ============================================================================

const { mockExecute, mockInvoke } = vi.hoisted(() => ({
  mockExecute: vi.fn(),
  mockInvoke: vi.fn(),
}));

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
    tenantSlug: 'test-tenant',
    isAuthenticated: true,
    accessToken: 'test-token',
  }),
}));

vi.mock('@/hooks/useCredits', () => ({
  useCreditGatedAction: () => ({
    execute: mockExecute,
    isPerforming: false,
    isFreeTier: true,
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () =>
            Promise.resolve({
              data: [
                {
                  id: 'client-1',
                  business_name: 'Test Business',
                  contact_name: 'John Doe',
                  email: 'john@test.com',
                  phone: '+1234567890',
                },
              ],
              error: null,
            }),
        }),
      }),
    }),
    functions: {
      invoke: mockInvoke,
    },
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/utils/toastHelpers', () => ({
  showSuccessToast: vi.fn(),
  showErrorToast: vi.fn(),
}));

vi.mock('@/lib/queryKeys', () => ({
  queryKeys: {
    wholesaleClients: {
      list: () => ['wholesaleClients', 'list'],
    },
    menuOrders: {
      all: ['menuOrders'],
    },
    crm: {
      invoices: {
        all: () => ['crm', 'invoices'],
      },
    },
  },
}));

vi.mock('@/lib/invalidation', () => ({
  invalidateOnEvent: vi.fn(),
}));

vi.mock('@/lib/formatters', () => ({
  formatPhoneNumber: (phone: string) => phone,
  formatCurrency: (amount: number) => `$${amount.toFixed(2)}`,
}));

// ============================================================================
// Test Setup
// ============================================================================

const defaultOrder = {
  id: 'order-1',
  total_amount: 250,
  created_at: '2026-01-15T10:00:00Z',
  order_data: {
    items: [
      { name: 'Product A', quantity: 2, price: 100 },
      { name: 'Product B', quantity: 1, price: 50 },
    ],
    subtotal: 250,
    tax: 0,
  },
  // Pre-select client to avoid complex Select interaction in tests
  client_id: 'client-1',
  converted_to_invoice_id: null,
};

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function renderDialog(props?: Partial<ConvertToInvoiceDialogProps>) {
  const queryClient = createTestQueryClient();
  const defaultProps: ConvertToInvoiceDialogProps = {
    open: true,
    onOpenChange: vi.fn(),
    order: defaultOrder,
    onSuccess: vi.fn(),
    ...props,
  };

  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ConvertToInvoiceDialog {...defaultProps} />
        </BrowserRouter>
      </QueryClientProvider>
    ),
    props: defaultProps,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('ConvertToInvoiceDialog Credit Gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecute.mockImplementation(
      async (_actionKey: string, action: () => Promise<unknown>) => {
        return action();
      }
    );
    mockInvoke.mockResolvedValue({
      data: {
        success: true,
        invoice_id: 'inv-1',
        invoice_number: 'INV-001',
      },
      error: null,
    });
  });

  it('should render the dialog with credit cost badge showing 50', () => {
    renderDialog();

    expect(screen.getByText('Convert Order to Invoice')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
  });

  it('should call executeCreditAction with invoice_create on submit', async () => {
    const user = userEvent.setup();
    renderDialog();

    // client_id is pre-set so submit is enabled
    const submitBtn = screen.getByRole('button', { name: /convert to invoice/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith(
        'invoice_create',
        expect.any(Function),
        {
          referenceId: 'order-1',
          referenceType: 'menu_order',
        }
      );
    });
  });

  it('should not invoke edge function when credit gate blocks', async () => {
    // Simulate credit gate blocking (returns null without calling action)
    mockExecute.mockResolvedValue(null);

    const user = userEvent.setup();
    renderDialog();

    const submitBtn = screen.getByRole('button', { name: /convert to invoice/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledWith(
        'invoice_create',
        expect.any(Function),
        expect.any(Object)
      );
    });

    // The edge function should NOT have been called since the gate blocked
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('should invoke edge function when credit gate allows', async () => {
    const user = userEvent.setup();
    const { props } = renderDialog();

    const submitBtn = screen.getByRole('button', { name: /convert to invoice/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('convert-menu-order-to-invoice', {
        body: {
          menu_order_id: 'order-1',
          client_id: 'client-1',
        },
      });
    });

    // Should call onSuccess after successful conversion
    await waitFor(() => {
      expect(props.onSuccess).toHaveBeenCalled();
    });
  });

  it('should not submit without selecting a client', async () => {
    const user = userEvent.setup();
    renderDialog({
      order: { ...defaultOrder, client_id: null },
    });

    const submitBtn = screen.getByRole('button', { name: /convert to invoice/i });
    await user.click(submitBtn);

    // Credit gate should NOT have been called (validation catches it first)
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('should show already converted state', () => {
    renderDialog({
      order: {
        ...defaultOrder,
        converted_to_invoice_id: 'existing-inv-1',
      },
    });

    expect(screen.getByText('Order Already Converted')).toBeInTheDocument();
  });

  it('should pass referenceId and referenceType in credit action options', async () => {
    const user = userEvent.setup();
    renderDialog();

    const submitBtn = screen.getByRole('button', { name: /convert to invoice/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledWith(
        'invoice_create',
        expect.any(Function),
        {
          referenceId: 'order-1',
          referenceType: 'menu_order',
        }
      );
    });
  });
});
