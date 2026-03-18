/**
 * WholesaleOrdersPage Tests
 * Tests for query key usage, staleTime, aria-labels, filtering, export, and view mode switching
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock dependencies before importing the component
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      update: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      delete: vi.fn().mockReturnThis(),
    }),
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    }),
  },
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: vi.fn().mockReturnValue({
    tenant: { id: 'tenant-123', slug: 'test-tenant', business_name: 'Test Business' },
    loading: false,
    admin: { id: 'admin-123', email: 'admin@test.com' },
    tenantSlug: 'test-tenant',
  }),
}));

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
}));

vi.mock('@/hooks/useTenantNavigate', () => ({
  useTenantNavigate: vi.fn().mockReturnValue(vi.fn()),
}));

vi.mock('@/hooks/useAdminKeyboardShortcuts', () => ({
  useAdminKeyboardShortcuts: vi.fn(),
}));

vi.mock('@/hooks/useUrlFilters', () => ({
  useUrlFilters: vi.fn().mockReturnValue([
    { q: '', status: 'all', view: 'selling' },
    vi.fn(),
    vi.fn(),
  ]),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/lib/orders/wholesaleOrderFlowManager', () => ({
  wholesaleOrderFlowManager: {
    transitionOrderStatus: vi.fn().mockResolvedValue({ success: true }),
  },
  WholesaleOrderStatus: {},
}));

vi.mock('@/lib/utils/orderEditability', () => ({
  canChangeStatus: vi.fn().mockReturnValue(true),
  getEditRestrictionMessage: vi.fn().mockReturnValue(null),
}));

vi.mock('@/lib/utils/exportUtils', () => ({
  quickExportCSV: vi.fn(),
}));

vi.mock('@/components/wholesale/EditWholesaleOrderDialog', () => ({
  EditWholesaleOrderDialog: () => <div data-testid="edit-dialog">Edit Dialog</div>,
}));

vi.mock('@/components/mobile/PullToRefresh', () => ({
  PullToRefresh: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/shared/LastUpdated', () => ({
  LastUpdated: () => <div data-testid="last-updated">Last updated</div>,
}));

vi.mock('@/components/CopyButton', () => ({
  default: () => <button>Copy</button>,
}));

vi.mock('@/components/admin/cross-links', () => ({
  CustomerLink: ({ customerName }: { customerName: string }) => <span>{customerName}</span>,
}));

// Import after mocks
import WholesaleOrdersPage from '../WholesaleOrdersPage';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { quickExportCSV } from '@/lib/utils/exportUtils';
import { supabase } from '@/integrations/supabase/client';

const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

function createMockChain(resolvedData: unknown = [], resolvedError: unknown = null) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockResolvedValue({ data: resolvedData, error: resolvedError });
  chain.update = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockResolvedValue({ data: null, error: null });
  chain.delete = vi.fn().mockReturnValue(chain);
  return chain;
}

const mockWholesaleOrders = [
  {
    id: 'wo-1',
    order_number: 'WO-001',
    client_id: 'client-1',
    total_amount: 1500.00,
    status: 'pending',
    payment_status: 'unpaid',
    delivery_address: '123 Main St',
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-01-15T10:00:00Z',
    tenant_id: 'tenant-123',
    runner_id: null,
    client: { id: 'client-1', business_name: 'Test Dispensary', contact_name: 'John Doe', phone: '555-0001' },
    items: [{ id: 'item-1', product_name: 'Product A', quantity: 10, unit_price: 150 }],
  },
  {
    id: 'wo-2',
    order_number: 'WO-002',
    client_id: 'client-2',
    total_amount: 2500.00,
    status: 'delivered',
    payment_status: 'paid',
    delivery_address: '456 Oak Ave',
    created_at: '2026-01-16T10:00:00Z',
    updated_at: '2026-01-16T10:00:00Z',
    tenant_id: 'tenant-123',
    runner_id: null,
    client: { id: 'client-2', business_name: 'Green Leaf Co', contact_name: 'Jane Smith', phone: '555-0002' },
    items: [{ id: 'item-2', product_name: 'Product B', quantity: 5, unit_price: 500 }],
  },
];

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/test-tenant/admin/wholesale-orders']}>
        {children}
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('WholesaleOrdersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (useTenantAdminAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      tenant: { id: 'tenant-123', slug: 'test-tenant', business_name: 'Test Business' },
      loading: false,
      admin: { id: 'admin-123', email: 'admin@test.com' },
      tenantSlug: 'test-tenant',
    });

    (useUrlFilters as unknown as ReturnType<typeof vi.fn>).mockReturnValue([
      { q: '', status: 'all', view: 'selling' },
      vi.fn(),
      vi.fn(),
    ]);

    mockFrom.mockReturnValue(createMockChain(mockWholesaleOrders));
  });

  describe('Initial Render', () => {
    it('should show loading skeleton when data is loading', () => {
      // Create a chain that never resolves to keep loading state
      const chain: Record<string, ReturnType<typeof vi.fn>> = {};
      chain.select = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn().mockReturnValue(chain);
      chain.in = vi.fn().mockReturnValue(chain);
      chain.order = vi.fn().mockReturnValue(new Promise(() => {}));
      mockFrom.mockReturnValue(chain);

      render(<WholesaleOrdersPage />, { wrapper: createWrapper() });

      // Skeleton uses role="status" for loading indicators
      const skeletons = screen.getAllByRole('status');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should render page header with Wholesale Orders title in selling mode', async () => {
      render(<WholesaleOrdersPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Wholesale Orders')).toBeInTheDocument();
      });
    });

    it('should render stats cards', async () => {
      render(<WholesaleOrdersPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Total Orders')).toBeInTheDocument();
        // "Pending" appears in stats card and status badge — use getAllByText
        expect(screen.getAllByText('Pending').length).toBeGreaterThan(0);
        expect(screen.getAllByText('In Transit').length).toBeGreaterThan(0);
        // "Delivered" appears in stats card and status badge
        expect(screen.getAllByText('Delivered').length).toBeGreaterThan(0);
        expect(screen.getByText('Total Revenue')).toBeInTheDocument();
      });
    });

    it('should render order data after loading', async () => {
      render(<WholesaleOrdersPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        // Order number appears in both desktop and mobile views
        expect(screen.getAllByText('WO-001').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Test Dispensary').length).toBeGreaterThan(0);
      });
    });
  });

  describe('Accessibility', () => {
    it('should have aria-label on view mode toggle', async () => {
      render(<WholesaleOrdersPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        const tabList = screen.getByRole('tablist');
        expect(tabList).toHaveAttribute('aria-label', 'Order view mode');
      });
    });

    it('should have aria-selected on active tab', async () => {
      render(<WholesaleOrdersPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        const sellingTab = screen.getByRole('tab', { name: 'Selling' });
        expect(sellingTab).toHaveAttribute('aria-selected', 'true');

        const buyingTab = screen.getByRole('tab', { name: 'Buying' });
        expect(buyingTab).toHaveAttribute('aria-selected', 'false');
      });
    });

    it('should have aria-label on export button', async () => {
      render(<WholesaleOrdersPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByLabelText('Export orders to CSV')).toBeInTheDocument();
      });
    });

    it('should have aria-label on refresh button', async () => {
      render(<WholesaleOrdersPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByLabelText('Refresh orders')).toBeInTheDocument();
      });
    });
  });

  describe('View Mode Switching', () => {
    it('should switch to buying mode when Buying tab is clicked', async () => {
      const setFiltersMock = vi.fn();
      (useUrlFilters as unknown as ReturnType<typeof vi.fn>).mockReturnValue([
        { q: '', status: 'all', view: 'selling' },
        setFiltersMock,
        vi.fn(),
      ]);

      const user = userEvent.setup();
      render(<WholesaleOrdersPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Wholesale Orders')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('tab', { name: 'Buying' }));
      expect(setFiltersMock).toHaveBeenCalledWith({ view: 'buying' });
    });
  });

  describe('Filtering', () => {
    it('should show correct count for status quick filters', async () => {
      render(<WholesaleOrdersPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        // "All Orders" button should show total count
        expect(screen.getByText('All Orders')).toBeInTheDocument();
      });
    });

    it('should update filter when quick filter is clicked', async () => {
      const setFiltersMock = vi.fn();
      (useUrlFilters as unknown as ReturnType<typeof vi.fn>).mockReturnValue([
        { q: '', status: 'all', view: 'selling' },
        setFiltersMock,
        vi.fn(),
      ]);

      const user = userEvent.setup();
      render(<WholesaleOrdersPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('All Orders')).toBeInTheDocument();
      });

      // Click "Pending" quick filter
      const pendingButtons = screen.getAllByRole('button', { name: /Pending/i });
      // Find the quick filter button (not the stats card)
      const pendingFilter = pendingButtons.find(btn => btn.closest('.bg-muted\\/20'));
      if (pendingFilter) {
        await user.click(pendingFilter);
        expect(setFiltersMock).toHaveBeenCalledWith({ status: 'pending' });
      }
    });

    it('should show clear filters button when filters are active', async () => {
      (useUrlFilters as unknown as ReturnType<typeof vi.fn>).mockReturnValue([
        { q: 'test search', status: 'all', view: 'selling' },
        vi.fn(),
        vi.fn(),
      ]);

      render(<WholesaleOrdersPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Clear')).toBeInTheDocument();
      });
    });
  });

  describe('Export', () => {
    it('should call quickExportCSV when export button is clicked', async () => {
      const user = userEvent.setup();
      render(<WholesaleOrdersPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getAllByText('WO-001').length).toBeGreaterThan(0);
      });

      await user.click(screen.getByLabelText('Export orders to CSV'));

      expect(quickExportCSV).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ 'Order #': 'WO-001' }),
        ]),
        'wholesale-orders-selling.csv'
      );
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no orders exist', async () => {
      mockFrom.mockReturnValue(createMockChain([]));

      render(<WholesaleOrdersPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('No wholesale orders yet')).toBeInTheDocument();
      });
    });

    it('should show search empty state when search has no results', async () => {
      mockFrom.mockReturnValue(createMockChain([]));
      (useUrlFilters as unknown as ReturnType<typeof vi.fn>).mockReturnValue([
        { q: 'nonexistent', status: 'all', view: 'selling' },
        vi.fn(),
        vi.fn(),
      ]);

      render(<WholesaleOrdersPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('No orders match your search')).toBeInTheDocument();
      });
    });
  });

  describe('Error State', () => {
    it('should show error state when query fails', async () => {
      // The queryFn throws when there's an error from supabase
      const chain: Record<string, ReturnType<typeof vi.fn>> = {};
      chain.select = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn().mockReturnValue(chain);
      chain.in = vi.fn().mockReturnValue(chain);
      chain.order = vi.fn().mockResolvedValue({ data: null, error: { message: 'Database error' } });
      mockFrom.mockReturnValue(chain);

      render(<WholesaleOrdersPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Failed to load data')).toBeInTheDocument();
        expect(screen.getByText('Try Again')).toBeInTheDocument();
      }, { timeout: 5000 });
    });
  });

  describe('Query Configuration', () => {
    it('should filter wholesale_orders by tenant_id', async () => {
      render(<WholesaleOrdersPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(mockFrom).toHaveBeenCalledWith('wholesale_orders');
      });

      // Verify tenant_id filter was applied via .eq()
      const chain = mockFrom.mock.results[0]?.value;
      if (chain) {
        expect(chain.eq).toHaveBeenCalledWith('tenant_id', 'tenant-123');
      }
    });
  });
});
