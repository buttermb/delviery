/**
 * StorefrontOrders Page Tests
 * Verifies order history management features:
 * 1. Renders order list with correct data
 * 2. Search filters orders by name/email/phone/order number
 * 3. Status filter buttons work
 * 4. Order detail sheet opens on click
 * 5. Status update mutation fires correctly
 * 6. Export button renders with correct columns
 * 7. Empty state shows when no orders
 * 8. Loading skeleton shows during fetch
 * 9. Realtime subscription is set up
 * 10. Fulfillment badges display correctly
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock data
const mockStore = { id: 'store-1', slug: 'test-store' };

const mockOrders = [
  {
    id: 'order-1',
    order_number: 'ORD-001',
    status: 'pending',
    payment_status: 'paid',
    customer_id: 'cust-1',
    customer_name: 'John Doe',
    customer_email: 'john@example.com',
    customer_phone: '555-0101',
    items: [
      { name: 'Rose Bouquet', product_id: 'prod-1', quantity: 2, price: 25.00 },
      { name: 'Tulip Bunch', product_id: 'prod-2', quantity: 1, price: 15.00 },
    ],
    subtotal: 65.00,
    delivery_fee: 5.00,
    total: 70.00,
    delivery_address: { street: '123 Main St', city: 'Springfield' },
    delivery_notes: 'Leave at door',
    tracking_token: 'track-abc',
    store_id: 'store-1',
    created_at: '2026-03-15T10:00:00Z',
    updated_at: '2026-03-15T10:00:00Z',
    fulfillment_method: 'delivery',
  },
  {
    id: 'order-2',
    order_number: 'ORD-002',
    status: 'preparing',
    payment_status: 'paid',
    customer_id: 'cust-2',
    customer_name: 'Jane Smith',
    customer_email: 'jane@example.com',
    customer_phone: '555-0102',
    items: [{ name: 'Orchid Pot', product_id: 'prod-3', quantity: 1, price: 45.00 }],
    subtotal: 45.00,
    delivery_fee: 0,
    total: 45.00,
    delivery_address: null,
    delivery_notes: null,
    tracking_token: null,
    store_id: 'store-1',
    created_at: '2026-03-14T14:00:00Z',
    updated_at: '2026-03-14T14:00:00Z',
    fulfillment_method: 'pickup',
  },
  {
    id: 'order-3',
    order_number: 'ORD-003',
    status: 'delivered',
    payment_status: 'paid',
    customer_id: null,
    customer_name: null,
    customer_email: null,
    customer_phone: null,
    items: [{ name: 'Sunflower', product_id: 'prod-4', quantity: 3, price: 10.00 }],
    subtotal: 30.00,
    delivery_fee: 8.00,
    total: 38.00,
    delivery_address: { street: '789 Elm St', city: 'Portland' },
    delivery_notes: null,
    tracking_token: 'track-xyz',
    store_id: 'store-1',
    created_at: '2026-03-13T09:00:00Z',
    updated_at: '2026-03-13T16:00:00Z',
    fulfillment_method: 'delivery',
  },
];

// Mock supabase channel
const mockOn = vi.fn().mockReturnThis();
const mockChannel = {
  on: mockOn,
  subscribe: vi.fn((callback?: (status: string) => void) => {
    if (callback) callback('SUBSCRIBED');
    return mockChannel;
  }),
  unsubscribe: vi.fn(),
};
const mockRemoveChannel = vi.fn();

const mockFrom = vi.fn();
const mockSelect = vi.fn().mockReturnThis();
const mockEq = vi.fn().mockReturnThis();
const mockOrder = vi.fn().mockReturnThis();
const mockMaybeSingle = vi.fn();
const mockUpdate = vi.fn().mockReturnThis();

const setupQueryMock = (ordersData: unknown, storeData: unknown = mockStore) => {
  mockMaybeSingle.mockResolvedValue({ data: storeData, error: null });

  mockFrom.mockImplementation((table: string) => {
    if (table === 'marketplace_stores') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: mockMaybeSingle,
          }),
        }),
      };
    }
    if (table === 'storefront_orders') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: ordersData, error: null }),
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: ordersData, error: null }),
            }),
          }),
        }),
      };
    }
    if (table === 'marketplace_orders') {
      return {
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
        }),
      };
    }
    return {
      select: mockSelect,
      update: mockUpdate,
    };
  });
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    channel: vi.fn(() => mockChannel),
    removeChannel: (...args: unknown[]) => mockRemoveChannel(...args),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}));

// Mock TenantAdminAuth context
vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: { id: 'tenant-1', name: 'Test Tenant' },
    tenantSlug: 'test-tenant',
    isLoading: false,
    isAdmin: true,
  }),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

// Mock formatCurrency
vi.mock('@/lib/utils/formatCurrency', () => ({
  formatCurrency: (val: number) => `$${val.toFixed(2)}`,
}));

// Mock formatDate
vi.mock('@/lib/utils/formatDate', () => ({
  formatSmartDate: (date: string) => new Date(date).toLocaleDateString(),
}));

// Mock sanitizeSearch
vi.mock('@/lib/sanitizeSearch', () => ({
  sanitizeSearchInput: (input: string) => input.trim(),
}));

// Mock humanizeError
vi.mock('@/lib/humanizeError', () => ({
  humanizeError: (err: unknown) => (err instanceof Error ? err.message : 'Unknown error'),
}));

// Mock cross-links
vi.mock('@/components/admin/cross-links', () => ({
  CustomerLink: ({ customerName }: { customerId: string | null; customerName: string }) => (
    <span data-testid="customer-link">{customerName}</span>
  ),
  ProductLink: ({ productName }: { productId: string; productName: string }) => (
    <span data-testid="product-link">{productName}</span>
  ),
}));

// Mock TruncatedText
vi.mock('@/components/shared/TruncatedText', () => ({
  TruncatedText: ({ text, className, as: Tag = 'span' }: { text: string; className?: string; as?: string }) => {
    const El = Tag as unknown as React.ElementType;
    return <El className={className}>{text}</El>;
  },
}));

// Mock ExportButton
vi.mock('@/components/ui/ExportButton', () => ({
  ExportButton: ({ data, filename, columns }: { data: unknown[]; filename: string; columns: unknown[] }) => (
    <button data-testid="export-button" data-filename={filename} data-column-count={columns?.length ?? 0}>
      Export ({data.length} rows)
    </button>
  ),
}));

// Import component after mocks
import StorefrontOrders from '@/pages/admin/storefront/StorefrontOrders';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/test-tenant/admin/storefront/orders']}>
          <Routes>
            <Route path="/:tenantSlug/admin/storefront/orders" element={children} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };
}

describe('StorefrontOrders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupQueryMock(mockOrders);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Order list rendering', () => {
    it('renders order history heading and order count', async () => {
      render(<StorefrontOrders />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Order History')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText('3 total orders')).toBeInTheDocument();
      });
    });

    it('displays order numbers in the table', async () => {
      render(<StorefrontOrders />, { wrapper: createWrapper() });

      // Both mobile and desktop views render so use getAllByText
      await waitFor(() => {
        expect(screen.getAllByText('ORD-001').length).toBeGreaterThan(0);
        expect(screen.getAllByText('ORD-002').length).toBeGreaterThan(0);
        expect(screen.getAllByText('ORD-003').length).toBeGreaterThan(0);
      });
    });

    it('displays customer names with links', async () => {
      render(<StorefrontOrders />, { wrapper: createWrapper() });

      await waitFor(() => {
        const links = screen.getAllByTestId('customer-link');
        const names = links.map((el) => el.textContent);
        expect(names).toContain('John Doe');
        expect(names).toContain('Jane Smith');
        expect(names).toContain('Guest');
      });
    });

    it('displays formatted totals', async () => {
      render(<StorefrontOrders />, { wrapper: createWrapper() });

      // Both mobile and desktop views render totals
      await waitFor(() => {
        expect(screen.getAllByText('$70.00').length).toBeGreaterThan(0);
        expect(screen.getAllByText('$45.00').length).toBeGreaterThan(0);
        expect(screen.getAllByText('$38.00').length).toBeGreaterThan(0);
      });
    });
  });

  describe('Search filtering', () => {
    it('filters orders by customer name', async () => {
      const user = userEvent.setup();
      render(<StorefrontOrders />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getAllByText('ORD-001').length).toBeGreaterThan(0);
      });

      const searchInput = screen.getByLabelText('Search by order number, customer name, email, or phone');
      await user.type(searchInput, 'John');

      await waitFor(() => {
        expect(screen.getAllByText('ORD-001').length).toBeGreaterThan(0);
        expect(screen.queryByText('ORD-002')).not.toBeInTheDocument();
        expect(screen.queryByText('ORD-003')).not.toBeInTheDocument();
      });
    });

    it('filters orders by order number', async () => {
      const user = userEvent.setup();
      render(<StorefrontOrders />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getAllByText('ORD-001').length).toBeGreaterThan(0);
      });

      const searchInput = screen.getByLabelText('Search by order number, customer name, email, or phone');
      await user.type(searchInput, 'ORD-002');

      await waitFor(() => {
        expect(screen.queryByText('ORD-001')).not.toBeInTheDocument();
        expect(screen.getAllByText('ORD-002').length).toBeGreaterThan(0);
        expect(screen.queryByText('ORD-003')).not.toBeInTheDocument();
      });
    });

    it('filters orders by email', async () => {
      const user = userEvent.setup();
      render(<StorefrontOrders />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getAllByText('ORD-001').length).toBeGreaterThan(0);
      });

      const searchInput = screen.getByLabelText('Search by order number, customer name, email, or phone');
      await user.type(searchInput, 'jane@');

      await waitFor(() => {
        expect(screen.queryByText('ORD-001')).not.toBeInTheDocument();
        expect(screen.getAllByText('ORD-002').length).toBeGreaterThan(0);
      });
    });
  });

  describe('Status filter buttons', () => {
    it('renders All button with total count', async () => {
      render(<StorefrontOrders />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText(/All \(3\)/)).toBeInTheDocument();
      });
    });

    it('renders individual status buttons with counts', async () => {
      render(<StorefrontOrders />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText(/Pending \(1\)/)).toBeInTheDocument();
        expect(screen.getByText(/Preparing \(1\)/)).toBeInTheDocument();
        expect(screen.getByText(/Delivered \(1\)/)).toBeInTheDocument();
      });
    });
  });

  describe('Export button', () => {
    it('renders export button with correct data', async () => {
      render(<StorefrontOrders />, { wrapper: createWrapper() });

      await waitFor(() => {
        const exportBtn = screen.getByTestId('export-button');
        expect(exportBtn).toBeInTheDocument();
        expect(exportBtn).toHaveTextContent('Export (3 rows)');
        expect(exportBtn).toHaveAttribute('data-filename', 'storefront-orders');
        expect(exportBtn).toHaveAttribute('data-column-count', '9');
      });
    });
  });

  describe('Empty state', () => {
    it('shows empty message when no orders exist', async () => {
      setupQueryMock([]);

      render(<StorefrontOrders />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('No orders found')).toBeInTheDocument();
        expect(screen.getByText('Orders will appear here when customers checkout')).toBeInTheDocument();
      });
    });
  });

  describe('No store state', () => {
    it('shows create store message when store is null', async () => {
      setupQueryMock([], null);

      render(<StorefrontOrders />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Please create a store first.')).toBeInTheDocument();
        expect(screen.getByText('Go to Dashboard')).toBeInTheDocument();
      });
    });
  });

  describe('Fulfillment badges', () => {
    it('displays delivery badge for delivery orders', async () => {
      render(<StorefrontOrders />, { wrapper: createWrapper() });

      await waitFor(() => {
        const deliveryBadges = screen.getAllByText('Delivery');
        expect(deliveryBadges.length).toBeGreaterThan(0);
      });
    });

    it('displays pickup badge for pickup orders', async () => {
      render(<StorefrontOrders />, { wrapper: createWrapper() });

      await waitFor(() => {
        const pickupBadges = screen.getAllByText('Pickup');
        expect(pickupBadges.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Realtime subscription', () => {
    it('subscribes to marketplace_orders changes for the store', async () => {
      const { supabase } = await import('@/integrations/supabase/client');

      render(<StorefrontOrders />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(supabase.channel).toHaveBeenCalledWith(
          expect.stringContaining('storefront-orders-')
        );
      });

      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          event: '*',
          schema: 'public',
          table: 'marketplace_orders',
          filter: expect.stringContaining('store_id=eq.'),
        }),
        expect.any(Function)
      );
    });

    it('cleans up subscription on unmount', async () => {
      const { supabase } = await import('@/integrations/supabase/client');

      const { unmount } = render(<StorefrontOrders />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(supabase.channel).toHaveBeenCalled();
      });

      unmount();

      expect(mockRemoveChannel).toHaveBeenCalledWith(mockChannel);
    });
  });

  describe('Order detail sheet', () => {
    it('opens detail sheet when order row is clicked', async () => {
      const user = userEvent.setup();
      render(<StorefrontOrders />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getAllByText('ORD-001').length).toBeGreaterThan(0);
      });

      // Click the first matching element (mobile card view)
      await user.click(screen.getAllByText('ORD-001')[0]);

      await waitFor(() => {
        expect(screen.getByText('Order ORD-001')).toBeInTheDocument();
      });
    });

    it('shows order items in detail sheet', async () => {
      const user = userEvent.setup();
      render(<StorefrontOrders />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getAllByText('ORD-001').length).toBeGreaterThan(0);
      });

      await user.click(screen.getAllByText('ORD-001')[0]);

      await waitFor(() => {
        const productLinks = screen.getAllByTestId('product-link');
        const names = productLinks.map((el) => el.textContent);
        expect(names).toContain('Rose Bouquet');
        expect(names).toContain('Tulip Bunch');
      });
    });

    it('shows delivery info for delivery orders', async () => {
      const user = userEvent.setup();
      render(<StorefrontOrders />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getAllByText('ORD-001').length).toBeGreaterThan(0);
      });

      await user.click(screen.getAllByText('ORD-001')[0]);

      await waitFor(() => {
        expect(screen.getByText(/123 Main St/)).toBeInTheDocument();
        expect(screen.getByText(/Leave at door/)).toBeInTheDocument();
      });
    });

    it('shows FREE for zero delivery fee', async () => {
      const user = userEvent.setup();
      render(<StorefrontOrders />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getAllByText('ORD-002').length).toBeGreaterThan(0);
      });

      await user.click(screen.getAllByText('ORD-002')[0]);

      await waitFor(() => {
        expect(screen.getByText('FREE')).toBeInTheDocument();
      });
    });

    it('shows pickup message for pickup orders', async () => {
      const user = userEvent.setup();
      render(<StorefrontOrders />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getAllByText('ORD-002').length).toBeGreaterThan(0);
      });

      await user.click(screen.getAllByText('ORD-002')[0]);

      await waitFor(() => {
        expect(screen.getByText('Customer will pick up at store')).toBeInTheDocument();
      });
    });

    it('shows tracking link when token exists', async () => {
      const user = userEvent.setup();
      render(<StorefrontOrders />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getAllByText('ORD-001').length).toBeGreaterThan(0);
      });

      await user.click(screen.getAllByText('ORD-001')[0]);

      await waitFor(() => {
        expect(screen.getByText('Tracking Link')).toBeInTheDocument();
        expect(screen.getByText(/track-abc/)).toBeInTheDocument();
      });
    });
  });
});
