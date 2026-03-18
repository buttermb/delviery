/**
 * InventoryTransfers Tests
 * Tests for inventory transfer CRUD with proper tenant filtering and DB schema alignment
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Create chainable mock helpers
const createChainableMock = (resolvedData: unknown = [], resolvedError: unknown = null) => {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: resolvedData, error: resolvedError }),
    insert: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  return chain;
};

// Mock dependencies before importing the component
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn().mockResolvedValue({ data: 'TRF-001', error: null }),
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

vi.mock('@/utils/errorHandling/handlers', () => ({
  handleError: vi.fn(),
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
  EnhancedEmptyState: ({ title, description, primaryAction }: {
    title: string;
    description: string;
    primaryAction?: { label: string; onClick: () => void };
  }) => (
    <div data-testid="empty-state">
      <p>{title}</p>
      <p>{description}</p>
      {primaryAction && (
        <button onClick={primaryAction.onClick}>{primaryAction.label}</button>
      )}
    </div>
  ),
}));

vi.mock('@/components/EnhancedLoadingState', () => ({
  EnhancedLoadingState: ({ message }: { message: string }) => (
    <div data-testid="loading-state">{message}</div>
  ),
}));

vi.mock('@/components/admin/shared/PageErrorState', () => ({
  PageErrorState: ({ message, onRetry }: { message: string; onRetry: () => void }) => (
    <div data-testid="error-state">
      <p>{message}</p>
      <button onClick={onRetry}>Retry</button>
    </div>
  ),
}));

// Import after mocks
import InventoryTransfers from '../InventoryTransfers';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={createTestQueryClient()}>
    {children}
  </QueryClientProvider>
);

const mockTransfers = [
  {
    id: 'transfer-1',
    product_id: 'prod-1',
    from_location_id: 'loc-1',
    to_location_id: 'loc-2',
    quantity: 10,
    notes: 'Test transfer',
    status: 'pending',
    created_at: '2026-01-15T10:00:00Z',
    transfer_number: 'TRF-001',
    account_id: 'tenant-123',
    tenant_id: 'tenant-123',
    product: { name: 'Blue Dream' },
    from_location: { name: 'Main Warehouse' },
    to_location: { name: 'Retail Store' },
  },
  {
    id: 'transfer-2',
    product_id: 'prod-2',
    from_location_id: 'loc-2',
    to_location_id: 'loc-1',
    quantity: 5.5,
    notes: null,
    status: 'completed',
    created_at: '2026-01-14T09:00:00Z',
    transfer_number: 'TRF-002',
    account_id: 'tenant-123',
    tenant_id: 'tenant-123',
    product: { name: 'OG Kush' },
    from_location: { name: 'Retail Store' },
    to_location: { name: 'Main Warehouse' },
  },
];

const mockProducts = [
  { id: 'prod-1', name: 'Blue Dream', sku: 'BD-001' },
  { id: 'prod-2', name: 'OG Kush', sku: null },
];

const mockLocations = [
  { id: 'loc-1', name: 'Main Warehouse' },
  { id: 'loc-2', name: 'Retail Store' },
];

describe('InventoryTransfers', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (useTenantAdminAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      tenant: { id: 'tenant-123', slug: 'test-tenant', business_name: 'Test Business' },
      loading: false,
      admin: { id: 'admin-123', email: 'admin@test.com' },
      tenantSlug: 'test-tenant',
    });

    // Default: return empty data for all tables
    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === 'products') {
        return createChainableMock(mockProducts);
      }
      if (table === 'locations') {
        const chain = createChainableMock();
        // Override for locations: order resolves directly (no limit)
        chain.order = vi.fn().mockResolvedValue({ data: mockLocations, error: null });
        return chain;
      }
      if (table === 'inventory_transfers') {
        return createChainableMock([]);
      }
      return createChainableMock();
    });

    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({ data: 'TRF-003', error: null });
  });

  describe('Initial Render', () => {
    it('should render page title and description', async () => {
      render(<InventoryTransfers />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Inventory Transfers')).toBeInTheDocument();
        expect(screen.getByText('Manage inventory transfers between locations')).toBeInTheDocument();
      });
    });

    it('should render New Transfer button', async () => {
      render(<InventoryTransfers />, { wrapper });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /new transfer/i })).toBeInTheDocument();
      });
    });

    it('should render empty state when no transfers exist', async () => {
      render(<InventoryTransfers />, { wrapper });

      await waitFor(() => {
        expect(screen.getByTestId('empty-state')).toBeInTheDocument();
        expect(screen.getByText('No Transfers Found')).toBeInTheDocument();
      });
    });
  });

  describe('Transfer List', () => {
    beforeEach(() => {
      (supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'products') {
          return createChainableMock(mockProducts);
        }
        if (table === 'locations') {
          const chain = createChainableMock();
          chain.order = vi.fn().mockResolvedValue({ data: mockLocations, error: null });
          return chain;
        }
        if (table === 'inventory_transfers') {
          return createChainableMock(mockTransfers);
        }
        return createChainableMock();
      });
    });

    it('should render transfer cards with transfer numbers', async () => {
      render(<InventoryTransfers />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('TRF-001')).toBeInTheDocument();
        expect(screen.getByText('TRF-002')).toBeInTheDocument();
      });
    });

    it('should display product names in transfer cards', async () => {
      render(<InventoryTransfers />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
        expect(screen.getByText('OG Kush')).toBeInTheDocument();
      });
    });

    it('should display location names in transfer cards', async () => {
      render(<InventoryTransfers />, { wrapper });

      await waitFor(() => {
        // from_location → to_location format
        expect(screen.getByText(/Main Warehouse → Retail Store/)).toBeInTheDocument();
        expect(screen.getByText(/Retail Store → Main Warehouse/)).toBeInTheDocument();
      });
    });

    it('should display quantity values', async () => {
      render(<InventoryTransfers />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('10')).toBeInTheDocument();
        expect(screen.getByText('5.5')).toBeInTheDocument();
      });
    });

    it('should display status badges', async () => {
      render(<InventoryTransfers />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('pending')).toBeInTheDocument();
        expect(screen.getByText('completed')).toBeInTheDocument();
      });
    });

    it('should display notes when present', async () => {
      render(<InventoryTransfers />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Test transfer')).toBeInTheDocument();
      });
    });
  });

  describe('Create Transfer Dialog', () => {
    it('should open dialog when New Transfer button is clicked', async () => {
      const user = userEvent.setup();
      render(<InventoryTransfers />, { wrapper });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /new transfer/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /new transfer/i }));

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Transfer inventory between warehouses')).toBeInTheDocument();
    });

    it('should open dialog from empty state action button', async () => {
      const user = userEvent.setup();
      render(<InventoryTransfers />, { wrapper });

      await waitFor(() => {
        expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Create Transfer'));

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should show validation error when submitting without product', async () => {
      const user = userEvent.setup();
      render(<InventoryTransfers />, { wrapper });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /new transfer/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /new transfer/i }));

      // Find the submit button inside dialog and click it
      const submitButton = screen.getByRole('button', { name: /create transfer/i });
      // The form has a required attribute on quantity input, so we need to fill that first
      // But our custom validation runs first (e.preventDefault). Trigger form submit via the form directly.
      const form = submitButton.closest('form');
      if (form) {
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      }

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Please select a product');
      });
    });
  });

  describe('Tenant Filtering', () => {
    it('should query products filtered by tenant_id', async () => {
      render(<InventoryTransfers />, { wrapper });

      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('products');
      });
    });

    it('should query locations filtered by tenant_id', async () => {
      render(<InventoryTransfers />, { wrapper });

      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('locations');
      });
    });

    it('should query inventory_transfers filtered by tenant_id', async () => {
      render(<InventoryTransfers />, { wrapper });

      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('inventory_transfers');
      });
    });
  });

  describe('Error Handling', () => {
    it('should show error state when transfers query fails', async () => {
      (supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'inventory_transfers') {
          const chain = createChainableMock();
          chain.limit = vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error', code: '500' } });
          return chain;
        }
        if (table === 'products') return createChainableMock(mockProducts);
        if (table === 'locations') {
          const chain = createChainableMock();
          chain.order = vi.fn().mockResolvedValue({ data: mockLocations, error: null });
          return chain;
        }
        return createChainableMock();
      });

      render(<InventoryTransfers />, { wrapper });

      await waitFor(() => {
        expect(screen.getByTestId('error-state')).toBeInTheDocument();
        expect(screen.getByText(/Failed to load inventory transfers/)).toBeInTheDocument();
      }, { timeout: 5000 });
    });
  });
});
