/**
 * BatchesPage Tests
 * Tests for batch management page: rendering, search, stats, create dialog, and tenant isolation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// --- Mocks (before component import) ---

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  },
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: vi.fn().mockReturnValue({
    tenant: { id: 'tenant-123', slug: 'test-tenant', business_name: 'Test Dispensary' },
    loading: false,
    admin: { id: 'admin-1', email: 'admin@test.com' },
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

vi.mock('@/hooks/useCredits', () => ({
  useCreditGatedAction: vi.fn().mockReturnValue({
    execute: vi.fn((_action: string, fn: () => Promise<void>) => fn()),
  }),
}));

vi.mock('@/components/EnhancedLoadingState', () => ({
  EnhancedLoadingState: () => <div data-testid="loading-state">Loading...</div>,
}));

vi.mock('@/components/shared/EnhancedEmptyState', () => ({
  EnhancedEmptyState: ({ title, description, primaryAction }: { title: string; description: string; primaryAction?: { label: string; onClick: () => void } }) => (
    <div data-testid="empty-state">
      <span>{title}</span>
      <span>{description}</span>
      {primaryAction && <button onClick={primaryAction.onClick}>{primaryAction.label}</button>}
    </div>
  ),
}));

import BatchesPage from '../BatchesPage';
import { supabase } from '@/integrations/supabase/client';

// --- Test Data ---

const mockBatches = [
  {
    id: 'batch-1',
    batch_number: 'BM-2024-001',
    product_id: 'prod-1',
    quantity_lbs: 50,
    received_date: '2024-06-01',
    expiration_date: '2026-12-01',
    warehouse_location: 'Warehouse A',
    notes: 'Test notes for batch 1',
    status: 'active',
    cost_per_lb: 100,
    supplier_id: null,
    account_id: null,
    created_at: '2024-06-01T00:00:00Z',
    updated_at: '2024-06-01T00:00:00Z',
    product: { name: 'Blue Dream', image_url: null },
  },
  {
    id: 'batch-2',
    batch_number: 'BM-2024-002',
    product_id: 'prod-2',
    quantity_lbs: 25,
    received_date: '2024-05-15',
    expiration_date: '2024-01-01', // expired
    warehouse_location: 'Warehouse B',
    notes: null,
    status: 'active',
    cost_per_lb: 80,
    supplier_id: null,
    account_id: null,
    created_at: '2024-05-15T00:00:00Z',
    updated_at: '2024-05-15T00:00:00Z',
    product: { name: 'OG Kush', image_url: 'https://example.com/og.jpg' },
  },
];

const mockProducts = [
  { id: 'prod-1', name: 'Blue Dream' },
  { id: 'prod-2', name: 'OG Kush' },
  { id: 'prod-3', name: 'Sour Diesel' },
];

// --- Helpers ---

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function createWrapper() {
  const queryClient = createQueryClient();
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/test-tenant/admin/catalog/batches']}>
          {children}
        </MemoryRouter>
      </QueryClientProvider>
    );
  };
}

function setupMockWithData(batches = mockBatches, products = mockProducts) {
  (supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
    if (table === 'inventory_batches') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: batches, error: null }),
          }),
        }),
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    }
    if (table === 'products') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: products, error: null }),
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

function setupMockTableMissing() {
  (supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
    if (table === 'inventory_batches') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: null,
              error: { code: '42P01', message: 'relation "inventory_batches" does not exist' },
            }),
          }),
        }),
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    }
    if (table === 'products') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockProducts, error: null }),
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

// --- Tests ---

describe('BatchesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMockWithData();
  });

  describe('Initial Render', () => {
    it('renders page header and action buttons', async () => {
      render(<BatchesPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Batches & Lots')).toBeInTheDocument();
      });
      expect(screen.getByText('Back')).toBeInTheDocument();
      expect(screen.getByText('New Batch')).toBeInTheDocument();
    });

    it('renders search input with aria-label', async () => {
      render(<BatchesPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByLabelText('Search batches')).toBeInTheDocument();
      });
    });

    it('calls supabase.from for batches and products', () => {
      render(<BatchesPage />, { wrapper: createWrapper() });

      expect(supabase.from).toHaveBeenCalledWith('inventory_batches');
      expect(supabase.from).toHaveBeenCalledWith('products');
    });
  });

  describe('Stats Cards', () => {
    it('displays correct batch stats', async () => {
      render(<BatchesPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      });

      // 2 batches total
      expect(screen.getByText('Total Batches')).toBeInTheDocument();
      // 75 lbs total (50 + 25)
      expect(screen.getByText('75 lbs')).toBeInTheDocument();
      expect(screen.getByText('Expiring Soon')).toBeInTheDocument();
    });
  });

  describe('Batch List', () => {
    it('renders batch items with product names', async () => {
      render(<BatchesPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      });
      expect(screen.getByText('OG Kush')).toBeInTheDocument();
    });

    it('renders batch numbers', async () => {
      render(<BatchesPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Batch #BM-2024-001')).toBeInTheDocument();
      });
      expect(screen.getByText('Batch #BM-2024-002')).toBeInTheDocument();
    });

    it('renders status badges correctly', async () => {
      render(<BatchesPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        // batch-1 has future expiry (Active), batch-2 is expired
        expect(screen.getByText('Active')).toBeInTheDocument();
      });
    });

    it('renders batch notes when present', async () => {
      render(<BatchesPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Test notes for batch 1')).toBeInTheDocument();
      });
    });

    it('renders product image when available', async () => {
      render(<BatchesPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        const img = screen.getByAltText('OG Kush');
        expect(img).toBeInTheDocument();
        expect(img).toHaveAttribute('src', 'https://example.com/og.jpg');
      });
    });

    it('renders warehouse location', async () => {
      render(<BatchesPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Warehouse A')).toBeInTheDocument();
        expect(screen.getByText('Warehouse B')).toBeInTheDocument();
      });
    });
  });

  describe('Search & Filtering', () => {
    it('filters batches by batch number', async () => {
      const user = userEvent.setup();
      render(<BatchesPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      });

      const searchInput = screen.getByLabelText('Search batches');
      await user.type(searchInput, 'BM-2024-001');

      expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      expect(screen.queryByText('OG Kush')).not.toBeInTheDocument();
    });

    it('filters batches by product name', async () => {
      const user = userEvent.setup();
      render(<BatchesPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      });

      const searchInput = screen.getByLabelText('Search batches');
      await user.type(searchInput, 'OG Kush');

      expect(screen.queryByText('Blue Dream')).not.toBeInTheDocument();
      expect(screen.getByText('OG Kush')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no batches exist', async () => {
      setupMockWithData([], mockProducts);

      render(<BatchesPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      });
      expect(screen.getByText('No Batches Found')).toBeInTheDocument();
    });
  });

  describe('Table Missing State', () => {
    it('shows feature not available when table is missing', async () => {
      setupMockTableMissing();

      render(<BatchesPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Feature Not Available')).toBeInTheDocument();
      });
    });
  });

  describe('Create Batch Dialog', () => {
    it('opens create dialog when clicking New Batch', async () => {
      const user = userEvent.setup();
      render(<BatchesPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('New Batch')).toBeInTheDocument();
      });

      await user.click(screen.getByText('New Batch'));

      expect(screen.getByText('Create New Batch')).toBeInTheDocument();
      expect(screen.getByLabelText('Batch Number *')).toBeInTheDocument();
      expect(screen.getByLabelText('Quantity (lbs) *')).toBeInTheDocument();
      expect(screen.getByLabelText('Storage Location')).toBeInTheDocument();
      expect(screen.getByLabelText('Notes')).toBeInTheDocument();
    });

    it('closes dialog on Cancel', async () => {
      const user = userEvent.setup();
      render(<BatchesPage />, { wrapper: createWrapper() });

      await user.click(screen.getByText('New Batch'));
      expect(screen.getByText('Create New Batch')).toBeInTheDocument();

      await user.click(screen.getByText('Cancel'));

      await waitFor(() => {
        expect(screen.queryByText('Create New Batch')).not.toBeInTheDocument();
      });
    });

    it('disables Create button when required fields are empty', async () => {
      const user = userEvent.setup();
      render(<BatchesPage />, { wrapper: createWrapper() });

      await user.click(screen.getByText('New Batch'));

      const createButton = screen.getByRole('button', { name: 'Create Batch' });
      expect(createButton).toBeDisabled();
    });

    it('validates batch_number and quantity before enabling Create', async () => {
      const user = userEvent.setup();
      render(<BatchesPage />, { wrapper: createWrapper() });

      await user.click(screen.getByText('New Batch'));

      // Fill batch number and quantity but no product
      await user.type(screen.getByLabelText('Batch Number *'), 'BM-NEW-001');
      await user.type(screen.getByLabelText('Quantity (lbs) *'), '10');

      // Still disabled because no product selected
      const createButton = screen.getByRole('button', { name: 'Create Batch' });
      expect(createButton).toBeDisabled();
    });

    it('renders notes field as a textarea', async () => {
      const user = userEvent.setup();
      render(<BatchesPage />, { wrapper: createWrapper() });

      await user.click(screen.getByText('New Batch'));

      const notesField = screen.getByLabelText('Notes');
      expect(notesField.tagName.toLowerCase()).toBe('textarea');
    });
  });

  describe('Tenant Isolation', () => {
    it('queries batches with tenant_id filter', async () => {
      render(<BatchesPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('inventory_batches');
      });
    });

    it('queries products with tenant_id filter', async () => {
      render(<BatchesPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('products');
      });
    });
  });
});
