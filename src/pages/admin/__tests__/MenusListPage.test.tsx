/**
 * MenusListPage Tests
 * Tests for menu listing, filtering, stats, keyboard shortcuts, and error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock dependencies before importing the component
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
  },
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: vi.fn().mockReturnValue({
    tenant: { id: 'tenant-123', slug: 'test-tenant', business_name: 'Test Business' },
    loading: false,
    tenantSlug: 'test-tenant',
  }),
}));

const mockUseDisposableMenus = vi.fn();
vi.mock('@/hooks/useDisposableMenus', () => ({
  useDisposableMenus: (...args: unknown[]) => mockUseDisposableMenus(...args),
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

vi.mock('@/utils/safeStorage', () => ({
  safeStorage: {
    getItem: vi.fn().mockReturnValue(null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

vi.mock('@/components/admin/disposable-menus/CreateMenuDialog', () => ({
  CreateMenuDialog: ({ open }: { open: boolean; onOpenChange: (open: boolean) => void }) =>
    open ? <div data-testid="create-menu-dialog">Create Menu Dialog</div> : null,
}));

// Import after mocks
import { MenusListPage } from '../MenusListPage';

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={createQueryClient()}>
    <MemoryRouter initialEntries={['/test-tenant/admin/menus']}>
      {children}
    </MemoryRouter>
  </QueryClientProvider>
);

const mockMenus = [
  {
    id: 'menu-1',
    tenant_id: 'tenant-123',
    name: 'Daily Special',
    status: 'active',
    encrypted_url_token: 'token-1',
    access_code: 'CODE1',
    description: 'Fresh daily specials',
    is_encrypted: true,
    device_locking_enabled: false,
    security_settings: {},
    expiration_date: null,
    never_expires: true,
    created_at: '2025-01-01T00:00:00Z',
    view_count: 150,
    customer_count: 10,
    order_count: 25,
    total_revenue: 1250.50,
    disposable_menu_products: [{ id: 'p1' }, { id: 'p2' }],
  },
  {
    id: 'menu-2',
    tenant_id: 'tenant-123',
    name: 'VIP Menu',
    status: 'active',
    encrypted_url_token: 'token-2',
    access_code: 'VIP2',
    description: 'Exclusive VIP products',
    is_encrypted: true,
    device_locking_enabled: true,
    security_settings: {},
    expiration_date: null,
    never_expires: true,
    created_at: '2025-02-01T00:00:00Z',
    view_count: 50,
    customer_count: 5,
    order_count: 10,
    total_revenue: 800,
    disposable_menu_products: [{ id: 'p3' }],
  },
  {
    id: 'menu-3',
    tenant_id: 'tenant-123',
    name: 'Old Menu',
    status: 'soft_burned',
    encrypted_url_token: 'token-3',
    access_code: null,
    description: null,
    is_encrypted: false,
    device_locking_enabled: false,
    security_settings: {},
    expiration_date: '2024-12-31T00:00:00Z',
    never_expires: false,
    created_at: '2024-06-01T00:00:00Z',
    view_count: 300,
    customer_count: 20,
    order_count: 50,
    total_revenue: 5000,
    disposable_menu_products: [],
  },
];

describe('MenusListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseDisposableMenus.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
  });

  describe('Page Header', () => {
    it('should render page title', () => {
      render(<MenusListPage />, { wrapper });
      expect(screen.getByText('Product Menus')).toBeInTheDocument();
    });

    it('should render page description', () => {
      render(<MenusListPage />, { wrapper });
      expect(screen.getByText('Create and manage secure product menus for your customers.')).toBeInTheDocument();
    });

    it('should render Create Menu button', () => {
      render(<MenusListPage />, { wrapper });
      const createButtons = screen.getAllByRole('button', { name: /create menu/i });
      expect(createButtons.length).toBeGreaterThan(0);
    });
  });

  describe('Stats Cards', () => {
    it('should display all stats cards', () => {
      mockUseDisposableMenus.mockReturnValue({
        data: mockMenus,
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      });

      render(<MenusListPage />, { wrapper });

      expect(screen.getByText('Active Menus')).toBeInTheDocument();
      expect(screen.getByText('Total Views')).toBeInTheDocument();
      expect(screen.getByText('Total Orders')).toBeInTheDocument();
      expect(screen.getByText('Total Revenue')).toBeInTheDocument();
    });

    it('should calculate correct active menu count', () => {
      mockUseDisposableMenus.mockReturnValue({
        data: mockMenus,
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      });

      render(<MenusListPage />, { wrapper });

      // 2 active menus (menu-1 and menu-2)
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('3 total menus')).toBeInTheDocument();
    });

    it('should calculate correct total views', () => {
      mockUseDisposableMenus.mockReturnValue({
        data: mockMenus,
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      });

      render(<MenusListPage />, { wrapper });

      // 150 + 50 + 300 = 500
      expect(screen.getByText('500')).toBeInTheDocument();
    });

    it('should calculate correct total orders', () => {
      mockUseDisposableMenus.mockReturnValue({
        data: mockMenus,
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      });

      render(<MenusListPage />, { wrapper });

      // 25 + 10 + 50 = 85
      expect(screen.getByText('85')).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should display loading skeletons when data is loading', () => {
      mockUseDisposableMenus.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        refetch: vi.fn(),
      });

      render(<MenusListPage />, { wrapper });

      const skeletons = screen.getAllByRole('status');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('Error State', () => {
    it('should display error message when query fails', () => {
      mockUseDisposableMenus.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        refetch: vi.fn(),
      });

      render(<MenusListPage />, { wrapper });

      expect(screen.getByText('Failed to load menus')).toBeInTheDocument();
      expect(screen.getByText('An unexpected error occurred while loading your menus.')).toBeInTheDocument();
    });

    it('should display Try Again button on error', () => {
      const mockRefetch = vi.fn();
      mockUseDisposableMenus.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        refetch: mockRefetch,
      });

      render(<MenusListPage />, { wrapper });

      const retryButton = screen.getByRole('button', { name: /try again/i });
      expect(retryButton).toBeInTheDocument();
    });

    it('should call refetch when Try Again is clicked', async () => {
      const user = userEvent.setup();
      const mockRefetch = vi.fn();
      mockUseDisposableMenus.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        refetch: mockRefetch,
      });

      render(<MenusListPage />, { wrapper });

      await user.click(screen.getByRole('button', { name: /try again/i }));
      expect(mockRefetch).toHaveBeenCalled();
    });
  });

  describe('Empty State', () => {
    it('should display empty state when no menus exist', () => {
      render(<MenusListPage />, { wrapper });

      expect(screen.getByText('No menus yet')).toBeInTheDocument();
      expect(screen.getByText('Create disposable menus to share with customers')).toBeInTheDocument();
    });

    it('should display Create Menu action in empty state', () => {
      render(<MenusListPage />, { wrapper });

      // The empty state should have a Create Menu button
      const createButtons = screen.getAllByText('Create Menu');
      expect(createButtons.length).toBeGreaterThanOrEqual(1);
    });

    it('should display filtered empty state when search has no results', async () => {
      const user = userEvent.setup();
      mockUseDisposableMenus.mockReturnValue({
        data: mockMenus,
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      });

      render(<MenusListPage />, { wrapper });

      const searchInput = screen.getByLabelText('Search menus');
      await user.type(searchInput, 'nonexistent menu xyz');

      await waitFor(() => {
        expect(screen.getByText('No Menus Found')).toBeInTheDocument();
        expect(screen.getByText('No menus match your current filters.')).toBeInTheDocument();
      });
    });
  });

  describe('Search', () => {
    it('should render search input', () => {
      render(<MenusListPage />, { wrapper });

      expect(screen.getByPlaceholderText('Search menus...')).toBeInTheDocument();
    });

    it('should filter menus by name', async () => {
      const user = userEvent.setup();
      mockUseDisposableMenus.mockReturnValue({
        data: mockMenus,
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      });

      render(<MenusListPage />, { wrapper });

      const searchInput = screen.getByPlaceholderText('Search menus...');
      await user.type(searchInput, 'VIP');

      await waitFor(() => {
        expect(screen.getByText('VIP Menu')).toBeInTheDocument();
        expect(screen.queryByText('Daily Special')).not.toBeInTheDocument();
      });
    });

    it('should filter menus by description', async () => {
      const user = userEvent.setup();
      mockUseDisposableMenus.mockReturnValue({
        data: mockMenus,
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      });

      render(<MenusListPage />, { wrapper });

      const searchInput = screen.getByPlaceholderText('Search menus...');
      await user.type(searchInput, 'fresh daily');

      await waitFor(() => {
        expect(screen.getByText('Daily Special')).toBeInTheDocument();
        expect(screen.queryByText('VIP Menu')).not.toBeInTheDocument();
      });
    });
  });

  describe('Status Filter', () => {
    it('should render status filter', () => {
      render(<MenusListPage />, { wrapper });

      expect(screen.getByText('All Statuses')).toBeInTheDocument();
    });
  });

  describe('View Mode Toggle', () => {
    it('should render grid and list view buttons', () => {
      render(<MenusListPage />, { wrapper });

      expect(screen.getByRole('button', { name: /grid view/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /list view/i })).toBeInTheDocument();
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should open create dialog on Cmd+N', async () => {
      const user = userEvent.setup();
      render(<MenusListPage />, { wrapper });

      await user.keyboard('{Meta>}n{/Meta}');

      await waitFor(() => {
        expect(screen.getByTestId('create-menu-dialog')).toBeInTheDocument();
      });
    });

    it('should open create dialog on Ctrl+N', async () => {
      const user = userEvent.setup();
      render(<MenusListPage />, { wrapper });

      await user.keyboard('{Control>}n{/Control}');

      await waitFor(() => {
        expect(screen.getByTestId('create-menu-dialog')).toBeInTheDocument();
      });
    });
  });

  describe('Create Menu Dialog', () => {
    it('should open dialog when Create Menu button is clicked', async () => {
      const user = userEvent.setup();
      render(<MenusListPage />, { wrapper });

      const createButtons = screen.getAllByRole('button', { name: /create menu/i });
      await user.click(createButtons[0]);

      await waitFor(() => {
        expect(screen.getByTestId('create-menu-dialog')).toBeInTheDocument();
      });
    });
  });

  describe('Menu List', () => {
    it('should display menu cards when data is loaded', () => {
      mockUseDisposableMenus.mockReturnValue({
        data: mockMenus,
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      });

      render(<MenusListPage />, { wrapper });

      expect(screen.getByText('Daily Special')).toBeInTheDocument();
      expect(screen.getByText('VIP Menu')).toBeInTheDocument();
      expect(screen.getByText('Old Menu')).toBeInTheDocument();
    });
  });

  describe('Query Configuration', () => {
    it('should pass tenant ID to useDisposableMenus', () => {
      render(<MenusListPage />, { wrapper });

      expect(mockUseDisposableMenus).toHaveBeenCalledWith('tenant-123');
    });
  });
});
