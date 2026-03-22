/**
 * PointOfSale Credit Gating Tests
 *
 * Verifies that the POS sale processing is properly gated by credits:
 * 1. pos_process_sale action key is used with the correct cost (25 credits)
 * 2. useCreditGatedAction hook is integrated in PointOfSale
 * 3. Credit check blocks sale when insufficient credits
 * 4. Credit check allows sale when sufficient credits
 * 5. CreditCostBadge is shown for free-tier users
 * 6. Validation happens before credit gating (cart empty, insufficient cash)
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
    tenantSlug: 'test-tenant',
    isAuthenticated: true,
  }),
}));

vi.mock('@/hooks/useCredits', () => ({
  useCreditGatedAction: () => ({
    execute: mockExecute,
    isPerforming: false,
    isFreeTier: true,
  }),
}));

vi.mock('@/lib/navigation/tenantNavigation', () => ({
  useTenantNavigation: () => ({
    navigateToAdmin: mockNavigateToAdmin,
    navigate: vi.fn(),
  }),
}));

vi.mock('@/hooks/useRealtimeSync', () => ({
  useRealtimeSync: vi.fn(),
}));

vi.mock('@/hooks/useInventorySync', () => ({
  useInventorySync: vi.fn(),
}));

vi.mock('@/hooks/useFreeTierLimits', () => ({
  useFreeTierLimits: () => ({
    checkLimit: () => ({ allowed: true }),
    recordAction: vi.fn(),
    limitsApply: false,
  }),
}));

vi.mock('@/hooks/useConfirmDialog', () => ({
  useConfirmDialog: () => ({
    dialogState: { open: false, title: '', description: '', onConfirm: vi.fn(), isLoading: false },
    confirm: vi.fn(),
    closeDialog: vi.fn(),
    setLoading: vi.fn(),
  }),
}));

const mockRpc = vi.fn();
const mockFrom = vi.fn();
const mockInvoke = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}));

vi.mock('@/lib/activityLogger', () => ({
  logActivityAuto: vi.fn(),
  ActivityActions: {
    UPDATE_INVENTORY: 'UPDATE_INVENTORY',
    COMPLETE_ORDER: 'COMPLETE_ORDER',
  },
}));

vi.mock('@/lib/invalidation', () => ({
  invalidateOnEvent: vi.fn(),
}));

vi.mock('@/lib/eventBus', () => ({
  publish: vi.fn(),
}));

vi.mock('@/lib/orders/orderFlowManager', () => ({
  orderFlowManager: {
    transitionOrderStatus: vi.fn(),
  },
}));

vi.mock('@/components/pos/PendingPickupsPanel', () => ({
  PendingPickupsPanel: () => <div data-testid="pending-pickups">Pending Pickups</div>,
}));

vi.mock('@/components/pos/QuickMenuWizard', () => ({
  QuickMenuWizard: () => null,
}));

vi.mock('@/components/shared/ConfirmDeleteDialog', () => ({
  ConfirmDeleteDialog: () => null,
}));

vi.mock('@/components/credits', () => ({
  CreditCostBadge: ({ actionKey, compact }: { actionKey: string; compact?: boolean }) => (
    <span data-testid="credit-cost-badge" data-action-key={actionKey} data-compact={compact}>
      25 credits
    </span>
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

// Helper to set up mock products
function setupProductMocks() {
  const mockProducts = [
    {
      id: 'product-1',
      name: 'Blue Dream',
      price: 35,
      category: 'flower',
      stock_quantity: 10,
      thc_percent: 21,
      image_url: null,
    },
  ];

  // Mock products query
  mockFrom.mockImplementation((table: string) => {
    if (table === 'products') {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: mockProducts, error: null }),
            }),
          }),
        }),
        update: () => ({
          eq: () => ({
            eq: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
      };
    }
    if (table === 'customers') {
      return {
        select: () => ({
          eq: () => ({
            order: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
        update: () => ({
          eq: () => ({
            eq: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
      };
    }
    if (table === 'account_settings') {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: { tax_rate: 8.875 }, error: null }),
          }),
        }),
      };
    }
    if (table === 'pos_transactions') {
      return {
        insert: () => ({
          select: () => ({
            maybeSingle: () => Promise.resolve({
              data: { id: 'txn-1', transaction_number: 'POS-TEST001' },
              error: null,
            }),
          }),
        }),
      };
    }
    if (table === 'disposable_menu_orders') {
      return {
        update: () => ({
          eq: () => ({
            eq: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
      };
    }
    return {
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: [], error: null }),
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
    };
  });

  // Mock RPC for atomic transaction
  mockRpc.mockResolvedValue({
    data: {
      success: true,
      transaction_id: 'txn-1',
      transaction_number: 'POS-TEST001',
      total: 38.10,
    },
    error: null,
  });

  // Mock telegram notification
  mockInvoke.mockResolvedValue({ data: null, error: null });
}

// ============================================================================
// Tests
// ============================================================================

describe('PointOfSale Credit Gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupProductMocks();
    mockExecute.mockImplementation(
      async (_actionKey: string, action: () => Promise<unknown>) => {
        return action();
      }
    );
  });

  it('should render the POS page with product catalog', async () => {
    const PointOfSale = (await import('../PointOfSale')).default;
    renderWithProviders(<PointOfSale />);

    expect(screen.getByText('Point of Sale')).toBeInTheDocument();
    expect(screen.getByLabelText('Search products')).toBeInTheDocument();
  });

  it('should show CreditCostBadge on the charge button for free-tier users', async () => {
    const PointOfSale = (await import('../PointOfSale')).default;
    renderWithProviders(<PointOfSale />);

    // Wait for the badge to render
    await waitFor(() => {
      const badge = screen.getByTestId('credit-cost-badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveAttribute('data-action-key', 'pos_process_sale');
    });
  });

  it('should call executeCreditAction with pos_process_sale when completing a sale', async () => {
    const user = userEvent.setup();
    const PointOfSale = (await import('../PointOfSale')).default;
    renderWithProviders(<PointOfSale />);

    // Wait for products to load and click one to add to cart
    await waitFor(() => {
      expect(screen.getByText('Blue Dream')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Blue Dream'));

    // Find and click the Charge button
    const chargeButton = await screen.findByRole('button', { name: /charge/i });
    await user.click(chargeButton);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith(
        'pos_process_sale',
        expect.any(Function),
        expect.objectContaining({
          onInsufficientCredits: expect.any(Function),
        })
      );
    });
  });

  it('should not call executeCreditAction when cart is empty', async () => {
    const { toast } = await import('sonner');
    const user = userEvent.setup();
    const PointOfSale = (await import('../PointOfSale')).default;
    renderWithProviders(<PointOfSale />);

    // The charge button should be disabled with empty cart, but let's verify
    // the completeSale function validates before credit gating
    const chargeButton = screen.getByRole('button', { name: /charge/i });
    expect(chargeButton).toBeDisabled();

    // Even if somehow clicked, credit gate should not be called
    expect(mockExecute).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalledWith('Cart is empty');
  });

  it('should not create transaction when credit gate blocks the action', async () => {
    // Simulate credit gate blocking (returns null = insufficient credits)
    mockExecute.mockResolvedValue(null);

    const user = userEvent.setup();
    const PointOfSale = (await import('../PointOfSale')).default;
    renderWithProviders(<PointOfSale />);

    // Wait for products to load and add to cart
    await waitFor(() => {
      expect(screen.getByText('Blue Dream')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Blue Dream'));

    // Click charge button
    const chargeButton = await screen.findByRole('button', { name: /charge/i });
    await user.click(chargeButton);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledWith(
        'pos_process_sale',
        expect.any(Function),
        expect.any(Object)
      );
    });

    // The RPC should NOT have been called since the credit gate blocked it
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('should complete transaction when credit gate allows the action', async () => {
    const { toast } = await import('sonner');
    const user = userEvent.setup();
    const PointOfSale = (await import('../PointOfSale')).default;
    renderWithProviders(<PointOfSale />);

    // Wait for products to load and add to cart
    await waitFor(() => {
      expect(screen.getByText('Blue Dream')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Blue Dream'));

    // Click charge button
    const chargeButton = await screen.findByRole('button', { name: /charge/i });
    await user.click(chargeButton);

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith(
        'create_pos_transaction_atomic',
        expect.objectContaining({
          p_tenant_id: 'test-tenant-id',
          p_payment_method: 'cash',
        })
      );
    });

    // Verify success toast
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        'Sale completed!',
        expect.objectContaining({
          description: expect.stringContaining('POS-TEST001'),
        })
      );
    });
  });

  it('should call onInsufficientCredits with toast when credits are blocked', async () => {
    const { toast } = await import('sonner');
    // Capture the options to test the onInsufficientCredits callback
    let capturedOptions: { onInsufficientCredits?: () => void } | undefined;
    mockExecute.mockImplementation(
      async (_actionKey: string, _action: () => Promise<unknown>, options?: { onInsufficientCredits?: () => void }) => {
        capturedOptions = options;
        // Simulate the hook calling onInsufficientCredits
        options?.onInsufficientCredits?.();
        return null;
      }
    );

    const user = userEvent.setup();
    const PointOfSale = (await import('../PointOfSale')).default;
    renderWithProviders(<PointOfSale />);

    await waitFor(() => {
      expect(screen.getByText('Blue Dream')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Blue Dream'));

    const chargeButton = await screen.findByRole('button', { name: /charge/i });
    await user.click(chargeButton);

    await waitFor(() => {
      expect(capturedOptions?.onInsufficientCredits).toBeDefined();
      expect(toast.error).toHaveBeenCalledWith(
        'Insufficient Credits',
        expect.objectContaining({
          description: expect.stringContaining('credits'),
        })
      );
    });
  });
});

// ============================================================================
// Credit Cost Configuration Tests for pos_process_sale
// ============================================================================

describe('POS Process Sale Credit Cost Configuration', () => {
  it('pos_process_sale should cost 25 credits', async () => {
    const { getCreditCost } = await import('@/lib/credits/creditCosts');
    expect(getCreditCost('pos_process_sale')).toBe(25);
  });

  it('pos_process_sale should not be a free action', async () => {
    const { isActionFree } = await import('@/lib/credits/creditCosts');
    expect(isActionFree('pos_process_sale')).toBe(false);
  });

  it('pos_process_sale should be categorized under pos', async () => {
    const { getCreditCostInfo } = await import('@/lib/credits/creditCosts');
    const info = getCreditCostInfo('pos_process_sale');
    expect(info).not.toBeNull();
    expect(info?.category).toBe('pos');
    expect(info?.credits).toBe(25);
  });
});
