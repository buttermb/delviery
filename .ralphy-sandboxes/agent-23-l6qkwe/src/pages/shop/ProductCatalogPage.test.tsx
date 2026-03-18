/**
 * ProductCatalogPage Tests
 * Verifies filtering, search, sort, and pagination functionality
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProductCatalogPage } from './ProductCatalogPage';

// Mock store data
const mockStore = {
  id: '12345678-1234-1234-1234-123456789012',
  store_name: 'Test Store',
  primary_color: '#10b981',
};

// Mock product data
const _mockRpcProducts = [
  {
    product_id: 'prod-1',
    product_name: 'OG Kush',
    description: 'Premium indica strain',
    category: 'Flower',
    brand: 'Premium Cannabis',
    sku: 'OGK-001',
    price: 45.00,
    sale_price: null,
    image_url: '/img/og-kush.jpg',
    images: [],
    is_featured: true,
    is_on_sale: false,
    stock_quantity: 50,
    strain_type: 'indica',
    thc_content: 24.5,
    cbd_content: 0.5,
    sort_order: 1,
    created_at: '2024-01-01',
  },
  {
    product_id: 'prod-2',
    product_name: 'Sour Diesel',
    description: 'Energizing sativa',
    category: 'Flower',
    brand: 'Green Farms',
    sku: 'SD-002',
    price: 50.00,
    sale_price: 40.00,
    image_url: '/img/sour-diesel.jpg',
    images: [],
    is_featured: false,
    is_on_sale: true,
    stock_quantity: 30,
    strain_type: 'sativa',
    thc_content: 22.0,
    cbd_content: 1.0,
    sort_order: 2,
    created_at: '2024-01-02',
  },
  {
    product_id: 'prod-3',
    product_name: 'Blue Dream',
    description: 'Balanced hybrid',
    category: 'Flower',
    brand: 'Dream Co',
    sku: 'BD-003',
    price: 55.00,
    sale_price: null,
    image_url: '/img/blue-dream.jpg',
    images: [],
    is_featured: false,
    is_on_sale: false,
    stock_quantity: 0,
    strain_type: 'hybrid',
    thc_content: 20.0,
    cbd_content: 2.0,
    sort_order: 3,
    created_at: '2024-01-03',
  },
  {
    product_id: 'prod-4',
    product_name: 'CBD Balm',
    description: 'Topical CBD product',
    category: 'Topicals',
    brand: 'Healing Hands',
    sku: 'CB-004',
    price: 30.00,
    sale_price: null,
    image_url: '/img/cbd-balm.jpg',
    images: [],
    is_featured: false,
    is_on_sale: false,
    stock_quantity: 100,
    strain_type: null,
    thc_content: 0.3,
    cbd_content: 15.0,
    sort_order: 4,
    created_at: '2024-01-04',
  },
  {
    product_id: 'prod-5',
    product_name: 'Purple Haze',
    description: 'Classic sativa',
    category: 'Flower',
    brand: 'Heritage',
    sku: 'PH-005',
    price: 60.00,
    sale_price: null,
    image_url: '/img/purple-haze.jpg',
    images: [],
    is_featured: false,
    is_on_sale: false,
    stock_quantity: 20,
    strain_type: 'sativa',
    thc_content: 26.0,
    cbd_content: 0.2,
    sort_order: 5,
    created_at: '2024-01-05',
  },
];

// Mock supabase - data must be inlined since vi.mock is hoisted
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: vi.fn().mockResolvedValue({
      data: [
        {
          product_id: 'prod-1', product_name: 'OG Kush', description: 'Premium indica strain',
          category: 'Flower', brand: 'Premium Cannabis', sku: 'OGK-001', price: 45.00,
          sale_price: null, image_url: '/img/og-kush.jpg', images: [], is_featured: true,
          is_on_sale: false, stock_quantity: 50, strain_type: 'indica', thc_content: 24.5,
          cbd_content: 0.5, sort_order: 1, created_at: '2024-01-01',
        },
        {
          product_id: 'prod-2', product_name: 'Sour Diesel', description: 'Energizing sativa',
          category: 'Flower', brand: 'Green Farms', sku: 'SD-002', price: 50.00,
          sale_price: 40.00, image_url: '/img/sour-diesel.jpg', images: [], is_featured: false,
          is_on_sale: true, stock_quantity: 30, strain_type: 'sativa', thc_content: 22.0,
          cbd_content: 1.0, sort_order: 2, created_at: '2024-01-02',
        },
        {
          product_id: 'prod-3', product_name: 'Blue Dream', description: 'Balanced hybrid',
          category: 'Flower', brand: 'Dream Co', sku: 'BD-003', price: 55.00,
          sale_price: null, image_url: '/img/blue-dream.jpg', images: [], is_featured: false,
          is_on_sale: false, stock_quantity: 0, strain_type: 'hybrid', thc_content: 20.0,
          cbd_content: 2.0, sort_order: 3, created_at: '2024-01-03',
        },
        {
          product_id: 'prod-4', product_name: 'CBD Balm', description: 'Topical CBD product',
          category: 'Topicals', brand: 'Healing Hands', sku: 'CB-004', price: 30.00,
          sale_price: null, image_url: '/img/cbd-balm.jpg', images: [], is_featured: false,
          is_on_sale: false, stock_quantity: 100, strain_type: null, thc_content: 0.3,
          cbd_content: 15.0, sort_order: 4, created_at: '2024-01-04',
        },
        {
          product_id: 'prod-5', product_name: 'Purple Haze', description: 'Classic sativa',
          category: 'Flower', brand: 'Heritage', sku: 'PH-005', price: 60.00,
          sale_price: null, image_url: '/img/purple-haze.jpg', images: [], is_featured: false,
          is_on_sale: false, stock_quantity: 20, strain_type: 'sativa', thc_content: 26.0,
          cbd_content: 0.2, sort_order: 5, created_at: '2024-01-05',
        },
      ],
      error: null,
    }),
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    }),
  },
}));

// Mock ShopLayout context
vi.mock('./ShopLayout', () => ({
  useShop: () => ({
    store: mockStore,
    setCartItemCount: vi.fn(),
  }),
}));

// Mock luxury theme
vi.mock('@/components/shop/luxury', () => ({
  useLuxuryTheme: () => ({
    isLuxuryTheme: false,
    accentColor: '#10b981',
    cardBg: '',
    cardBorder: '',
    textMuted: '',
  }),
}));

// Mock wishlist
vi.mock('@/hooks/useWishlist', () => ({
  useWishlist: () => ({
    items: [],
    toggleItem: vi.fn(),
    isInWishlist: () => false,
  }),
}));

// Mock cart
vi.mock('@/hooks/useShopCart', () => ({
  useShopCart: () => ({
    addItem: vi.fn(),
    cartItems: [],
    cartCount: 0,
  }),
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

// Mock FilterDrawer
vi.mock('@/components/shop/FilterDrawer', () => ({
  FilterDrawer: () => null,
  FilterTriggerButton: ({ onClick }: { onClick: () => void }) => (
    <button onClick={onClick} data-testid="filter-trigger">Filters</button>
  ),
  getActiveFilterCount: () => 0,
}));

// Mock ProductQuickViewModal
vi.mock('@/components/shop/ProductQuickViewModal', () => ({
  ProductQuickViewModal: () => null,
}));

// Mock EnhancedPriceSlider
vi.mock('@/components/shop/EnhancedPriceSlider', () => ({
  EnhancedPriceSlider: () => null,
}));

// Mock StockWarning
vi.mock('@/components/shop/StockWarning', () => ({
  StockWarning: () => null,
}));

// Mock StorefrontProductCard
vi.mock('@/components/shop/StorefrontProductCard', () => ({
  StorefrontProductCard: ({ product }: { product: { product_name: string; strain_type: string; thc_content: number | null; price: number } }) => (
    <div data-testid={`product-card-${product.product_name}`}>
      <span data-testid="product-name">{product.product_name}</span>
      <span data-testid="product-strain">{product.strain_type}</span>
      <span data-testid="product-thc">{product.thc_content}</span>
      <span data-testid="product-price">{product.price}</span>
    </div>
  ),
}));

// Mock formatCurrency
vi.mock('@/lib/utils/formatCurrency', () => ({
  formatCurrency: (val: number) => `$${val.toFixed(2)}`,
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock the Select component to avoid Radix pointer capture issues in jsdom
vi.mock('@/components/ui/select', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');

  function MockSelect({ value, onValueChange, children }: { value: string; onValueChange: (val: string) => void; children: React.ReactNode }) {
    // Collect SelectItem options from children
    const options: Array<{ value: string; label: string }> = [];
    function collectOptions(node: React.ReactNode): void {
      React.Children.forEach(node, (child: unknown) => {
        if (!child || typeof child !== 'object' || !('props' in (child as Record<string, unknown>))) return;
        const typedChild = child as { props: Record<string, unknown>; type?: { displayName?: string } };
        if (typedChild.props && typedChild.props['data-mock-option']) {
          options.push({ value: typedChild.props['data-mock-value'] as string, label: typedChild.props['data-mock-label'] as string });
        }
        if (typedChild.props && typedChild.props.children) {
          collectOptions(typedChild.props.children as React.ReactNode);
        }
      });
    }
    collectOptions(children);

    return React.createElement('div', { 'data-testid': 'mock-select', 'data-value': value },
      React.createElement('select', {
        value,
        onChange: (e: React.ChangeEvent<HTMLSelectElement>) => onValueChange(e.target.value),
        'data-testid': 'mock-select-native',
      }, options.map((opt: { value: string; label: string }) =>
        React.createElement('option', { key: opt.value, value: opt.value }, opt.label)
      )),
      children
    );
  }

  return {
    Select: MockSelect,
    SelectTrigger: ({ children }: { children: React.ReactNode }) =>
      React.createElement('div', { 'data-testid': 'mock-select-trigger' }, children),
    SelectValue: ({ placeholder }: { placeholder?: string }) =>
      React.createElement('span', { 'data-testid': 'mock-select-value' }, placeholder),
    SelectContent: ({ children }: { children: React.ReactNode }) =>
      React.createElement('div', { 'data-testid': 'mock-select-content' }, children),
    SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) =>
      React.createElement('div', {
        'data-testid': `select-option-${value}`,
        'data-mock-option': true,
        'data-mock-value': value,
        'data-mock-label': typeof children === 'string' ? children : value,
      }, children),
  };
});

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/shop/test-store/products']}>
        <Routes>
          <Route path="/shop/:storeSlug/products" element={<ProductCatalogPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('ProductCatalogPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Display', () => {
    it('renders all synced products', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('product-card-OG Kush')).toBeInTheDocument();
        expect(screen.getByTestId('product-card-Sour Diesel')).toBeInTheDocument();
        expect(screen.getByTestId('product-card-Blue Dream')).toBeInTheDocument();
        expect(screen.getByTestId('product-card-CBD Balm')).toBeInTheDocument();
        expect(screen.getByTestId('product-card-Purple Haze')).toBeInTheDocument();
      });
    });

    it('shows product count', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText(/5 products found/i)).toBeInTheDocument();
      });
    });
  });

  describe('Search', () => {
    it('filters products by name search', async () => {
      const user = userEvent.setup();
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('product-card-OG Kush')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search products...');
      await user.type(searchInput, 'OG Kush');

      await waitFor(() => {
        expect(screen.getByTestId('product-card-OG Kush')).toBeInTheDocument();
        expect(screen.queryByTestId('product-card-Sour Diesel')).not.toBeInTheDocument();
      });
    });

    it('filters products by description search', async () => {
      const user = userEvent.setup();
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('product-card-OG Kush')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search products...');
      await user.type(searchInput, 'Energizing');

      await waitFor(() => {
        expect(screen.getByTestId('product-card-Sour Diesel')).toBeInTheDocument();
        expect(screen.queryByTestId('product-card-OG Kush')).not.toBeInTheDocument();
      });
    });

    it('filters products by brand search', async () => {
      const user = userEvent.setup();
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('product-card-OG Kush')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search products...');
      await user.type(searchInput, 'Heritage');

      await waitFor(() => {
        expect(screen.getByTestId('product-card-Purple Haze')).toBeInTheDocument();
        expect(screen.queryByTestId('product-card-OG Kush')).not.toBeInTheDocument();
      });
    });
  });

  describe('Category Filter', () => {
    it('renders category filter with product categories from data', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('product-card-OG Kush')).toBeInTheDocument();
      });

      // Verify category options are rendered from product data
      // The Flower and Topicals categories come from our mock products
      expect(screen.getByTestId('select-option-Flower')).toBeInTheDocument();
      expect(screen.getByTestId('select-option-Topicals')).toBeInTheDocument();
    });
  });

  describe('Strain Type Filter', () => {
    it('renders strain type filter options', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('product-card-OG Kush')).toBeInTheDocument();
      });

      // Verify strain type options exist
      expect(screen.getByText('Indica')).toBeInTheDocument();
      expect(screen.getByText('Sativa')).toBeInTheDocument();
      expect(screen.getByText('Hybrid')).toBeInTheDocument();
    });

    it('renders all strain types in the All Strains default state', async () => {
      renderPage();

      await waitFor(() => {
        // All products should be visible when no strain filter is applied
        expect(screen.getByTestId('product-card-OG Kush')).toBeInTheDocument();
        expect(screen.getByTestId('product-card-Sour Diesel')).toBeInTheDocument();
        expect(screen.getByTestId('product-card-Blue Dream')).toBeInTheDocument();
      });
    });
  });

  describe('Sort Options', () => {
    it('renders sort options including THC%', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('product-card-OG Kush')).toBeInTheDocument();
      });

      // Verify sort options are rendered
      expect(screen.getByText('Name A-Z')).toBeInTheDocument();
      expect(screen.getByText('Price: Low to High')).toBeInTheDocument();
      expect(screen.getByText('Price: High to Low')).toBeInTheDocument();
      expect(screen.getByText('THC%: High to Low')).toBeInTheDocument();
      expect(screen.getByText('THC%: Low to High')).toBeInTheDocument();
    });

    it('sorts products by name A-Z by default', async () => {
      renderPage();

      await waitFor(() => {
        const products = screen.getAllByTestId(/^product-card-/);
        // Alphabetical: Blue Dream, CBD Balm, OG Kush, Purple Haze, Sour Diesel
        expect(products[0]).toHaveTextContent('Blue Dream');
        expect(products[4]).toHaveTextContent('Sour Diesel');
      });
    });
  });

  describe('Active Filters', () => {
    it('shows active search filter badge', async () => {
      const user = userEvent.setup();
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('product-card-OG Kush')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search products...');
      await user.type(searchInput, 'OG');

      await waitFor(() => {
        expect(screen.getByText('Search: OG')).toBeInTheDocument();
      });
    });

    it('clears all filters when Clear All is clicked', async () => {
      const user = userEvent.setup();
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('product-card-OG Kush')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search products...');
      await user.type(searchInput, 'OG');

      await waitFor(() => {
        expect(screen.getByText('Clear All')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Clear All'));

      await waitFor(() => {
        expect(screen.getAllByTestId(/^product-card-/)).toHaveLength(5);
      });
    });
  });

  describe('Loading and Error States', () => {
    it('shows empty state when no products match filters', async () => {
      const user = userEvent.setup();
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('product-card-OG Kush')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search products...');
      await user.type(searchInput, 'nonexistent product xyz');

      await waitFor(() => {
        expect(screen.getByText('No products found')).toBeInTheDocument();
        expect(screen.getByText('Try adjusting your search or filters')).toBeInTheDocument();
      });
    });
  });
});
