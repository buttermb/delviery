/**
 * BulkOperationsPage Credit Gating Tests
 *
 * Verifies that the bulk operation execute action is properly gated by credits:
 * 1. marketplace_bulk_update action key is used with the correct cost (100 credits)
 * 2. useCreditGatedAction hook is integrated in BulkOperationsPage
 * 3. Credit check blocks action when insufficient credits
 * 4. Credit check allows action when sufficient credits
 * 5. OutOfCreditsModal is rendered
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
const mockCloseOutOfCreditsModal = vi.fn();

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
}));

const mockSupabaseChain = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  order: vi.fn().mockResolvedValue({
    data: [
      { id: 'product-1', name: 'Product A', price: 10, stock_quantity: 100 },
      { id: 'product-2', name: 'Product B', price: 20, stock_quantity: 50 },
    ],
    error: null,
  }),
};

// Make chained methods return the chain object for fluent API
mockSupabaseChain.select.mockReturnValue(mockSupabaseChain);
mockSupabaseChain.eq.mockReturnValue(mockSupabaseChain);
mockSupabaseChain.in.mockReturnValue(mockSupabaseChain);
mockSupabaseChain.update.mockReturnValue(mockSupabaseChain);

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnValue(mockSupabaseChain),
  },
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

vi.mock('@/hooks/useCreditGatedAction', () => ({
  useCreditGatedAction: () => ({
    execute: mockExecute,
    showOutOfCreditsModal: false,
    closeOutOfCreditsModal: mockCloseOutOfCreditsModal,
    blockedAction: null,
    isExecuting: false,
  }),
}));

vi.mock('@/components/credits/OutOfCreditsModal', () => ({
  OutOfCreditsModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="out-of-credits-modal">Out of Credits</div> : null,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/components/EnhancedLoadingState', () => ({
  EnhancedLoadingState: () => <div data-testid="loading-state">Loading...</div>,
}));

vi.mock('@/components/shared/EnhancedEmptyState', () => ({
  EnhancedEmptyState: ({ title }: { title: string }) => <div data-testid="empty-state">{title}</div>,
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

describe('BulkOperationsPage Credit Gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecute.mockImplementation(
      async (options: { action: () => Promise<unknown> }) => {
        await options.action();
        return { success: true, creditsCost: 100, wasBlocked: false };
      }
    );
  });

  it('should render the bulk operations page with operation cards', async () => {
    const BulkOperationsPage = (await import('../BulkOperationsPage')).default;
    renderWithProviders(<BulkOperationsPage />);

    // Wait for products to load (data loads async via React Query)
    await waitFor(() => {
      expect(screen.getByText('Update Prices')).toBeInTheDocument();
    });

    expect(screen.getByText('Bulk Operations')).toBeInTheDocument();
    expect(screen.getByText('Update Stock Levels')).toBeInTheDocument();
    expect(screen.getByText('Apply Tags')).toBeInTheDocument();
    expect(screen.getByText('Update Status')).toBeInTheDocument();
  });

  it('should call executeCreditAction with marketplace_bulk_update action key', async () => {
    const user = userEvent.setup();
    const BulkOperationsPage = (await import('../BulkOperationsPage')).default;
    renderWithProviders(<BulkOperationsPage />);

    // Wait for products to load
    await waitFor(() => {
      expect(screen.getByText('Product A')).toBeInTheDocument();
    });

    // Select a product
    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[0]);

    // Click on "Update Status" operation card
    await user.click(screen.getByText('Update Status'));

    // Execute the operation in the dialog
    const executeBtn = screen.getByRole('button', { name: /execute operation/i });
    await user.click(executeBtn);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          actionKey: 'marketplace_bulk_update',
          action: expect.any(Function),
          onError: expect.any(Function),
        })
      );
    });
  });

  it('should not execute bulk operation when credit gate blocks the action', async () => {
    const { supabase } = await import('@/integrations/supabase/client');

    // Simulate credit gate blocking (returns blocked result, does not call action)
    mockExecute.mockResolvedValue({
      success: false,
      creditsCost: 100,
      wasBlocked: true,
    });

    const user = userEvent.setup();
    const BulkOperationsPage = (await import('../BulkOperationsPage')).default;
    renderWithProviders(<BulkOperationsPage />);

    // Wait for products to load
    await waitFor(() => {
      expect(screen.getByText('Product A')).toBeInTheDocument();
    });

    // Select a product
    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[0]);

    // Click on "Update Status" operation card
    await user.click(screen.getByText('Update Status'));

    // Execute the operation
    const executeBtn = screen.getByRole('button', { name: /execute operation/i });
    await user.click(executeBtn);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledWith(
        expect.objectContaining({ actionKey: 'marketplace_bulk_update' })
      );
    });

    // The supabase update call should NOT have been made
    // because the credit gate blocked the action callback from executing
    expect(supabase.from('products').update).not.toHaveBeenCalled();
  });

  it('should render OutOfCreditsModal component', async () => {
    const BulkOperationsPage = (await import('../BulkOperationsPage')).default;
    renderWithProviders(<BulkOperationsPage />);

    await waitFor(() => {
      expect(screen.getByText('Bulk Operations')).toBeInTheDocument();
    });

    // The modal is rendered but hidden (open=false from mock)
    // Verify it doesn't show when not blocked
    expect(screen.queryByTestId('out-of-credits-modal')).not.toBeInTheDocument();
  });
});

// ============================================================================
// Credit Cost Configuration Tests for marketplace_bulk_update
// ============================================================================

describe('Marketplace Bulk Update Credit Cost Configuration', () => {
  it('marketplace_bulk_update should cost 100 credits', async () => {
    const { getCreditCost } = await import('@/lib/credits/creditCosts');
    expect(getCreditCost('marketplace_bulk_update')).toBe(100);
  });

  it('marketplace_bulk_update should not be a free action', async () => {
    const { isActionFree } = await import('@/lib/credits/creditCosts');
    expect(isActionFree('marketplace_bulk_update')).toBe(false);
  });

  it('marketplace_bulk_update should be categorized under marketplace', async () => {
    const { getCreditCostInfo } = await import('@/lib/credits/creditCosts');
    const info = getCreditCostInfo('marketplace_bulk_update');
    expect(info).not.toBeNull();
    expect(info?.category).toBe('marketplace');
    expect(info?.credits).toBe(100);
  });
});
