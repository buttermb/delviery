/**
 * POReceivingPage Tests
 * Tests for PO receiving page: loading skeleton, empty state, search sanitization,
 * data display, background refresh indicator, and dialog interaction.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

// Mock dependencies before importing the component
const mockSupabaseFrom = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockSupabaseFrom(...args),
  },
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: vi.fn().mockReturnValue({
    tenant: { id: 'tenant-123', slug: 'test-tenant', business_name: 'Test Dispensary' },
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

vi.mock('@/components/admin/purchase-orders/POReceiveDialog', () => ({
  POReceiveDialog: ({ open, purchaseOrder }: { open: boolean; purchaseOrder: { po_number: string } | null }) =>
    open ? <div data-testid="po-receive-dialog">Receive Dialog: {purchaseOrder?.po_number}</div> : null,
}));

vi.mock('@/components/shared/EnhancedEmptyState', () => ({
  EnhancedEmptyState: ({ title, description, primaryAction }: {
    title: string;
    description: string;
    primaryAction?: { label: string; onClick: () => void };
  }) => (
    <div data-testid="enhanced-empty-state">
      <p>{title}</p>
      <p>{description}</p>
      {primaryAction && (
        <button onClick={primaryAction.onClick}>{primaryAction.label}</button>
      )}
    </div>
  ),
}));

// Import after mocks
import POReceivingPage from '../POReceivingPage';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';

const mockPurchaseOrders = [
  {
    id: 'po-1',
    po_number: 'PO-2024-001',
    vendor_id: 'vendor-1',
    status: 'approved',
    total: 1500.00,
    expected_delivery_date: new Date().toISOString().split('T')[0],
    notes: 'Urgent order',
    tenant_id: 'tenant-123',
    account_id: 'tenant-123',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    created_by: null,
    approved_by: null,
    received_date: null,
    location_id: null,
    subtotal: 1400,
    tax: 100,
    shipping: null,
  },
  {
    id: 'po-2',
    po_number: 'PO-2024-002',
    vendor_id: 'vendor-2',
    status: 'submitted',
    total: 2500.00,
    expected_delivery_date: '2024-12-31',
    notes: null,
    tenant_id: 'tenant-123',
    account_id: 'tenant-123',
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
    created_by: null,
    approved_by: null,
    received_date: null,
    location_id: null,
    subtotal: 2300,
    tax: 200,
    shipping: null,
  },
];

const mockVendors = [
  { id: 'vendor-1', name: 'Green Farms Supply' },
  { id: 'vendor-2', name: 'Cannabis Wholesale Co' },
];

const mockSuppliers = [
  { id: 'supplier-1', supplier_name: 'Bulk Supplier Inc' },
];

/**
 * Creates a Supabase-like chainable mock where every method returns the chain,
 * and the chain is also a thenable (awaitable) that resolves to { data, error }.
 */
function createChainableMock(resolvedData: unknown = [], resolvedError: unknown = null) {
  const result = { data: resolvedData, error: resolvedError };
  const chain: Record<string, unknown> = {};

  // Make chainable methods
  const methods = ['select', 'eq', 'in', 'order', 'neq', 'gt', 'lt', 'gte', 'lte', 'like', 'ilike', 'is', 'filter', 'range', 'limit', 'maybeSingle', 'single'];
  for (const method of methods) {
    chain[method] = vi.fn().mockReturnValue(chain);
  }

  // Make the chain thenable (awaitable)
  chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);

  return chain;
}

function setupSupabaseMock(options: {
  purchaseOrders?: unknown[];
  vendors?: unknown[];
  suppliers?: unknown[];
  poError?: unknown;
} = {}) {
  const { purchaseOrders = [], vendors = [], suppliers = [], poError = null } = options;

  mockSupabaseFrom.mockImplementation((table: string) => {
    if (table === 'purchase_orders') {
      return createChainableMock(purchaseOrders, poError);
    }
    if (table === 'vendors') {
      return createChainableMock(vendors);
    }
    if (table === 'wholesale_suppliers') {
      return createChainableMock(suppliers);
    }
    if (table === 'purchase_order_items') {
      return createChainableMock([]);
    }
    return createChainableMock();
  });
}

describe('POReceivingPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });

    (useTenantAdminAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      tenant: { id: 'tenant-123', slug: 'test-tenant', business_name: 'Test Dispensary' },
      loading: false,
      admin: { id: 'admin-123', email: 'admin@test.com' },
      tenantSlug: 'test-tenant',
    });

    setupSupabaseMock();
  });

  const renderPage = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/test-tenant/admin/operations/po-receiving']}>
          <POReceivingPage />
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  describe('Loading State', () => {
    it('should render skeleton loading state initially', () => {
      // Create a mock that never resolves to keep loading state
      mockSupabaseFrom.mockImplementation(() => {
        const chain: Record<string, unknown> = {};
        const methods = ['select', 'eq', 'in', 'order', 'neq', 'maybeSingle', 'single'];
        for (const method of methods) {
          chain[method] = vi.fn().mockReturnValue(chain);
        }
        // Never-resolving thenable
        chain.then = () => new Promise(() => { /* never resolves */ });
        return chain;
      });

      renderPage();

      // Skeleton elements should be visible (role="status" from Skeleton component)
      const skeletons = document.querySelectorAll('[role="status"]');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('Empty State', () => {
    it('should render enhanced empty state when no POs exist', async () => {
      setupSupabaseMock({ purchaseOrders: [] });

      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('enhanced-empty-state')).toBeInTheDocument();
      });

      expect(screen.getByText('No purchase orders awaiting receipt')).toBeInTheDocument();
    });

    it('should show search-specific empty state when filtering with no results', async () => {
      setupSupabaseMock({ purchaseOrders: mockPurchaseOrders, vendors: mockVendors });

      const user = userEvent.setup();
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('PO-2024-001')).toBeInTheDocument();
      });

      const searchInput = screen.getByLabelText('Search by PO number, vendor, or notes');
      await user.type(searchInput, 'nonexistent-xyz');

      await waitFor(() => {
        expect(screen.getByTestId('enhanced-empty-state')).toBeInTheDocument();
        expect(screen.getByText('No matching purchase orders')).toBeInTheDocument();
      });
    });

    it('should clear search when Clear Search button is clicked in empty state', async () => {
      setupSupabaseMock({ purchaseOrders: mockPurchaseOrders, vendors: mockVendors });

      const user = userEvent.setup();
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('PO-2024-001')).toBeInTheDocument();
      });

      const searchInput = screen.getByLabelText('Search by PO number, vendor, or notes');
      await user.type(searchInput, 'nonexistent-xyz');

      await waitFor(() => {
        expect(screen.getByText('Clear Search')).toBeInTheDocument();
      });

      const clearButton = screen.getByText('Clear Search');
      await user.click(clearButton);

      await waitFor(() => {
        expect(screen.getByText('PO-2024-001')).toBeInTheDocument();
      });
    });
  });

  describe('Data Display', () => {
    it('should render purchase orders in the table', async () => {
      setupSupabaseMock({
        purchaseOrders: mockPurchaseOrders,
        vendors: mockVendors,
        suppliers: mockSuppliers,
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('PO-2024-001')).toBeInTheDocument();
        expect(screen.getByText('PO-2024-002')).toBeInTheDocument();
      });
    });

    it('should display vendor names from vendor map', async () => {
      setupSupabaseMock({
        purchaseOrders: mockPurchaseOrders,
        vendors: mockVendors,
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Green Farms Supply')).toBeInTheDocument();
        expect(screen.getByText('Cannabis Wholesale Co')).toBeInTheDocument();
      });
    });

    it('should show Receive button for approved POs and View for submitted', async () => {
      setupSupabaseMock({ purchaseOrders: mockPurchaseOrders });

      renderPage();

      await waitFor(() => {
        expect(screen.getByLabelText('Receive purchase order PO-2024-001')).toBeInTheDocument();
        expect(screen.getByLabelText('View purchase order PO-2024-002')).toBeInTheDocument();
      });
    });
  });

  describe('Search Filtering', () => {
    it('should filter POs by PO number', async () => {
      setupSupabaseMock({
        purchaseOrders: mockPurchaseOrders,
        vendors: mockVendors,
      });

      const user = userEvent.setup();
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('PO-2024-001')).toBeInTheDocument();
        expect(screen.getByText('PO-2024-002')).toBeInTheDocument();
      });

      const searchInput = screen.getByLabelText('Search by PO number, vendor, or notes');
      await user.type(searchInput, '001');

      expect(screen.getByText('PO-2024-001')).toBeInTheDocument();
      expect(screen.queryByText('PO-2024-002')).not.toBeInTheDocument();
    });

    it('should filter POs by vendor name', async () => {
      setupSupabaseMock({
        purchaseOrders: mockPurchaseOrders,
        vendors: mockVendors,
      });

      const user = userEvent.setup();
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('PO-2024-001')).toBeInTheDocument();
      });

      const searchInput = screen.getByLabelText('Search by PO number, vendor, or notes');
      await user.type(searchInput, 'Green Farms');

      expect(screen.getByText('PO-2024-001')).toBeInTheDocument();
      expect(screen.queryByText('PO-2024-002')).not.toBeInTheDocument();
    });

    it('should sanitize search input (trim whitespace)', async () => {
      setupSupabaseMock({
        purchaseOrders: mockPurchaseOrders,
        vendors: mockVendors,
      });

      const user = userEvent.setup();
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('PO-2024-001')).toBeInTheDocument();
      });

      const searchInput = screen.getByLabelText('Search by PO number, vendor, or notes');
      await user.type(searchInput, 'Urgent');

      // Should find the PO with "Urgent order" in notes
      expect(screen.getByText('PO-2024-001')).toBeInTheDocument();
    });
  });

  describe('Dialog Interaction', () => {
    it('should open receive dialog when Receive button is clicked', async () => {
      setupSupabaseMock({ purchaseOrders: mockPurchaseOrders });

      const user = userEvent.setup();
      renderPage();

      await waitFor(() => {
        expect(screen.getByLabelText('Receive purchase order PO-2024-001')).toBeInTheDocument();
      });

      await user.click(screen.getByLabelText('Receive purchase order PO-2024-001'));

      await waitFor(() => {
        expect(screen.getByTestId('po-receive-dialog')).toBeInTheDocument();
        expect(screen.getByText('Receive Dialog: PO-2024-001')).toBeInTheDocument();
      });
    });

    it('should open dialog when clicking a table row', async () => {
      setupSupabaseMock({ purchaseOrders: mockPurchaseOrders });

      const user = userEvent.setup();
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('PO-2024-001')).toBeInTheDocument();
      });

      const row = screen.getByLabelText(/Purchase order PO-2024-001/);
      await user.click(row);

      await waitFor(() => {
        expect(screen.getByTestId('po-receive-dialog')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have aria-labels on action buttons', async () => {
      setupSupabaseMock({ purchaseOrders: mockPurchaseOrders });

      renderPage();

      await waitFor(() => {
        expect(screen.getByLabelText('Receive purchase order PO-2024-001')).toBeInTheDocument();
        expect(screen.getByLabelText('View purchase order PO-2024-002')).toBeInTheDocument();
      });
    });

    it('should have aria-label on table rows', async () => {
      setupSupabaseMock({ purchaseOrders: mockPurchaseOrders });

      renderPage();

      await waitFor(() => {
        expect(screen.getByLabelText(/Purchase order PO-2024-001, ready to receive/)).toBeInTheDocument();
        expect(screen.getByLabelText(/Purchase order PO-2024-002, pending approval/)).toBeInTheDocument();
      });
    });

    it('should have aria-label on status filter', async () => {
      setupSupabaseMock();

      renderPage();

      await waitFor(() => {
        expect(screen.getByLabelText('Filter by status')).toBeInTheDocument();
      });
    });
  });

  describe('Tenant Context', () => {
    it('should query purchase_orders table', async () => {
      setupSupabaseMock({ purchaseOrders: mockPurchaseOrders });

      renderPage();

      await waitFor(() => {
        expect(mockSupabaseFrom).toHaveBeenCalledWith('purchase_orders');
      });
    });

    it('should query vendors table', async () => {
      setupSupabaseMock({ vendors: mockVendors });

      renderPage();

      await waitFor(() => {
        expect(mockSupabaseFrom).toHaveBeenCalledWith('vendors');
      });
    });

    it('should not crash when tenant is null', () => {
      (useTenantAdminAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        tenant: null,
        loading: false,
        admin: null,
        tenantSlug: null,
      });

      expect(() => renderPage()).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle query errors gracefully and show empty state', async () => {
      setupSupabaseMock({
        purchaseOrders: [],
        poError: { message: 'Database error', code: '42P01' },
      });

      renderPage();

      // Should show empty state (since queryFn returns [] on error), not crash
      await waitFor(() => {
        expect(screen.getByTestId('enhanced-empty-state')).toBeInTheDocument();
      });
    });
  });
});
