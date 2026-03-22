/**
 * CreatePreOrderPage Credit Gating Tests
 *
 * Verifies that the pre-order create action is properly gated by credits:
 * 1. order_create_manual action key is used with the correct cost (50 credits)
 * 2. useCreditGatedAction hook is integrated in CreatePreOrderPage
 * 3. Credit check blocks action when insufficient credits
 * 4. Credit check allows action when sufficient credits
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
const mockCreatePreOrder = vi.fn();
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
    loading: false,
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

vi.mock('@/hooks/crm/usePreOrders', () => ({
  useCreatePreOrder: () => ({
    mutateAsync: mockCreatePreOrder,
    isPending: false,
  }),
}));

vi.mock('@/hooks/crm/useActivityLog', () => ({
  useLogActivity: () => ({
    mutate: mockLogActivity,
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

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/components/ui/shortcut-hint', () => ({
  ShortcutHint: ({ children }: { children: ReactNode }) => <>{children}</>,
  useModifierKey: () => '⌘',
}));

vi.mock('@/hooks/useFormKeyboardShortcuts', () => ({
  useFormKeyboardShortcuts: () => {},
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

describe('CreatePreOrderPage Credit Gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecute.mockImplementation(
      async (_actionKey: string, action: () => Promise<unknown>) => {
        return action();
      }
    );
    mockCreatePreOrder.mockResolvedValue({
      id: 'pre-order-1',
      pre_order_number: 'PO-001',
    });
  });

  it('should render the create pre-order form', async () => {
    const CreatePreOrderPage = (await import('../CreatePreOrderPage')).default;
    renderWithProviders(<CreatePreOrderPage />);

    expect(screen.getByRole('heading', { name: /create pre-order/i })).toBeInTheDocument();
    expect(screen.getByText('Order Details')).toBeInTheDocument();
  });

  it('should call executeCreditAction with order_create_manual action key on submit', async () => {
    const user = userEvent.setup();
    const CreatePreOrderPage = (await import('../CreatePreOrderPage')).default;
    renderWithProviders(<CreatePreOrderPage />);

    // Select a client
    const clientSelector = screen.getByTestId('client-selector');
    await user.selectOptions(clientSelector, 'client-1');

    // Add a line item
    const addItemBtn = screen.getByTestId('add-line-item');
    await user.click(addItemBtn);

    // Submit the form
    const submitBtn = screen.getByRole('button', { name: /create pre-order/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith(
        'order_create_manual',
        expect.any(Function)
      );
    });
  });

  it('should not create pre-order when credit gate blocks the action', async () => {
    // Simulate credit gate blocking the action (returns null)
    mockExecute.mockResolvedValue(null);

    const user = userEvent.setup();
    const CreatePreOrderPage = (await import('../CreatePreOrderPage')).default;
    renderWithProviders(<CreatePreOrderPage />);

    // Select a client
    const clientSelector = screen.getByTestId('client-selector');
    await user.selectOptions(clientSelector, 'client-1');

    // Add a line item
    const addItemBtn = screen.getByTestId('add-line-item');
    await user.click(addItemBtn);

    // Submit the form
    const submitBtn = screen.getByRole('button', { name: /create pre-order/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledWith('order_create_manual', expect.any(Function));
    });

    // The createPreOrder mutation should NOT have been called directly
    expect(mockCreatePreOrder).not.toHaveBeenCalled();
  });

  it('should create pre-order when credit gate allows the action', async () => {
    const user = userEvent.setup();
    const CreatePreOrderPage = (await import('../CreatePreOrderPage')).default;
    renderWithProviders(<CreatePreOrderPage />);

    // Select a client
    const clientSelector = screen.getByTestId('client-selector');
    await user.selectOptions(clientSelector, 'client-1');

    // Add a line item
    const addItemBtn = screen.getByTestId('add-line-item');
    await user.click(addItemBtn);

    // Submit the form
    const submitBtn = screen.getByRole('button', { name: /create pre-order/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockCreatePreOrder).toHaveBeenCalledTimes(1);
    });

    // Verify the pre-order payload
    expect(mockCreatePreOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id: 'client-1',
        status: 'pending',
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
    const CreatePreOrderPage = (await import('../CreatePreOrderPage')).default;
    renderWithProviders(<CreatePreOrderPage />);

    // Select a client
    const clientSelector = screen.getByTestId('client-selector');
    await user.selectOptions(clientSelector, 'client-1');

    // Submit without adding line items
    const submitBtn = screen.getByRole('button', { name: /create pre-order/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Please add at least one line item');
    });

    // Credit gate should NOT have been called
    expect(mockExecute).not.toHaveBeenCalled();
  });
});

// ============================================================================
// Credit Cost Configuration Tests for order_create_manual
// ============================================================================

describe('Pre-Order Credit Cost Configuration', () => {
  it('order_create_manual should cost 50 credits', async () => {
    const { getCreditCost } = await import('@/lib/credits/creditCosts');
    expect(getCreditCost('order_create_manual')).toBe(50);
  });

  it('order_create_manual should not be a free action', async () => {
    const { isActionFree } = await import('@/lib/credits/creditCosts');
    expect(isActionFree('order_create_manual')).toBe(false);
  });

  it('order_create_manual should be categorized under orders', async () => {
    const { getCreditCostInfo } = await import('@/lib/credits/creditCosts');
    const info = getCreditCostInfo('order_create_manual');
    expect(info).not.toBeNull();
    expect(info?.category).toBe('orders');
    expect(info?.actionName).toBe('Create Manual Order');
    expect(info?.credits).toBe(50);
  });
});
