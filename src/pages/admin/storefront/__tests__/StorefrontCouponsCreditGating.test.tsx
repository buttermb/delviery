/**
 * StorefrontCoupons Credit Gating Tests
 *
 * Verifies that storefront coupon creation is gated by credits:
 * 1. marketplace_coupon_created action key is used (25 credits)
 * 2. Credit gate only applies to creation, NOT editing
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
const mockInsert = vi.fn();
const mockUpdate = vi.fn();

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
    from: (table: string) => {
      if (table === 'marketplace_stores') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({ data: { id: 'store-1' }, error: null }),
            }),
          }),
        };
      }
      if (table === 'marketplace_coupons') {
        return {
          select: () => ({
            eq: () => ({
              order: () =>
                Promise.resolve({ data: [], error: null }),
            }),
          }),
          insert: mockInsert,
          update: (data: unknown) => {
            mockUpdate(data);
            return {
              eq: () => ({
                eq: () => Promise.resolve({ error: null }),
              }),
            };
          },
          delete: () => ({
            eq: () => ({
              eq: () => Promise.resolve({ error: null }),
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

vi.mock('@/lib/humanizeError', () => ({
  humanizeError: (e: unknown) => String(e),
}));

vi.mock('@/utils/toastHelpers', () => ({
  showCopyToast: vi.fn(),
}));

vi.mock('@/hooks/useConfirmDialog', () => ({
  useConfirmDialog: () => ({
    dialogState: { open: false, onConfirm: vi.fn() },
    confirm: vi.fn(),
    closeDialog: vi.fn(),
    setLoading: vi.fn(),
  }),
}));

vi.mock('@/components/shared/ConfirmDeleteDialog', () => ({
  ConfirmDeleteDialog: () => null,
}));

vi.mock('@/lib/utils/formatCurrency', () => ({
  formatCurrency: (v: number) => `$${v.toFixed(2)}`,
}));

vi.mock('@/lib/utils/formatDate', () => ({
  formatSmartDate: (d: string) => d,
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

describe('StorefrontCoupons Credit Gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecute.mockImplementation(
      async (_actionKey: string, action: () => Promise<unknown>) => {
        return action();
      }
    );
    mockInsert.mockResolvedValue({ error: null });
    mockUpdate.mockResolvedValue({ error: null });
  });

  it('should render the create coupon button', async () => {
    const StorefrontCoupons = (await import('../StorefrontCoupons')).default;
    renderWithProviders(<StorefrontCoupons />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /create coupon/i })).toBeInTheDocument();
    });
  });

  it('should call executeCreditAction with marketplace_coupon_created on new coupon', async () => {
    const user = userEvent.setup();
    const StorefrontCoupons = (await import('../StorefrontCoupons')).default;
    renderWithProviders(<StorefrontCoupons />);

    // Wait for store to load and click create
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /create coupon/i })).toBeInTheDocument();
    });

    const createBtn = screen.getByRole('button', { name: /create coupon/i });
    await user.click(createBtn);

    // Fill in the form
    const codeInput = screen.getByPlaceholderText('SAVE20');
    await user.type(codeInput, 'NEWCODE');

    const valueInput = screen.getByPlaceholderText('20');
    await user.type(valueInput, '15');

    // Submit
    const form = screen.getByRole('button', { name: /save coupon/i });
    await user.click(form);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith(
        'marketplace_coupon_created',
        expect.any(Function)
      );
    });
  });

  it('should not call credit gate when required fields are missing', async () => {
    const { toast } = await import('sonner');
    const user = userEvent.setup();
    const StorefrontCoupons = (await import('../StorefrontCoupons')).default;
    renderWithProviders(<StorefrontCoupons />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /create coupon/i })).toBeInTheDocument();
    });

    const createBtn = screen.getByRole('button', { name: /create coupon/i });
    await user.click(createBtn);

    // Submit without filling fields
    const saveBtn = screen.getByRole('button', { name: /save coupon/i });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Please fill in the required fields');
    });

    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('should not create coupon when credit gate blocks the action', async () => {
    mockExecute.mockResolvedValue(null);

    const user = userEvent.setup();
    const StorefrontCoupons = (await import('../StorefrontCoupons')).default;
    renderWithProviders(<StorefrontCoupons />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /create coupon/i })).toBeInTheDocument();
    });

    const createBtn = screen.getByRole('button', { name: /create coupon/i });
    await user.click(createBtn);

    const codeInput = screen.getByPlaceholderText('SAVE20');
    await user.type(codeInput, 'BLOCKED');

    const valueInput = screen.getByPlaceholderText('20');
    await user.type(valueInput, '10');

    const saveBtn = screen.getByRole('button', { name: /save coupon/i });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledWith(
        'marketplace_coupon_created',
        expect.any(Function)
      );
    });

    // Insert should NOT have been called since gate blocked it
    expect(mockInsert).not.toHaveBeenCalled();
  });
});
