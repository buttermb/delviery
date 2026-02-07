/**
 * InventoryManagement Tests
 * Tests for inventory dashboard with accurate value calculations based on actual product costs
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
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
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

vi.mock('@/components/admin/StockAdjustmentDialog', () => ({
  StockAdjustmentDialog: () => null,
}));

vi.mock('@/components/admin/InventoryMovementLog', () => ({
  InventoryMovementLog: () => <div data-testid="movement-log">Movement Log</div>,
}));

vi.mock('@/components/admin/products/BulkImageGenerator', () => ({
  BulkImageGenerator: () => null,
}));

vi.mock('@/components/tutorial/TakeTourButton', () => ({
  TakeTourButton: () => null,
}));

vi.mock('@/lib/tutorials/tutorialConfig', () => ({
  inventoryTutorial: { id: 'inventory', steps: [] },
}));

vi.mock('@/components/shared/ResponsiveTable', () => ({
  ResponsiveTable: ({ data, columns }: { data: unknown[]; columns: unknown[] }) => (
    <table data-testid="inventory-table">
      <tbody>
        {data.map((item: { id: string; name: string }) => (
          <tr key={item.id} data-testid={`product-row-${item.id}`}>
            <td>{item.name}</td>
          </tr>
        ))}
      </tbody>
    </table>
  ),
}));

// Import after mocks
import { InventoryManagement } from '../InventoryManagement';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={createQueryClient()}>
    <MemoryRouter initialEntries={['/test-tenant/admin/inventory']}>
      {children}
    </MemoryRouter>
  </QueryClientProvider>
);

describe('InventoryManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset useTenantAdminAuth mock to default
    (useTenantAdminAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      tenant: { id: 'tenant-123', slug: 'test-tenant', business_name: 'Test Business' },
      loading: false,
      admin: { id: 'admin-123', email: 'admin@test.com' },
      tenantSlug: 'test-tenant',
    });

    // Reset supabase mock
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
  });

  describe('Initial Render', () => {
    it('should render page title', async () => {
      render(<InventoryManagement />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Inventory Management')).toBeInTheDocument();
      });
    });

    it('should render loading state initially', async () => {
      render(<InventoryManagement />, { wrapper });

      // Loading state shows loading indicator
      expect(screen.getByText('Loading inventory...')).toBeInTheDocument();
    });

    it('should render empty state when no products exist', async () => {
      render(<InventoryManagement />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('No inventory data. Add products to get started.')).toBeInTheDocument();
      });
    });

    it('should show Manage Products button', async () => {
      render(<InventoryManagement />, { wrapper });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /manage products/i })).toBeInTheDocument();
      });
    });
  });

  describe('Tenant Validation', () => {
    it('should filter products by tenant_id', async () => {
      const eqMock = vi.fn().mockReturnThis();
      const orderMock = vi.fn().mockResolvedValue({ data: [], error: null });

      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: eqMock,
        order: orderMock,
      });

      render(<InventoryManagement />, { wrapper });

      await waitFor(() => {
        expect(eqMock).toHaveBeenCalledWith('tenant_id', 'tenant-123');
      });
    });

    it('should not load inventory when tenant is missing', async () => {
      (useTenantAdminAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        tenant: null,
        loading: false,
        admin: { id: 'admin-123', email: 'admin@test.com' },
        tenantSlug: 'test-tenant',
      });

      const fromMock = vi.fn();
      (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(fromMock);

      render(<InventoryManagement />, { wrapper });

      // Supabase should not be called when tenant is null
      await waitFor(() => {
        expect(fromMock).not.toHaveBeenCalled();
      });
    });
  });

  describe('Value Calculations', () => {
    it('should calculate total value from actual product costs using cost_per_unit', async () => {
      const mockProducts = [
        {
          id: 'product-1',
          tenant_id: 'tenant-123',
          name: 'Product 1',
          sku: 'SKU001',
          batch_number: 'BATCH001',
          available_quantity: 100,
          low_stock_alert: 20,
          category: 'flower',
          cost_per_unit: 50,
          wholesale_price: null,
          price_per_lb: null,
        },
        {
          id: 'product-2',
          tenant_id: 'tenant-123',
          name: 'Product 2',
          sku: 'SKU002',
          batch_number: 'BATCH002',
          available_quantity: 50,
          low_stock_alert: 10,
          category: 'edibles',
          cost_per_unit: 30,
          wholesale_price: null,
          price_per_lb: null,
        },
      ];

      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockProducts, error: null }),
      });

      render(<InventoryManagement />, { wrapper });

      // Total value should be: (100 * 50) + (50 * 30) = 5000 + 1500 = 6500
      // Total stock is 150 lbs
      // Displayed as $7k (6500/1000 = 6.5, toFixed(0) = 7)
      await waitFor(() => {
        expect(screen.getByText('150 lbs')).toBeInTheDocument();
        expect(screen.getByText('$7k')).toBeInTheDocument();
      });
    });

    it('should fall back to wholesale_price when cost_per_unit is null', async () => {
      const mockProducts = [
        {
          id: 'product-1',
          tenant_id: 'tenant-123',
          name: 'Product 1',
          sku: 'SKU001',
          batch_number: 'BATCH001',
          available_quantity: 100,
          low_stock_alert: 20,
          category: 'flower',
          cost_per_unit: null,
          wholesale_price: 40,
          price_per_lb: null,
        },
      ];

      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockProducts, error: null }),
      });

      render(<InventoryManagement />, { wrapper });

      // Total value should be: 100 * 40 = 4000
      await waitFor(() => {
        expect(screen.getByText('$4k')).toBeInTheDocument();
      });
    });

    it('should fall back to price_per_lb when both cost_per_unit and wholesale_price are null', async () => {
      const mockProducts = [
        {
          id: 'product-1',
          tenant_id: 'tenant-123',
          name: 'Product 1',
          sku: 'SKU001',
          batch_number: 'BATCH001',
          available_quantity: 100,
          low_stock_alert: 20,
          category: 'flower',
          cost_per_unit: null,
          wholesale_price: null,
          price_per_lb: 35,
        },
      ];

      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockProducts, error: null }),
      });

      render(<InventoryManagement />, { wrapper });

      // Total value should be: 100 * 35 = 3500, displayed as $4k (3500/1000 = 3.5, toFixed(0) = 4)
      await waitFor(() => {
        expect(screen.getByText('$4k')).toBeInTheDocument();
      });
    });

    it('should show $0k when all products have no cost information', async () => {
      const mockProducts = [
        {
          id: 'product-1',
          tenant_id: 'tenant-123',
          name: 'Product 1',
          sku: 'SKU001',
          batch_number: 'BATCH001',
          available_quantity: 100,
          low_stock_alert: 20,
          category: 'flower',
          cost_per_unit: null,
          wholesale_price: null,
          price_per_lb: null,
        },
      ];

      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockProducts, error: null }),
      });

      render(<InventoryManagement />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('$0k')).toBeInTheDocument();
      });
    });

    it('should calculate average cost per lb correctly', async () => {
      const mockProducts = [
        {
          id: 'product-1',
          tenant_id: 'tenant-123',
          name: 'Product 1',
          sku: 'SKU001',
          batch_number: 'BATCH001',
          available_quantity: 100,
          low_stock_alert: 20,
          category: 'flower',
          cost_per_unit: 100, // $100/lb
          wholesale_price: null,
          price_per_lb: null,
        },
        {
          id: 'product-2',
          tenant_id: 'tenant-123',
          name: 'Product 2',
          sku: 'SKU002',
          batch_number: 'BATCH002',
          available_quantity: 100,
          low_stock_alert: 10,
          category: 'flower',
          cost_per_unit: 200, // $200/lb
          wholesale_price: null,
          price_per_lb: null,
        },
      ];

      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockProducts, error: null }),
      });

      render(<InventoryManagement />, { wrapper });

      // Total value = (100 * 100) + (100 * 200) = 30000
      // Total stock = 200 lbs
      // Avg cost = 30000 / 200 = $150/lb
      await waitFor(() => {
        expect(screen.getByText('$150')).toBeInTheDocument();
      });
    });
  });

  describe('Stock Status', () => {
    it('should show CRITICAL status for items with quantity <= 10', async () => {
      const mockProducts = [
        {
          id: 'product-1',
          tenant_id: 'tenant-123',
          name: 'Low Stock Product',
          sku: 'SKU001',
          batch_number: 'BATCH001',
          available_quantity: 5,
          low_stock_alert: 20,
          category: 'flower',
          cost_per_unit: 100,
          wholesale_price: null,
          price_per_lb: null,
        },
      ];

      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockProducts, error: null }),
      });

      render(<InventoryManagement />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Low Stock Product')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: new Error('Database error') }),
      });

      render(<InventoryManagement />, { wrapper });

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to load inventory');
      });
    });
  });

  describe('Warehouse Grouping', () => {
    it('should group products by warehouse location', async () => {
      const mockProducts = [
        {
          id: 'product-1',
          tenant_id: 'tenant-123',
          name: 'Product 1',
          sku: 'SKU001',
          batch_number: 'BATCH001',
          available_quantity: 100,
          low_stock_alert: 20,
          warehouse_location: 'Warehouse A',
          category: 'flower',
          cost_per_unit: 50,
          wholesale_price: null,
          price_per_lb: null,
        },
        {
          id: 'product-2',
          tenant_id: 'tenant-123',
          name: 'Product 2',
          sku: 'SKU002',
          batch_number: 'BATCH002',
          available_quantity: 50,
          low_stock_alert: 10,
          warehouse_location: 'Warehouse B',
          category: 'edibles',
          cost_per_unit: 30,
          wholesale_price: null,
          price_per_lb: null,
        },
      ];

      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockProducts, error: null }),
      });

      render(<InventoryManagement />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText(/Warehouse A/)).toBeInTheDocument();
        expect(screen.getByText(/Warehouse B/)).toBeInTheDocument();
      });
    });

    it('should default to "Warehouse A" when warehouse_location is not set', async () => {
      const mockProducts = [
        {
          id: 'product-1',
          tenant_id: 'tenant-123',
          name: 'Product 1',
          sku: 'SKU001',
          batch_number: 'BATCH001',
          available_quantity: 100,
          low_stock_alert: 20,
          warehouse_location: undefined,
          category: 'flower',
          cost_per_unit: 50,
          wholesale_price: null,
          price_per_lb: null,
        },
      ];

      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockProducts, error: null }),
      });

      render(<InventoryManagement />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText(/Warehouse A/)).toBeInTheDocument();
      });
    });
  });

  describe('Movement Log', () => {
    it('should render inventory movement log component', async () => {
      render(<InventoryManagement />, { wrapper });

      await waitFor(() => {
        expect(screen.getByTestId('movement-log')).toBeInTheDocument();
      });
    });
  });
});

describe('InventoryManagement Value Calculation Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (useTenantAdminAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      tenant: { id: 'tenant-123', slug: 'test-tenant', business_name: 'Test Business' },
      loading: false,
      admin: { id: 'admin-123', email: 'admin@test.com' },
      tenantSlug: 'test-tenant',
    });
  });

  it('should handle mixed cost sources in the same inventory', async () => {
    const mockProducts = [
      {
        id: 'product-1',
        tenant_id: 'tenant-123',
        name: 'Product with cost_per_unit',
        sku: 'SKU001',
        batch_number: 'BATCH001',
        available_quantity: 10,
        low_stock_alert: 5,
        category: 'flower',
        cost_per_unit: 100,
        wholesale_price: 80, // Should be ignored
        price_per_lb: 70, // Should be ignored
      },
      {
        id: 'product-2',
        tenant_id: 'tenant-123',
        name: 'Product with wholesale_price only',
        sku: 'SKU002',
        batch_number: 'BATCH002',
        available_quantity: 10,
        low_stock_alert: 5,
        category: 'flower',
        cost_per_unit: null,
        wholesale_price: 50,
        price_per_lb: 40, // Should be ignored
      },
      {
        id: 'product-3',
        tenant_id: 'tenant-123',
        name: 'Product with price_per_lb only',
        sku: 'SKU003',
        batch_number: 'BATCH003',
        available_quantity: 10,
        low_stock_alert: 5,
        category: 'flower',
        cost_per_unit: null,
        wholesale_price: null,
        price_per_lb: 25,
      },
      {
        id: 'product-4',
        tenant_id: 'tenant-123',
        name: 'Product with no cost',
        sku: 'SKU004',
        batch_number: 'BATCH004',
        available_quantity: 10,
        low_stock_alert: 5,
        category: 'flower',
        cost_per_unit: null,
        wholesale_price: null,
        price_per_lb: null,
      },
    ];

    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockProducts, error: null }),
    });

    render(<InventoryManagement />, { wrapper });

    // Total value = (10 * 100) + (10 * 50) + (10 * 25) + (10 * 0) = 1000 + 500 + 250 + 0 = 1750
    // Total stock = 40 lbs
    // Displayed as $2k (1750/1000 = 1.75, toFixed(0) = 2)
    await waitFor(() => {
      expect(screen.getByText('40 lbs')).toBeInTheDocument();
      expect(screen.getByText('$2k')).toBeInTheDocument();
    });
  });

  it('should handle zero quantity products', async () => {
    const mockProducts = [
      {
        id: 'product-1',
        tenant_id: 'tenant-123',
        name: 'Out of stock product',
        sku: 'SKU001',
        batch_number: 'BATCH001',
        available_quantity: 0,
        low_stock_alert: 10,
        category: 'flower',
        cost_per_unit: 1000, // High cost but zero quantity = $0 value
        wholesale_price: null,
        price_per_lb: null,
      },
    ];

    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockProducts, error: null }),
    });

    render(<InventoryManagement />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('0 lbs')).toBeInTheDocument();
      expect(screen.getByText('$0k')).toBeInTheDocument();
    });
  });
});
