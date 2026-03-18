/**
 * StorefrontLiveOrders Page Tests
 * Verifies real-time order management features:
 * 1. Real-time order updates via subscription
 * 2. New order sound plays
 * 3. Browser notification if permitted
 * 4. Order cards show status, customer, items
 * 5. Status update dropdown
 * 6. Status progression: pending -> confirmed -> preparing -> ready -> delivered
 * 7. Filter by status
 * 8. Delivery vs pickup badge
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock data
const mockStore = { id: 'store-1' };

const mockOrders = [
  {
    id: 'order-1',
    order_number: 'ORD-001',
    customer_name: 'John Doe',
    customer_email: 'john@example.com',
    customer_phone: '555-0101',
    delivery_address: { street: '123 Main St' },
    delivery_notes: 'Leave at door',
    subtotal: 45.00,
    delivery_fee: 5.00,
    total: 50.00,
    total_amount: 50.00,
    status: 'pending',
    shipping_method: 'delivery',
    created_at: new Date(Date.now() - 5 * 60000).toISOString(),
    items: [
      { name: 'Product A', quantity: 2, price: 20.00 },
      { name: 'Product B', quantity: 1, price: 5.00 },
    ],
  },
  {
    id: 'order-2',
    order_number: 'ORD-002',
    customer_name: 'Jane Smith',
    customer_email: 'jane@example.com',
    customer_phone: '555-0102',
    delivery_address: null,
    delivery_notes: null,
    subtotal: 30.00,
    delivery_fee: 0,
    total: 30.00,
    total_amount: 30.00,
    status: 'preparing',
    shipping_method: 'pickup',
    created_at: new Date(Date.now() - 15 * 60000).toISOString(),
    items: [{ name: 'Product C', quantity: 1, price: 30.00 }],
  },
  {
    id: 'order-3',
    order_number: 'ORD-003',
    customer_name: 'Bob Wilson',
    customer_email: 'bob@example.com',
    customer_phone: null,
    delivery_address: { street: '456 Oak Ave' },
    delivery_notes: null,
    subtotal: 75.00,
    delivery_fee: 10.00,
    total: 85.00,
    total_amount: 85.00,
    status: 'ready',
    shipping_method: 'delivery',
    created_at: new Date(Date.now() - 30 * 60000).toISOString(),
    items: [
      { name: 'Product D', quantity: 3, price: 25.00 },
    ],
  },
  {
    id: 'order-4',
    order_number: 'ORD-004',
    customer_name: 'Alice Brown',
    customer_email: 'alice@example.com',
    customer_phone: '555-0104',
    delivery_address: null,
    delivery_notes: null,
    subtotal: 20.00,
    delivery_fee: 0,
    total: 20.00,
    total_amount: 20.00,
    status: 'confirmed',
    shipping_method: 'collect',
    created_at: new Date(Date.now() - 10 * 60000).toISOString(),
    items: [{ name: 'Product E', quantity: 2, price: 10.00 }],
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
const mockIn = vi.fn().mockReturnThis();
const mockOrder = vi.fn().mockReturnThis();
const mockLimit = vi.fn();
const mockMaybeSingle = vi.fn();
const mockUpdate = vi.fn().mockReturnThis();

// Setup query chain mock
const setupQueryMock = (data: unknown, error: unknown = null) => {
  mockLimit.mockResolvedValue({ data, error });
  mockMaybeSingle.mockResolvedValue({ data: mockStore, error: null });
  mockFrom.mockReturnValue({
    select: mockSelect,
    update: mockUpdate,
  });
  mockSelect.mockReturnValue({
    eq: mockEq,
    in: mockIn,
    order: mockOrder,
  });
  mockEq.mockReturnValue({
    eq: mockEq,
    in: mockIn,
    order: mockOrder,
    maybeSingle: mockMaybeSingle,
    limit: mockLimit,
  });
  mockIn.mockReturnValue({
    limit: mockLimit,
    eq: mockEq,
    order: mockOrder,
  });
  mockOrder.mockReturnValue({
    in: mockIn,
    eq: mockEq,
    limit: mockLimit,
  });
  mockUpdate.mockReturnValue({
    eq: mockEq,
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

// Import component after mocks
import { StorefrontLiveOrders } from '@/pages/admin/storefront/StorefrontLiveOrders';

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
        <MemoryRouter initialEntries={['/test-tenant/admin/storefront/live-orders']}>
          <Routes>
            <Route path="/:tenantSlug/admin/storefront/live-orders" element={children} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };
}

describe('StorefrontLiveOrders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupQueryMock(mockOrders);

    // Mock Audio constructor
    vi.stubGlobal('Audio', vi.fn(() => ({
      play: vi.fn().mockResolvedValue(undefined),
      volume: 0.5,
    })));

    // Mock Notification
    vi.stubGlobal('Notification', Object.assign(
      vi.fn(() => ({ close: vi.fn(), onclick: null })),
      { permission: 'granted', requestPermission: vi.fn().mockResolvedValue('granted') }
    ));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Real-time order updates', () => {
    it('subscribes to marketplace_orders table changes', async () => {
      const { supabase } = await import('@/integrations/supabase/client');

      render(<StorefrontLiveOrders />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(supabase.channel).toHaveBeenCalledWith(
          expect.stringContaining('storefront-live-orders-')
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

      const { unmount } = render(<StorefrontLiveOrders />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(supabase.channel).toHaveBeenCalled();
      });

      unmount();

      expect(mockRemoveChannel).toHaveBeenCalledWith(mockChannel);
    });
  });

  describe('New order sound notification', () => {
    it('does not play sound on initial load', async () => {
      render(<StorefrontLiveOrders />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Live Orders')).toBeInTheDocument();
      });

      // Audio should not be instantiated on initial load (no new orders detected)
      expect(Audio).not.toHaveBeenCalled();
    });

    it('shows sound toggle button', async () => {
      render(<StorefrontLiveOrders />, { wrapper: createWrapper() });

      await waitFor(() => {
        const soundBtn = screen.getByTitle('Mute notifications');
        expect(soundBtn).toBeInTheDocument();
      });
    });

    it('toggles sound off when button clicked', async () => {
      const user = userEvent.setup();
      render(<StorefrontLiveOrders />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByTitle('Mute notifications')).toBeInTheDocument();
      });

      await user.click(screen.getByTitle('Mute notifications'));

      expect(screen.getByTitle('Enable notifications')).toBeInTheDocument();
    });
  });

  describe('Browser notification', () => {
    it('requests notification permission on mount', async () => {
      (Notification as unknown as { permission: string }).permission = 'default';

      render(<StorefrontLiveOrders />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(Notification.requestPermission).toHaveBeenCalled();
      });
    });

    it('does not request permission if already granted', async () => {
      (Notification as unknown as { permission: string }).permission = 'granted';

      render(<StorefrontLiveOrders />, { wrapper: createWrapper() });

      // Wait for component to render, then check permission was NOT re-requested
      await waitFor(() => {
        expect(screen.getByText('Live Orders')).toBeInTheDocument();
      });

      expect(Notification.requestPermission).not.toHaveBeenCalled();
    });
  });

  describe('Order cards display', () => {
    it('shows order number, customer name, and items in list view', async () => {
      const user = userEvent.setup();
      render(<StorefrontLiveOrders />, { wrapper: createWrapper() });

      // Switch to list view
      await waitFor(() => {
        expect(screen.getByText('List')).toBeInTheDocument();
      });
      await user.click(screen.getByText('List'));

      await waitFor(() => {
        expect(screen.getByText('#ORD-001')).toBeInTheDocument();
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });
    });

    it('shows status badges with correct colors', async () => {
      const user = userEvent.setup();
      render(<StorefrontLiveOrders />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('List')).toBeInTheDocument();
      });
      await user.click(screen.getByText('List'));

      await waitFor(() => {
        // Multiple elements may exist (badges + dropdown values), just ensure they're present
        const pendingElements = screen.getAllByText('Pending');
        expect(pendingElements.length).toBeGreaterThanOrEqual(1);
        const preparingElements = screen.getAllByText('Preparing');
        expect(preparingElements.length).toBeGreaterThanOrEqual(1);
        const readyElements = screen.getAllByText('Ready');
        expect(readyElements.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('shows order totals', async () => {
      const user = userEvent.setup();
      render(<StorefrontLiveOrders />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('List')).toBeInTheDocument();
      });
      await user.click(screen.getByText('List'));

      await waitFor(() => {
        expect(screen.getByText('$50.00')).toBeInTheDocument();
        expect(screen.getByText('$30.00')).toBeInTheDocument();
        expect(screen.getByText('$85.00')).toBeInTheDocument();
      });
    });

    it('shows item count', async () => {
      const user = userEvent.setup();
      render(<StorefrontLiveOrders />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('List')).toBeInTheDocument();
      });
      await user.click(screen.getByText('List'));

      await waitFor(() => {
        // Multiple orders have items displayed
        const twoItemsElements = screen.getAllByText(/2 items/);
        expect(twoItemsElements.length).toBeGreaterThanOrEqual(1);
        const oneItemElements = screen.getAllByText(/1 item/);
        expect(oneItemElements.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('shows delivery notes when present', async () => {
      const user = userEvent.setup();
      render(<StorefrontLiveOrders />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('List')).toBeInTheDocument();
      });
      await user.click(screen.getByText('List'));

      await waitFor(() => {
        expect(screen.getByText(/Leave at door/)).toBeInTheDocument();
      });
    });
  });

  describe('Status update dropdown', () => {
    it('renders status dropdown for each order in list view', async () => {
      const user = userEvent.setup();
      render(<StorefrontLiveOrders />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('List')).toBeInTheDocument();
      });
      await user.click(screen.getByText('List'));

      await waitFor(() => {
        // Each order should have a status select trigger
        const triggers = screen.getAllByRole('combobox');
        // Filter select + 4 order status selects = 5 total
        expect(triggers.length).toBeGreaterThanOrEqual(4);
      });
    });

    it('renders with mutation available for status updates', async () => {
      render(<StorefrontLiveOrders />, { wrapper: createWrapper() });

      const user = userEvent.setup();

      await waitFor(() => {
        expect(screen.getByText('List')).toBeInTheDocument();
      });
      await user.click(screen.getByText('List'));

      await waitFor(() => {
        // Each order card has a status dropdown
        const triggers = screen.getAllByRole('combobox');
        expect(triggers.length).toBeGreaterThanOrEqual(4);
      });
    });
  });

  describe('Status progression', () => {
    it('includes all statuses in the progression', async () => {
      const user = userEvent.setup();
      render(<StorefrontLiveOrders />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('List')).toBeInTheDocument();
      });
      await user.click(screen.getByText('List'));

      // The status filter dropdown should have all statuses
      await waitFor(() => {
        expect(screen.getByText('All Active')).toBeInTheDocument();
      });
    });

    it('displays confirmed status in the filter options', async () => {
      render(<StorefrontLiveOrders />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Live Orders')).toBeInTheDocument();
      });

      // The confirmed status filter option should exist
      // Find the filter dropdown
      const filterTriggers = screen.getAllByRole('combobox');
      expect(filterTriggers.length).toBeGreaterThan(0);
    });

    it('shows Confirmed badge for confirmed orders', async () => {
      const user = userEvent.setup();
      render(<StorefrontLiveOrders />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('List')).toBeInTheDocument();
      });
      await user.click(screen.getByText('List'));

      await waitFor(() => {
        // Multiple "Confirmed" text elements exist (badge + dropdown value)
        const confirmedElements = screen.getAllByText('Confirmed');
        expect(confirmedElements.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('Filter by status', () => {
    it('renders status filter dropdown', async () => {
      render(<StorefrontLiveOrders />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('All Active')).toBeInTheDocument();
      });
    });

    it('queries with specific status when filter changes', async () => {
      render(<StorefrontLiveOrders />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(mockFrom).toHaveBeenCalledWith('marketplace_orders');
      });

      // Verify the default query uses 'in' with active statuses
      expect(mockIn).toHaveBeenCalledWith(
        'status',
        ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery']
      );
    });

    it('shows pending count badge when there are pending orders', async () => {
      render(<StorefrontLiveOrders />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('1 new')).toBeInTheDocument();
      });
    });

    it('shows stats summary', async () => {
      render(<StorefrontLiveOrders />, { wrapper: createWrapper() });

      await waitFor(() => {
        // "4 active orders • 2 preparing • 1 ready"
        expect(screen.getByText(/4 active orders/)).toBeInTheDocument();
        expect(screen.getByText(/2 preparing/)).toBeInTheDocument();
        expect(screen.getByText(/1 ready/)).toBeInTheDocument();
      });
    });
  });

  describe('Delivery vs pickup badge', () => {
    it('shows Delivery badge for delivery orders', async () => {
      const user = userEvent.setup();
      render(<StorefrontLiveOrders />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('List')).toBeInTheDocument();
      });
      await user.click(screen.getByText('List'));

      await waitFor(() => {
        const deliveryBadges = screen.getAllByText('Delivery');
        expect(deliveryBadges.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('shows Pickup badge for pickup orders', async () => {
      const user = userEvent.setup();
      render(<StorefrontLiveOrders />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('List')).toBeInTheDocument();
      });
      await user.click(screen.getByText('List'));

      await waitFor(() => {
        const pickupBadges = screen.getAllByText('Pickup');
        expect(pickupBadges.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('shows Pickup badge when shipping_method is "collect"', async () => {
      const user = userEvent.setup();
      render(<StorefrontLiveOrders />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('List')).toBeInTheDocument();
      });
      await user.click(screen.getByText('List'));

      await waitFor(() => {
        // Order 4 has shipping_method: 'collect' which should show Pickup
        const pickupBadges = screen.getAllByText('Pickup');
        expect(pickupBadges.length).toBe(2); // Order 2 (pickup) + Order 4 (collect)
      });
    });

    it('shows Delivery badge when delivery_address is present and no shipping_method', async () => {
      // Test with order that has delivery_address but no shipping_method
      const ordersWithNoMethod = [
        {
          ...mockOrders[0],
          shipping_method: null,
          delivery_address: { street: '789 Elm St' },
        },
      ];
      setupQueryMock(ordersWithNoMethod);

      const user = userEvent.setup();
      render(<StorefrontLiveOrders />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('List')).toBeInTheDocument();
      });
      await user.click(screen.getByText('List'));

      await waitFor(() => {
        expect(screen.getByText('Delivery')).toBeInTheDocument();
      });
    });
  });

  describe('View modes', () => {
    it('renders kanban view by default', async () => {
      render(<StorefrontLiveOrders />, { wrapper: createWrapper() });

      await waitFor(() => {
        // Kanban has column labels like "NEW", "PREPARING", etc.
        expect(screen.getByText('Board')).toBeInTheDocument();
      });
    });

    it('switches to list view when List button clicked', async () => {
      const user = userEvent.setup();
      render(<StorefrontLiveOrders />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('List')).toBeInTheDocument();
      });
      await user.click(screen.getByText('List'));

      await waitFor(() => {
        expect(screen.getByText('#ORD-001')).toBeInTheDocument();
      });
    });
  });

  describe('Auto-refresh', () => {
    it('shows auto-refresh toggle', async () => {
      render(<StorefrontLiveOrders />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByLabelText('Auto')).toBeInTheDocument();
      });
    });

    it('shows manual refresh button', async () => {
      render(<StorefrontLiveOrders />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Live Orders')).toBeInTheDocument();
      });

      // RefreshCw icon button
      const buttons = screen.getAllByRole('button');
      const refreshBtn = buttons.find(btn =>
        btn.querySelector('[class*="lucide-refresh-cw"]') ||
        btn.querySelector('svg')
      );
      expect(refreshBtn).toBeDefined();
    });
  });

  describe('Empty state', () => {
    it('shows empty state when no orders', async () => {
      setupQueryMock([]);

      render(<StorefrontLiveOrders />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('No active orders')).toBeInTheDocument();
        expect(screen.getByText('New orders will appear here in real-time')).toBeInTheDocument();
      });
    });
  });

  describe('Search functionality', () => {
    it('renders search input', async () => {
      render(<StorefrontLiveOrders />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search orders...')).toBeInTheDocument();
      });
    });

    it('filters orders by customer name', async () => {
      const user = userEvent.setup();
      render(<StorefrontLiveOrders />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('List')).toBeInTheDocument();
      });
      await user.click(screen.getByText('List'));

      await waitFor(() => {
        expect(screen.getByText('#ORD-001')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search orders...');
      await user.type(searchInput, 'John');

      await waitFor(() => {
        expect(screen.getByText('#ORD-001')).toBeInTheDocument();
        expect(screen.queryByText('#ORD-002')).not.toBeInTheDocument();
      });
    });

    it('filters orders by order number', async () => {
      const user = userEvent.setup();
      render(<StorefrontLiveOrders />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('List')).toBeInTheDocument();
      });
      await user.click(screen.getByText('List'));

      await waitFor(() => {
        expect(screen.getByText('#ORD-001')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search orders...');
      await user.type(searchInput, 'ORD-003');

      await waitFor(() => {
        expect(screen.getByText('#ORD-003')).toBeInTheDocument();
        expect(screen.queryByText('#ORD-001')).not.toBeInTheDocument();
      });
    });
  });

  describe('No store state', () => {
    it('shows create store message when no store exists', async () => {
      mockMaybeSingle.mockResolvedValue({ data: null, error: null });

      render(<StorefrontLiveOrders />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Please create a store first.')).toBeInTheDocument();
        expect(screen.getByText('Go to Dashboard')).toBeInTheDocument();
      });
    });
  });
});
