/**
 * PurchaseOrdersPage Tests (Hub-embedded version)
 * Tests for the purchase orders tab within the Operations Hub
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

import PurchaseOrdersPage from '../PurchaseOrdersPage';
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
    status: 'confirmed',
    total: 3200.5,
    notes: null,
    expected_delivery_date: null,
    created_at: '2024-12-05T00:00:00Z',
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

describe('PurchaseOrdersPage (Hub-embedded)', () => {
  beforeEach(() => {
    setupMock([], []);
  });

  describe('Rendering', () => {
    it('should render the page header', async () => {
      renderWithProviders(<PurchaseOrdersPage />);
      await waitFor(() => {
        expect(screen.getByText('Purchase Orders')).toBeInTheDocument();
      });
      expect(screen.getByText('Create and manage purchase orders from suppliers')).toBeInTheDocument();
    });

    it('should render the New Purchase Order button', async () => {
      renderWithProviders(<PurchaseOrdersPage />);
      await waitFor(() => {
        expect(screen.getAllByText('New Purchase Order').length).toBeGreaterThan(0);
      });
    });

    it('should render status filter', async () => {
      renderWithProviders(<PurchaseOrdersPage />);
      await waitFor(() => {
        expect(screen.getByText('All Statuses')).toBeInTheDocument();
      });
    });
  });

  describe('Empty State', () => {
    it('should render EnhancedEmptyState when no POs exist', async () => {
      renderWithProviders(<PurchaseOrdersPage />);
      await waitFor(() => {
        expect(screen.getByText('No purchase orders yet')).toBeInTheDocument();
      });
    });
  });

  describe('Vendor Name Display', () => {
    it('should display vendor names instead of raw IDs', async () => {
      setupMock(mockPurchaseOrders, mockVendors);
      renderWithProviders(<PurchaseOrdersPage />);
      await waitFor(() => {
        expect(screen.getAllByText('Green Valley Farms').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Pacific Coast Supply').length).toBeGreaterThan(0);
      });
    });

    it('should show "Unknown Vendor" for unresolved vendor IDs', async () => {
      const posWithUnknown = [{ ...mockPurchaseOrders[0], vendor_id: 'unknown-id' }];
      setupMock(posWithUnknown, mockVendors);
      renderWithProviders(<PurchaseOrdersPage />);
      await waitFor(() => {
        expect(screen.getAllByText('Unknown Vendor').length).toBeGreaterThan(0);
      });
    });
  });

  describe('Status Normalization', () => {
    it('should normalize "submitted" to "Sent"', async () => {
      const legacyPOs = [{ ...mockPurchaseOrders[0], id: 'legacy-1', status: 'submitted' }];
      setupMock(legacyPOs, mockVendors);
      renderWithProviders(<PurchaseOrdersPage />);
      await waitFor(() => {
        expect(screen.getAllByText('Sent').length).toBeGreaterThan(0);
      });
    });

    it('should normalize "approved" to "Confirmed"', async () => {
      const legacyPOs = [{ ...mockPurchaseOrders[0], id: 'legacy-2', status: 'approved' }];
      setupMock(legacyPOs, mockVendors);
      renderWithProviders(<PurchaseOrdersPage />);
      await waitFor(() => {
        expect(screen.getAllByText('Confirmed').length).toBeGreaterThan(0);
      });
    });
  });

  describe('Accessibility', () => {
    it('should have aria-labels on action buttons', async () => {
      setupMock(mockPurchaseOrders, mockVendors);
      renderWithProviders(<PurchaseOrdersPage />);
      await waitFor(() => {
        expect(screen.getAllByText('PO-2024-001').length).toBeGreaterThan(0);
      });
      expect(screen.getAllByLabelText(/View PO-2024-001/i).length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should render PageErrorState on fetch failure', async () => {
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
      renderWithProviders(<PurchaseOrdersPage />);
      await waitFor(() => {
        expect(screen.getByText('Failed to load purchase orders. Please try again.')).toBeInTheDocument();
      }, { timeout: 5000 });
    });
  });

  describe('Actions', () => {
    it('should open create form when New Purchase Order is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<PurchaseOrdersPage />);
      await waitFor(() => {
        expect(screen.getAllByText('New Purchase Order').length).toBeGreaterThan(0);
      });
      await user.click(screen.getAllByText('New Purchase Order')[0]);
      await waitFor(() => {
        expect(screen.getByTestId('po-create-form')).toBeInTheDocument();
      });
    });

    it('should fetch vendors for display', async () => {
      renderWithProviders(<PurchaseOrdersPage />);
      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('vendors');
      });
    });
  });
});
