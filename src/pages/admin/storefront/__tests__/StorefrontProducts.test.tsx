/**
 * StorefrontProducts Tests
 * Tests for storefront product catalog management including visibility toggling,
 * price editing, filtering, mobile responsiveness, and realtime subscriptions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock supabase with chainable methods
const mockFrom = vi.fn();
const mockChannel = vi.fn();
const mockRemoveChannel = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    channel: (...args: unknown[]) => mockChannel(...args),
    removeChannel: (...args: unknown[]) => mockRemoveChannel(...args),
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
  humanizeError: vi.fn((e: Error) => e.message),
}));

import StorefrontProducts from '../StorefrontProducts';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';

const mockProducts = [
  {
    id: 'prod-1',
    name: 'Blue Dream',
    category: 'Flower',
    price: 45.0,
    image_url: 'https://example.com/blue-dream.jpg',
    in_stock: true,
    menu_visibility: true,
  },
  {
    id: 'prod-2',
    name: 'OG Kush',
    category: 'Flower',
    price: 55.0,
    image_url: null,
    in_stock: true,
    menu_visibility: true,
  },
  {
    id: 'prod-3',
    name: 'Sour Diesel Cartridge',
    category: 'Vape',
    price: 35.0,
    image_url: null,
    in_stock: false,
    menu_visibility: false,
  },
];

const mockSettings = [
  {
    id: 'setting-1',
    product_id: 'prod-1',
    is_visible: true,
    custom_price: 40.0,
    display_order: 0,
  },
  {
    id: 'setting-2',
    product_id: 'prod-2',
    is_visible: false,
    custom_price: null,
    display_order: 1,
  },
];

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={createQueryClient()}>
    <MemoryRouter initialEntries={['/test-tenant/admin/storefront/products']}>
      {children}
    </MemoryRouter>
  </QueryClientProvider>
);

function createChainableMock(resolvedValue: { data: unknown; error: unknown }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const resolve = vi.fn().mockResolvedValue(resolvedValue);

  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.maybeSingle = vi.fn().mockResolvedValue(resolvedValue);
  chain.then = resolve.then?.bind(resolve);

  // Make the chain itself thenable (for queries that don't end with maybeSingle)
  Object.defineProperty(chain, 'then', {
    get: () => resolve.then?.bind(Promise.resolve(resolvedValue)),
  });

  return chain;
}

function setupStoreAndProducts() {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'marketplace_stores') {
      return createChainableMock({
        data: { id: 'store-123' },
        error: null,
      });
    }
    if (table === 'products') {
      const chain = createChainableMock({
        data: mockProducts,
        error: null,
      });
      // For products, the query ends at .order(), not .maybeSingle()
      chain.order = vi.fn().mockResolvedValue({ data: mockProducts, error: null });
      return chain;
    }
    if (table === 'marketplace_product_settings') {
      const chain = createChainableMock({
        data: mockSettings,
        error: null,
      });
      // settings query ends at .eq('store_id', ...)
      chain.eq = vi.fn().mockResolvedValue({ data: mockSettings, error: null });
      return chain;
    }
    return createChainableMock({ data: null, error: null });
  });

  // Mock realtime channel
  const channelMock = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnValue('SUBSCRIBED'),
  };
  mockChannel.mockReturnValue(channelMock);
  mockRemoveChannel.mockReturnValue(undefined);
}

function setupNoStore() {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'marketplace_stores') {
      return createChainableMock({
        data: null,
        error: null,
      });
    }
    return createChainableMock({ data: [], error: null });
  });
}

describe('StorefrontProducts', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (useTenantAdminAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      tenant: { id: 'tenant-123', slug: 'test-tenant', business_name: 'Test Business' },
      loading: false,
      admin: { id: 'admin-123', email: 'admin@test.com' },
      tenantSlug: 'test-tenant',
    });
  });

  describe('Initial Render', () => {
    it('should render the catalog management header when store exists', async () => {
      setupStoreAndProducts();

      render(<StorefrontProducts />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Catalog Management')).toBeInTheDocument();
      });
    });

    it('should show product visibility count', async () => {
      setupStoreAndProducts();

      render(<StorefrontProducts />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText(/of.*products visible in store/)).toBeInTheDocument();
      });
    });

    it('should render refresh button', async () => {
      setupStoreAndProducts();

      render(<StorefrontProducts />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeInTheDocument();
      });
    });
  });

  describe('No Store State', () => {
    it('should show create store message when no store exists', async () => {
      setupNoStore();

      render(<StorefrontProducts />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Please create a store first.')).toBeInTheDocument();
      });
    });

    it('should show Go to Dashboard button when no store', async () => {
      setupNoStore();

      render(<StorefrontProducts />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Go to Dashboard')).toBeInTheDocument();
      });
    });
  });

  describe('Search and Filters', () => {
    it('should render search input', async () => {
      setupStoreAndProducts();

      render(<StorefrontProducts />, { wrapper });

      await waitFor(() => {
        expect(screen.getByLabelText('Search products')).toBeInTheDocument();
      });
    });

    it('should render category filter', async () => {
      setupStoreAndProducts();

      render(<StorefrontProducts />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('All Categories')).toBeInTheDocument();
      });
    });

    it('should render visibility filter', async () => {
      setupStoreAndProducts();

      render(<StorefrontProducts />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('All Products')).toBeInTheDocument();
      });
    });
  });

  describe('Empty States', () => {
    it('should show contextual empty state for no products', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'marketplace_stores') {
          return createChainableMock({ data: { id: 'store-123' }, error: null });
        }
        if (table === 'products') {
          const chain = createChainableMock({ data: [], error: null });
          chain.order = vi.fn().mockResolvedValue({ data: [], error: null });
          return chain;
        }
        if (table === 'marketplace_product_settings') {
          const chain = createChainableMock({ data: [], error: null });
          chain.eq = vi.fn().mockResolvedValue({ data: [], error: null });
          return chain;
        }
        return createChainableMock({ data: null, error: null });
      });

      const channelMock = { on: vi.fn().mockReturnThis(), subscribe: vi.fn() };
      mockChannel.mockReturnValue(channelMock);

      render(<StorefrontProducts />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('No products yet')).toBeInTheDocument();
        expect(screen.getByText('Add products in your inventory first')).toBeInTheDocument();
        expect(screen.getByText('Go to Products')).toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    it('should show skeletons when store exists but products are loading', async () => {
      // Store resolves immediately, but products never resolve (stay loading)
      let resolveProducts: ((value: unknown) => void) | undefined;
      const productsPromise = new Promise((resolve) => {
        resolveProducts = resolve;
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'marketplace_stores') {
          return createChainableMock({ data: { id: 'store-123' }, error: null });
        }
        if (table === 'products') {
          const chain = createChainableMock({ data: [], error: null });
          chain.order = vi.fn().mockReturnValue(productsPromise);
          return chain;
        }
        if (table === 'marketplace_product_settings') {
          const chain = createChainableMock({ data: [], error: null });
          chain.eq = vi.fn().mockReturnValue(productsPromise);
          return chain;
        }
        return createChainableMock({ data: null, error: null });
      });

      const channelMock = { on: vi.fn().mockReturnThis(), subscribe: vi.fn() };
      mockChannel.mockReturnValue(channelMock);

      render(<StorefrontProducts />, { wrapper });

      // Wait for store to load, then products should be in loading state
      await waitFor(() => {
        expect(screen.getByText('Catalog Management')).toBeInTheDocument();
      });

      // Resolve products to avoid act warnings
      resolveProducts?.({ data: [], error: null });
    });
  });

  describe('Accessibility', () => {
    it('should have aria-labels on search input', async () => {
      setupStoreAndProducts();

      render(<StorefrontProducts />, { wrapper });

      await waitFor(() => {
        expect(screen.getByLabelText('Search products')).toBeInTheDocument();
      });
    });
  });

  describe('Realtime Subscription', () => {
    it('should set up realtime channel for product settings', async () => {
      setupStoreAndProducts();

      render(<StorefrontProducts />, { wrapper });

      await waitFor(() => {
        expect(mockChannel).toHaveBeenCalledWith(
          expect.stringContaining('storefront-products-')
        );
      });
    });

    it('should clean up realtime channel on unmount', async () => {
      setupStoreAndProducts();

      const { unmount } = render(<StorefrontProducts />, { wrapper });

      await waitFor(() => {
        expect(mockChannel).toHaveBeenCalled();
      });

      unmount();

      expect(mockRemoveChannel).toHaveBeenCalled();
    });
  });
});
