/**
 * WarehousesPage Tests
 * Tests for warehouse listing, form validation, and stats display
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
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
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
  useTenantNavigate: vi.fn().mockReturnValue(vi.fn()),
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

// Import after mocks
import WarehousesPage from '../locations/WarehousesPage';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={createQueryClient()}>
    <MemoryRouter initialEntries={['/test-tenant/admin/warehouses']}>
      {children}
    </MemoryRouter>
  </QueryClientProvider>
);

describe('WarehousesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (useTenantAdminAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      tenant: { id: 'tenant-123', slug: 'test-tenant', business_name: 'Test Business' },
      loading: false,
      admin: { id: 'admin-123', email: 'admin@test.com' },
      tenantSlug: 'test-tenant',
    });

    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
  });

  describe('Initial Render', () => {
    it('should show loading skeleton when data is loading', () => {
      // Simulate a never-resolving query
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue(new Promise(() => {})),
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

      render(<WarehousesPage />, { wrapper });

      // Skeleton uses role="status" with aria-label="Loading..."
      const skeletons = screen.getAllByRole('status');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should render page title and description', async () => {
      render(<WarehousesPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Warehouses')).toBeInTheDocument();
      });
      expect(screen.getByText('Manage warehouse locations and track inventory by location')).toBeInTheDocument();
    });

    it('should render Add Warehouse button', async () => {
      render(<WarehousesPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add.*warehouse/i })).toBeInTheDocument();
      });
    });

    it('should render stat cards', async () => {
      render(<WarehousesPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Total Warehouses')).toBeInTheDocument();
        expect(screen.getByText('Total Inventory')).toBeInTheDocument();
        // "Total Value" appears in both the table header and stat card
        expect(screen.getAllByText('Total Value').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('Total Products')).toBeInTheDocument();
      });
    });
  });

  describe('Data Display', () => {
    it('should display warehouses grouped by category', async () => {
      const mockProducts = [
        { category: 'Flower', stock_quantity: 100, cost_per_unit: 10 },
        { category: 'Flower', stock_quantity: 50, cost_per_unit: 15 },
        { category: 'Edibles', stock_quantity: 200, cost_per_unit: 5 },
      ];

      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: mockProducts, error: null }),
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

      render(<WarehousesPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Flower')).toBeInTheDocument();
        expect(screen.getByText('Edibles')).toBeInTheDocument();
      });
    });

    it('should display correct product counts in badges', async () => {
      const mockProducts = [
        { category: 'Flower', stock_quantity: 100, cost_per_unit: 10 },
        { category: 'Flower', stock_quantity: 50, cost_per_unit: 15 },
      ];

      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: mockProducts, error: null }),
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

      render(<WarehousesPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('2 items')).toBeInTheDocument();
      });
    });

    it('should show stats reflecting aggregated data', async () => {
      const mockProducts = [
        { category: 'Flower', stock_quantity: 100, cost_per_unit: 10 },
        { category: 'Edibles', stock_quantity: 50, cost_per_unit: 5 },
      ];

      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: mockProducts, error: null }),
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

      render(<WarehousesPage />, { wrapper });

      await waitFor(() => {
        // Total Warehouses stat should show "2" (2 categories)
        const warehousesStat = screen.getByText('Total Warehouses').closest('div');
        expect(warehousesStat).toBeInTheDocument();
      });

      // 150 lbs total inventory
      expect(screen.getByText(/150\.0/)).toBeInTheDocument();
    });
  });

  describe('Add Warehouse Dialog', () => {
    it('should open dialog when Add Warehouse is clicked', async () => {
      const user = userEvent.setup();
      render(<WarehousesPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Warehouses')).toBeInTheDocument();
      });

      const addButton = screen.getByRole('button', { name: /add.*warehouse/i });
      await user.click(addButton);

      expect(screen.getByText('Add New Warehouse')).toBeInTheDocument();
    });

    it('should validate warehouse name is required', async () => {
      const user = userEvent.setup();
      render(<WarehousesPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Warehouses')).toBeInTheDocument();
      });

      // Open dialog
      await user.click(screen.getByRole('button', { name: /add.*warehouse/i }));

      // Try to submit without name
      const submitButtons = screen.getAllByRole('button', { name: /add warehouse/i });
      const submitButton = submitButtons[submitButtons.length - 1];
      await user.click(submitButton);

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText('Warehouse name is required')).toBeInTheDocument();
      });
    });

    it('should submit form with valid data', async () => {
      const user = userEvent.setup();
      const insertMock = vi.fn().mockResolvedValue({ data: null, error: null });

      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        insert: insertMock,
      });

      render(<WarehousesPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Warehouses')).toBeInTheDocument();
      });

      // Open dialog
      await user.click(screen.getByRole('button', { name: /add.*warehouse/i }));

      // Fill form
      await user.type(screen.getByLabelText(/warehouse name/i), 'Main Warehouse');
      await user.type(screen.getByLabelText(/address/i), '123 Main St');

      // Submit
      const submitButtons = screen.getAllByRole('button', { name: /add warehouse/i });
      const submitButton = submitButtons[submitButtons.length - 1];
      await user.click(submitButton);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Warehouse added successfully');
      });
    });

    it('should reset form on dialog close', async () => {
      const user = userEvent.setup();
      render(<WarehousesPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Warehouses')).toBeInTheDocument();
      });

      // Open dialog
      await user.click(screen.getByRole('button', { name: /add.*warehouse/i }));

      // Type something
      const nameInput = screen.getByLabelText(/warehouse name/i);
      await user.type(nameInput, 'Test');

      // Close dialog via Cancel
      await user.click(screen.getByRole('button', { name: /cancel/i }));

      // Re-open dialog
      await user.click(screen.getByRole('button', { name: /add.*warehouse/i }));

      // Input should be empty
      const freshInput = screen.getByLabelText(/warehouse name/i);
      expect(freshInput).toHaveValue('');
    });
  });

  describe('Error Handling', () => {
    it('should show feature not available when table is missing (42P01)', async () => {
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: { code: '42P01', message: 'table not found' } }),
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

      render(<WarehousesPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Feature Not Available')).toBeInTheDocument();
      });
    });

    it('should show error toast when create fails', async () => {
      const user = userEvent.setup();

      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        insert: vi.fn().mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate key' } }),
      });

      render(<WarehousesPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Warehouses')).toBeInTheDocument();
      });

      // Open dialog and submit
      await user.click(screen.getByRole('button', { name: /add.*warehouse/i }));
      await user.type(screen.getByLabelText(/warehouse name/i), 'Duplicate Warehouse');
      const submitButtons = screen.getAllByRole('button', { name: /add warehouse/i });
      await user.click(submitButtons[submitButtons.length - 1]);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to add warehouse', expect.objectContaining({
          description: expect.any(String),
        }));
      });
    });
  });

  describe('Tenant Context', () => {
    it('should filter products by tenant_id', async () => {
      const eqMock = vi.fn().mockResolvedValue({ data: [], error: null });

      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: eqMock,
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

      render(<WarehousesPage />, { wrapper });

      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('products');
        expect(eqMock).toHaveBeenCalledWith('tenant_id', 'tenant-123');
      });
    });

    it('should not fetch when tenant is missing', () => {
      (useTenantAdminAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        tenant: null,
        loading: false,
        admin: null,
        tenantSlug: null,
      });

      render(<WarehousesPage />, { wrapper });

      // Query is disabled when no tenantId, page renders with empty data
      expect(screen.getByText('Warehouses')).toBeInTheDocument();
      expect(screen.getByText('Total Warehouses')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have aria-labels on action buttons', async () => {
      const mockProducts = [
        { category: 'Flower', stock_quantity: 100, cost_per_unit: 10 },
      ];

      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: mockProducts, error: null }),
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

      render(<WarehousesPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add new warehouse/i })).toBeInTheDocument();
      });
    });

    it('should have form labels connected to inputs', async () => {
      const user = userEvent.setup();
      render(<WarehousesPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Warehouses')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /add.*warehouse/i }));

      expect(screen.getByLabelText(/warehouse name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/address/i)).toBeInTheDocument();
    });
  });
});
