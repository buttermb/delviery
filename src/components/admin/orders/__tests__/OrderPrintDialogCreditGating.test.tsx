/**
 * OrderPrintDialog Credit Gating Tests
 *
 * Verifies that the receipt print action is properly gated by credits:
 * 1. pos_print_receipt action key is used with the correct cost (5 credits)
 * 2. useCreditGatedAction hook is integrated in OrderPrintDialog
 * 3. Credit check blocks print when insufficient credits
 * 4. Credit check allows print when sufficient credits
 * 5. OutOfCreditsModal is shown when credits are insufficient
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { type ReactNode } from 'react';
import type { OrderPrintData } from '../OrderPrintView';

// ============================================================================
// Mocks
// ============================================================================

const mockExecute = vi.fn();
const mockCloseOutOfCreditsModal = vi.fn();

const mockHookReturn = {
  execute: mockExecute,
  isExecuting: false,
  showOutOfCreditsModal: false,
  closeOutOfCreditsModal: mockCloseOutOfCreditsModal,
  blockedAction: null as string | null,
  balance: 1000,
  isFreeTier: true,
};

vi.mock('@/hooks/useCreditGatedAction', () => ({
  useCreditGatedAction: () => mockHookReturn,
}));

vi.mock('@/components/credits/OutOfCreditsModal', () => ({
  OutOfCreditsModal: ({ open, actionAttempted }: { open: boolean; actionAttempted?: string }) =>
    open ? (
      <div data-testid="out-of-credits-modal" data-action={actionAttempted}>
        Out of credits
      </div>
    ) : null,
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: { id: 'test-tenant-id', slug: 'test-tenant' },
    tenantSlug: 'test-tenant',
    isAuthenticated: true,
    accessToken: 'test-token',
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
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

// Mock OrderPrintView with forwardRef to avoid ref warning
vi.mock('../OrderPrintView', async () => {
  const { forwardRef } = await import('react');
  return {
    OrderPrintView: forwardRef<HTMLDivElement>((_props, ref) => (
      <div ref={ref} data-testid="print-view">Mock Print View</div>
    )),
  };
});

// ============================================================================
// Test Setup
// ============================================================================

const mockOrder: OrderPrintData = {
  id: 'order-123',
  order_number: 'ORD-001',
  created_at: '2025-01-01T00:00:00Z',
  status: 'completed',
  total_amount: 99.99,
  subtotal: 89.99,
  tax_amount: 10.0,
  customer: {
    name: 'John Doe',
    email: 'john@example.com',
    phone: '555-0100',
  },
  items: [
    {
      product_name: 'Test Product',
      quantity: 2,
      price: 44.995,
    },
  ],
};

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

describe('OrderPrintDialog Credit Gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset hook return to defaults
    mockHookReturn.execute = mockExecute;
    mockHookReturn.isExecuting = false;
    mockHookReturn.showOutOfCreditsModal = false;
    mockHookReturn.blockedAction = null;
    mockHookReturn.balance = 1000;
    mockHookReturn.isFreeTier = true;

    mockExecute.mockImplementation(
      async (options: { action: () => Promise<unknown> }) => {
        const result = await options.action();
        return { success: true, result, creditsCost: 5, wasBlocked: false };
      }
    );
  });

  it('should render the print dialog with Print button', async () => {
    const { OrderPrintDialog } = await import('../OrderPrintDialog');
    renderWithProviders(
      <OrderPrintDialog
        open={true}
        onOpenChange={vi.fn()}
        order={mockOrder}
      />
    );

    expect(screen.getByText(/Print Order #ORD-001/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /print/i })).toBeInTheDocument();
  });

  it('should call executeCreditAction with pos_print_receipt when Print is clicked', async () => {
    const user = userEvent.setup();
    const { OrderPrintDialog } = await import('../OrderPrintDialog');
    renderWithProviders(
      <OrderPrintDialog
        open={true}
        onOpenChange={vi.fn()}
        order={mockOrder}
      />
    );

    const printButton = screen.getByRole('button', { name: /^print$/i });
    await user.click(printButton);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          actionKey: 'pos_print_receipt',
          referenceId: 'order-123',
          referenceType: 'order',
        })
      );
    });
  });

  it('should not print when credit gate blocks the action', async () => {
    // Simulate credit gate blocking - action callback is never called
    mockExecute.mockResolvedValue({
      success: false,
      creditsCost: 5,
      wasBlocked: true,
    });

    const user = userEvent.setup();
    const mockWindowOpen = vi.spyOn(window, 'open').mockReturnValue(null);

    try {
      const { OrderPrintDialog } = await import('../OrderPrintDialog');
      renderWithProviders(
        <OrderPrintDialog
          open={true}
          onOpenChange={vi.fn()}
          order={mockOrder}
        />
      );

      const printButton = screen.getByRole('button', { name: /^print$/i });
      await user.click(printButton);

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith(
          expect.objectContaining({
            actionKey: 'pos_print_receipt',
          })
        );
      });

      // The action callback was never invoked (credit gate blocked it),
      // so window.open should NOT have been called
      expect(mockWindowOpen).not.toHaveBeenCalled();
    } finally {
      mockWindowOpen.mockRestore();
    }
  });

  it('should show OutOfCreditsModal when credits are insufficient', async () => {
    // Set the hook to show the modal state
    mockHookReturn.showOutOfCreditsModal = true;
    mockHookReturn.blockedAction = 'pos_print_receipt';

    const { OrderPrintDialog } = await import('../OrderPrintDialog');
    renderWithProviders(
      <OrderPrintDialog
        open={true}
        onOpenChange={vi.fn()}
        order={mockOrder}
      />
    );

    expect(screen.getByTestId('out-of-credits-modal')).toBeInTheDocument();
    expect(screen.getByTestId('out-of-credits-modal')).toHaveAttribute(
      'data-action',
      'pos_print_receipt'
    );
  });

  it('should disable Print button when credit check is in progress', async () => {
    mockHookReturn.isExecuting = true;

    const { OrderPrintDialog } = await import('../OrderPrintDialog');
    renderWithProviders(
      <OrderPrintDialog
        open={true}
        onOpenChange={vi.fn()}
        order={mockOrder}
      />
    );

    const printButton = screen.getByRole('button', { name: /checking credits/i });
    expect(printButton).toBeDisabled();
  });

  it('should pass order.id as referenceId for idempotency', async () => {
    const user = userEvent.setup();
    const { OrderPrintDialog } = await import('../OrderPrintDialog');
    renderWithProviders(
      <OrderPrintDialog
        open={true}
        onOpenChange={vi.fn()}
        order={mockOrder}
      />
    );

    const printButton = screen.getByRole('button', { name: /^print$/i });
    await user.click(printButton);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          referenceId: 'order-123',
          referenceType: 'order',
        })
      );
    });
  });
});

// ============================================================================
// Credit Cost Configuration Tests for pos_print_receipt
// ============================================================================

describe('POS Print Receipt Credit Cost Configuration', () => {
  it('pos_print_receipt should cost 5 credits', async () => {
    const { getCreditCost } = await import('@/lib/credits/creditCosts');
    expect(getCreditCost('pos_print_receipt')).toBe(5);
  });

  it('pos_print_receipt should be categorized under pos', async () => {
    const { getCreditCostInfo } = await import('@/lib/credits/creditCosts');
    const info = getCreditCostInfo('pos_print_receipt');
    expect(info).not.toBeNull();
    expect(info?.category).toBe('pos');
    expect(info?.actionName).toBe('Print Receipt');
    expect(info?.credits).toBe(5);
  });
});
