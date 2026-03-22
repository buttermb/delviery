/**
 * CouponCreateForm Credit Gating Tests
 *
 * Verifies that coupon creation is properly gated by credits:
 * 1. coupon_create action key is used with the correct cost (20 credits)
 * 2. useCreditGatedAction hook is integrated in CouponCreateForm
 * 3. Credit check blocks creation when insufficient credits
 * 4. Credit check allows creation when sufficient credits
 * 5. Editing a coupon does NOT consume credits
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
    admin: { id: 'admin-1' },
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
    from: (table: string) => {
      if (table === 'coupon_codes') {
        return {
          insert: mockInsert,
          update: () => ({
            eq: mockUpdate,
          }),
        };
      }
      return { insert: vi.fn(), update: vi.fn() };
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

vi.mock('@/lib/queryKeys', () => ({
  queryKeys: {
    coupons: {
      lists: () => ['coupons', 'list'],
      detail: (id: string) => ['coupons', 'detail', id],
    },
  },
}));

vi.mock('@/lib/humanizeError', () => ({
  humanizeError: (e: unknown) => String(e),
}));

vi.mock('@/lib/utils/sanitize', () => ({
  sanitizeCouponCode: (code: string) => code.toUpperCase().trim(),
  sanitizeTextareaInput: (text: string) => text.trim(),
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
      {ui}
    </QueryClientProvider>
  );
}

// ============================================================================
// Import after mocks
// ============================================================================

import { CouponCreateForm } from '../CouponCreateForm';

// ============================================================================
// Tests
// ============================================================================

describe('CouponCreateForm Credit Gating', () => {
  const mockOnOpenChange = vi.fn();
  const mockOnSuccess = vi.fn();

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

  it('should render the create coupon form', () => {
    renderWithProviders(
      <CouponCreateForm
        open={true}
        onOpenChange={mockOnOpenChange}
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.getByText('Create New Coupon')).toBeInTheDocument();
    expect(screen.getByLabelText(/coupon code/i)).toBeInTheDocument();
  });

  it('should call executeCreditAction with coupon_create on create submit', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <CouponCreateForm
        open={true}
        onOpenChange={mockOnOpenChange}
        onSuccess={mockOnSuccess}
      />
    );

    // Submit the form (code is auto-generated, discount_value defaults to 10)
    const submitBtn = screen.getByRole('button', { name: /create coupon/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith(
        'coupon_create',
        expect.any(Function)
      );
    });
  });

  it('should not create coupon when credit gate blocks the action', async () => {
    mockExecute.mockResolvedValue(null);

    const user = userEvent.setup();

    renderWithProviders(
      <CouponCreateForm
        open={true}
        onOpenChange={mockOnOpenChange}
        onSuccess={mockOnSuccess}
      />
    );

    const submitBtn = screen.getByRole('button', { name: /create coupon/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledWith('coupon_create', expect.any(Function));
    });

    // The insert should NOT have been called (action blocked by gate)
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('should create coupon when credit gate allows the action', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <CouponCreateForm
        open={true}
        onOpenChange={mockOnOpenChange}
        onSuccess={mockOnSuccess}
      />
    );

    const submitBtn = screen.getByRole('button', { name: /create coupon/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledTimes(1);
    });

    expect(mockInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        discount_type: 'percentage',
        discount_value: 10,
        status: 'active',
        created_by: 'admin-1',
      }),
    ]);
  });

  it('should NOT use credit gate when editing an existing coupon', async () => {
    const user = userEvent.setup();

    const existingCoupon = {
      id: 'coupon-123',
      code: 'EXISTING10',
      discount_type: 'percentage' as const,
      discount_value: 10,
      description: null,
      start_date: null,
      end_date: null,
      never_expires: false,
      min_purchase: null,
      max_discount: null,
      total_usage_limit: null,
      per_user_limit: null,
      auto_apply: false,
      status: 'active' as const,
      created_by: 'admin-1',
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
      tenant_id: 'test-tenant-id',
      times_used: 0,
      stackable: false,
    };

    renderWithProviders(
      <CouponCreateForm
        open={true}
        onOpenChange={mockOnOpenChange}
        coupon={existingCoupon}
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.getByText('Edit Coupon')).toBeInTheDocument();

    const submitBtn = screen.getByRole('button', { name: /update coupon/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledTimes(1);
    });

    // Credit gate should NOT have been called for edits
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('should validate discount value before calling credit gate', async () => {
    const { toast } = await import('sonner');
    const user = userEvent.setup();

    renderWithProviders(
      <CouponCreateForm
        open={true}
        onOpenChange={mockOnOpenChange}
        onSuccess={mockOnSuccess}
      />
    );

    // Set discount_value to 0 by clearing the input
    const discountInput = screen.getByLabelText(/discount value/i);
    await user.clear(discountInput);
    await user.type(discountInput, '0');

    const submitBtn = screen.getByRole('button', { name: /create coupon/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Discount value must be greater than 0');
    });

    // Credit gate should NOT be called when validation fails
    expect(mockExecute).not.toHaveBeenCalled();
  });
});

// ============================================================================
// Credit Cost Configuration Tests for coupon_create
// ============================================================================

describe('Coupon Credit Cost Configuration', () => {
  it('coupon_create should cost 20 credits', async () => {
    const { getCreditCost } = await import('@/lib/credits/creditCosts');
    expect(getCreditCost('coupon_create')).toBe(20);
  });

  it('coupon_create should not be a free action', async () => {
    const { isActionFree } = await import('@/lib/credits/creditCosts');
    expect(isActionFree('coupon_create')).toBe(false);
  });

  it('coupon_create should be categorized under coupons', async () => {
    const { getCreditCostInfo } = await import('@/lib/credits/creditCosts');
    const info = getCreditCostInfo('coupon_create');
    expect(info).not.toBeNull();
    expect(info?.category).toBe('coupons');
    expect(info?.actionName).toBe('Create Coupon');
    expect(info?.credits).toBe(20);
  });
});
