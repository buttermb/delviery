/**
 * ProductSyncPage Tests
 * Tests for product sync page: loading, empty states, search, and sync actions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock chain builder for supabase
const createChain = (resolvedData: unknown = [], resolvedError: unknown = null) => ({
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockResolvedValue({ data: resolvedData, error: resolvedError }),
  maybeSingle: vi.fn().mockResolvedValue({ data: resolvedData, error: resolvedError }),
});

const mockFromFn = vi.fn();
const mockRpcFn = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFromFn(...args),
    rpc: (...args: unknown[]) => mockRpcFn(...args),
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

vi.mock('@/lib/humanizeError', () => ({
  humanizeError: vi.fn((error: unknown, fallback: string) => {
    if (error instanceof Error) return error.message;
    return fallback;
  }),
}));

// Import after mocks
import ProductSyncPage from '../ProductSyncPage';
import { toast } from 'sonner';

const mockStore = { id: 'store-123', store_name: 'Test Store' };
const mockProducts = [
  {
    id: 'prod-1',
    name: 'Blue Dream',
    category: 'flower',
    wholesale_price: 25.0,
    retail_price: 35.0,
    available_quantity: 100,
    image_url: 'https://example.com/blue-dream.jpg',
    marketplace_product_sync: [
      {
        id: 'sync-1',
        sync_status: 'synced',
        last_synced_at: '2026-03-15T10:00:00Z',
        last_attempt_at: '2026-03-15T10:00:00Z',
        sync_errors: null,
        listing_id: 'listing-1',
      },
    ],
  },
  {
    id: 'prod-2',
    name: 'OG Kush',
    category: 'flower',
    wholesale_price: 30.0,
    retail_price: 40.0,
    available_quantity: 50,
    image_url: null,
    marketplace_product_sync: [],
  },
  {
    id: 'prod-3',
    name: 'Gummy Bears',
    category: 'edibles',
    wholesale_price: null,
    retail_price: 15.0,
    available_quantity: 200,
    image_url: null,
    marketplace_product_sync: [
      {
        id: 'sync-3',
        sync_status: 'error',
        last_synced_at: null,
        last_attempt_at: '2026-03-14T10:00:00Z',
        sync_errors: { message: 'Price validation failed' },
        listing_id: null,
      },
    ],
  },
];

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function renderWithProviders(ui: ReactNode) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/test-tenant/admin/marketplace/product-sync']}>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('ProductSyncPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loading state', () => {
    it('shows skeleton while loading store and products', () => {
      // Make the queries hang forever
      const storeChain = createChain();
      storeChain.maybeSingle.mockReturnValue(new Promise(() => {}));
      mockFromFn.mockReturnValue(storeChain);

      renderWithProviders(<ProductSyncPage />);

      // Should not show main content while loading
      expect(screen.queryByText('Product Sync')).not.toBeInTheDocument();
      expect(screen.queryByText('Marketplace Store Required')).not.toBeInTheDocument();
    });
  });

  describe('no store state', () => {
    it('shows store required message when no marketplace store exists', async () => {
      const storeChain = createChain(null);
      const productsChain = createChain([]);

      mockFromFn.mockImplementation((table: string) => {
        if (table === 'marketplace_stores') return storeChain;
        if (table === 'products') return productsChain;
        return createChain();
      });

      renderWithProviders(<ProductSyncPage />);

      await waitFor(() => {
        expect(screen.getByText('Marketplace Store Required')).toBeInTheDocument();
      });

      expect(screen.getByText('Create Store')).toBeInTheDocument();
    });
  });

  describe('with store and products', () => {
    beforeEach(() => {
      const storeChain = createChain(mockStore);
      const productsChain = createChain(mockProducts);

      mockFromFn.mockImplementation((table: string) => {
        if (table === 'marketplace_stores') return storeChain;
        if (table === 'products') return productsChain;
        return createChain();
      });
    });

    it('renders product list with sync status', async () => {
      renderWithProviders(<ProductSyncPage />);

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      });

      expect(screen.getByText('OG Kush')).toBeInTheDocument();
      expect(screen.getByText('Gummy Bears')).toBeInTheDocument();
      expect(screen.getByText('Synced')).toBeInTheDocument();
      expect(screen.getByText('Not Synced')).toBeInTheDocument();
      expect(screen.getByText('Error')).toBeInTheDocument();
    });

    it('renders correct sync action buttons', async () => {
      renderWithProviders(<ProductSyncPage />);

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      });

      // Synced product shows "Update" button
      expect(screen.getByText('Update')).toBeInTheDocument();

      // Not-synced product shows "Sync" button
      const syncButtons = screen.getAllByText('Sync');
      expect(syncButtons.length).toBeGreaterThanOrEqual(1);
    });

    it('has aria-labels on action buttons', async () => {
      renderWithProviders(<ProductSyncPage />);

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      });

      expect(screen.getByLabelText('Update Blue Dream')).toBeInTheDocument();
      expect(screen.getByLabelText('Sync OG Kush')).toBeInTheDocument();
    });

    it('displays category badges', async () => {
      renderWithProviders(<ProductSyncPage />);

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      });

      const flowerBadges = screen.getAllByText('flower');
      expect(flowerBadges.length).toBe(2);
      expect(screen.getByText('edibles')).toBeInTheDocument();
    });
  });

  describe('search filtering', () => {
    beforeEach(() => {
      const storeChain = createChain(mockStore);
      const productsChain = createChain(mockProducts);

      mockFromFn.mockImplementation((table: string) => {
        if (table === 'marketplace_stores') return storeChain;
        if (table === 'products') return productsChain;
        return createChain();
      });
    });

    it('filters products by name', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ProductSyncPage />);

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      });

      const searchInput = screen.getByLabelText('Search products');
      await user.type(searchInput, 'Blue');

      expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      expect(screen.queryByText('OG Kush')).not.toBeInTheDocument();
      expect(screen.queryByText('Gummy Bears')).not.toBeInTheDocument();
    });

    it('filters products by category', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ProductSyncPage />);

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      });

      const searchInput = screen.getByLabelText('Search products');
      await user.type(searchInput, 'edibles');

      expect(screen.queryByText('Blue Dream')).not.toBeInTheDocument();
      expect(screen.getByText('Gummy Bears')).toBeInTheDocument();
    });

    it('shows empty state with clear button when search has no results', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ProductSyncPage />);

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      });

      const searchInput = screen.getByLabelText('Search products');
      await user.type(searchInput, 'nonexistent');

      expect(screen.getByText('No matching products')).toBeInTheDocument();
      expect(screen.getByText('Clear Search')).toBeInTheDocument();
    });

    it('clears search when Clear Search button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ProductSyncPage />);

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      });

      const searchInput = screen.getByLabelText('Search products');
      await user.type(searchInput, 'nonexistent');

      expect(screen.getByText('No matching products')).toBeInTheDocument();

      await user.click(screen.getByText('Clear Search'));

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      });
    });
  });

  describe('empty product list', () => {
    it('shows proper empty state when no products exist', async () => {
      const storeChain = createChain(mockStore);
      const productsChain = createChain([]);

      mockFromFn.mockImplementation((table: string) => {
        if (table === 'marketplace_stores') return storeChain;
        if (table === 'products') return productsChain;
        return createChain();
      });

      renderWithProviders(<ProductSyncPage />);

      await waitFor(() => {
        expect(screen.getByText('No products to sync')).toBeInTheDocument();
      });

      expect(screen.getByText('Add products to your inventory first')).toBeInTheDocument();
    });
  });

  describe('sync actions', () => {
    beforeEach(() => {
      const storeChain = createChain(mockStore);
      const productsChain = createChain(mockProducts);

      mockFromFn.mockImplementation((table: string) => {
        if (table === 'marketplace_stores') return storeChain;
        if (table === 'products') return productsChain;
        return createChain();
      });
    });

    it('calls sync RPC when sync button is clicked', async () => {
      const user = userEvent.setup();
      mockRpcFn.mockResolvedValue({ data: { success: true, listing_id: 'new-listing' }, error: null });

      renderWithProviders(<ProductSyncPage />);

      await waitFor(() => {
        expect(screen.getByText('OG Kush')).toBeInTheDocument();
      });

      // Click the Sync button for OG Kush (not synced)
      const syncButton = screen.getByLabelText('Sync OG Kush');
      await user.click(syncButton);

      await waitFor(() => {
        expect(mockRpcFn).toHaveBeenCalledWith('sync_product_to_marketplace', {
          p_product_id: 'prod-2',
          p_store_id: 'store-123',
        });
      });
    });

    it('shows success toast on successful sync', async () => {
      const user = userEvent.setup();
      mockRpcFn.mockResolvedValue({ data: { success: true, listing_id: 'new-listing' }, error: null });

      renderWithProviders(<ProductSyncPage />);

      await waitFor(() => {
        expect(screen.getByText('OG Kush')).toBeInTheDocument();
      });

      await user.click(screen.getByLabelText('Sync OG Kush'));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Product synced successfully');
      });
    });

    it('shows error toast with humanized message on sync failure', async () => {
      const user = userEvent.setup();
      mockRpcFn.mockResolvedValue({ data: null, error: new Error('RPC error') });

      renderWithProviders(<ProductSyncPage />);

      await waitFor(() => {
        expect(screen.getByText('OG Kush')).toBeInTheDocument();
      });

      await user.click(screen.getByLabelText('Sync OG Kush'));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Sync failed', {
          description: expect.any(String),
        });
      });
    });

    it('shows info toast when all products are already synced during bulk sync', async () => {
      const user = userEvent.setup();

      // Override with all-synced products
      const allSynced = mockProducts.map(p => ({
        ...p,
        marketplace_product_sync: [{
          id: `sync-${p.id}`,
          sync_status: 'synced',
          last_synced_at: '2026-03-15T10:00:00Z',
          last_attempt_at: '2026-03-15T10:00:00Z',
          sync_errors: null,
          listing_id: `listing-${p.id}`,
        }],
      }));

      const productsChain = createChain(allSynced);
      mockFromFn.mockImplementation((table: string) => {
        if (table === 'marketplace_stores') return createChain(mockStore);
        if (table === 'products') return productsChain;
        return createChain();
      });

      renderWithProviders(<ProductSyncPage />);

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      });

      await user.click(screen.getByLabelText('Sync all unsynced products'));

      await waitFor(() => {
        expect(toast.info).toHaveBeenCalledWith('All products are already synced.');
      });
    });
  });

  describe('header controls', () => {
    it('has refresh and bulk sync buttons with aria-labels', async () => {
      const storeChain = createChain(mockStore);
      const productsChain = createChain(mockProducts);

      mockFromFn.mockImplementation((table: string) => {
        if (table === 'marketplace_stores') return storeChain;
        if (table === 'products') return productsChain;
        return createChain();
      });

      renderWithProviders(<ProductSyncPage />);

      await waitFor(() => {
        expect(screen.getByText('Product Sync')).toBeInTheDocument();
      });

      expect(screen.getByLabelText('Refresh product sync status')).toBeInTheDocument();
      expect(screen.getByLabelText('Sync all unsynced products')).toBeInTheDocument();
    });
  });
});
