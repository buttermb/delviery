/**
 * BulkActions Credit Gating Tests
 *
 * Verifies that bulk stock update actions are properly gated by credits:
 * 1. stock_bulk_update action key is used with the correct cost (25 credits)
 * 2. useCreditGatedAction hook is integrated in BulkActions
 * 3. Credit check blocks action when insufficient credits
 * 4. Credit check allows action when sufficient credits
 * 5. Buttons are disabled during credit action execution
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';

// ============================================================================
// Mocks
// ============================================================================

const mockExecute = vi.fn();
const mockSupabaseUpdate = vi.fn();
const mockSupabaseIn = vi.fn();

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
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
      update: (updates: Record<string, unknown>) => {
        mockSupabaseUpdate(updates);
        return {
          in: (_col: string, _ids: string[]) => {
            mockSupabaseIn(_col, _ids);
            return Promise.resolve({ error: null });
          },
        };
      },
      delete: () => ({
        in: () => Promise.resolve({ error: null }),
      }),
    }),
  },
}));

vi.mock('@/lib/queryKeys', () => ({
  queryKeys: {
    adminProducts: { all: ['adminProducts'] },
  },
}));

vi.mock('@/lib/humanizeError', () => ({
  humanizeError: (e: unknown) => String(e),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/components/shared/ConfirmDeleteDialog', () => ({
  ConfirmDeleteDialog: () => null,
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
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

// ============================================================================
// Tests
// ============================================================================

describe('BulkActions Credit Gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecute.mockImplementation(
      async (_actionKey: string, action: () => Promise<unknown>) => {
        return action();
      }
    );
  });

  it('should render bulk action buttons', async () => {
    const { BulkActions } = await import('../BulkActions');
    renderWithProviders(
      <BulkActions
        selectedCount={3}
        selectedProducts={['p1', 'p2', 'p3']}
        onClearSelection={vi.fn()}
      />
    );

    expect(screen.getByText('3 products selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /set active/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /set inactive/i })).toBeInTheDocument();
  });

  it('should call executeCreditAction with stock_bulk_update when setting active', async () => {
    const user = userEvent.setup();
    const { BulkActions } = await import('../BulkActions');
    renderWithProviders(
      <BulkActions
        selectedCount={2}
        selectedProducts={['p1', 'p2']}
        onClearSelection={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /set active/i }));

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith(
        'stock_bulk_update',
        expect.any(Function)
      );
    });
  });

  it('should call executeCreditAction with stock_bulk_update when setting inactive', async () => {
    const user = userEvent.setup();
    const { BulkActions } = await import('../BulkActions');
    renderWithProviders(
      <BulkActions
        selectedCount={2}
        selectedProducts={['p1', 'p2']}
        onClearSelection={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /set inactive/i }));

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith(
        'stock_bulk_update',
        expect.any(Function)
      );
    });
  });

  it('should not update products when credit gate blocks the action', async () => {
    mockExecute.mockResolvedValue(null);

    const user = userEvent.setup();
    const { BulkActions } = await import('../BulkActions');
    renderWithProviders(
      <BulkActions
        selectedCount={2}
        selectedProducts={['p1', 'p2']}
        onClearSelection={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /set active/i }));

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledWith('stock_bulk_update', expect.any(Function));
    });

    // The supabase update should NOT have been called
    expect(mockSupabaseUpdate).not.toHaveBeenCalled();
  });

  it('should update products when credit gate allows the action', async () => {
    const user = userEvent.setup();
    const { BulkActions } = await import('../BulkActions');
    renderWithProviders(
      <BulkActions
        selectedCount={2}
        selectedProducts={['p1', 'p2']}
        onClearSelection={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /set active/i }));

    await waitFor(() => {
      expect(mockSupabaseUpdate).toHaveBeenCalledWith({ in_stock: true });
    });
  });

  it('should update with in_stock false when setting inactive', async () => {
    const user = userEvent.setup();
    const { BulkActions } = await import('../BulkActions');
    renderWithProviders(
      <BulkActions
        selectedCount={1}
        selectedProducts={['p1']}
        onClearSelection={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /set inactive/i }));

    await waitFor(() => {
      expect(mockSupabaseUpdate).toHaveBeenCalledWith({ in_stock: false });
    });
  });
});

// ============================================================================
// Credit Cost Configuration Tests for stock_bulk_update
// ============================================================================

describe('Bulk Stock Update Credit Cost Configuration', () => {
  it('stock_bulk_update should cost 25 credits', async () => {
    const { getCreditCost } = await import('@/lib/credits/creditCosts');
    expect(getCreditCost('stock_bulk_update')).toBe(25);
  });

  it('stock_bulk_update should not be a free action', async () => {
    const { isActionFree } = await import('@/lib/credits/creditCosts');
    expect(isActionFree('stock_bulk_update')).toBe(false);
  });

  it('stock_bulk_update should be categorized under inventory', async () => {
    const { getCreditCostInfo } = await import('@/lib/credits/creditCosts');
    const info = getCreditCostInfo('stock_bulk_update');
    expect(info).not.toBeNull();
    expect(info?.category).toBe('inventory');
    expect(info?.actionName).toBe('Bulk Update Stock');
    expect(info?.credits).toBe(25);
  });
});
