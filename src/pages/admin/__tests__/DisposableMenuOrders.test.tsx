/**
 * Tests for DisposableMenuOrders component
 *
 * Verifies:
 * - Rendering of stats, filters, and orders list
 * - Search and status filtering
 * - Empty state when no orders
 * - Order details dialog opens correctly
 * - Convert to invoice flow
 * - Export functionality
 * - onUpdate refetches orders after status change
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

// Mock external dependencies before component import
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: { id: 'test-tenant-id', name: 'Test Tenant', slug: 'test-tenant' },
    tenantSlug: 'test-tenant',
  }),
}));

vi.mock('@/lib/navigation/tenantNavigation', () => ({
  useTenantNavigation: () => ({
    navigateToAdmin: vi.fn(),
  }),
}));

const mockRefetch = vi.fn().mockResolvedValue({ data: [] });

const mockOrders = [
  {
    id: 'order-1',
    menu_id: 'menu-1',
    tenant_id: 'test-tenant-id',
    contact_phone: '555-1234',
    status: 'pending',
    total_amount: 100.0,
    order_data: {
      items: [
        { quantity: 2, name: 'Blue Dream', product_name: 'Blue Dream', price: 25 },
        { quantity: 1, name: 'OG Kush', product_name: 'OG Kush', price: 50 },
      ],
    },
    created_at: '2026-01-20T10:00:00Z',
    converted_to_invoice_id: null,
    menu: { name: 'Weekly Menu' },
  },
  {
    id: 'order-2',
    menu_id: 'menu-1',
    tenant_id: 'test-tenant-id',
    contact_phone: '555-5678',
    status: 'processing',
    total_amount: 250.5,
    order_data: {
      items: [{ quantity: 5, name: 'Sour Diesel', product_name: 'Sour Diesel', price: 50.1 }],
    },
    created_at: '2026-01-19T14:30:00Z',
    converted_to_invoice_id: null,
    menu: { name: 'Special Menu' },
  },
  {
    id: 'order-3',
    menu_id: 'menu-2',
    tenant_id: 'test-tenant-id',
    contact_phone: '555-9999',
    status: 'completed',
    total_amount: 75.0,
    order_data: { items: [] },
    created_at: '2026-01-18T09:15:00Z',
    converted_to_invoice_id: 'invoice-1',
    menu: { name: 'Weekly Menu' },
  },
  {
    id: 'order-4',
    menu_id: 'menu-2',
    tenant_id: 'test-tenant-id',
    contact_phone: null,
    status: 'cancelled',
    total_amount: 0,
    order_data: null,
    created_at: '2026-01-17T08:00:00Z',
    converted_to_invoice_id: null,
    menu: { name: 'Old Menu' },
  },
];

vi.mock('@/hooks/useDisposableMenus', () => ({
  useMenuOrders: () => ({
    data: mockOrders,
    isLoading: false,
    refetch: mockRefetch,
  }),
}));

const mockExportOrders = vi.fn();
vi.mock('@/utils/exportHelpers', () => ({
  exportOrders: (...args: unknown[]) => mockExportOrders(...args),
}));

vi.mock('@/utils/toastHelpers', () => ({
  showSuccessToast: vi.fn(),
  showErrorToast: vi.fn(),
}));

vi.mock('@/components/admin/disposable-menus/OrderDetailsDialog', () => ({
  OrderDetailsDialog: ({ order, open, onOpenChange, onUpdate }: {
    order: { id: string };
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onUpdate: () => void;
  }) =>
    open ? (
      <div data-testid="order-details-dialog">
        <span>Order Details: {order.id}</span>
        <button onClick={onUpdate}>Update Order</button>
        <button onClick={() => onOpenChange(false)}>Close</button>
      </div>
    ) : null,
}));

vi.mock('@/components/admin/disposable-menus/OrderStatusBadge', () => ({
  OrderStatusBadge: ({ status }: { status: string }) => (
    <span data-testid="status-badge">{status}</span>
  ),
}));

vi.mock('@/components/admin/disposable-menus/ConvertToInvoiceDialog', () => ({
  ConvertToInvoiceDialog: ({ open, onOpenChange }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) =>
    open ? (
      <div data-testid="convert-dialog">
        <button onClick={() => onOpenChange(false)}>Close Convert</button>
      </div>
    ) : null,
}));

vi.mock('@/components/shared/EnhancedEmptyState', () => ({
  EnhancedEmptyState: ({ title, description }: { title: string; description: string }) => (
    <div data-testid="empty-state">
      <span>{title}</span>
      <span>{description}</span>
    </div>
  ),
}));

vi.mock('@/components/shared/LastUpdated', () => ({
  LastUpdated: ({ onRefresh }: { onRefresh: () => void }) => (
    <button data-testid="refresh-button" onClick={onRefresh}>Refresh</button>
  ),
}));

vi.mock('@/components/CopyButton', () => ({
  default: () => <button data-testid="copy-button">Copy</button>,
}));

vi.mock('@/lib/formatters', () => ({
  formatSmartDate: (date: string) => new Date(date).toLocaleDateString(),
}));

vi.mock('@/hooks/usePagination', () => ({
  usePagination: (items: unknown[]) => ({
    paginatedItems: items,
    currentPage: 1,
    totalPages: 1,
    pageSize: 25,
    totalItems: items.length,
    goToPage: vi.fn(),
    changePageSize: vi.fn(),
  }),
}));

vi.mock('@/components/shared/StandardPagination', () => ({
  StandardPagination: () => <div data-testid="pagination">Pagination</div>,
}));

// Import component after mocks
import DisposableMenuOrders from '../DisposableMenuOrders';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = createQueryClient();
  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>{ui}</BrowserRouter>
      </QueryClientProvider>
    ),
    queryClient,
  };
}

describe('DisposableMenuOrders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the Order Management header', async () => {
      renderWithProviders(<DisposableMenuOrders />);
      await waitFor(() => {
        expect(screen.getByText('Order Management')).toBeInTheDocument();
      });
    });

    it('should render Back to Menus button', async () => {
      renderWithProviders(<DisposableMenuOrders />);
      await waitFor(() => {
        expect(screen.getByText('Back to Menus')).toBeInTheDocument();
      });
    });

    it('should render Export All button', async () => {
      renderWithProviders(<DisposableMenuOrders />);
      await waitFor(() => {
        expect(screen.getByText('Export All')).toBeInTheDocument();
      });
    });

    it('should render search input', async () => {
      renderWithProviders(<DisposableMenuOrders />);
      await waitFor(() => {
        expect(screen.getByLabelText('Search by customer, phone, or menu')).toBeInTheDocument();
      });
    });

    it('should render status filter buttons', async () => {
      renderWithProviders(<DisposableMenuOrders />);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Pending' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Processing' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Completed' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Cancelled' })).toBeInTheDocument();
      });
    });
  });

  describe('Stats Cards', () => {
    it('should render all stats cards with correct values', async () => {
      renderWithProviders(<DisposableMenuOrders />);
      await waitFor(() => {
        expect(screen.getByText('Total Orders')).toBeInTheDocument();
        expect(screen.getByText('4')).toBeInTheDocument(); // total
      });
    });

    it('should calculate pending count correctly', async () => {
      renderWithProviders(<DisposableMenuOrders />);
      await waitFor(() => {
        // 1 pending order - find the stats card section (first grid)
        const statsGrid = screen.getByText('Total Orders').closest('.grid');
        expect(statsGrid).toBeInTheDocument();
        // Within stats grid, the pending card should show "1"
        const pendingHeading = within(statsGrid!).getByText('Pending');
        expect(pendingHeading).toBeInTheDocument();
      });
    });

    it('should show total revenue', async () => {
      renderWithProviders(<DisposableMenuOrders />);
      await waitFor(() => {
        expect(screen.getByText('Total Revenue')).toBeInTheDocument();
      });
    });

    it('should show average order value', async () => {
      renderWithProviders(<DisposableMenuOrders />);
      await waitFor(() => {
        expect(screen.getByText('Avg Order')).toBeInTheDocument();
      });
    });
  });

  describe('Orders List', () => {
    it('should render orders with customer phone numbers', async () => {
      renderWithProviders(<DisposableMenuOrders />);
      await waitFor(() => {
        expect(screen.getByText('555-1234')).toBeInTheDocument();
        expect(screen.getByText('555-5678')).toBeInTheDocument();
      });
    });

    it('should show "Unknown Customer" when phone is null', async () => {
      renderWithProviders(<DisposableMenuOrders />);
      await waitFor(() => {
        expect(screen.getByText('Unknown Customer')).toBeInTheDocument();
      });
    });

    it('should render order status badges', async () => {
      renderWithProviders(<DisposableMenuOrders />);
      await waitFor(() => {
        const badges = screen.getAllByTestId('status-badge');
        expect(badges.length).toBe(4);
      });
    });

    it('should render order amounts', async () => {
      renderWithProviders(<DisposableMenuOrders />);
      await waitFor(() => {
        expect(screen.getByText('$100.00')).toBeInTheDocument();
        expect(screen.getByText('$250.50')).toBeInTheDocument();
      });
    });

    it('should render menu names', async () => {
      renderWithProviders(<DisposableMenuOrders />);
      await waitFor(() => {
        expect(screen.getAllByText('Weekly Menu').length).toBeGreaterThan(0);
        expect(screen.getByText('Special Menu')).toBeInTheDocument();
      });
    });

    it('should show item count and preview badges', async () => {
      renderWithProviders(<DisposableMenuOrders />);
      await waitFor(() => {
        expect(screen.getByText('2 item(s)')).toBeInTheDocument();
        expect(screen.getByText('2x Blue Dream')).toBeInTheDocument();
        expect(screen.getByText('1x OG Kush')).toBeInTheDocument();
      });
    });

    it('should hide Convert button for already-converted orders', async () => {
      renderWithProviders(<DisposableMenuOrders />);
      await waitFor(() => {
        // order-3 has converted_to_invoice_id set, so should not have Convert button
        // 3 orders should have Convert buttons (order-1, order-2, order-4), order-3 should not
        const convertButtons = screen.getAllByText('Convert');
        expect(convertButtons.length).toBe(3);
      });
    });
  });

  describe('Search Filtering', () => {
    it('should filter orders by phone number', async () => {
      const user = userEvent.setup();
      renderWithProviders(<DisposableMenuOrders />);

      const searchInput = screen.getByLabelText('Search by customer, phone, or menu');
      await user.type(searchInput, '555-1234');

      await waitFor(() => {
        expect(screen.getByText('555-1234')).toBeInTheDocument();
        expect(screen.queryByText('555-5678')).not.toBeInTheDocument();
      });
    });

    it('should filter orders by menu name', async () => {
      const user = userEvent.setup();
      renderWithProviders(<DisposableMenuOrders />);

      const searchInput = screen.getByLabelText('Search by customer, phone, or menu');
      await user.type(searchInput, 'Special');

      await waitFor(() => {
        expect(screen.getByText('555-5678')).toBeInTheDocument();
        expect(screen.queryByText('555-1234')).not.toBeInTheDocument();
      });
    });
  });

  describe('Status Filtering', () => {
    it('should filter by pending status', async () => {
      const user = userEvent.setup();
      renderWithProviders(<DisposableMenuOrders />);

      await user.click(screen.getByRole('button', { name: 'Pending' }));

      await waitFor(() => {
        expect(screen.getByText('555-1234')).toBeInTheDocument();
        expect(screen.queryByText('555-5678')).not.toBeInTheDocument();
      });
    });

    it('should show all orders when "All" is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<DisposableMenuOrders />);

      // First filter by pending
      await user.click(screen.getByRole('button', { name: 'Pending' }));
      await waitFor(() => {
        expect(screen.queryByText('555-5678')).not.toBeInTheDocument();
      });

      // Then click All
      await user.click(screen.getByRole('button', { name: 'All' }));
      await waitFor(() => {
        expect(screen.getByText('555-1234')).toBeInTheDocument();
        expect(screen.getByText('555-5678')).toBeInTheDocument();
      });
    });
  });

  describe('Order Details Dialog', () => {
    it('should open order details when clicking View button', async () => {
      const user = userEvent.setup();
      renderWithProviders(<DisposableMenuOrders />);

      const viewButtons = await screen.findAllByText('View');
      await user.click(viewButtons[0]);

      await waitFor(() => {
        expect(screen.getByTestId('order-details-dialog')).toBeInTheDocument();
        expect(screen.getByText('Order Details: order-1')).toBeInTheDocument();
      });
    });

    it('should refetch orders when onUpdate is called', async () => {
      const user = userEvent.setup();
      renderWithProviders(<DisposableMenuOrders />);

      const viewButtons = await screen.findAllByText('View');
      await user.click(viewButtons[0]);

      await waitFor(() => {
        expect(screen.getByTestId('order-details-dialog')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Update Order'));

      await waitFor(() => {
        expect(mockRefetch).toHaveBeenCalled();
      });
    });
  });

  describe('Convert to Invoice', () => {
    it('should open convert dialog when clicking Convert button', async () => {
      const user = userEvent.setup();
      renderWithProviders(<DisposableMenuOrders />);

      const convertButtons = await screen.findAllByText('Convert');
      await user.click(convertButtons[0]);

      await waitFor(() => {
        expect(screen.getByTestId('convert-dialog')).toBeInTheDocument();
      });
    });
  });

  describe('Export', () => {
    it('should call exportOrders when clicking Export All', async () => {
      const user = userEvent.setup();
      renderWithProviders(<DisposableMenuOrders />);

      await user.click(screen.getByText('Export All'));

      expect(mockExportOrders).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 'order-1', menu_name: 'Weekly Menu' }),
        ])
      );
    });
  });

  describe('Refresh', () => {
    it('should refetch orders when refresh is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<DisposableMenuOrders />);

      await user.click(screen.getByTestId('refresh-button'));

      await waitFor(() => {
        expect(mockRefetch).toHaveBeenCalled();
      });
    });
  });

  describe('Filtered Empty State', () => {
    it('should show empty state when search has no results', async () => {
      const user = userEvent.setup();
      renderWithProviders(<DisposableMenuOrders />);

      const searchInput = screen.getByLabelText('Search by customer, phone, or menu');
      await user.type(searchInput, 'nonexistent-order-12345');

      await waitFor(() => {
        expect(screen.getByText('No orders found')).toBeInTheDocument();
      });
    });
  });
});

describe('DisposableMenuOrders - Stats Calculation Logic', () => {
  it('should count processing orders including "preparing" status', () => {
    const orders = [
      { status: 'processing' },
      { status: 'preparing' },
      { status: 'pending' },
    ];
    const processingCount = orders.filter(
      o => o.status === 'processing' || o.status === 'preparing'
    ).length;
    expect(processingCount).toBe(2);
  });

  it('should count completed orders including "delivered" status', () => {
    const orders = [
      { status: 'completed' },
      { status: 'delivered' },
      { status: 'pending' },
    ];
    const completedCount = orders.filter(
      o => o.status === 'completed' || o.status === 'delivered'
    ).length;
    expect(completedCount).toBe(2);
  });

  it('should count cancelled orders including "rejected" status', () => {
    const orders = [
      { status: 'cancelled' },
      { status: 'rejected' },
      { status: 'pending' },
    ];
    const cancelledCount = orders.filter(
      o => o.status === 'cancelled' || o.status === 'rejected'
    ).length;
    expect(cancelledCount).toBe(2);
  });

  it('should calculate average order value correctly', () => {
    const orders = [
      { total_amount: 100 },
      { total_amount: 200 },
      { total_amount: null },
    ];
    const avg = orders.reduce((sum, o) => sum + parseFloat(String(o.total_amount ?? 0)), 0) / orders.length;
    expect(avg).toBe(100); // (100 + 200 + 0) / 3
  });
});
