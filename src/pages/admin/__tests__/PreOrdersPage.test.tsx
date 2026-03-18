/**
 * PreOrdersPage Tests
 *
 * Tests for the pre-orders listing page including:
 * - Page header and stats cards
 * - Expected date rendering (no longer a placeholder)
 * - Search and filter functionality
 * - Convert to Invoice dialog integration
 * - Cancel order functionality
 * - Loading and empty states
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// --- Mocks ---

const mockNavigateToAdmin = vi.fn();

vi.mock('@/lib/navigation/tenantNavigation', () => ({
  useTenantNavigation: vi.fn().mockReturnValue({
    navigateToAdmin: (...args: unknown[]) => mockNavigateToAdmin(...args),
    navigate: vi.fn(),
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
    }),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }),
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

vi.mock('@/hooks/crm/useAccountId', () => ({
  useAccountIdSafe: vi.fn().mockReturnValue('account-123'),
}));

vi.mock('@/hooks/crm/usePreOrders', () => ({
  usePreOrders: vi.fn().mockReturnValue({
    data: [],
    isLoading: false,
  }),
  useCancelPreOrder: vi.fn().mockReturnValue({
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/contexts/ThemeContext', () => ({
  ThemeProvider: ({ children }: { children: ReactNode }) => children,
  useTheme: vi.fn().mockReturnValue({
    theme: 'light',
    toggleTheme: vi.fn(),
  }),
}));

vi.mock('@/utils/safeStorage', () => ({
  safeStorage: {
    getItem: vi.fn().mockReturnValue(null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

// Mock ConvertPreOrderDialog to simplify testing
vi.mock('@/components/crm/ConvertPreOrderDialog', () => ({
  ConvertPreOrderDialog: ({ open, preOrder }: { open: boolean; preOrder: { pre_order_number: string } }) =>
    open ? <div data-testid="convert-dialog">Convert Dialog for {preOrder.pre_order_number}</div> : null,
}));

// Import after mocks
import PreOrdersPage from '../PreOrdersPage';
import { usePreOrders } from '@/hooks/crm/usePreOrders';
import type { CRMPreOrder } from '@/types/crm';

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={createQueryClient()}>
    <MemoryRouter initialEntries={['/test-tenant/admin/crm/pre-orders']}>
      {children}
    </MemoryRouter>
  </QueryClientProvider>
);

const mockPreOrders: CRMPreOrder[] = [
  {
    id: 'po-1',
    account_id: 'account-123',
    client_id: 'client-1',
    pre_order_number: 'PO-001',
    line_items: [{ quantity: 2, unit_price: 50, line_total: 100 }],
    subtotal: 100,
    tax: 0,
    total: 100,
    status: 'pending',
    converted_to_invoice_id: null,
    converted_at: null,
    expected_date: '2026-04-15',
    notes: null,
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
    client: {
      id: 'client-1',
      account_id: 'account-123',
      name: 'Alice Corp',
      email: 'alice@corp.com',
      phone: '555-0001',
      status: 'active',
      open_balance: 0,
      portal_password_hash: null,
      portal_last_login: null,
      notified_about_menu_update: false,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
  },
  {
    id: 'po-2',
    account_id: 'account-123',
    client_id: 'client-2',
    pre_order_number: 'PO-002',
    line_items: [],
    subtotal: 250,
    tax: 0,
    total: 250,
    status: 'converted',
    converted_to_invoice_id: 'inv-1',
    converted_at: '2026-03-10T00:00:00Z',
    expected_date: null,
    notes: null,
    created_at: '2026-02-15T00:00:00Z',
    updated_at: '2026-03-10T00:00:00Z',
    client: {
      id: 'client-2',
      account_id: 'account-123',
      name: 'Bob LLC',
      email: 'bob@llc.com',
      phone: null,
      status: 'active',
      open_balance: 0,
      portal_password_hash: null,
      portal_last_login: null,
      notified_about_menu_update: false,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
  },
  {
    id: 'po-3',
    account_id: 'account-123',
    client_id: 'client-3',
    pre_order_number: 'PO-003',
    line_items: [],
    subtotal: 75,
    tax: 0,
    total: 75,
    status: 'cancelled',
    converted_to_invoice_id: null,
    converted_at: null,
    expected_date: null,
    notes: null,
    created_at: '2026-02-01T00:00:00Z',
    updated_at: '2026-02-05T00:00:00Z',
    client: {
      id: 'client-3',
      account_id: 'account-123',
      name: 'Carol Inc',
      email: null,
      phone: null,
      status: 'active',
      open_balance: 0,
      portal_password_hash: null,
      portal_last_login: null,
      notified_about_menu_update: false,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
  },
];

describe('PreOrdersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (usePreOrders as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [],
      isLoading: false,
    });
  });

  describe('Page Header', () => {
    it('should render page title and description', () => {
      render(<PreOrdersPage />, { wrapper });
      expect(screen.getByText('Pre-Orders')).toBeInTheDocument();
      expect(screen.getByText('Manage pre-orders and convert them to invoices.')).toBeInTheDocument();
    });

    it('should render Create Pre-Order button', () => {
      render(<PreOrdersPage />, { wrapper });
      expect(screen.getByRole('button', { name: /create pre-order/i })).toBeInTheDocument();
    });

    it('should navigate to create page on button click', async () => {
      const user = userEvent.setup();
      render(<PreOrdersPage />, { wrapper });

      await user.click(screen.getByRole('button', { name: /create pre-order/i }));
      expect(mockNavigateToAdmin).toHaveBeenCalledWith('crm/pre-orders/new');
    });
  });

  describe('Stats Cards', () => {
    it('should display all three stats cards', () => {
      render(<PreOrdersPage />, { wrapper });
      expect(screen.getByText('Pending Orders')).toBeInTheDocument();
      expect(screen.getByText('Pending Value')).toBeInTheDocument();
      expect(screen.getByText('Converted')).toBeInTheDocument();
    });

    it('should calculate correct stats from pre-orders', () => {
      (usePreOrders as ReturnType<typeof vi.fn>).mockReturnValue({
        data: mockPreOrders,
        isLoading: false,
      });

      render(<PreOrdersPage />, { wrapper });

      // 1 pending order (PO-001)
      const pendingCard = screen.getByText('Pending Orders').closest('[class*="card"]')!;
      expect(within(pendingCard).getByText('1')).toBeInTheDocument();

      // 1 converted order (PO-002) — use the stats card title (CardTitle)
      const convertedCardTitle = screen.getByText('Converted', { selector: 'h3' });
      const convertedCard = convertedCardTitle.closest('[class*="card"]')!;
      expect(within(convertedCard).getByText('1')).toBeInTheDocument();
    });
  });

  describe('Expected Date Column', () => {
    it('should display formatted expected_date when present', () => {
      (usePreOrders as ReturnType<typeof vi.fn>).mockReturnValue({
        data: [mockPreOrders[0]], // has expected_date: '2026-04-15'
        isLoading: false,
      });

      render(<PreOrdersPage />, { wrapper });

      // The expected date cell should show a formatted date, not "-"
      const rows = screen.getAllByRole('row');
      const cells = within(rows[1]).getAllByRole('cell');
      // Expected Date is the 4th column (index 3)
      // Use regex to account for timezone differences (Apr 14 or Apr 15)
      expect(cells[3].textContent).toMatch(/Apr 1[45], 2026/);
    });

    it('should display dash when expected_date is null', () => {
      (usePreOrders as ReturnType<typeof vi.fn>).mockReturnValue({
        data: [mockPreOrders[1]], // has expected_date: null
        isLoading: false,
      });

      render(<PreOrdersPage />, { wrapper });

      // The expected date cell should show "-"
      const rows = screen.getAllByRole('row');
      // Row 0 is header, row 1 is data
      const cells = within(rows[1]).getAllByRole('cell');
      // Expected Date is the 4th column (index 3)
      expect(cells[3]).toHaveTextContent('-');
    });
  });

  describe('Search Functionality', () => {
    it('should render search input', () => {
      render(<PreOrdersPage />, { wrapper });
      expect(screen.getByPlaceholderText('Search pre-orders...')).toBeInTheDocument();
    });

    it('should filter pre-orders by PO number', async () => {
      const user = userEvent.setup();

      (usePreOrders as ReturnType<typeof vi.fn>).mockReturnValue({
        data: mockPreOrders,
        isLoading: false,
      });

      render(<PreOrdersPage />, { wrapper });

      const searchInput = screen.getByPlaceholderText('Search pre-orders...');
      await user.type(searchInput, 'PO-001');

      await waitFor(() => {
        expect(screen.getByText('PO-001')).toBeInTheDocument();
        expect(screen.queryByText('PO-002')).not.toBeInTheDocument();
      });
    });

    it('should filter pre-orders by client name', async () => {
      const user = userEvent.setup();

      (usePreOrders as ReturnType<typeof vi.fn>).mockReturnValue({
        data: mockPreOrders,
        isLoading: false,
      });

      render(<PreOrdersPage />, { wrapper });

      const searchInput = screen.getByPlaceholderText('Search pre-orders...');
      await user.type(searchInput, 'Alice');

      await waitFor(() => {
        expect(screen.getByText('Alice Corp')).toBeInTheDocument();
        expect(screen.queryByText('Bob LLC')).not.toBeInTheDocument();
      });
    });
  });

  describe('Status Filter', () => {
    it('should render filter button', () => {
      render(<PreOrdersPage />, { wrapper });
      expect(screen.getByRole('button', { name: /filter/i })).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should show skeleton rows when loading', () => {
      (usePreOrders as ReturnType<typeof vi.fn>).mockReturnValue({
        data: undefined,
        isLoading: true,
      });

      render(<PreOrdersPage />, { wrapper });

      // Should have 5 skeleton rows (each with skeleton cells)
      const skeletons = screen.getAllByTestId ? [] : [];
      // Check by looking for Skeleton elements (they don't have specific test IDs)
      const rows = screen.getAllByRole('row');
      // 1 header row + 5 skeleton rows = 6
      expect(rows.length).toBe(6);
    });
  });

  describe('Empty State', () => {
    it('should show empty message when no pre-orders exist', () => {
      (usePreOrders as ReturnType<typeof vi.fn>).mockReturnValue({
        data: [],
        isLoading: false,
      });

      render(<PreOrdersPage />, { wrapper });
      expect(screen.getByText('No pre-orders found.')).toBeInTheDocument();
    });
  });

  describe('Table Row Navigation', () => {
    it('should navigate to detail page on row click', async () => {
      const user = userEvent.setup();

      (usePreOrders as ReturnType<typeof vi.fn>).mockReturnValue({
        data: [mockPreOrders[0]],
        isLoading: false,
      });

      render(<PreOrdersPage />, { wrapper });

      const row = screen.getByText('PO-001').closest('tr')!;
      await user.click(row);

      expect(mockNavigateToAdmin).toHaveBeenCalledWith('crm/pre-orders/po-1');
    });
  });

  describe('Convert to Invoice', () => {
    it('should open ConvertPreOrderDialog when clicking Convert action', async () => {
      const user = userEvent.setup();

      (usePreOrders as ReturnType<typeof vi.fn>).mockReturnValue({
        data: [mockPreOrders[0]], // pending order
        isLoading: false,
      });

      render(<PreOrdersPage />, { wrapper });

      // Open actions menu
      const moreButton = screen.getByRole('button', { name: /open menu/i });
      await user.click(moreButton);

      // Click Convert to Invoice
      const convertOption = await screen.findByText('Convert to Invoice');
      await user.click(convertOption);

      // ConvertPreOrderDialog should now be open
      await waitFor(() => {
        expect(screen.getByTestId('convert-dialog')).toBeInTheDocument();
        expect(screen.getByText('Convert Dialog for PO-001')).toBeInTheDocument();
      });
    });

    it('should not show Convert option for non-pending orders', async () => {
      const user = userEvent.setup();

      (usePreOrders as ReturnType<typeof vi.fn>).mockReturnValue({
        data: [mockPreOrders[1]], // converted order
        isLoading: false,
      });

      render(<PreOrdersPage />, { wrapper });

      // Open actions menu
      const moreButton = screen.getByRole('button', { name: /open menu/i });
      await user.click(moreButton);

      // Wait for menu to open
      await screen.findByText('View Details');
      expect(screen.queryByText('Convert to Invoice')).not.toBeInTheDocument();
    });
  });

  describe('Cancel Order', () => {
    it('should show Cancel Order option for pending orders', async () => {
      const user = userEvent.setup();

      (usePreOrders as ReturnType<typeof vi.fn>).mockReturnValue({
        data: [mockPreOrders[0]], // pending
        isLoading: false,
      });

      render(<PreOrdersPage />, { wrapper });

      const moreButton = screen.getByRole('button', { name: /open menu/i });
      await user.click(moreButton);

      expect(await screen.findByText('Cancel Order')).toBeInTheDocument();
    });

    it('should not show Cancel Order option for non-pending orders', async () => {
      const user = userEvent.setup();

      (usePreOrders as ReturnType<typeof vi.fn>).mockReturnValue({
        data: [mockPreOrders[2]], // cancelled
        isLoading: false,
      });

      render(<PreOrdersPage />, { wrapper });

      const moreButton = screen.getByRole('button', { name: /open menu/i });
      await user.click(moreButton);

      await screen.findByText('View Details');
      expect(screen.queryByText('Cancel Order')).not.toBeInTheDocument();
    });
  });

  describe('Status Badges', () => {
    it('should render correct badges for each status', () => {
      (usePreOrders as ReturnType<typeof vi.fn>).mockReturnValue({
        data: mockPreOrders,
        isLoading: false,
      });

      render(<PreOrdersPage />, { wrapper });

      // "Pending" appears as both stats card label and badge — check badge exists in the table
      const tableBody = screen.getAllByRole('rowgroup')[1]; // tbody
      expect(within(tableBody).getByText('Pending')).toBeInTheDocument();
      expect(within(tableBody).getByText('Converted')).toBeInTheDocument();
      expect(within(tableBody).getByText('Cancelled')).toBeInTheDocument();
    });
  });
});
