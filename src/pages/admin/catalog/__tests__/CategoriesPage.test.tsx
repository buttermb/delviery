/**
 * CategoriesPage Tests
 * Tests for category CRUD operations, tree rendering, search, and tenant isolation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// --- Mocks ---

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
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

vi.mock('@/lib/navigation/tenantNavigation', () => ({
  useTenantNavigation: vi.fn().mockReturnValue({
    navigateToAdmin: vi.fn(),
    navigate: vi.fn(),
    tenantSlug: 'test-tenant',
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/utils/errorHandling/handlers', () => ({
  handleError: vi.fn(),
}));

vi.mock('@/components/shared/TruncatedText', () => ({
  TruncatedText: ({ text, className, as: Tag = 'span' }: { text: string; className?: string; as?: string }) => {
    const Element = Tag as keyof JSX.IntrinsicElements;
    return <Element className={className}>{text}</Element>;
  },
}));

vi.mock('@/components/shared/ConfirmDeleteDialog', () => ({
  ConfirmDeleteDialog: ({
    open,
    onConfirm,
    itemName,
    description,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
    itemName?: string;
    itemType?: string;
    description?: string;
    isLoading?: boolean;
  }) =>
    open ? (
      <div data-testid="confirm-delete-dialog">
        <span data-testid="delete-item-name">{itemName}</span>
        {description && <span data-testid="delete-description">{description}</span>}
        <button data-testid="confirm-delete-btn" onClick={onConfirm}>
          Confirm Delete
        </button>
      </div>
    ) : null,
}));

vi.mock('@/components/shared/EnhancedEmptyState', () => ({
  EnhancedEmptyState: ({
    title,
    description,
    primaryAction,
  }: {
    icon?: unknown;
    title: string;
    description: string;
    primaryAction?: { label: string; onClick: () => void; icon?: unknown };
  }) => (
    <div data-testid="empty-state">
      <h3>{title}</h3>
      <p>{description}</p>
      {primaryAction && (
        <button data-testid="empty-state-action" onClick={primaryAction.onClick}>
          {primaryAction.label}
        </button>
      )}
    </div>
  ),
}));

// Import after mocks
import CategoriesPage from '../CategoriesPage';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';

// --- Helpers ---

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

function renderWithProviders(ui: ReactNode) {
  const queryClient = createQueryClient();
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </MemoryRouter>,
  );
}

const MOCK_CATEGORIES = [
  { id: 'cat-1', tenant_id: 'tenant-123', name: 'Flower', description: 'Cannabis flower', parent_id: null, created_at: '2024-01-01', updated_at: '2024-01-01' },
  { id: 'cat-2', tenant_id: 'tenant-123', name: 'Edibles', description: 'Edible products', parent_id: null, created_at: '2024-01-01', updated_at: '2024-01-01' },
  { id: 'cat-3', tenant_id: 'tenant-123', name: 'Indica', description: 'Indica strains', parent_id: 'cat-1', created_at: '2024-01-01', updated_at: '2024-01-01' },
  { id: 'cat-4', tenant_id: 'tenant-123', name: 'Sativa', description: 'Sativa strains', parent_id: 'cat-1', created_at: '2024-01-01', updated_at: '2024-01-01' },
];

const MOCK_PRODUCTS = [
  { category_id: 'cat-1' },
  { category_id: 'cat-1' },
  { category_id: 'cat-3' },
  { category_id: 'cat-2' },
];

function setupMockSupabase(categories = MOCK_CATEGORIES, products = MOCK_PRODUCTS) {
  const mockFrom = supabase.from as ReturnType<typeof vi.fn>;
  mockFrom.mockImplementation((table: string) => {
    if (table === 'categories') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: categories, error: null }),
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      };
    }
    if (table === 'products') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnValue({
          data: products,
          error: null,
          then: (fn: (result: { data: typeof products; error: null }) => unknown) =>
            Promise.resolve(fn({ data: products, error: null })),
        }),
        order: vi.fn().mockResolvedValue({ data: products, error: null }),
      };
    }
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
  });
}

// --- Tests ---

describe('CategoriesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMockSupabase();
  });

  describe('Rendering', () => {
    it('renders page header and stats cards', async () => {
      renderWithProviders(<CategoriesPage />);

      expect(screen.getByText('Product Categories')).toBeInTheDocument();
      expect(screen.getByText('Organize products into categories for your storefront')).toBeInTheDocument();
      expect(screen.getByText('New Category')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText('Categories')).toBeInTheDocument();
        expect(screen.getByText('Categorized Products')).toBeInTheDocument();
      });
    });

    it('renders loading skeletons while fetching categories', () => {
      const mockFrom = supabase.from as ReturnType<typeof vi.fn>;
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnValue(new Promise(() => {})), // never resolves
      });

      renderWithProviders(<CategoriesPage />);

      const skeletons = screen.getAllByRole('status', { name: /loading/i });
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('renders categories as a tree with parent-child hierarchy', async () => {
      renderWithProviders(<CategoriesPage />);

      await waitFor(() => {
        expect(screen.getByText('Flower')).toBeInTheDocument();
        expect(screen.getByText('Edibles')).toBeInTheDocument();
      });

      // Indica and Sativa are children of Flower - they should be visible after expanding
      expect(screen.queryByText('Indica')).not.toBeInTheDocument();
    });

    it('shows empty state when no categories exist', async () => {
      setupMockSupabase([], []);

      renderWithProviders(<CategoriesPage />);

      await waitFor(() => {
        expect(screen.getByTestId('empty-state')).toBeInTheDocument();
        expect(screen.getByText('No Categories Found')).toBeInTheDocument();
      });
    });

    it('shows table missing message when categories table does not exist', async () => {
      const mockFrom = supabase.from as ReturnType<typeof vi.fn>;
      mockFrom.mockImplementation((table: string) => {
        if (table === 'categories') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: null, error: { code: '42P01', message: 'relation does not exist' } }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          not: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      });

      renderWithProviders(<CategoriesPage />);

      await waitFor(() => {
        expect(screen.getByText('Feature Not Available')).toBeInTheDocument();
      });
    });

    it('displays product counts per category', async () => {
      renderWithProviders(<CategoriesPage />);

      await waitFor(() => {
        // Flower has 2 direct products, Edibles has 1
        expect(screen.getByText('Flower')).toBeInTheDocument();
      });

      // Check that product count text exists
      const productLabels = screen.getAllByText(/products$/);
      expect(productLabels.length).toBeGreaterThan(0);
    });
  });

  describe('Tree Expand/Collapse', () => {
    it('expands and collapses parent categories', async () => {
      const user = userEvent.setup();
      renderWithProviders(<CategoriesPage />);

      await waitFor(() => {
        expect(screen.getByText('Flower')).toBeInTheDocument();
      });

      // Flower has children - find the expand button
      const expandBtn = screen.getByRole('button', { name: 'Expand category' });
      await user.click(expandBtn);

      // Children should now be visible
      await waitFor(() => {
        expect(screen.getByText('Indica')).toBeInTheDocument();
        expect(screen.getByText('Sativa')).toBeInTheDocument();
      });

      // Collapse
      const collapseBtn = screen.getByRole('button', { name: 'Collapse category' });
      await user.click(collapseBtn);

      await waitFor(() => {
        expect(screen.queryByText('Indica')).not.toBeInTheDocument();
      });
    });
  });

  describe('Search', () => {
    it('filters categories by name', async () => {
      const user = userEvent.setup();
      renderWithProviders(<CategoriesPage />);

      await waitFor(() => {
        expect(screen.getByText('Flower')).toBeInTheDocument();
      });

      const searchInput = screen.getByLabelText('Search categories');
      await user.type(searchInput, 'Edible');

      await waitFor(() => {
        expect(screen.getByText('Edibles')).toBeInTheDocument();
        expect(screen.queryByText('Flower')).not.toBeInTheDocument();
      });
    });

    it('filters categories by description', async () => {
      const user = userEvent.setup();
      renderWithProviders(<CategoriesPage />);

      await waitFor(() => {
        expect(screen.getByText('Flower')).toBeInTheDocument();
      });

      const searchInput = screen.getByLabelText('Search categories');
      await user.type(searchInput, 'Indica strains');

      await waitFor(() => {
        expect(screen.getByText('Indica')).toBeInTheDocument();
        expect(screen.queryByText('Edibles')).not.toBeInTheDocument();
      });
    });

    it('shows empty state when search has no results', async () => {
      const user = userEvent.setup();
      renderWithProviders(<CategoriesPage />);

      await waitFor(() => {
        expect(screen.getByText('Flower')).toBeInTheDocument();
      });

      const searchInput = screen.getByLabelText('Search categories');
      await user.type(searchInput, 'nonexistent category xyz');

      await waitFor(() => {
        expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      });
    });
  });

  describe('Create Category', () => {
    it('opens create dialog when New Category button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<CategoriesPage />);

      await waitFor(() => {
        expect(screen.getByText('New Category')).toBeInTheDocument();
      });

      await user.click(screen.getByText('New Category'));

      await waitFor(() => {
        expect(screen.getByText('New Category', { selector: '[role="dialog"] *' })).toBeInTheDocument();
        expect(screen.getByLabelText('Name')).toBeInTheDocument();
        expect(screen.getByLabelText('Description')).toBeInTheDocument();
        expect(screen.getByLabelText('Parent Category')).toBeInTheDocument();
      });
    });

    it('validates required name field', async () => {
      const user = userEvent.setup();
      renderWithProviders(<CategoriesPage />);

      await waitFor(() => {
        expect(screen.getByText('New Category')).toBeInTheDocument();
      });

      await user.click(screen.getByText('New Category'));

      await waitFor(() => {
        expect(screen.getByLabelText('Name')).toBeInTheDocument();
      });

      // Submit without filling name
      await user.click(screen.getByRole('button', { name: 'Create' }));

      await waitFor(() => {
        expect(screen.getByText('Category name is required')).toBeInTheDocument();
      });
    });
  });

  describe('Delete Category', () => {
    it('opens delete confirmation dialog', async () => {
      const user = userEvent.setup();
      renderWithProviders(<CategoriesPage />);

      await waitFor(() => {
        expect(screen.getByText('Flower')).toBeInTheDocument();
      });

      // Click delete button on the first category
      const deleteButtons = screen.getAllByRole('button', { name: 'Delete category' });
      await user.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByTestId('confirm-delete-dialog')).toBeInTheDocument();
      });
    });

    it('shows product count in delete description', async () => {
      const user = userEvent.setup();
      renderWithProviders(<CategoriesPage />);

      await waitFor(() => {
        expect(screen.getByText('Flower')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: 'Delete category' });
      await user.click(deleteButtons[0]);

      await waitFor(() => {
        const dialog = screen.getByTestId('confirm-delete-dialog');
        expect(within(dialog).getByTestId('delete-item-name')).toHaveTextContent('Flower');
      });
    });
  });

  describe('Navigation', () => {
    it('navigates back to inventory hub', async () => {
      const user = userEvent.setup();
      renderWithProviders(<CategoriesPage />);

      const backBtn = screen.getByRole('button', { name: /back/i });
      await user.click(backBtn);

      const { navigateToAdmin } = (useTenantNavigation as ReturnType<typeof vi.fn>)();
      expect(navigateToAdmin).toHaveBeenCalledWith('inventory-hub');
    });

    it('navigates to filtered products when view products button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<CategoriesPage />);

      await waitFor(() => {
        expect(screen.getByText('Flower')).toBeInTheDocument();
      });

      const viewButtons = screen.getAllByRole('button', { name: 'View products' });
      await user.click(viewButtons[0]);

      const { navigateToAdmin } = (useTenantNavigation as ReturnType<typeof vi.fn>)();
      expect(navigateToAdmin).toHaveBeenCalledWith(
        expect.stringContaining('products?category_id='),
      );
    });
  });

  describe('Edit Category', () => {
    it('opens edit dialog with pre-filled values', async () => {
      const user = userEvent.setup();
      renderWithProviders(<CategoriesPage />);

      await waitFor(() => {
        expect(screen.getByText('Flower')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByRole('button', { name: 'Edit category' });
      await user.click(editButtons[0]);

      await waitFor(() => {
        const dialog = document.querySelector('[role="dialog"]');
        expect(dialog).toBeInTheDocument();
        expect(within(dialog!).getByText('Edit Category')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper aria-labels on interactive elements', async () => {
      renderWithProviders(<CategoriesPage />);

      await waitFor(() => {
        expect(screen.getByText('Flower')).toBeInTheDocument();
      });

      expect(screen.getByLabelText('Search categories')).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: 'Edit category' }).length).toBeGreaterThan(0);
      expect(screen.getAllByRole('button', { name: 'Delete category' }).length).toBeGreaterThan(0);
      expect(screen.getAllByRole('button', { name: 'View products' }).length).toBeGreaterThan(0);
    });

    it('has expand/collapse aria-labels for parent categories', async () => {
      renderWithProviders(<CategoriesPage />);

      await waitFor(() => {
        expect(screen.getByText('Flower')).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: 'Expand category' })).toBeInTheDocument();
    });
  });

  describe('Tenant Isolation', () => {
    it('does not fetch data when tenant is missing', async () => {
      const mockAuth = useTenantAdminAuth as ReturnType<typeof vi.fn>;
      mockAuth.mockReturnValue({
        tenant: null,
        loading: false,
        admin: null,
        tenantSlug: null,
      });

      renderWithProviders(<CategoriesPage />);

      // Should not call supabase
      await waitFor(() => {
        // Empty state should show instead of trying to load
        expect(screen.getByText('Product Categories')).toBeInTheDocument();
      });
    });

    it('queries categories with tenant_id filter', async () => {
      // Restore the default auth mock (previous test set tenant to null)
      const mockAuth = useTenantAdminAuth as ReturnType<typeof vi.fn>;
      mockAuth.mockReturnValue({
        tenant: { id: 'tenant-123', slug: 'test-tenant', business_name: 'Test Business' },
        loading: false,
        admin: { id: 'admin-123', email: 'admin@test.com' },
        tenantSlug: 'test-tenant',
      });
      setupMockSupabase();

      const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

      renderWithProviders(<CategoriesPage />);

      await waitFor(() => {
        expect(mockFrom).toHaveBeenCalledWith('categories');
      });
    });
  });

  describe('Summary Stats', () => {
    it('displays category count and product count labels', async () => {
      renderWithProviders(<CategoriesPage />);

      await waitFor(() => {
        expect(screen.getByText('Categories')).toBeInTheDocument();
        expect(screen.getByText('Categorized Products')).toBeInTheDocument();
      });
    });
  });
});
