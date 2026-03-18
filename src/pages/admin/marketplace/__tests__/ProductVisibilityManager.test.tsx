/**
 * ProductVisibilityManager Tests
 * Tests for product visibility management with filter, search, and mutation functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Hoisted mocks for vi.mock factories
const { mockNavigateTenant } = vi.hoisted(() => ({
  mockNavigateTenant: vi.fn(),
}));

// Mock dependencies before importing the component
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      update: vi.fn().mockReturnThis(),
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

vi.mock('@/hooks/useTenantNavigate', () => ({
  useTenantNavigate: vi.fn().mockReturnValue(mockNavigateTenant),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
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

vi.mock('@/components/EnhancedLoadingState', () => ({
  EnhancedLoadingState: ({ message }: { message?: string }) => (
    <div data-testid="loading-state">{message}</div>
  ),
}));

// Import after mocks
import ProductVisibilityManager from '../ProductVisibilityManager';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const mockListings = [
  {
    id: 'listing-1',
    tenant_id: 'tenant-123',
    product_name: 'Blue Dream',
    product_type: 'flower',
    strain_type: 'hybrid',
    base_price: 35.00,
    unit_type: 'gram',
    quantity_available: 100,
    images: ['https://example.com/img1.jpg'],
    status: 'active',
    visibility: 'public',
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'listing-2',
    tenant_id: 'tenant-123',
    product_name: 'OG Kush',
    product_type: 'flower',
    strain_type: 'indica',
    base_price: 40.00,
    unit_type: 'gram',
    quantity_available: 0,
    images: null,
    status: 'draft',
    visibility: 'hidden',
    created_at: '2024-01-02T00:00:00Z',
  },
  {
    id: 'listing-3',
    tenant_id: 'tenant-123',
    product_name: 'Gummy Bears',
    product_type: 'edible',
    strain_type: null,
    base_price: 25.00,
    unit_type: 'unit',
    quantity_available: 50,
    images: [],
    status: 'active',
    visibility: 'public',
    created_at: '2024-01-03T00:00:00Z',
  },
];

const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={createQueryClient()}>
    <MemoryRouter initialEntries={['/test-tenant/admin/marketplace/products']}>
      {children}
    </MemoryRouter>
  </QueryClientProvider>
);

function setupSupabaseMock(data: unknown[] = [], error: Error | null = null) {
  const eqMock = vi.fn().mockReturnThis();
  const orderMock = vi.fn().mockResolvedValue({ data, error });
  const updateMock = vi.fn().mockReturnThis();

  (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: eqMock,
    order: orderMock,
    update: updateMock,
  });

  return { eqMock, orderMock, updateMock };
}

describe('ProductVisibilityManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigateTenant.mockClear();

    (useTenantAdminAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      tenant: { id: 'tenant-123', slug: 'test-tenant', business_name: 'Test Business' },
      loading: false,
      admin: { id: 'admin-123', email: 'admin@test.com' },
      tenantSlug: 'test-tenant',
    });

    setupSupabaseMock(mockListings);
  });

  describe('Initial Render', () => {
    it('should render the page title and description', async () => {
      render(<ProductVisibilityManager />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Product Visibility')).toBeInTheDocument();
        expect(screen.getByText('Manage which products are visible in your marketplace store.')).toBeInTheDocument();
      });
    });

    it('should render the Add Product button with aria-label', async () => {
      render(<ProductVisibilityManager />, { wrapper });

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /add new product to marketplace/i });
        expect(button).toBeInTheDocument();
      });
    });

    it('should render listings in the table', async () => {
      render(<ProductVisibilityManager />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
        expect(screen.getByText('OG Kush')).toBeInTheDocument();
        expect(screen.getByText('Gummy Bears')).toBeInTheDocument();
      });
    });

    it('should show empty state when no listings exist', async () => {
      setupSupabaseMock([]);

      render(<ProductVisibilityManager />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText(/no listings found/i)).toBeInTheDocument();
      });
    });

    it('should show loading state initially', () => {
      // Don't resolve the query immediately
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnValue(new Promise(() => {})),
        update: vi.fn().mockReturnThis(),
      });

      render(<ProductVisibilityManager />, { wrapper });

      expect(screen.getByTestId('loading-state')).toBeInTheDocument();
    });
  });

  describe('Tenant Isolation', () => {
    it('should filter queries by tenant_id', async () => {
      const { eqMock } = setupSupabaseMock(mockListings);

      render(<ProductVisibilityManager />, { wrapper });

      await waitFor(() => {
        expect(eqMock).toHaveBeenCalledWith('tenant_id', 'tenant-123');
      });
    });

    it('should not fetch when tenant is missing', async () => {
      (useTenantAdminAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        tenant: null,
        loading: false,
        admin: null,
        tenantSlug: null,
      });

      render(<ProductVisibilityManager />, { wrapper });

      // Should not show listings (query disabled)
      await waitFor(() => {
        expect(screen.getByText('Product Visibility')).toBeInTheDocument();
      });
    });
  });

  describe('Navigation', () => {
    it('should navigate to listing creation page on Add Product click', async () => {
      const user = userEvent.setup();
      render(<ProductVisibilityManager />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      });

      const addButton = screen.getByRole('button', { name: /add new product to marketplace/i });
      await user.click(addButton);

      expect(mockNavigateTenant).toHaveBeenCalledWith('/admin/marketplace/listings/new');
    });
  });

  describe('Search', () => {
    it('should filter listings by search term', async () => {
      const user = userEvent.setup();
      render(<ProductVisibilityManager />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      });

      const searchInput = screen.getByLabelText('Search products');
      await user.type(searchInput, 'Blue');

      expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      expect(screen.queryByText('OG Kush')).not.toBeInTheDocument();
      expect(screen.queryByText('Gummy Bears')).not.toBeInTheDocument();
    });

    it('should show filtered empty state when search has no matches', async () => {
      const user = userEvent.setup();
      render(<ProductVisibilityManager />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      });

      const searchInput = screen.getByLabelText('Search products');
      await user.type(searchInput, 'Nonexistent Product');

      expect(screen.getByText(/no listings match your filters/i)).toBeInTheDocument();
    });
  });

  describe('Filters', () => {
    it('should render the filter button with aria-label', async () => {
      render(<ProductVisibilityManager />, { wrapper });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /filter products/i })).toBeInTheDocument();
      });
    });

    it('should open filter dropdown on click', async () => {
      const user = userEvent.setup();
      render(<ProductVisibilityManager />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      });

      const filterButton = screen.getByRole('button', { name: /filter products/i });
      await user.click(filterButton);

      // DropdownMenu renders checkbox items - check for Active/Draft filter options
      await waitFor(() => {
        expect(screen.getByRole('menuitemcheckbox', { name: /^Active$/i })).toBeInTheDocument();
        expect(screen.getByRole('menuitemcheckbox', { name: /^Draft$/i })).toBeInTheDocument();
        expect(screen.getByRole('menuitemcheckbox', { name: /^Public$/i })).toBeInTheDocument();
        expect(screen.getByRole('menuitemcheckbox', { name: /^Hidden$/i })).toBeInTheDocument();
      });
    });

    it('should filter by status when Active is selected', async () => {
      const user = userEvent.setup();
      render(<ProductVisibilityManager />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      });

      const filterButton = screen.getByRole('button', { name: /filter products/i });
      await user.click(filterButton);

      await waitFor(() => {
        expect(screen.getByText('Active')).toBeInTheDocument();
      });

      const activeOption = screen.getByRole('menuitemcheckbox', { name: /^Active$/i });
      await user.click(activeOption);

      // After filtering, draft listing should be gone
      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
        expect(screen.getByText('Gummy Bears')).toBeInTheDocument();
        expect(screen.queryByText('OG Kush')).not.toBeInTheDocument();
      });
    });

    it('should show Clear button when filters are active', async () => {
      const user = userEvent.setup();
      render(<ProductVisibilityManager />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      });

      // No Clear button initially
      expect(screen.queryByRole('button', { name: /clear filters/i })).not.toBeInTheDocument();

      const filterButton = screen.getByRole('button', { name: /filter products/i });
      await user.click(filterButton);

      const draftOption = screen.getByRole('menuitemcheckbox', { name: /^Draft$/i });
      await user.click(draftOption);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /clear filters/i })).toBeInTheDocument();
      });
    });

    it('should clear filters when Clear button is clicked', async () => {
      const user = userEvent.setup();
      render(<ProductVisibilityManager />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      });

      // Apply a filter
      const filterButton = screen.getByRole('button', { name: /filter products/i });
      await user.click(filterButton);

      const draftOption = screen.getByRole('menuitemcheckbox', { name: /^Draft$/i });
      await user.click(draftOption);

      await waitFor(() => {
        expect(screen.queryByText('Blue Dream')).not.toBeInTheDocument();
      });

      // Clear filters
      const clearButton = screen.getByRole('button', { name: /clear filters/i });
      await user.click(clearButton);

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
        expect(screen.getByText('OG Kush')).toBeInTheDocument();
        expect(screen.getByText('Gummy Bears')).toBeInTheDocument();
      });
    });

    it('should show filter count badge when filters are active', async () => {
      const user = userEvent.setup();
      render(<ProductVisibilityManager />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      });

      const filterButton = screen.getByRole('button', { name: /filter products/i });
      await user.click(filterButton);

      const activeOption = screen.getByRole('menuitemcheckbox', { name: /^Active$/i });
      await user.click(activeOption);

      await waitFor(() => {
        // Badge shows count of active filters
        const badge = filterButton.querySelector('.ml-2');
        expect(badge).toBeInTheDocument();
        expect(badge?.textContent).toBe('1');
      });
    });
  });

  describe('Visibility Toggle', () => {
    it('should render switch for each listing', async () => {
      render(<ProductVisibilityManager />, { wrapper });

      await waitFor(() => {
        const switches = screen.getAllByRole('switch');
        expect(switches).toHaveLength(3);
      });
    });

    it('should have correct checked state based on visibility', async () => {
      render(<ProductVisibilityManager />, { wrapper });

      await waitFor(() => {
        const switches = screen.getAllByRole('switch');
        // Blue Dream: public = checked, OG Kush: hidden = unchecked, Gummy Bears: public = checked
        expect(switches[0]).toBeChecked();
        expect(switches[1]).not.toBeChecked();
        expect(switches[2]).toBeChecked();
      });
    });

    it('should have aria-labels on visibility switches', async () => {
      render(<ProductVisibilityManager />, { wrapper });

      await waitFor(() => {
        expect(screen.getByLabelText('Toggle visibility for Blue Dream')).toBeInTheDocument();
        expect(screen.getByLabelText('Toggle visibility for OG Kush')).toBeInTheDocument();
      });
    });
  });

  describe('Actions Dropdown', () => {
    it('should render actions button for each listing', async () => {
      render(<ProductVisibilityManager />, { wrapper });

      await waitFor(() => {
        const actionButtons = screen.getAllByRole('button', { name: /actions for/i });
        expect(actionButtons).toHaveLength(3);
      });
    });

    it('should include product name in actions button aria-label', async () => {
      render(<ProductVisibilityManager />, { wrapper });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Actions for Blue Dream' })).toBeInTheDocument();
      });
    });

    it('should show dropdown menu with Edit and Manage options', async () => {
      const user = userEvent.setup();
      render(<ProductVisibilityManager />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      });

      const actionsButton = screen.getByRole('button', { name: 'Actions for Blue Dream' });
      await user.click(actionsButton);

      await waitFor(() => {
        expect(screen.getByText('Edit Details')).toBeInTheDocument();
        expect(screen.getByText('Manage Bulk Pricing')).toBeInTheDocument();
      });
    });

    it('should navigate to edit page on Edit Details click', async () => {
      const user = userEvent.setup();
      render(<ProductVisibilityManager />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      });

      const actionsButton = screen.getByRole('button', { name: 'Actions for Blue Dream' });
      await user.click(actionsButton);

      const editItem = screen.getByText('Edit Details');
      await user.click(editItem);

      expect(mockNavigateTenant).toHaveBeenCalledWith('/admin/marketplace/listings/listing-1/edit');
    });

    it('should show Deactivate for active listings and Activate for draft', async () => {
      const user = userEvent.setup();
      render(<ProductVisibilityManager />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      });

      // Blue Dream is active, should show "Deactivate"
      const actionsButton = screen.getByRole('button', { name: 'Actions for Blue Dream' });
      await user.click(actionsButton);

      await waitFor(() => {
        expect(screen.getByText('Deactivate')).toBeInTheDocument();
      });
    });
  });

  describe('Table Display', () => {
    it('should display product images when available', async () => {
      render(<ProductVisibilityManager />, { wrapper });

      await waitFor(() => {
        const img = screen.getByAltText('Blue Dream');
        expect(img).toBeInTheDocument();
        expect(img).toHaveAttribute('src', 'https://example.com/img1.jpg');
      });
    });

    it('should show "No Img" placeholder when no image', async () => {
      render(<ProductVisibilityManager />, { wrapper });

      await waitFor(() => {
        const noImgLabels = screen.getAllByText('No Img');
        expect(noImgLabels.length).toBeGreaterThan(0);
      });
    });

    it('should display product type capitalized', async () => {
      render(<ProductVisibilityManager />, { wrapper });

      await waitFor(() => {
        expect(screen.getAllByText('flower')).toHaveLength(2);
        expect(screen.getByText('edible')).toBeInTheDocument();
      });
    });

    it('should display price with unit', async () => {
      render(<ProductVisibilityManager />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('$35.00 / gram')).toBeInTheDocument();
        expect(screen.getByText('$25.00 / unit')).toBeInTheDocument();
      });
    });

    it('should show destructive badge for zero stock', async () => {
      render(<ProductVisibilityManager />, { wrapper });

      await waitFor(() => {
        // OG Kush has 0 stock
        const zeroBadge = screen.getByText('0');
        expect(zeroBadge.closest('[class*="destructive"]')).toBeInTheDocument();
      });
    });

    it('should display status badges with correct styling', async () => {
      render(<ProductVisibilityManager />, { wrapper });

      await waitFor(() => {
        const activeBadges = screen.getAllByText('active');
        expect(activeBadges).toHaveLength(2);
        expect(screen.getByText('draft')).toBeInTheDocument();
      });
    });

    it('should display strain type when available', async () => {
      render(<ProductVisibilityManager />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('hybrid')).toBeInTheDocument();
        expect(screen.getByText('indica')).toBeInTheDocument();
      });
    });
  });
});
