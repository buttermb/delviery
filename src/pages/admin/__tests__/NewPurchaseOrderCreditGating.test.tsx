/**
 * NewPurchaseOrder Credit Gating Tests
 *
 * Verifies that the purchase order create action is properly gated by credits:
 * 1. purchase_order_create action key is used with the correct cost (30 credits)
 * 2. useCreditGatedAction hook is integrated in NewPurchaseOrder
 * 3. Credit check blocks action when insufficient credits
 * 4. Credit check allows action when sufficient credits
 * 5. OutOfCreditsModal is shown when credits are insufficient
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
const mockNavigateToAdmin = vi.fn();

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
    tenantSlug: 'test-tenant',
  }),
}));

vi.mock('@/hooks/useCredits', () => ({
  useCreditGatedAction: () => ({
    execute: mockExecute,
    isPerforming: false,
    isFreeTier: true,
  }),
}));

vi.mock('@/hooks/useTenantNavigation', () => ({
  useTenantNavigation: () => ({
    navigateToAdmin: mockNavigateToAdmin,
  }),
}));

const mockSupabaseInsert = vi.fn();
const mockSupabaseRpc = vi.fn();
const mockSupabaseUpdate = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === 'products') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: 'product-1',
                name: 'Test Product',
                cost_per_unit: 10,
                stock_quantity: 100,
                image_url: null,
              },
            ],
            error: null,
          }),
          update: vi.fn((data: unknown) => {
            mockSupabaseUpdate(data);
            return {
              eq: vi.fn().mockReturnThis(),
            };
          }),
        };
      }
      if (table === 'purchase_orders') {
        return {
          insert: vi.fn((data: unknown) => {
            mockSupabaseInsert(table, data);
            return {
              select: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: 'po-1', po_number: 'PO-260101-001' },
                error: null,
              }),
            };
          }),
        };
      }
      if (table === 'purchase_order_items') {
        return {
          insert: vi.fn((data: unknown) => {
            mockSupabaseInsert(table, data);
            return Promise.resolve({ error: null });
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    }),
    rpc: vi.fn((...args: unknown[]) => {
      mockSupabaseRpc(...args);
      return Promise.resolve({ data: null, error: null });
    }),
  },
}));

vi.mock('@/components/wholesale/SmartVendorPicker', () => ({
  SmartVendorPicker: ({
    onSelect,
  }: {
    selectedVendor: unknown;
    onSelect: (vendor: { id: string; name: string }) => void;
    onClear: () => void;
  }) => (
    <button
      data-testid="select-vendor"
      onClick={() => onSelect({ id: 'vendor-1', name: 'Test Vendor' })}
    >
      Select Vendor
    </button>
  ),
}));

vi.mock('@/components/shared/DisabledTooltip', () => ({
  DisabledTooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/credits/OutOfCreditsModal', () => ({
  OutOfCreditsModal: ({
    open,
    onOpenChange,
    actionAttempted,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    actionAttempted?: string;
  }) =>
    open ? (
      <div data-testid="out-of-credits-modal">
        <span data-testid="blocked-action">{actionAttempted}</span>
        <button data-testid="close-modal" onClick={() => onOpenChange(false)}>
          Close
        </button>
      </div>
    ) : null,
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

describe('NewPurchaseOrder Credit Gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecute.mockImplementation(
      async (_actionKey: string, action: () => Promise<unknown>) => {
        return action();
      }
    );
  });

  it('should render the new purchase order form', async () => {
    const NewPurchaseOrder = (await import('../NewPurchaseOrder')).default;
    renderWithProviders(<NewPurchaseOrder />);

    expect(
      screen.getByRole('heading', { name: /new purchase order/i })
    ).toBeInTheDocument();
  });

  it('should call executeCreditAction with purchase_order_create on submit', async () => {
    const user = userEvent.setup();
    const NewPurchaseOrder = (await import('../NewPurchaseOrder')).default;
    renderWithProviders(<NewPurchaseOrder />);

    // Step 1: Select vendor
    await user.click(screen.getByTestId('select-vendor'));
    await user.click(screen.getByText('Next Step'));

    // Step 2: Search and add product
    const searchInput = screen.getByLabelText('Search products to add');
    await user.type(searchInput, 'Test');

    await waitFor(() => {
      expect(screen.getByText('Test Product')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Test Product'));

    // Submit
    const submitBtn = screen.getByRole('button', {
      name: /create purchase order/i,
    });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith(
        'purchase_order_create',
        expect.any(Function),
        expect.objectContaining({
          onInsufficientCredits: expect.any(Function),
        })
      );
    });
  });

  it('should not create PO when credit gate blocks the action', async () => {
    // Simulate credit gate blocking (returns null, calls onInsufficientCredits)
    mockExecute.mockImplementation(
      async (
        _actionKey: string,
        _action: () => Promise<unknown>,
        options?: { onInsufficientCredits?: () => void }
      ) => {
        options?.onInsufficientCredits?.();
        return null;
      }
    );

    const user = userEvent.setup();
    const NewPurchaseOrder = (await import('../NewPurchaseOrder')).default;
    renderWithProviders(<NewPurchaseOrder />);

    // Step 1: Select vendor
    await user.click(screen.getByTestId('select-vendor'));
    await user.click(screen.getByText('Next Step'));

    // Step 2: Search and add product
    const searchInput = screen.getByLabelText('Search products to add');
    await user.type(searchInput, 'Test');

    await waitFor(() => {
      expect(screen.getByText('Test Product')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Test Product'));

    // Submit
    const submitBtn = screen.getByRole('button', {
      name: /create purchase order/i,
    });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledWith(
        'purchase_order_create',
        expect.any(Function),
        expect.objectContaining({
          onInsufficientCredits: expect.any(Function),
        })
      );
    });

    // The supabase insert should NOT have been called
    expect(mockSupabaseInsert).not.toHaveBeenCalled();
  });

  it('should show OutOfCreditsModal when credits are insufficient', async () => {
    // Simulate credit gate blocking
    mockExecute.mockImplementation(
      async (
        _actionKey: string,
        _action: () => Promise<unknown>,
        options?: { onInsufficientCredits?: () => void }
      ) => {
        options?.onInsufficientCredits?.();
        return null;
      }
    );

    const user = userEvent.setup();
    const NewPurchaseOrder = (await import('../NewPurchaseOrder')).default;
    renderWithProviders(<NewPurchaseOrder />);

    // Step 1: Select vendor
    await user.click(screen.getByTestId('select-vendor'));
    await user.click(screen.getByText('Next Step'));

    // Step 2: Add product
    const searchInput = screen.getByLabelText('Search products to add');
    await user.type(searchInput, 'Test');

    await waitFor(() => {
      expect(screen.getByText('Test Product')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Test Product'));

    // Submit
    const submitBtn = screen.getByRole('button', {
      name: /create purchase order/i,
    });
    await user.click(submitBtn);

    // Verify modal appears
    await waitFor(() => {
      expect(screen.getByTestId('out-of-credits-modal')).toBeInTheDocument();
      expect(screen.getByTestId('blocked-action')).toHaveTextContent(
        'purchase_order_create'
      );
    });
  });

  it('should create PO when credit gate allows the action', async () => {
    const user = userEvent.setup();
    const NewPurchaseOrder = (await import('../NewPurchaseOrder')).default;
    renderWithProviders(<NewPurchaseOrder />);

    // Step 1: Select vendor
    await user.click(screen.getByTestId('select-vendor'));
    await user.click(screen.getByText('Next Step'));

    // Step 2: Add product
    const searchInput = screen.getByLabelText('Search products to add');
    await user.type(searchInput, 'Test');

    await waitFor(() => {
      expect(screen.getByText('Test Product')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Test Product'));

    // Submit
    const submitBtn = screen.getByRole('button', {
      name: /create purchase order/i,
    });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockSupabaseInsert).toHaveBeenCalledWith(
        'purchase_orders',
        expect.objectContaining({
          tenant_id: 'test-tenant-id',
          vendor_id: 'vendor-1',
          status: 'ordered',
        })
      );
    });
  });
});

// ============================================================================
// Credit Cost Configuration Tests for purchase_order_create
// ============================================================================

describe('Purchase Order Credit Cost Configuration', () => {
  it('purchase_order_create should cost 30 credits', async () => {
    const { getCreditCost } = await import('@/lib/credits/creditCosts');
    expect(getCreditCost('purchase_order_create')).toBe(30);
  });

  it('purchase_order_create should not be a free action', async () => {
    const { isActionFree } = await import('@/lib/credits/creditCosts');
    expect(isActionFree('purchase_order_create')).toBe(false);
  });

  it('purchase_order_create should be categorized under operations', async () => {
    const { getCreditCostInfo } = await import('@/lib/credits/creditCosts');
    const info = getCreditCostInfo('purchase_order_create');
    expect(info).not.toBeNull();
    expect(info?.category).toBe('operations');
    expect(info?.actionName).toBe('Create Purchase Order');
    expect(info?.credits).toBe(30);
  });
});
