/**
 * NewWholesaleOrder Credit Gating Tests
 *
 * Verifies that wholesale order placement is properly gated by credits:
 * 1. wholesale_order_place action key is used with the correct cost (100 credits)
 * 2. useCreditGatedAction hook is integrated in NewWholesaleOrder
 * 3. CreditCostBadge is shown on the submit button for free-tier users
 * 4. CreditCostBadge is hidden for non-free-tier users
 * 5. Credit check blocks action when insufficient credits
 * 6. Credit check allows action when sufficient credits
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { type ReactNode } from 'react';

// ============================================================================
// Mocks
// ============================================================================

const mockExecute = vi.fn();
const mockNavigateToAdmin = vi.fn();
let mockIsFreeTier = true;

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
}));

vi.mock('@/utils/toastHelpers', () => ({
  showSuccessToast: vi.fn(),
  showErrorToast: vi.fn(),
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
    accessToken: 'test-token',
  }),
}));

vi.mock('@/hooks/useCredits', () => ({
  useCreditGatedAction: () => ({
    execute: mockExecute,
    isPerforming: false,
    isFreeTier: mockIsFreeTier,
  }),
  useCredits: () => ({
    balance: 5000,
    isFreeTier: mockIsFreeTier,
    isLoading: false,
    canPerformAction: vi.fn().mockResolvedValue(true),
    performAction: vi.fn().mockResolvedValue({ success: true }),
  }),
}));

vi.mock('@/hooks/useWholesaleData', () => ({
  useWholesaleCouriers: () => ({
    data: [
      { id: 'courier-1', full_name: 'John Runner', phone: '555-1234', vehicle_type: 'Car', is_online: true, is_active: true },
    ],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useProductsForWholesale: () => ({
    data: [
      {
        id: 'product-1',
        product_name: 'Test Product',
        base_price: 100,
        retail_price: 120,
        cost_per_unit: 60,
        quantity_available: 50,
        category: 'flower',
        image_url: null,
        source: 'products' as const,
        strain_type: 'Indica',
      },
    ],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/lib/navigation/tenantNavigation', () => ({
  useTenantNavigation: () => ({
    navigateToAdmin: mockNavigateToAdmin,
    navigate: vi.fn(),
  }),
}));

vi.mock('@/components/wholesale/SmartClientPicker', () => ({
  SmartClientPicker: ({ onSelect }: { onSelect: (client: Record<string, unknown>) => void }) => (
    <button
      data-testid="smart-client-picker"
      onClick={() =>
        onSelect({
          id: 'client-1',
          business_name: 'Test Business',
          contact_name: 'Jane Doe',
          credit_limit: 10000,
          outstanding_balance: 500,
          status: 'active',
          address: '123 Main St',
          phone: '555-5678',
          email: 'jane@test.com',
        })
      }
    >
      Select Client
    </button>
  ),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
    }),
    functions: {
      invoke: vi.fn().mockResolvedValue({
        data: { order_number: 'WO-001' },
        error: null,
      }),
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

vi.mock('@/components/credits', () => ({
  CreditCostBadge: ({ actionKey, className }: { actionKey: string; className?: string; showTooltip?: boolean }) => (
    <span data-testid="credit-cost-badge" data-action-key={actionKey} className={className}>
      100 credits
    </span>
  ),
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

async function navigateToReviewStep(user: ReturnType<typeof userEvent.setup>) {
  // Step 1: Select client
  const selectClientBtn = screen.getByTestId('smart-client-picker');
  await user.click(selectClientBtn);

  // Wait for auto-advance, then click Next to products
  await waitFor(() => {
    expect(screen.getByText(/Select Products/i)).toBeInTheDocument();
  });

  // Step 2: Add a product
  const productCard = screen.getByText('Test Product');
  await user.click(productCard);

  // Click Next to payment
  const nextBtn = screen.getByRole('button', { name: /next/i });
  await user.click(nextBtn);

  // Step 3: Payment - just click Next
  await waitFor(() => {
    expect(screen.getByText(/Payment Terms/i)).toBeInTheDocument();
  });
  const paymentNextBtn = screen.getByRole('button', { name: /next/i });
  await user.click(paymentNextBtn);

  // Step 4: Delivery - just click Next
  await waitFor(() => {
    expect(screen.getByText(/Delivery Details/i)).toBeInTheDocument();
  });
  const deliveryNextBtn = screen.getByRole('button', { name: /next/i });
  await user.click(deliveryNextBtn);

  // Step 5: Review
  await waitFor(() => {
    expect(screen.getByText(/Review Order/i)).toBeInTheDocument();
  });
}

// ============================================================================
// Tests
// ============================================================================

describe('NewWholesaleOrder Credit Gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsFreeTier = true;
    mockExecute.mockImplementation(
      async (_actionKey: string, action: () => Promise<unknown>) => {
        return action();
      }
    );
  });

  it('should render the new wholesale order form', async () => {
    const NewWholesaleOrder = (await import('../NewWholesaleOrder')).default;
    renderWithProviders(<NewWholesaleOrder />);

    expect(screen.getByText('New Wholesale Order')).toBeInTheDocument();
  });

  it('should show CreditCostBadge on Create Order button for free-tier users', async () => {
    const user = userEvent.setup();
    const NewWholesaleOrder = (await import('../NewWholesaleOrder')).default;
    renderWithProviders(<NewWholesaleOrder />);

    await navigateToReviewStep(user);

    // The CreditCostBadge should be visible on the review step
    const badge = screen.getByTestId('credit-cost-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute('data-action-key', 'wholesale_order_place');
  });

  it('should hide CreditCostBadge for non-free-tier users', async () => {
    mockIsFreeTier = false;
    const user = userEvent.setup();
    const NewWholesaleOrder = (await import('../NewWholesaleOrder')).default;
    renderWithProviders(<NewWholesaleOrder />);

    await navigateToReviewStep(user);

    // The CreditCostBadge should NOT be visible
    expect(screen.queryByTestId('credit-cost-badge')).not.toBeInTheDocument();
  });

  it('should call executeCreditAction with wholesale_order_place on submit', async () => {
    const user = userEvent.setup();
    const NewWholesaleOrder = (await import('../NewWholesaleOrder')).default;
    renderWithProviders(<NewWholesaleOrder />);

    await navigateToReviewStep(user);

    // Click Create Order
    const createBtn = screen.getByRole('button', { name: /create order/i });
    await user.click(createBtn);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith(
        'wholesale_order_place',
        expect.any(Function),
        expect.objectContaining({ referenceId: expect.any(String) })
      );
    });
  });

  it('should not create order when credit gate blocks the action', async () => {
    const { supabase } = await import('@/integrations/supabase/client');
    mockExecute.mockResolvedValue(null);

    const user = userEvent.setup();
    const NewWholesaleOrder = (await import('../NewWholesaleOrder')).default;
    renderWithProviders(<NewWholesaleOrder />);

    await navigateToReviewStep(user);

    // Click Create Order
    const createBtn = screen.getByRole('button', { name: /create order/i });
    await user.click(createBtn);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledWith(
        'wholesale_order_place',
        expect.any(Function),
        expect.any(Object)
      );
    });

    // The edge function should NOT have been called
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
  });
});

// ============================================================================
// Credit Cost Configuration Tests for wholesale_order_place
// ============================================================================

describe('Wholesale Order Credit Cost Configuration', () => {
  it('wholesale_order_place should cost 100 credits', async () => {
    const { getCreditCost } = await import('@/lib/credits/creditCosts');
    expect(getCreditCost('wholesale_order_place')).toBe(100);
  });

  it('wholesale_order_place should not be a free action', async () => {
    const { isActionFree } = await import('@/lib/credits/creditCosts');
    expect(isActionFree('wholesale_order_place')).toBe(false);
  });

  it('wholesale_order_place should be categorized under wholesale', async () => {
    const { getCreditCostInfo } = await import('@/lib/credits/creditCosts');
    const info = getCreditCostInfo('wholesale_order_place');
    expect(info).not.toBeNull();
    expect(info?.category).toBe('wholesale');
    expect(info?.actionName).toBe('Place Wholesale Order');
    expect(info?.credits).toBe(100);
  });
});
