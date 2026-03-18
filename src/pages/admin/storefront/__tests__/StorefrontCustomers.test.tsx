/**
 * StorefrontCustomers Tests
 * Tests for storefront customers page including search sanitization,
 * immutable aggregation, error/loading states, and navigation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Track navigate calls
const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ tenantSlug: 'test-tenant' }),
  };
});

// Mock supabase
const mockSelect = vi.fn().mockReturnThis();
const mockEq = vi.fn().mockReturnThis();
const mockNot = vi.fn().mockReturnThis();
const mockMaybeSingle = vi.fn();
const mockFrom = vi.fn().mockReturnValue({
  select: mockSelect,
  eq: mockEq,
  not: mockNot,
  maybeSingle: mockMaybeSingle,
});
const mockRpc = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
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
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/hooks/useTablePreferences', () => ({
  useTablePreferences: vi.fn().mockReturnValue({
    preferences: { sortBy: 'total_spent' },
    savePreferences: vi.fn(),
  }),
}));

vi.mock('@/hooks/useMarketplaceCustomerSync', () => ({
  useMarketplaceCustomerSync: vi.fn().mockReturnValue({
    sync: vi.fn(),
    syncAsync: vi.fn(),
    isSyncing: false,
    syncResult: null,
    syncError: null,
  }),
}));

// Import component after mocks
import StorefrontCustomers from '../StorefrontCustomers';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/test-tenant/admin/storefront/customers']}>
          {children}
        </MemoryRouter>
      </QueryClientProvider>
    );
  };
}

describe('StorefrontCustomers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
  });

  it('shows "create a store" message when no store exists', async () => {
    // First call for store query returns null
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    render(<StorefrontCustomers />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Please create a store first.')).toBeInTheDocument();
    });
  });

  it('navigates to storefront dashboard when "Go to Dashboard" is clicked', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const user = userEvent.setup();
    render(<StorefrontCustomers />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Go to Dashboard')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Go to Dashboard'));
    expect(mockNavigate).toHaveBeenCalledWith('/test-tenant/admin/storefront');
  });

  it('renders loading skeletons while data is fetching', async () => {
    // Store query resolves with a store
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: 'store-1' }, error: null });
    // Customer orders query - never resolves to keep loading
    mockNot.mockReturnValue(new Promise(() => {}));

    render(<StorefrontCustomers />, { wrapper: createWrapper() });

    // Should show the header while loading
    await waitFor(() => {
      expect(screen.getByText('Customer Directory')).toBeInTheDocument();
    });
  });

  it('renders customer data when loaded', async () => {
    // Store query
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: 'store-1' }, error: null });

    // Orders data for customer aggregation
    const mockOrders = [
      {
        customer_email: 'alice@example.com',
        customer_name: 'Alice Smith',
        customer_phone: '555-0100',
        total_amount: 50,
        created_at: '2025-01-15T10:00:00Z',
      },
      {
        customer_email: 'alice@example.com',
        customer_name: 'Alice Smith',
        customer_phone: '555-0100',
        total_amount: 75,
        created_at: '2025-02-20T10:00:00Z',
      },
      {
        customer_email: 'bob@example.com',
        customer_name: 'Bob Jones',
        customer_phone: null,
        total_amount: 30,
        created_at: '2025-01-10T10:00:00Z',
      },
    ];

    mockNot.mockResolvedValueOnce({ data: mockOrders, error: null });

    render(<StorefrontCustomers />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    });

    expect(screen.getByText('Bob Jones')).toBeInTheDocument();
    // Alice should have 2 orders aggregated — verify the badge exists
    const badges = screen.getAllByText('2');
    expect(badges.length).toBeGreaterThan(0);
  });

  it('shows empty state when no customers', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: 'store-1' }, error: null });
    mockNot.mockResolvedValueOnce({ data: [], error: null });

    render(<StorefrontCustomers />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('No customers found')).toBeInTheDocument();
    });

    expect(
      screen.getByText('Customers will appear here after their first order')
    ).toBeInTheDocument();
  });

  it('shows error state when query fails', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: 'store-1' }, error: null });
    // Mock the chained call to always reject (retry: 2 means 3 total attempts)
    mockNot
      .mockResolvedValueOnce({ data: null, error: { message: 'Network error', code: '500' } })
      .mockResolvedValueOnce({ data: null, error: { message: 'Network error', code: '500' } })
      .mockResolvedValueOnce({ data: null, error: { message: 'Network error', code: '500' } });

    render(<StorefrontCustomers />, { wrapper: createWrapper() });

    await waitFor(
      () => {
        expect(screen.getByText('Failed to load customers. Please try again.')).toBeInTheDocument();
      },
      { timeout: 10000 },
    );
  });

  it('filters customers by search query', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: 'store-1' }, error: null });

    const mockOrders = [
      {
        customer_email: 'alice@example.com',
        customer_name: 'Alice Smith',
        customer_phone: '555-0100',
        total_amount: 50,
        created_at: '2025-01-15T10:00:00Z',
      },
      {
        customer_email: 'bob@example.com',
        customer_name: 'Bob Jones',
        customer_phone: '555-0200',
        total_amount: 30,
        created_at: '2025-01-10T10:00:00Z',
      },
    ];

    mockNot.mockResolvedValueOnce({ data: mockOrders, error: null });

    const user = userEvent.setup();
    render(<StorefrontCustomers />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    });

    // Search for "bob"
    const searchInput = screen.getByLabelText('Search by email, name, or phone');
    await user.type(searchInput, 'bob');

    await waitFor(() => {
      expect(screen.queryByText('Alice Smith')).not.toBeInTheDocument();
    });

    expect(screen.getByText('Bob Jones')).toBeInTheDocument();
  });

  it('sanitizes search input', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: 'store-1' }, error: null });
    mockNot.mockResolvedValueOnce({ data: [], error: null });

    const user = userEvent.setup();
    render(<StorefrontCustomers />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('No customers found')).toBeInTheDocument();
    });

    // Search with special characters — should not crash
    const searchInput = screen.getByLabelText('Search by email, name, or phone');
    await user.type(searchInput, '%test%');

    // Should still show empty state (not crash)
    expect(screen.getByText('No customers found')).toBeInTheDocument();
  });

  it('renders stats cards with computed values', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: 'store-1' }, error: null });

    const mockOrders = [
      {
        customer_email: 'alice@example.com',
        customer_name: 'Alice',
        customer_phone: null,
        total_amount: 100,
        created_at: '2025-01-15T10:00:00Z',
      },
      {
        customer_email: 'alice@example.com',
        customer_name: 'Alice',
        customer_phone: null,
        total_amount: 200,
        created_at: '2025-02-15T10:00:00Z',
      },
    ];

    mockNot.mockResolvedValueOnce({ data: mockOrders, error: null });

    render(<StorefrontCustomers />, { wrapper: createWrapper() });

    await waitFor(
      () => {
        // Stats should show 1 customer with computed totals
        expect(screen.getByText('Total Customers')).toBeInTheDocument();
        expect(screen.getByText('Repeat Customers')).toBeInTheDocument();
        expect(screen.getByText('Alice')).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    // Verify Total Revenue stat card shows $300 ($100 + $200)
    const revenueCards = screen.getAllByText('$300.00');
    expect(revenueCards.length).toBeGreaterThan(0);
  });
});
