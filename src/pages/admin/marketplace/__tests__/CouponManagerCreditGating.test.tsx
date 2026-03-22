/**
 * CouponManager Credit Gating Tests
 *
 * Verifies that marketplace coupon creation is gated by credits:
 * 1. marketplace_coupon_created action key is used (25 credits)
 * 2. useCreditGatedAction hook is integrated
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

vi.mock('@/integrations/supabase/client', () => {
  const chainable = {
    select: () => chainable,
    eq: () => chainable,
    order: () => Promise.resolve({ data: [], error: null }),
    insert: (...args: unknown[]) => mockInsert(...args),
    delete: () => ({
      eq: () => ({
        eq: () => Promise.resolve({ error: null }),
      }),
    }),
  };
  return {
    supabase: {
      from: () => chainable,
    },
  };
});

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

describe('CouponManager Credit Gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecute.mockImplementation(
      async (_actionKey: string, action: () => Promise<unknown>) => {
        return action();
      }
    );
    mockInsert.mockResolvedValue({ error: null });
  });

  it('should render the coupon creation dialog trigger', async () => {
    const CouponManager = (await import('../CouponManager')).default;
    renderWithProviders(<CouponManager />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /create coupon/i })).toBeInTheDocument();
    });
  });

  it('should call executeCreditAction with marketplace_coupon_created on create', async () => {
    const user = userEvent.setup();
    const CouponManager = (await import('../CouponManager')).default;
    renderWithProviders(<CouponManager />);

    // Wait for loading to finish, then open dialog
    const createBtn = await screen.findByRole('button', { name: /create coupon/i });
    await user.click(createBtn);

    // Fill in form
    const codeInput = screen.getByPlaceholderText('SUMMER25');
    await user.type(codeInput, 'SAVE10');

    const valueInput = screen.getByPlaceholderText('20');
    await user.type(valueInput, '10');

    // Submit
    const submitBtn = screen.getAllByRole('button', { name: /create coupon/i }).pop()!;
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith(
        'marketplace_coupon_created',
        expect.any(Function)
      );
    });
  });

  it('should not create coupon when credit gate blocks the action', async () => {
    mockExecute.mockResolvedValue(null);

    const user = userEvent.setup();
    const CouponManager = (await import('../CouponManager')).default;
    renderWithProviders(<CouponManager />);

    // Wait for loading to finish, then open dialog
    const createBtn = await screen.findByRole('button', { name: /create coupon/i });
    await user.click(createBtn);

    // Fill in form
    const codeInput = screen.getByPlaceholderText('SUMMER25');
    await user.type(codeInput, 'BLOCKED');

    const valueInput = screen.getByPlaceholderText('20');
    await user.type(valueInput, '15');

    // Submit
    const submitBtn = screen.getAllByRole('button', { name: /create coupon/i }).pop()!;
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledWith(
        'marketplace_coupon_created',
        expect.any(Function)
      );
    });

    // Supabase insert should NOT have been called
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('should not call credit gate when required fields are missing', async () => {
    const { toast } = await import('sonner');
    const user = userEvent.setup();
    const CouponManager = (await import('../CouponManager')).default;
    renderWithProviders(<CouponManager />);

    // Wait for loading to finish, then open dialog
    const createBtn = await screen.findByRole('button', { name: /create coupon/i });
    await user.click(createBtn);

    // Submit without filling fields
    const submitBtn = screen.getAllByRole('button', { name: /create coupon/i }).pop()!;
    await user.click(submitBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Please fill in required fields (Code and Value)'
      );
    });

    expect(mockExecute).not.toHaveBeenCalled();
  });
});

// ============================================================================
// Credit Cost Configuration Tests
// ============================================================================

describe('Marketplace Coupon Credit Cost Configuration', () => {
  it('marketplace_coupon_created should cost 25 credits', async () => {
    const { getCreditCost } = await import('@/lib/credits/creditCosts');
    expect(getCreditCost('marketplace_coupon_created')).toBe(25);
  });

  it('marketplace_coupon_created should be categorized under marketplace', async () => {
    const { getCreditCostInfo } = await import('@/lib/credits/creditCosts');
    const info = getCreditCostInfo('marketplace_coupon_created');
    expect(info).not.toBeNull();
    expect(info?.category).toBe('marketplace');
    expect(info?.actionName).toBe('Create Marketplace Coupon');
    expect(info?.credits).toBe(25);
  });
});
