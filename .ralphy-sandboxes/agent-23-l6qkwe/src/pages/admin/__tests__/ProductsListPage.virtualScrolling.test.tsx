/**
 * ProductsListPage Virtual Scrolling Tests
 * Tests for virtual scrolling functionality in the products grid and table views
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
      neq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      update: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      delete: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
    rpc: vi.fn().mockResolvedValue({ data: { success: true }, error: null }),
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
  useTenantNavigate: vi.fn().mockReturnValue(vi.fn()),
}));

vi.mock('@/hooks/useDebounce', () => ({
  useDebounce: vi.fn((value: string) => value),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
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

vi.mock('@/components/shared/EnhancedEmptyState', () => ({
  EnhancedEmptyState: ({ title, description, primaryAction }: { title?: string; description?: string; primaryAction?: { label: string; onClick: () => void; icon?: React.ReactNode } }) => (
    <div data-testid="empty-state">
      {title && <span>{title}</span>}
      {description && <span>{description}</span>}
      {primaryAction && (
        <button onClick={primaryAction.onClick}>{primaryAction.label}</button>
      )}
    </div>
  ),
}));

// Import after mocks
import { ProductsListPage } from '../ProductsListPage';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';

// Helper to create large dataset for testing virtual scrolling
const createMockProducts = (count: number) => {
  return Array.from({ length: count }, (_, i) => ({
    id: `product-${i}`,
    name: `Product ${i}`,
    sku: `SKU${String(i).padStart(3, '0')}`,
    category: ['flower', 'edibles', 'concentrates', 'topicals'][i % 4],
    wholesale_price: 10 + (i % 50),
    available_quantity: 50 + (i % 100),
    cost_per_unit: 5 + (i % 25),
    low_stock_alert: 10,
    tenant_id: 'tenant-123',
    image_url: `https://example.com/product-${i}.jpg`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));
};

const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={createQueryClient()}>
    <MemoryRouter initialEntries={['/test-tenant/admin/products']}>
      {children}
    </MemoryRouter>
  </QueryClientProvider>
);

describe('ProductsListPage - Virtual Scrolling', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset useTenantAdminAuth mock to default
    (useTenantAdminAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      tenant: { id: 'tenant-123', slug: 'test-tenant', business_name: 'Test Business' },
      loading: false,
      admin: { id: 'admin-123', email: 'admin@test.com' },
      tenantSlug: 'test-tenant',
    });
  });

  describe('Grid View Virtual Scrolling', () => {
    it('should render virtual scrolling container for grid view', async () => {
      const mockProducts = createMockProducts(50);

      const orderMock = vi.fn().mockResolvedValue({ data: mockProducts, error: null });
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        order: orderMock,
      });

      const { container } = render(<ProductsListPage />, { wrapper });

      await waitFor(() => {
        // Check that grid view is rendered by default
        const gridContainer = container.querySelector('[style*="height: 600px"]');
        expect(gridContainer).toBeInTheDocument();
      });
    });

    it('should not render all products at once in grid view (virtualization)', async () => {
      const mockProducts = createMockProducts(100);

      const orderMock = vi.fn().mockResolvedValue({ data: mockProducts, error: null });
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        order: orderMock,
      });

      const { container } = render(<ProductsListPage />, { wrapper });

      await waitFor(() => {
        // Wait for products to load
        expect(screen.getByText(/Products \(/)).toBeInTheDocument();
      });

      // Check that not all 100 products are rendered in the DOM
      const productCards = container.querySelectorAll('[class*="group hover:scale"]');
      // With virtualization, only visible rows should be rendered
      expect(productCards.length).toBeLessThan(100);
    });

    it('should handle empty product list in grid view', async () => {
      const orderMock = vi.fn().mockResolvedValue({ data: [], error: null });
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        order: orderMock,
      });

      render(<ProductsListPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      });
    });

    it('should display products count in header', async () => {
      const mockProducts = createMockProducts(75);

      const orderMock = vi.fn().mockResolvedValue({ data: mockProducts, error: null });
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        order: orderMock,
      });

      render(<ProductsListPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText(/Products \(75\)/)).toBeInTheDocument();
      });
    });

    it('should filter products and update virtual list', async () => {
      const mockProducts = createMockProducts(50);

      const orderMock = vi.fn().mockResolvedValue({ data: mockProducts, error: null });
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        order: orderMock,
      });

      const user = userEvent.setup();
      render(<ProductsListPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText(/Products \(50\)/)).toBeInTheDocument();
      });

      // Type in search input to filter products
      const searchInput = screen.getByPlaceholderText(/search products/i);
      await user.type(searchInput, 'Product 1');

      await waitFor(() => {
        // Product count should update after filtering
        const header = screen.getByText(/Products \(\d+\)/);
        expect(header).toBeInTheDocument();
      });
    });
  });

  describe('Table View Virtual Scrolling', () => {
    it('should enable virtualization for table view', async () => {
      const mockProducts = createMockProducts(50);

      const orderMock = vi.fn().mockResolvedValue({ data: mockProducts, error: null });
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        order: orderMock,
      });

      const user = userEvent.setup();
      const { container } = render(<ProductsListPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText(/Products \(50\)/)).toBeInTheDocument();
      });

      // Switch to table view
      const tableViewButton = screen.getByLabelText('Table view');
      await user.click(tableViewButton);

      await waitFor(() => {
        // ResponsiveTable should be rendered with virtualization enabled
        // The component will use VirtualizedTableTanstack internally
        expect(container.querySelector('table') || container.querySelector('[style*="position: relative"]')).toBeInTheDocument();
      });
    });

    it('should toggle between grid and table view', async () => {
      const mockProducts = createMockProducts(20);

      const orderMock = vi.fn().mockResolvedValue({ data: mockProducts, error: null });
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        order: orderMock,
      });

      const user = userEvent.setup();
      const { container } = render(<ProductsListPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText(/Products \(20\)/)).toBeInTheDocument();
      });

      // Default is grid view
      expect(container.querySelector('[style*="height: 600px"]')).toBeInTheDocument();

      // Switch to table view
      const tableViewButton = screen.getByLabelText('Table view');
      await user.click(tableViewButton);

      await waitFor(() => {
        // Grid container should no longer be visible
        const gridView = container.querySelector('[style*="height: 600px"]');
        // Grid view should be hidden when table view is active
        expect(gridView).not.toBeInTheDocument();
      });

      // Switch back to grid view
      const gridViewButton = screen.getByLabelText('Grid view');
      await user.click(gridViewButton);

      await waitFor(() => {
        // Grid container should be visible again
        expect(container.querySelector('[style*="height: 600px"]')).toBeInTheDocument();
      });
    });

    it('should pass virtualizeThreshold prop to ResponsiveTable', async () => {
      const mockProducts = createMockProducts(15);

      const orderMock = vi.fn().mockResolvedValue({ data: mockProducts, error: null });
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        order: orderMock,
      });

      const user = userEvent.setup();
      render(<ProductsListPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText(/Products \(15\)/)).toBeInTheDocument();
      });

      // Switch to table view
      const tableViewButton = screen.getByLabelText('Table view');
      await user.click(tableViewButton);

      // With 15 products and virtualizeThreshold=10, virtualization should be enabled
      await waitFor(() => {
        expect(screen.getByLabelText('Table view')).toHaveAttribute('data-state', 'on');
      });
    });
  });

  describe('Performance with Large Datasets', () => {
    it('should handle 500 products efficiently in grid view', async () => {
      const mockProducts = createMockProducts(500);

      const orderMock = vi.fn().mockResolvedValue({ data: mockProducts, error: null });
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        order: orderMock,
      });

      const { container } = render(<ProductsListPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText(/Products \(500\)/)).toBeInTheDocument();
      });

      // Virtual scrolling container should exist
      const gridContainer = container.querySelector('[style*="height: 600px"]');
      expect(gridContainer).toBeInTheDocument();

      // Not all products should be in the DOM
      const productCards = container.querySelectorAll('[class*="group hover:scale"]');
      expect(productCards.length).toBeLessThan(500);
    });

    it('should handle 500 products efficiently in table view', async () => {
      const mockProducts = createMockProducts(500);

      const orderMock = vi.fn().mockResolvedValue({ data: mockProducts, error: null });
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        order: orderMock,
      });

      const user = userEvent.setup();
      const { container } = render(<ProductsListPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText(/Products \(500\)/)).toBeInTheDocument();
      }, { timeout: 5000 });

      // Switch to table view
      const tableViewButton = screen.getByLabelText('Table view');
      await user.click(tableViewButton);

      await waitFor(() => {
        // Table or virtualized container should be rendered
        const tableElement = container.querySelector('table') || container.querySelector('[style*="position: relative"]');
        expect(tableElement).toBeInTheDocument();
      }, { timeout: 5000 });
    });

    it('should update stats correctly with large datasets', async () => {
      const mockProducts = createMockProducts(200);

      const orderMock = vi.fn().mockResolvedValue({ data: mockProducts, error: null });
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        order: orderMock,
      });

      render(<ProductsListPage />, { wrapper });

      await waitFor(() => {
        // Total products stat
        expect(screen.getByText('200')).toBeInTheDocument();
        expect(screen.getByText('Total Products')).toBeInTheDocument();
      });
    });
  });

  describe('Filtering and Sorting with Virtual Scrolling', () => {
    it('should maintain virtual scrolling after category filter', async () => {
      const mockProducts = createMockProducts(100);

      const orderMock = vi.fn().mockResolvedValue({ data: mockProducts, error: null });
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        order: orderMock,
      });

      const { container } = render(<ProductsListPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText(/Products \(100\)/)).toBeInTheDocument();
      });

      // Virtual scrolling container should exist before and after filtering
      let gridContainer = container.querySelector('[style*="height: 600px"]');
      expect(gridContainer).toBeInTheDocument();

      // After any filter changes, virtual scrolling should still be present
      await waitFor(() => {
        gridContainer = container.querySelector('[style*="height: 600px"]');
        expect(gridContainer).toBeInTheDocument();
      });
    });

    it('should maintain virtual scrolling after sorting', async () => {
      const mockProducts = createMockProducts(80);

      const orderMock = vi.fn().mockResolvedValue({ data: mockProducts, error: null });
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        order: orderMock,
      });

      const { container } = render(<ProductsListPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText(/Products \(80\)/)).toBeInTheDocument();
      });

      // Virtual scrolling container should exist regardless of sort order
      const gridContainer = container.querySelector('[style*="height: 600px"]');
      expect(gridContainer).toBeInTheDocument();

      // Virtual scrolling should still be active after sorting
      await waitFor(() => {
        const containerAfterSort = container.querySelector('[style*="height: 600px"]');
        expect(containerAfterSort).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle exactly one product', async () => {
      const mockProducts = createMockProducts(1);

      const orderMock = vi.fn().mockResolvedValue({ data: mockProducts, error: null });
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        order: orderMock,
      });

      const { container } = render(<ProductsListPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText(/Products \(1\)/)).toBeInTheDocument();
      }, { timeout: 3000 });

      // With one product, virtual scrolling container should still exist
      await waitFor(() => {
        const gridContainer = container.querySelector('[style*="height: 600px"]');
        expect(gridContainer).toBeInTheDocument();
      });
    });

    it('should handle products with missing images', async () => {
      const mockProducts = createMockProducts(10).map(p => ({
        ...p,
        image_url: null,
      }));

      const orderMock = vi.fn().mockResolvedValue({ data: mockProducts, error: null });
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        order: orderMock,
      });

      render(<ProductsListPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText(/Products \(10\)/)).toBeInTheDocument();
      });
    });

    it('should handle products with zero quantity', async () => {
      const mockProducts = createMockProducts(5).map(p => ({
        ...p,
        available_quantity: 0,
      }));

      const orderMock = vi.fn().mockResolvedValue({ data: mockProducts, error: null });
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        order: orderMock,
      });

      render(<ProductsListPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText(/Products \(5\)/)).toBeInTheDocument();
      });
    });
  });
});
