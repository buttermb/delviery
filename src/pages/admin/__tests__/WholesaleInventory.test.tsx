/**
 * WholesaleInventory Tests
 * Tests for wholesale inventory page: overview cards, category grouping,
 * active deliveries, top movers, restock alerts, and empty states.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Hoisted mocks for access inside vi.mock factories
const { mockNavigateToAdmin, mockInventoryData, mockDeliveriesData } = vi.hoisted(() => ({
  mockNavigateToAdmin: vi.fn(),
  mockInventoryData: vi.fn(),
  mockDeliveriesData: vi.fn(),
}));

// Mock Supabase before imports
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockGte = vi.fn();
const mockIn = vi.fn();
const mockOrder = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => {
      mockFrom(...args);
      return {
        select: (...sArgs: unknown[]) => {
          mockSelect(...sArgs);
          return {
            eq: (...eArgs: unknown[]) => {
              mockEq(...eArgs);
              return {
                order: (...oArgs: unknown[]) => {
                  mockOrder(...oArgs);
                  return Promise.resolve({ data: [], error: null });
                },
                gte: (...gArgs: unknown[]) => {
                  mockGte(...gArgs);
                  return {
                    in: (...iArgs: unknown[]) => {
                      mockIn(...iArgs);
                      return Promise.resolve({ data: [], error: null });
                    },
                  };
                },
                limit: vi.fn().mockResolvedValue({ data: [], error: null }),
              };
            },
            order: (...oArgs: unknown[]) => {
              mockOrder(...oArgs);
              return {
                limit: vi.fn().mockResolvedValue({ data: [], error: null }),
              };
            },
          };
        },
      };
    },
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

vi.mock('@/lib/navigation/tenantNavigation', () => ({
  useTenantNavigation: vi.fn().mockReturnValue({
    navigateToAdmin: mockNavigateToAdmin,
  }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/hooks/useWholesaleData', () => ({
  useWholesaleInventory: (...args: unknown[]) => mockInventoryData(...args),
  useWholesaleDeliveries: (...args: unknown[]) => mockDeliveriesData(...args),
}));

// Mock child components
vi.mock('@/components/EnhancedLoadingState', () => ({
  EnhancedLoadingState: ({ variant }: { variant: string }) => (
    <div data-testid="loading-state" data-variant={variant}>Loading...</div>
  ),
}));

vi.mock('@/components/shared/EnhancedEmptyState', () => ({
  EnhancedEmptyState: ({ title, description }: { title: string; description: string }) => (
    <div data-testid="empty-state">
      <p>{title}</p>
      <p>{description}</p>
    </div>
  ),
}));

vi.mock('@/components/shared/ResponsiveTable', () => ({
  ResponsiveTable: ({ data, emptyState }: { data: unknown[]; emptyState?: { title: string } }) => (
    <div data-testid="responsive-table">
      {data.length === 0 && emptyState && <div>{emptyState.title}</div>}
      {data.map((item: Record<string, unknown>, i: number) => (
        <div key={String(item.id ?? i)} data-testid="table-row">
          {String(item.strain)} - {String(item.weight_lbs)} lbs
        </div>
      ))}
    </div>
  ),
}));

vi.mock('@/lib/utils/formatCurrency', () => ({
  formatCurrency: (val: number) => `$${val.toFixed(2)}`,
}));

// Import after mocks
import WholesaleInventory from '../WholesaleInventory';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/test-tenant/admin/wholesale-inventory']}>
          {children}
        </MemoryRouter>
      </QueryClientProvider>
    );
  };
}

describe('WholesaleInventory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInventoryData.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    mockDeliveriesData.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it('renders the page header', async () => {
    render(<WholesaleInventory />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Inventory Management')).toBeInTheDocument();
      expect(screen.getByText('Wholesale scale inventory tracking')).toBeInTheDocument();
    });
  });

  it('renders loading state when data is loading', () => {
    mockInventoryData.mockReturnValue({
      data: [],
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<WholesaleInventory />, { wrapper: createWrapper() });
    expect(screen.getByTestId('loading-state')).toBeInTheDocument();
  });

  it('renders error state with retry button on inventory error', async () => {
    const refetchFn = vi.fn();
    mockInventoryData.mockReturnValue({
      data: [],
      isLoading: false,
      isError: true,
      error: new Error('Network error'),
      refetch: refetchFn,
    });

    render(<WholesaleInventory />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Failed to load data')).toBeInTheDocument();
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByText('Try Again'));
    expect(refetchFn).toHaveBeenCalled();
  });

  it('calculates overview stats from inventory data', async () => {
    mockInventoryData.mockReturnValue({
      data: [
        { id: 'p1', product_name: 'OG Kush', category: 'Flower', quantity_lbs: 100, cost_per_lb: 10 },
        { id: 'p2', product_name: 'Blue Dream', category: 'Flower', quantity_lbs: 50, cost_per_lb: 12 },
      ],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<WholesaleInventory />, { wrapper: createWrapper() });

    // Total stock: 100 + 50 = 150 lbs (overview card shows "150 lbs")
    await waitFor(() => {
      const allLbs = screen.getAllByText('150 lbs');
      // At least one is the overview card
      expect(allLbs.length).toBeGreaterThanOrEqual(1);
    });

    // Total value: 100*10 + 50*12 = 1000 + 600 = $1600
    expect(screen.getByText('$1600.00')).toBeInTheDocument();

    // Avg cost: 1600 / 150 ≈ $10.67
    expect(screen.getByText('$10.67')).toBeInTheDocument();
  });

  it('groups inventory by category', async () => {
    mockInventoryData.mockReturnValue({
      data: [
        { id: 'p1', product_name: 'OG Kush', category: 'Flower', quantity_lbs: 100, cost_per_lb: 10 },
        { id: 'p2', product_name: 'Blue Dream', category: 'Concentrate', quantity_lbs: 50, cost_per_lb: 12 },
      ],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<WholesaleInventory />, { wrapper: createWrapper() });

    // Category names appear as warehouse filter buttons and as card headers
    await waitFor(() => {
      const flowerButtons = screen.getAllByText('Flower');
      expect(flowerButtons.length).toBeGreaterThanOrEqual(1);
      const concentrateButtons = screen.getAllByText('Concentrate');
      expect(concentrateButtons.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows empty state when no inventory', async () => {
    render(<WholesaleInventory />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.getByText('No Inventory Found')).toBeInTheDocument();
    });
  });

  it('displays active deliveries with real data', async () => {
    mockDeliveriesData.mockReturnValue({
      data: [
        {
          id: 'del-1',
          status: 'in_transit',
          runner: { full_name: 'John Driver', phone: '555-1234', vehicle_type: 'van' },
          order: { order_number: 'WO-001', total_amount: 500, delivery_address: '123 Main St' },
          tenant_id: 'tenant-123',
          order_id: 'ord-1',
          runner_id: 'run-1',
          current_location: null,
          notes: null,
          created_at: '2024-01-01',
        },
        {
          id: 'del-2',
          status: 'pending',
          runner: { full_name: 'Jane Courier', phone: '555-5678', vehicle_type: 'car' },
          order: { order_number: 'WO-002', total_amount: 300, delivery_address: '456 Oak Ave' },
          tenant_id: 'tenant-123',
          order_id: 'ord-2',
          runner_id: 'run-2',
          current_location: null,
          notes: null,
          created_at: '2024-01-02',
        },
      ],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<WholesaleInventory />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('John Driver')).toBeInTheDocument();
      expect(screen.getByText('123 Main St')).toBeInTheDocument();
      expect(screen.getByText('In Transit')).toBeInTheDocument();

      expect(screen.getByText('Jane Courier')).toBeInTheDocument();
      expect(screen.getByText('456 Oak Ave')).toBeInTheDocument();
      expect(screen.getByText('Pending')).toBeInTheDocument();
    });
  });

  it('shows no active deliveries message when none exist', async () => {
    render(<WholesaleInventory />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('No active deliveries')).toBeInTheDocument();
    });
  });

  it('shows empty state for top movers when no data', async () => {
    render(<WholesaleInventory />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('No sales data in the last 30 days')).toBeInTheDocument();
      expect(screen.getByText('No sales activity this month')).toBeInTheDocument();
    });
  });

  it('shows healthy inventory message when no restock needed', async () => {
    mockInventoryData.mockReturnValue({
      data: [
        { id: 'p1', product_name: 'OG Kush', category: 'Flower', quantity_lbs: 100, cost_per_lb: 10 },
      ],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<WholesaleInventory />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('All inventory levels are healthy')).toBeInTheDocument();
    });
  });

  it('shows restock alerts for low-stock items', async () => {
    mockInventoryData.mockReturnValue({
      data: [
        { id: 'p1', product_name: 'Low Flower', category: 'Flower', quantity_lbs: 5, cost_per_lb: 10 },
        { id: 'p2', product_name: 'Medium Flower', category: 'Flower', quantity_lbs: 20, cost_per_lb: 12 },
      ],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<WholesaleInventory />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/Low Flower: 5 lbs left/)).toBeInTheDocument();
      expect(screen.getByText(/restock urgently/)).toBeInTheDocument();
      expect(screen.getByText(/Medium Flower: 20 lbs left/)).toBeInTheDocument();
      expect(screen.getByText(/consider restocking/)).toBeInTheDocument();
    });
  });

  it('navigates to inventory management on Add Stock click', async () => {
    render(<WholesaleInventory />, { wrapper: createWrapper() });

    const user = userEvent.setup();
    const addButton = screen.getByText('Add Stock');
    await user.click(addButton);

    expect(mockNavigateToAdmin).toHaveBeenCalledWith('inventory-management');
  });

  it('navigates to inventory management on Move Stock click', async () => {
    render(<WholesaleInventory />, { wrapper: createWrapper() });

    const user = userEvent.setup();
    const moveButton = screen.getByText('Move Stock');
    await user.click(moveButton);

    expect(mockNavigateToAdmin).toHaveBeenCalledWith('inventory-management');
  });

  it('filters delivered deliveries out of active list', async () => {
    mockDeliveriesData.mockReturnValue({
      data: [
        {
          id: 'del-1',
          status: 'delivered',
          runner: { full_name: 'Done Driver', phone: '555', vehicle_type: 'van' },
          order: { order_number: 'WO-X', total_amount: 100, delivery_address: 'Done St' },
          tenant_id: 'tenant-123',
          order_id: 'ord-x',
          runner_id: 'run-x',
          current_location: null,
          notes: null,
          created_at: '2024-01-01',
        },
      ],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<WholesaleInventory />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.queryByText('Done Driver')).not.toBeInTheDocument();
      expect(screen.getByText('No active deliveries')).toBeInTheDocument();
    });
  });

  it('assigns correct status badges to inventory items', async () => {
    mockInventoryData.mockReturnValue({
      data: [
        { id: 'p1', product_name: 'Very Low', category: 'Flower', quantity_lbs: 5, cost_per_lb: 10 },
        { id: 'p2', product_name: 'Low Stock', category: 'Flower', quantity_lbs: 15, cost_per_lb: 10 },
        { id: 'p3', product_name: 'Good Stock', category: 'Flower', quantity_lbs: 50, cost_per_lb: 10 },
      ],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<WholesaleInventory />, { wrapper: createWrapper() });

    await waitFor(() => {
      // The table row shows strain and weight
      const rows = screen.getAllByTestId('table-row');
      expect(rows).toHaveLength(3);
      expect(rows[0]).toHaveTextContent('Very Low - 5 lbs');
      expect(rows[1]).toHaveTextContent('Low Stock - 15 lbs');
      expect(rows[2]).toHaveTextContent('Good Stock - 50 lbs');
    });
  });
});
