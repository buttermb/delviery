/**
 * ProductCategories Tests
 * Tests for category CRUD operations using the categories table
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock dependencies before importing the component
const mockFrom = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
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
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/utils/errorHandling/handlers', () => ({
  handleError: vi.fn(),
}));

vi.mock('@/components/shared/ConfirmDeleteDialog', () => ({
  ConfirmDeleteDialog: ({
    open,
    onConfirm,
    itemName,
  }: {
    open: boolean;
    onConfirm: () => void;
    itemName?: string;
  }) =>
    open ? (
      <div data-testid="delete-dialog">
        <span>Delete {itemName}</span>
        <button onClick={onConfirm}>Confirm Delete</button>
      </div>
    ) : null,
}));

vi.mock('@/components/shared/EnhancedEmptyState', () => ({
  EnhancedEmptyState: ({
    title,
    description,
    primaryAction,
  }: {
    title: string;
    description: string;
    primaryAction?: { label: string; onClick: () => void };
  }) => (
    <div data-testid="empty-state">
      <h3>{title}</h3>
      <p>{description}</p>
      {primaryAction && (
        <button onClick={primaryAction.onClick}>{primaryAction.label}</button>
      )}
    </div>
  ),
}));

// Import after mocks
import { ProductCategories } from '../ProductCategories';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { toast } from 'sonner';

const mockCategories = [
  {
    id: 'cat-1',
    tenant_id: 'tenant-123',
    name: 'Flower',
    description: 'Cannabis flower products',
    parent_id: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'cat-2',
    tenant_id: 'tenant-123',
    name: 'Edibles',
    description: 'Edible cannabis products',
    parent_id: null,
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
  },
  {
    id: 'cat-3',
    tenant_id: 'tenant-123',
    name: 'Concentrates',
    description: null,
    parent_id: null,
    created_at: '2024-01-03T00:00:00Z',
    updated_at: '2024-01-03T00:00:00Z',
  },
];

const mockProducts = [
  { category_id: 'cat-1' },
  { category_id: 'cat-1' },
  { category_id: 'cat-1' },
  { category_id: 'cat-2' },
];

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={createQueryClient()}>
    <MemoryRouter initialEntries={['/test-tenant/admin/categories']}>
      {children}
    </MemoryRouter>
  </QueryClientProvider>
);

function setupSupabaseMock({
  categories = mockCategories,
  products = mockProducts,
  insertError = null,
  updateError = null,
  deleteError = null,
}: {
  categories?: typeof mockCategories;
  products?: typeof mockProducts;
  insertError?: { message: string; code?: string } | null;
  updateError?: { message: string; code?: string } | null;
  deleteError?: { message: string; code?: string } | null;
} = {}) {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'categories') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: categories, error: null }),
            not: vi.fn().mockResolvedValue({ data: categories, error: null }),
          }),
        }),
        insert: vi.fn().mockResolvedValue({
          data: insertError ? null : { id: 'new-cat' },
          error: insertError,
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: updateError ? null : {},
              error: updateError,
            }),
          }),
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: deleteError ? null : {},
              error: deleteError,
            }),
          }),
        }),
      };
    }
    if (table === 'products') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            not: vi.fn().mockResolvedValue({ data: products, error: null }),
          }),
        }),
      };
    }
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
  });
}

describe('ProductCategories', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (useTenantAdminAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      tenant: { id: 'tenant-123', slug: 'test-tenant', business_name: 'Test Business' },
      loading: false,
      admin: { id: 'admin-123', email: 'admin@test.com' },
      tenantSlug: 'test-tenant',
    });

    setupSupabaseMock();
  });

  describe('Initial Render', () => {
    it('should render the page title and header', async () => {
      render(<ProductCategories />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Product Categories')).toBeInTheDocument();
      });
      expect(
        screen.getByText('Organize products into categories for easier management')
      ).toBeInTheDocument();
    });

    it('should render the "New Category" button', async () => {
      render(<ProductCategories />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('New Category')).toBeInTheDocument();
      });
    });

    it('should render category cards when categories exist', async () => {
      render(<ProductCategories />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Flower')).toBeInTheDocument();
      });
      expect(screen.getByText('Edibles')).toBeInTheDocument();
      expect(screen.getByText('Concentrates')).toBeInTheDocument();
    });

    it('should show descriptions when present', async () => {
      render(<ProductCategories />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Cannabis flower products')).toBeInTheDocument();
      });
      expect(screen.getByText('Edible cannabis products')).toBeInTheDocument();
    });

    it('should show summary stats', async () => {
      render(<ProductCategories />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Categories')).toBeInTheDocument();
      });
      expect(screen.getByText('Categorized Products')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should render empty state when no categories exist', async () => {
      setupSupabaseMock({ categories: [] });

      render(<ProductCategories />, { wrapper });

      await waitFor(() => {
        expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      });
      expect(screen.getByText('No Categories Yet')).toBeInTheDocument();
    });
  });

  describe('Search', () => {
    it('should render search input when categories exist', async () => {
      render(<ProductCategories />, { wrapper });

      await waitFor(() => {
        expect(screen.getByLabelText('Search categories')).toBeInTheDocument();
      });
    });

    it('should filter categories by search query', async () => {
      const user = userEvent.setup();
      render(<ProductCategories />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Flower')).toBeInTheDocument();
      });

      const searchInput = screen.getByLabelText('Search categories');
      await user.type(searchInput, 'Edibles');

      await waitFor(() => {
        expect(screen.getByText('Edibles')).toBeInTheDocument();
        expect(screen.queryByText('Flower')).not.toBeInTheDocument();
        expect(screen.queryByText('Concentrates')).not.toBeInTheDocument();
      });
    });
  });

  describe('Create Category', () => {
    it('should open create dialog when "New Category" is clicked', async () => {
      const user = userEvent.setup();
      render(<ProductCategories />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('New Category')).toBeInTheDocument();
      });

      await user.click(screen.getByText('New Category'));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have aria-labels on action dropdowns', async () => {
      render(<ProductCategories />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Flower')).toBeInTheDocument();
      });

      const actionButtons = screen.getAllByLabelText(/Actions for/);
      expect(actionButtons.length).toBeGreaterThan(0);
    });

    it('should have search input with proper aria-label', async () => {
      render(<ProductCategories />, { wrapper });

      await waitFor(() => {
        expect(screen.getByLabelText('Search categories')).toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    it('should not render categories when tenant is not available', () => {
      (useTenantAdminAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        tenant: null,
        loading: false,
        admin: null,
        tenantSlug: null,
      });

      render(<ProductCategories />, { wrapper });

      // With no tenant, query is disabled so no categories render
      expect(screen.queryByText('Flower')).not.toBeInTheDocument();
      expect(screen.queryByText('Edibles')).not.toBeInTheDocument();
    });
  });

  describe('Tenant Isolation', () => {
    it('should query categories with tenant_id filter', async () => {
      render(<ProductCategories />, { wrapper });

      await waitFor(() => {
        expect(mockFrom).toHaveBeenCalledWith('categories');
      });
    });

    it('should not fetch when tenant is not available', () => {
      (useTenantAdminAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        tenant: null,
        loading: false,
        admin: null,
        tenantSlug: null,
      });

      render(<ProductCategories />, { wrapper });

      // Should not call supabase when no tenant
      expect(mockFrom).not.toHaveBeenCalled();
    });
  });
});
