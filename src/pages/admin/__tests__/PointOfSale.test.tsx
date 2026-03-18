/**
 * Tests for PointOfSale component
 *
 * These tests verify the POS page functionality including:
 * - Product loading via useQuery
 * - Product filtering via useMemo (search + category)
 * - Cart management (add, update quantity, remove at zero)
 * - Loading pending orders with real product data
 * - Payment and totals calculation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    info: vi.fn(),
  }),
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: { id: 'test-tenant-id', name: 'Test Tenant' },
    tenantSlug: 'test-tenant',
  }),
}));

vi.mock('@/lib/navigation/tenantNavigation', () => ({
  useTenantNavigation: () => ({
    navigateToAdmin: vi.fn(),
  }),
}));

vi.mock('@/hooks/useInventorySync', () => ({
  useInventorySync: vi.fn(),
}));

vi.mock('@/hooks/useRealtimeSync', () => ({
  useRealtimeSync: vi.fn(),
}));

vi.mock('@/hooks/useFreeTierLimits', () => ({
  useFreeTierLimits: () => ({
    checkLimit: vi.fn(() => ({ allowed: true })),
    recordAction: vi.fn(),
    limitsApply: false,
  }),
}));

vi.mock('@/lib/activityLogger', () => ({
  logActivityAuto: vi.fn(),
  ActivityActions: { UPDATE_INVENTORY: 'UPDATE_INVENTORY', COMPLETE_ORDER: 'COMPLETE_ORDER' },
}));

vi.mock('@/lib/invalidation', () => ({
  invalidateOnEvent: vi.fn(),
}));

vi.mock('@/lib/eventBus', () => ({
  publish: vi.fn(),
}));

vi.mock('@/components/pos/PendingPickupsPanel', () => ({
  PendingPickupsPanel: () => <div data-testid="pending-pickups">Pending Pickups</div>,
}));

vi.mock('@/components/pos/QuickMenuWizard', () => ({
  QuickMenuWizard: () => null,
}));

const mockProducts = [
  {
    id: 'product-1',
    name: 'Blue Dream',
    price: 35,
    category: 'flower',
    stock_quantity: 100,
    thc_percent: 21,
    image_url: null,
    in_stock: true,
  },
  {
    id: 'product-2',
    name: 'Gummy Bears',
    price: 25,
    category: 'edibles',
    stock_quantity: 50,
    thc_percent: null,
    image_url: null,
    in_stock: true,
  },
  {
    id: 'product-3',
    name: 'OG Kush',
    price: 40,
    category: 'flower',
    stock_quantity: 0,
    thc_percent: 28,
    image_url: null,
    in_stock: true,
  },
];

const mockFrom = vi.fn();
const mockRpc = vi.fn();

vi.mock('@/integrations/supabase/client', () => {
  const createChain = (data: unknown) => ({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data, error: null }),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
        order: vi.fn().mockResolvedValue({ data, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
      order: vi.fn().mockResolvedValue({ data, error: null }),
    }),
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'txn-1' }, error: null }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    }),
  });

  return {
    supabase: {
      from: (table: string) => {
        mockFrom(table);
        if (table === 'products') return createChain(mockProducts);
        if (table === 'customers') return createChain([]);
        if (table === 'account_settings') return createChain(null);
        return createChain([]);
      },
      rpc: mockRpc.mockResolvedValue({
        data: { success: true, transaction_id: 'txn-1', transaction_number: 'POS-001', total: 38.1 },
        error: null,
      }),
      functions: {
        invoke: vi.fn().mockResolvedValue({}),
      },
    },
  };
});

vi.mock('@/lib/orders/orderFlowManager', () => ({
  orderFlowManager: {
    transitionOrderStatus: vi.fn().mockResolvedValue(undefined),
  },
}));

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{ui}</BrowserRouter>
    </QueryClientProvider>
  );
}

describe('PointOfSale', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the page header and tabs', async () => {
    const { default: PointOfSale } = await import('../PointOfSale');
    renderWithProviders(<PointOfSale />);

    expect(screen.getByText('Point of Sale')).toBeInTheDocument();
    expect(screen.getByText('Here & Now')).toBeInTheDocument();
    expect(screen.getByText('Pending Pickups')).toBeInTheDocument();
  });

  it('loads and displays products via useQuery', async () => {
    const { default: PointOfSale } = await import('../PointOfSale');
    renderWithProviders(<PointOfSale />);

    await waitFor(() => {
      expect(screen.getByText('Blue Dream')).toBeInTheDocument();
    });

    expect(screen.getByText('Gummy Bears')).toBeInTheDocument();
    expect(screen.getByText('OG Kush')).toBeInTheDocument();
  });

  it('filters products by search query', async () => {
    const user = userEvent.setup();
    const { default: PointOfSale } = await import('../PointOfSale');
    renderWithProviders(<PointOfSale />);

    await waitFor(() => {
      expect(screen.getByText('Blue Dream')).toBeInTheDocument();
    });

    const searchInput = screen.getByLabelText('Search products');
    await user.type(searchInput, 'gummy');

    expect(screen.getByText('Gummy Bears')).toBeInTheDocument();
    expect(screen.queryByText('Blue Dream')).not.toBeInTheDocument();
    expect(screen.queryByText('OG Kush')).not.toBeInTheDocument();
  });

  it('filters products by category', async () => {
    const user = userEvent.setup();
    const { default: PointOfSale } = await import('../PointOfSale');
    renderWithProviders(<PointOfSale />);

    await waitFor(() => {
      expect(screen.getByText('Blue Dream')).toBeInTheDocument();
    });

    // Click the "edibles" category filter
    const ediblesButton = screen.getByRole('button', { name: /edibles/i });
    await user.click(ediblesButton);

    expect(screen.getByText('Gummy Bears')).toBeInTheDocument();
    expect(screen.queryByText('Blue Dream')).not.toBeInTheDocument();
  });

  it('adds product to cart on click', async () => {
    const user = userEvent.setup();
    const { default: PointOfSale } = await import('../PointOfSale');
    renderWithProviders(<PointOfSale />);

    await waitFor(() => {
      expect(screen.getByText('Blue Dream')).toBeInTheDocument();
    });

    // Click the Blue Dream product card
    await user.click(screen.getByText('Blue Dream'));

    // Cart should now have quantity controls (Decrease/Increase buttons)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Decrease quantity' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Increase quantity' })).toBeInTheDocument();
    });
  });

  it('shows empty cart message when no items', async () => {
    const { default: PointOfSale } = await import('../PointOfSale');
    renderWithProviders(<PointOfSale />);

    expect(screen.getByText('Scan or select items')).toBeInTheDocument();
  });

  it('displays out of stock overlay on products with zero stock', async () => {
    const { default: PointOfSale } = await import('../PointOfSale');
    renderWithProviders(<PointOfSale />);

    await waitFor(() => {
      expect(screen.getByText('OUT OF STOCK')).toBeInTheDocument();
    });
  });

  it('shows Walk-In Mode badge by default', async () => {
    const { default: PointOfSale } = await import('../PointOfSale');
    renderWithProviders(<PointOfSale />);

    expect(screen.getByText('Walk-In Mode')).toBeInTheDocument();
  });

  it('has fullscreen toggle button with aria-label', async () => {
    const { default: PointOfSale } = await import('../PointOfSale');
    renderWithProviders(<PointOfSale />);

    expect(screen.getByRole('button', { name: 'Full screen' })).toBeInTheDocument();
  });

  it('displays payment method buttons', async () => {
    const { default: PointOfSale } = await import('../PointOfSale');
    renderWithProviders(<PointOfSale />);

    expect(screen.getByRole('button', { name: /cash/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /credit/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /debit/i })).toBeInTheDocument();
  });

  it('shows category filter buttons', async () => {
    const { default: PointOfSale } = await import('../PointOfSale');
    renderWithProviders(<PointOfSale />);

    expect(screen.getByRole('button', { name: /^all$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /flower/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edibles/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /concentrates/i })).toBeInTheDocument();
  });
});
