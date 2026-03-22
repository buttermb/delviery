/**
 * ProductVisibilityManager Credit Gating Tests
 *
 * Verifies that the marketplace bulk update action is properly gated by credits:
 * 1. marketplace_bulk_update action key is used with the correct cost (100 credits)
 * 2. useCreditGatedAction hook is integrated
 * 3. Credit check blocks action when insufficient credits
 * 4. Credit check allows action when sufficient credits
 * 5. OutOfCreditsModal is shown when blocked
 * 6. Bulk selection and visibility toggle work correctly
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { type ReactNode } from 'react';

// ============================================================================
// Mocks
// ============================================================================

const mockExecute = vi.fn();
const mockNavigateTenant = vi.fn();

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
  useCredits: () => ({
    balance: 1000,
    isFreeTier: true,
    isLoading: false,
    lifetimeSpent: 500,
    canPerformAction: vi.fn().mockResolvedValue(true),
    performAction: vi.fn(),
  }),
}));

vi.mock('@/hooks/useTenantNavigate', () => ({
  useTenantNavigate: () => mockNavigateTenant,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/humanizeError', () => ({
  humanizeError: (e: unknown, fallback?: string) => fallback ?? 'An error occurred',
}));

vi.mock('@/components/EnhancedLoadingState', () => ({
  EnhancedLoadingState: () => <div data-testid="loading-state">Loading...</div>,
}));

// Mock Supabase
const mockUpdate = vi.fn().mockReturnValue({
  in: vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
  }),
});

const mockSelect = vi.fn().mockReturnValue({
  eq: vi.fn().mockReturnValue({
    order: vi.fn().mockResolvedValue({
      data: [
        {
          id: 'listing-1',
          tenant_id: 'test-tenant-id',
          product_name: 'Blue Dream',
          product_type: 'flower',
          strain_type: 'hybrid',
          base_price: 25.00,
          unit_type: 'gram',
          quantity_available: 100,
          images: [],
          status: 'active',
          visibility: 'public',
          created_at: '2024-01-01',
        },
        {
          id: 'listing-2',
          tenant_id: 'test-tenant-id',
          product_name: 'OG Kush',
          product_type: 'flower',
          strain_type: 'indica',
          base_price: 30.00,
          unit_type: 'gram',
          quantity_available: 50,
          images: [],
          status: 'draft',
          visibility: 'hidden',
          created_at: '2024-01-02',
        },
        {
          id: 'listing-3',
          tenant_id: 'test-tenant-id',
          product_name: 'Sour Diesel',
          product_type: 'flower',
          strain_type: 'sativa',
          base_price: 28.00,
          unit_type: 'gram',
          quantity_available: 75,
          images: [],
          status: 'active',
          visibility: 'public',
          created_at: '2024-01-03',
        },
      ],
      error: null,
    }),
  }),
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === 'marketplace_listings') {
        return {
          select: mockSelect,
          update: mockUpdate,
        };
      }
      return { select: vi.fn(), update: vi.fn() };
    }),
  },
}));

// Mock OutOfCreditsModal
vi.mock('@/components/credits/OutOfCreditsModal', () => ({
  OutOfCreditsModal: ({ open, actionAttempted }: { open: boolean; actionAttempted?: string }) => (
    open ? (
      <div data-testid="out-of-credits-modal" data-action={actionAttempted}>
        Out of credits
      </div>
    ) : null
  ),
}));

// Mock CreditCostBadge
vi.mock('@/components/credits/CreditCostBadge', () => ({
  CreditCostBadge: ({ actionKey }: { actionKey?: string }) => (
    <span data-testid={`credit-badge-${actionKey}`}>100 cr</span>
  ),
}));

// Mock queryKeys
vi.mock('@/lib/queryKeys', () => ({
  queryKeys: {
    marketplaceListings: {
      byTenant: (id: string | undefined) => ['marketplace-listings', 'by-tenant', id],
      all: ['marketplace-listings'],
    },
    credits: {
      all: ['credits'],
      balance: (id: string | undefined) => ['credits', 'balance', id],
    },
  },
}));

// Mock PLAN_CONFIG for OutOfCreditsModal
vi.mock('@/config/planPricing', () => ({
  PLAN_CONFIG: {
    starter: { priceMonthly: 49 },
  },
}));

vi.mock('@/lib/credits', () => ({
  getCreditCost: vi.fn((key: string) => key === 'marketplace_bulk_update' ? 100 : 0),
  getCreditCostInfo: vi.fn((key: string) => key === 'marketplace_bulk_update' ? {
    actionKey: 'marketplace_bulk_update',
    actionName: 'Bulk Product Update',
    credits: 100,
    category: 'marketplace',
    description: 'Bulk update product visibility/pricing for marketplace',
  } : null),
  calculateCreditVsSubscription: vi.fn(() => ({ savings: 100, creditPackCost: 200 })),
  CREDIT_PACKAGES: [{ id: 'starter-pack', credits: 5000, priceCents: 999 }],
}));

// ============================================================================
// Test Setup
// ============================================================================

import ProductVisibilityManager from '../ProductVisibilityManager';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>{children}</BrowserRouter>
      </QueryClientProvider>
    );
  };
}

function renderComponent() {
  return render(<ProductVisibilityManager />, { wrapper: createWrapper() });
}

// ============================================================================
// Tests
// ============================================================================

describe('ProductVisibilityManager Credit Gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecute.mockResolvedValue(null);
  });

  it('renders product listings with checkboxes', async () => {
    renderComponent();

    // Wait for listings to render
    expect(await screen.findByText('Blue Dream')).toBeInTheDocument();
    expect(screen.getByText('OG Kush')).toBeInTheDocument();
    expect(screen.getByText('Sour Diesel')).toBeInTheDocument();

    // Checkboxes should be present (select all + 3 rows)
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBe(4); // 1 header + 3 rows
  });

  it('shows bulk action bar when items are selected', async () => {
    const user = userEvent.setup();
    renderComponent();

    // Wait for listings to render
    expect(await screen.findByText('Blue Dream')).toBeInTheDocument();

    // Select first item
    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[1]); // First row checkbox (index 0 is header)

    // Bulk action bar should appear
    expect(screen.getByText('1 selected')).toBeInTheDocument();
    expect(screen.getByText('Set Public')).toBeInTheDocument();
    expect(screen.getByText('Set Hidden')).toBeInTheDocument();
    expect(screen.getByText('Clear')).toBeInTheDocument();
  });

  it('shows CreditCostBadge on bulk action buttons', async () => {
    const user = userEvent.setup();
    renderComponent();

    expect(await screen.findByText('Blue Dream')).toBeInTheDocument();

    // Select an item to show bulk actions
    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[1]);

    // Credit badges should be visible
    const badges = screen.getAllByTestId('credit-badge-marketplace_bulk_update');
    expect(badges.length).toBe(2); // One on each bulk button
  });

  it('calls executeCreditAction with marketplace_bulk_update when bulk setting public', async () => {
    const user = userEvent.setup();
    renderComponent();

    expect(await screen.findByText('Blue Dream')).toBeInTheDocument();

    // Select two items
    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[1]); // Blue Dream
    await user.click(checkboxes[2]); // OG Kush

    expect(screen.getByText('2 selected')).toBeInTheDocument();

    // Click "Set Public"
    await user.click(screen.getByText('Set Public'));

    // Should have called executeCreditAction with the correct action key
    expect(mockExecute).toHaveBeenCalledTimes(1);
    expect(mockExecute).toHaveBeenCalledWith(
      'marketplace_bulk_update',
      expect.any(Function),
      expect.objectContaining({
        onInsufficientCredits: expect.any(Function),
      })
    );
  });

  it('calls executeCreditAction with marketplace_bulk_update when bulk setting hidden', async () => {
    const user = userEvent.setup();
    renderComponent();

    expect(await screen.findByText('Blue Dream')).toBeInTheDocument();

    // Select an item
    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[1]);

    // Click "Set Hidden"
    await user.click(screen.getByText('Set Hidden'));

    expect(mockExecute).toHaveBeenCalledTimes(1);
    expect(mockExecute).toHaveBeenCalledWith(
      'marketplace_bulk_update',
      expect.any(Function),
      expect.objectContaining({
        onInsufficientCredits: expect.any(Function),
      })
    );
  });

  it('shows OutOfCreditsModal when credits are insufficient', async () => {
    // Make execute trigger the onInsufficientCredits callback
    mockExecute.mockImplementation(async (_actionKey: string, _action: () => Promise<unknown>, options?: { onInsufficientCredits?: () => void }) => {
      options?.onInsufficientCredits?.();
      return null;
    });

    const user = userEvent.setup();
    renderComponent();

    expect(await screen.findByText('Blue Dream')).toBeInTheDocument();

    // Select an item
    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[1]);

    // Click bulk action
    await user.click(screen.getByText('Set Public'));

    // OutOfCreditsModal should be shown
    expect(screen.getByTestId('out-of-credits-modal')).toBeInTheDocument();
    expect(screen.getByTestId('out-of-credits-modal')).toHaveAttribute(
      'data-action',
      'marketplace_bulk_update'
    );
  });

  it('selects all items when header checkbox is clicked', async () => {
    const user = userEvent.setup();
    renderComponent();

    expect(await screen.findByText('Blue Dream')).toBeInTheDocument();

    // Click "Select all" checkbox
    const selectAll = screen.getByLabelText('Select all');
    await user.click(selectAll);

    // All items should be selected
    expect(screen.getByText('3 selected')).toBeInTheDocument();
  });

  it('clears selection when Clear button is clicked', async () => {
    const user = userEvent.setup();
    renderComponent();

    expect(await screen.findByText('Blue Dream')).toBeInTheDocument();

    // Select all
    const selectAll = screen.getByLabelText('Select all');
    await user.click(selectAll);

    expect(screen.getByText('3 selected')).toBeInTheDocument();

    // Clear selection
    await user.click(screen.getByText('Clear'));

    // Bulk bar should be gone
    expect(screen.queryByText('3 selected')).not.toBeInTheDocument();
    expect(screen.queryByText('Set Public')).not.toBeInTheDocument();
  });

  it('does not show bulk action bar when no items selected', async () => {
    renderComponent();

    expect(await screen.findByText('Blue Dream')).toBeInTheDocument();

    // No bulk action bar should be visible
    expect(screen.queryByText('Set Public')).not.toBeInTheDocument();
    expect(screen.queryByText('Set Hidden')).not.toBeInTheDocument();
  });
});

describe('Credit Cost Configuration', () => {
  it('marketplace_bulk_update action key is defined with 100 credits', async () => {
    const { CREDIT_COSTS } = await import('@/lib/credits/creditCosts');
    const cost = CREDIT_COSTS.marketplace_bulk_update;

    expect(cost).toBeDefined();
    expect(cost.actionKey).toBe('marketplace_bulk_update');
    expect(cost.credits).toBe(100);
    expect(cost.category).toBe('marketplace');
  });
});
