/**
 * ExpenseTracking Credit Gating Tests
 *
 * Verifies that the expense add action is properly gated by credits:
 * 1. expense_add action key is used with the correct cost (5 credits)
 * 2. useCreditGatedAction hook is integrated in ExpenseTracking
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
const mockSupabaseInsert = vi.fn();
const mockSupabaseSelect = vi.fn();
const mockSupabaseDelete = vi.fn();

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
  useCredits: () => ({
    balance: 100,
    isFreeTier: true,
    isLoading: false,
    canPerformAction: vi.fn().mockResolvedValue(true),
    performAction: vi.fn().mockResolvedValue({ success: true }),
    lifetimeSpent: 0,
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'expenses') {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => mockSupabaseSelect(),
              }),
            }),
          }),
          insert: (data: unknown) => mockSupabaseInsert(data),
          delete: () => ({
            eq: () => ({
              eq: () => mockSupabaseDelete(),
            }),
          }),
        };
      }
      return {
        select: () => ({ eq: () => ({ order: () => ({ limit: () => ({ data: [], error: null }) }) }) }),
      };
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

vi.mock('@/lib/invalidation', () => ({
  invalidateOnEvent: vi.fn(),
}));

vi.mock('@/components/credits/CreditCostBadge', () => ({
  CreditCostBadge: ({ actionKey }: { actionKey: string }) => (
    <span data-testid="credit-cost-badge" data-action-key={actionKey}>
      5 cr
    </span>
  ),
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
      <div data-testid="out-of-credits-modal" data-action={actionAttempted}>
        <span>Out of Credits</span>
        <button onClick={() => onOpenChange(false)}>Close</button>
      </div>
    ) : null,
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

describe('ExpenseTracking Credit Gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecute.mockImplementation(
      async (_actionKey: string, action: () => Promise<unknown>) => {
        return action();
      }
    );
    mockSupabaseSelect.mockResolvedValue({ data: [], error: null });
    mockSupabaseInsert.mockResolvedValue({ error: null });
    mockSupabaseDelete.mockResolvedValue({ error: null });
  });

  it('should render the expense tracking page with add expense button', async () => {
    const ExpenseTracking = (await import('../ExpenseTracking')).default;
    renderWithProviders(<ExpenseTracking />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add expense/i })).toBeInTheDocument();
    });
  });

  it('should show CreditCostBadge with expense_add action key', async () => {
    const ExpenseTracking = (await import('../ExpenseTracking')).default;
    renderWithProviders(<ExpenseTracking />);

    await waitFor(() => {
      const badge = screen.getByTestId('credit-cost-badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveAttribute('data-action-key', 'expense_add');
    });
  });

  it('should call executeCreditAction with expense_add on form submit', async () => {
    const user = userEvent.setup();
    const ExpenseTracking = (await import('../ExpenseTracking')).default;
    renderWithProviders(<ExpenseTracking />);

    // Open the dialog
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add expense/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /add expense/i }));

    // Fill in the form
    const descriptionInput = await screen.findByLabelText(/description/i);
    await user.type(descriptionInput, 'Office supplies');

    const amountInput = screen.getByLabelText(/amount/i);
    await user.type(amountInput, '45.99');

    // Submit the form
    const submitBtn = screen.getByRole('button', { name: /^add expense$/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith(
        'expense_add',
        expect.any(Function),
        expect.objectContaining({
          onInsufficientCredits: expect.any(Function),
        })
      );
    });
  });

  it('should not insert expense when credit gate blocks the action', async () => {
    // Simulate credit gate blocking (returns null)
    mockExecute.mockResolvedValue(null);

    const user = userEvent.setup();
    const ExpenseTracking = (await import('../ExpenseTracking')).default;
    renderWithProviders(<ExpenseTracking />);

    // Open the dialog
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add expense/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /add expense/i }));

    // Fill in the form
    const descriptionInput = await screen.findByLabelText(/description/i);
    await user.type(descriptionInput, 'Test expense');

    const amountInput = screen.getByLabelText(/amount/i);
    await user.type(amountInput, '25.00');

    // Submit the form
    const submitBtn = screen.getByRole('button', { name: /^add expense$/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledWith(
        'expense_add',
        expect.any(Function),
        expect.any(Object)
      );
    });

    // Supabase insert should NOT have been called since credit gate blocked
    expect(mockSupabaseInsert).not.toHaveBeenCalled();
  });

  it('should show OutOfCreditsModal when onInsufficientCredits is called', async () => {
    // Simulate credit gate calling onInsufficientCredits callback
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
    const ExpenseTracking = (await import('../ExpenseTracking')).default;
    renderWithProviders(<ExpenseTracking />);

    // Open the dialog
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add expense/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /add expense/i }));

    // Fill in the form
    const descriptionInput = await screen.findByLabelText(/description/i);
    await user.type(descriptionInput, 'Test expense');

    const amountInput = screen.getByLabelText(/amount/i);
    await user.type(amountInput, '10.00');

    // Submit the form
    const submitBtn = screen.getByRole('button', { name: /^add expense$/i });
    await user.click(submitBtn);

    // OutOfCreditsModal should appear
    await waitFor(() => {
      const modal = screen.getByTestId('out-of-credits-modal');
      expect(modal).toBeInTheDocument();
      expect(modal).toHaveAttribute('data-action', 'expense_add');
    });
  });

  it('should insert expense when credit gate allows the action', async () => {
    const user = userEvent.setup();
    const ExpenseTracking = (await import('../ExpenseTracking')).default;
    renderWithProviders(<ExpenseTracking />);

    // Open the dialog
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add expense/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /add expense/i }));

    // Fill in the form
    const descriptionInput = await screen.findByLabelText(/description/i);
    await user.type(descriptionInput, 'Office supplies');

    const amountInput = screen.getByLabelText(/amount/i);
    await user.type(amountInput, '45.99');

    // Submit the form
    const submitBtn = screen.getByRole('button', { name: /^add expense$/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockSupabaseInsert).toHaveBeenCalledTimes(1);
      expect(mockSupabaseInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: 'test-tenant-id',
          description: 'Office supplies',
          amount: 45.99,
          category: 'Supplies',
        })
      );
    });
  });
});

// ============================================================================
// Credit Cost Configuration Tests for expense_add
// ============================================================================

describe('Expense Credit Cost Configuration', () => {
  it('expense_add should cost 5 credits', async () => {
    const { getCreditCost } = await import('@/lib/credits/creditCosts');
    expect(getCreditCost('expense_add')).toBe(5);
  });

  it('expense_add should not be a free action', async () => {
    const { isActionFree } = await import('@/lib/credits/creditCosts');
    expect(isActionFree('expense_add')).toBe(false);
  });

  it('expense_add should be categorized under analytics', async () => {
    const { getCreditCostInfo } = await import('@/lib/credits/creditCosts');
    const info = getCreditCostInfo('expense_add');
    expect(info).not.toBeNull();
    expect(info?.category).toBe('analytics');
    expect(info?.actionName).toBe('Add Expense');
    expect(info?.credits).toBe(5);
  });
});
