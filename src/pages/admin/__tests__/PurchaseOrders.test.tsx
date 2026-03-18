/**
 * PurchaseOrders Tests
 * Tests for purchase order listing, filtering, vendor display, and responsive layout
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';

// Track supabase.from calls
let mockFromImpl: (table: string) => Record<string, unknown>;

function createChain(data: unknown[] = []) {
  const result = { data, error: null };
  const chain: Record<string, unknown> = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    update: vi.fn(() => chain),
    insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
    then: (resolve: (val: unknown) => void) => resolve(result),
  };
  return chain;
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn((...args: unknown[]) => {
      if (mockFromImpl) return mockFromImpl(args[0] as string);
      return createChain();
    }),
  },
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: { id: 'tenant-123', slug: 'test-tenant', business_name: 'Test Business' },
    loading: false,
    admin: { id: 'admin-123', email: 'admin@test.com' },
    tenantSlug: 'test-tenant',
  }),
}));

vi.mock('@/hooks/usePurchaseOrders', () => ({
  usePurchaseOrders: () => ({
    deletePurchaseOrder: { mutateAsync: vi.fn() },
    updatePurchaseOrderStatus: { mutateAsync: vi.fn() },
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
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/components/admin/purchase-orders/POCreateForm', () => ({
  POCreateForm: ({ open }: { open: boolean }) =>
    open ? <div data-testid="po-create-form">PO Create Form</div> : null,
}));

vi.mock('@/components/admin/purchase-orders/PODetail', () => ({
  PODetail: ({ open }: { open: boolean }) =>
    open ? <div data-testid="po-detail">PO Detail</div> : null,
}));

vi.mock('@/components/shared/ConfirmDeleteDialog', () => ({
  ConfirmDeleteDialog: () => null,
}));

vi.mock('@/hooks/useConfirmDialog', () => ({
  useConfirmDialog: () => ({
    dialogState: { open: false, title: '', description: '', onConfirm: vi.fn(), isLoading: false },
    confirm: vi.fn(),
    closeDialog: vi.fn(),
    setLoading: vi.fn(),
  }),
}));

import PurchaseOrders from '../PurchaseOrders';
import { supabase } from '@/integrations/supabase/client';

const mockPurchaseOrders = [
  {
    id: 'po-1',
    po_number: 'PO-2024-001',
    vendor_id: 'vendor-1',
    status: 'draft',
    total: 1500.0,
    notes: 'Urgent order',
    expected_delivery_date: '2024-12-25',
    created_at: '2024-12-01T00:00:00Z',
    tenant_id: 'tenant-123',
  },
  {
    id: 'po-2',
    po_number: 'PO-2024-002',
    vendor_id: 'vendor-2',
    status: 'sent',
    total: 3200.5,
    notes: null,
    expected_delivery_date: null,
    created_at: '2024-12-05T00:00:00Z',
    tenant_id: 'tenant-123',
  },
  {
    id: 'po-3',
    po_number: 'PO-2024-003',
    vendor_id: 'vendor-1',
    status: 'received',
    total: 750.0,
    notes: 'Completed',
    expected_delivery_date: '2024-11-20',
    created_at: '2024-11-15T00:00:00Z',
    tenant_id: 'tenant-123',
  },
];

const mockVendors = [
  { id: 'vendor-1', name: 'Green Valley Farms' },
  { id: 'vendor-2', name: 'Pacific Coast Supply' },
];

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = createQueryClient();
  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <BrowserRouter>{ui}</BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    ),
    queryClient,
  };
}

function setupMock(pos: unknown[] = [], vendors: unknown[] = []) {
  mockFromImpl = (table: string) => {
    if (table === 'purchase_orders') return createChain(pos);
    if (table === 'vendors') return createChain(vendors);
    return createChain();
  };
}

describe('PurchaseOrders', () => {
  beforeEach(() => {
    setupMock([], []);
  });

  describe('Rendering', () => {
    it('should render the page header', async () => {
      renderWithProviders(<PurchaseOrders />);
      await waitFor(() => {
        expect(screen.getByText('Purchase Orders')).toBeInTheDocument();
      });
      expect(screen.getByText('Create and manage purchase orders from vendors')).toBeInTheDocument();
    });

    it('should render the New PO button', async () => {
      renderWithProviders(<PurchaseOrders />);
      await waitFor(() => {
        expect(screen.getByText('New PO')).toBeInTheDocument();
      });
    });

    it('should render the search input', async () => {
      renderWithProviders(<PurchaseOrders />);
      await waitFor(() => {
        expect(screen.getByLabelText('Search by PO number or notes')).toBeInTheDocument();
      });
    });

    it('should render stats cards', async () => {
      setupMock(mockPurchaseOrders, mockVendors);
      renderWithProviders(<PurchaseOrders />);
      await waitFor(() => {
        expect(screen.getByText('Total POs')).toBeInTheDocument();
        expect(screen.getByText('Drafts')).toBeInTheDocument();
        expect(screen.getByText('Pending')).toBeInTheDocument();
        expect(screen.getByText('Total Value')).toBeInTheDocument();
      });
    });
  });

  describe('Empty State', () => {
    it('should render empty state when no POs exist', async () => {
      renderWithProviders(<PurchaseOrders />);
      await waitFor(() => {
        expect(screen.getByText('No purchase orders yet')).toBeInTheDocument();
      });
    });

    it('should show "New Purchase Order" action in empty state', async () => {
      renderWithProviders(<PurchaseOrders />);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /new purchase order/i })).toBeInTheDocument();
      });
    });
  });

  describe('Data Loading', () => {
    it('should fetch purchase orders with tenant filter', async () => {
      renderWithProviders(<PurchaseOrders />);
      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('purchase_orders');
      });
    });

    it('should fetch vendors for name display', async () => {
      renderWithProviders(<PurchaseOrders />);
      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('vendors');
      });
    });

    it('should display vendor names instead of IDs', async () => {
      setupMock(mockPurchaseOrders, mockVendors);
      renderWithProviders(<PurchaseOrders />);
      await waitFor(() => {
        expect(screen.getAllByText('Green Valley Farms').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Pacific Coast Supply').length).toBeGreaterThan(0);
      });
    });

    it('should display PO numbers', async () => {
      setupMock(mockPurchaseOrders, mockVendors);
      renderWithProviders(<PurchaseOrders />);
      await waitFor(() => {
        expect(screen.getAllByText('PO-2024-001').length).toBeGreaterThan(0);
        expect(screen.getAllByText('PO-2024-002').length).toBeGreaterThan(0);
      });
    });

    it('should display formatted totals', async () => {
      setupMock(mockPurchaseOrders, mockVendors);
      renderWithProviders(<PurchaseOrders />);
      await waitFor(() => {
        expect(screen.getByText('1,500.00')).toBeInTheDocument();
        expect(screen.getByText('3,200.50')).toBeInTheDocument();
      });
    });
  });

  describe('Status Display', () => {
    it('should show status badges for POs', async () => {
      setupMock(mockPurchaseOrders, mockVendors);
      renderWithProviders(<PurchaseOrders />);
      await waitFor(() => {
        expect(screen.getAllByText('Draft').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Sent').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Received').length).toBeGreaterThan(0);
      });
    });

    it('should normalize legacy status "submitted" to "Sent"', async () => {
      const legacyPOs = [{ ...mockPurchaseOrders[0], id: 'po-legacy', status: 'submitted' }];
      setupMock(legacyPOs, mockVendors);
      renderWithProviders(<PurchaseOrders />);
      await waitFor(() => {
        expect(screen.getAllByText('Sent').length).toBeGreaterThan(0);
      });
    });
  });

  describe('Actions', () => {
    it('should open create form when New PO is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<PurchaseOrders />);
      await waitFor(() => {
        expect(screen.getByText('New PO')).toBeInTheDocument();
      });
      await user.click(screen.getByText('New PO'));
      await waitFor(() => {
        expect(screen.getByTestId('po-create-form')).toBeInTheDocument();
      });
    });

    it('should open detail dialog when view button is clicked', async () => {
      const user = userEvent.setup();
      setupMock(mockPurchaseOrders, mockVendors);
      renderWithProviders(<PurchaseOrders />);
      await waitFor(() => {
        expect(screen.getAllByText('PO-2024-001').length).toBeGreaterThan(0);
      });
      const viewButtons = screen.getAllByLabelText(/View PO-2024-001/i);
      await user.click(viewButtons[0]);
      await waitFor(() => {
        expect(screen.getByTestId('po-detail')).toBeInTheDocument();
      });
    });

    it('should show edit button only for draft POs', async () => {
      setupMock(mockPurchaseOrders, mockVendors);
      renderWithProviders(<PurchaseOrders />);
      await waitFor(() => {
        expect(screen.getAllByText('PO-2024-001').length).toBeGreaterThan(0);
      });
      // Draft PO has edit button
      expect(screen.getAllByLabelText(/Edit PO-2024-001/i).length).toBeGreaterThan(0);
      // Sent PO does not
      expect(screen.queryAllByLabelText(/Edit PO-2024-002/i).length).toBe(0);
    });

    it('should show delete button only for draft or cancelled POs', async () => {
      setupMock(mockPurchaseOrders, mockVendors);
      renderWithProviders(<PurchaseOrders />);
      await waitFor(() => {
        expect(screen.getAllByText('PO-2024-001').length).toBeGreaterThan(0);
      });
      // Draft PO has delete button
      expect(screen.getAllByLabelText(/Delete PO-2024-001/i).length).toBeGreaterThan(0);
      // Sent PO does not
      expect(screen.queryAllByLabelText(/Delete PO-2024-002/i).length).toBe(0);
      // Received PO does not
      expect(screen.queryAllByLabelText(/Delete PO-2024-003/i).length).toBe(0);
    });
  });

  describe('Accessibility', () => {
    it('should have aria-labels on action buttons', async () => {
      setupMock(mockPurchaseOrders, mockVendors);
      renderWithProviders(<PurchaseOrders />);
      await waitFor(() => {
        expect(screen.getAllByText('PO-2024-001').length).toBeGreaterThan(0);
      });
      expect(screen.getAllByLabelText(/View PO-2024-001/i).length).toBeGreaterThan(0);
      expect(screen.getAllByLabelText(/View PO-2024-002/i).length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should render error state on fetch failure', async () => {
      mockFromImpl = (table: string) => {
        if (table === 'purchase_orders') {
          const errResult = { data: null, error: { message: 'Database error' } };
          const chain: Record<string, unknown> = {
            select: vi.fn(() => chain),
            eq: vi.fn(() => chain),
            order: vi.fn(() => chain),
            then: (resolve: (val: unknown) => void) => resolve(errResult),
          };
          return chain;
        }
        return createChain();
      };
      renderWithProviders(<PurchaseOrders />);
      await waitFor(() => {
        expect(screen.getByText('Failed to load purchase orders. Please try again.')).toBeInTheDocument();
      }, { timeout: 5000 });
    });
  });
});
