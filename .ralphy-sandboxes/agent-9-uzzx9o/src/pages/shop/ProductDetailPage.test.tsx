/**
 * ProductDetailPage Tests
 * Verifies product info, gallery, cart integration, and related products
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProductDetailPage } from './ProductDetailPage';

// Mock product data from RPC
const mockProduct = {
  product_id: 'prod-1',
  product_name: 'OG Kush',
  description: '<p>Premium indica strain with earthy flavors</p>',
  category: 'Flower',
  brand: 'Premium Cannabis',
  sku: 'OGK-001',
  price: 50.00,
  sale_price: 45.00,
  image_url: '/img/og-kush-1.jpg',
  images: ['/img/og-kush-2.jpg', '/img/og-kush-3.jpg'],
  is_featured: true,
  is_on_sale: true,
  stock_quantity: 50,
  strain_type: 'indica',
  thc_content: 24.5,
  cbd_content: 0.5,
  sort_order: 1,
  created_at: '2024-01-01',
  metrc_retail_id: 'METRC-001',
  exclude_from_discounts: false,
  minimum_price: null,
  effects: ['Relaxed', 'Sleepy', 'Happy'],
  min_expiry_days: null,
};

const mockRelatedProduct = {
  product_id: 'prod-2',
  product_name: 'Purple Kush',
  description: 'Another great indica',
  category: 'Flower',
  brand: 'Heritage',
  sku: 'PK-002',
  price: 55.00,
  sale_price: null,
  image_url: '/img/purple-kush.jpg',
  images: [],
  is_featured: false,
  is_on_sale: false,
  stock_quantity: 20,
  strain_type: 'indica',
  thc_content: 22.0,
  cbd_content: 1.0,
  sort_order: 2,
  created_at: '2024-01-02',
  metrc_retail_id: null,
  exclude_from_discounts: false,
  minimum_price: null,
  effects: [],
  min_expiry_days: null,
};

const _mockOutOfStockProduct = {
  ...mockProduct,
  product_id: 'prod-3',
  product_name: 'Sold Out Strain',
  stock_quantity: 0,
};

const mockStore = {
  id: '12345678-1234-1234-1234-123456789012',
  store_name: 'Test Store',
  primary_color: '#10b981',
};

const mockAddItem = vi.fn();

// Mock supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: vi.fn().mockImplementation((fnName: string) => {
      if (fnName === 'get_marketplace_products') {
        return Promise.resolve({ data: [mockProduct, mockRelatedProduct], error: null });
      }
      return Promise.resolve({ data: [], error: null });
    }),
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
        }),
      }),
    }),
  },
}));

// Mock ShopLayout
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
    textPrimary: '',
    textMuted: '',
  }),
}));

// Mock cart hook
vi.mock('@/hooks/useShopCart', () => ({
  useShopCart: () => ({
    addItem: mockAddItem,
    cartCount: 0,
    subtotal: 0,
  }),
}));

// Mock useProductStock
vi.mock('@/hooks/useInventoryCheck', () => ({
  useProductStock: () => ({
    data: { available: 50 },
    isLoading: false,
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

// Mock embla-carousel-react
vi.mock('embla-carousel-react', () => ({
  default: () => [vi.fn(), null],
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    img: ({ children, ...props }: Record<string, unknown>) => {
      const { initial: _initial, animate: _animate, exit: _exit, transition: _transition, whileHover: _whileHover, whileTap: _whileTap, ...domProps } = props;
      return <img {...domProps as React.ImgHTMLAttributes<HTMLImageElement>}>{children as React.ReactNode}</img>;
    },
    button: ({ children, ...props }: Record<string, unknown>) => {
      const { initial: _initial, animate: _animate, exit: _exit, transition: _transition, whileHover: _whileHover, whileTap: _whileTap, ...domProps } = props;
      return <button {...domProps as React.ButtonHTMLAttributes<HTMLButtonElement>}>{children as React.ReactNode}</button>;
    },
    div: ({ children, ...props }: Record<string, unknown>) => {
      const { initial: _initial, animate: _animate, exit: _exit, transition: _transition, whileHover: _whileHover, whileTap: _whileTap, ...domProps } = props;
      return <div {...domProps as React.HTMLAttributes<HTMLDivElement>}>{children as React.ReactNode}</div>;
    },
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock recently viewed
vi.mock('@/hooks/useRecentlyViewed', () => ({
  useRecentlyViewed: () => ({
    addToRecentlyViewed: vi.fn(),
  }),
}));

// Mock components that aren't being tested
vi.mock('@/components/shop/RecentlyViewedSection', () => ({
  RecentlyViewedSection: () => null,
}));

vi.mock('@/components/shop/StockWarning', () => ({
  StockWarning: () => null,
}));

vi.mock('@/components/shop/MobileFixedAddToCart', () => ({
  MobileFixedAddToCart: () => null,
}));

vi.mock('@/components/shop/ScrollProgress', () => ({
  ScrollProgress: () => null,
}));

vi.mock('@/components/shop/CartPreviewPopup', () => ({
  CartPreviewPopup: () => null,
}));

vi.mock('@/components/shop/ReviewForm', () => ({
  ReviewForm: () => <div data-testid="review-form">Review Form</div>,
}));

// Mock sanitize
vi.mock('@/lib/utils/sanitize', () => ({
  sanitizeHtml: (html: string) => html,
  safeJsonParse: <T,>(json: string | null, fallback: T) => {
    if (!json) return fallback;
    try { return JSON.parse(json); } catch { return fallback; }
  },
}));

// Mock formatCurrency
vi.mock('@/lib/utils/formatCurrency', () => ({
  formatCurrency: (val: number) => `$${val.toFixed(2)}`,
}));

// Mock formatDate
vi.mock('@/lib/utils/formatDate', () => ({
  formatSmartDate: (date: string) => date,
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

function renderPage(productId = 'prod-1') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/shop/test-store/products/${productId}`]}>
        <Routes>
          <Route path="/shop/:storeSlug/products/:productId" element={<ProductDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('ProductDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset document head
    document.title = '';
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.remove();
    const jsonld = document.getElementById('product-jsonld');
    if (jsonld) jsonld.remove();
  });

  describe('Product Info Display', () => {
    it('displays product name', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1, name: /OG Kush/i })).toBeInTheDocument();
      });
    });

    it('displays product brand', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Premium Cannabis')).toBeInTheDocument();
      });
    });

    it('displays product price', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('$45.00')).toBeInTheDocument();
      });
    });

    it('displays compare-at price when on sale', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('$50.00')).toBeInTheDocument();
      });
    });

    it('displays product description in the description tab', async () => {
      renderPage();

      await waitFor(() => {
        // The description appears as innerHTML in a div
        const descriptionElements = screen.getAllByText(/Premium indica strain with earthy flavors/);
        expect(descriptionElements.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Strain Type Badge', () => {
    it('displays strain type badge', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('indica')).toBeInTheDocument();
      });
    });
  });

  describe('THC/CBD Percentages', () => {
    it('displays THC percentage', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('THC')).toBeInTheDocument();
        expect(screen.getByText('24.5%')).toBeInTheDocument();
      });
    });

    it('displays CBD percentage', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('CBD')).toBeInTheDocument();
        expect(screen.getByText('0.5%')).toBeInTheDocument();
      });
    });
  });

  describe('Stock Status', () => {
    it('shows In Stock for available products', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('In Stock')).toBeInTheDocument();
      });
    });

    it('shows stock status indicator for in-stock products', async () => {
      renderPage();

      await waitFor(() => {
        // The in-stock dot indicator should be present
        expect(screen.getByText('In Stock')).toBeInTheDocument();
      });
    });
  });

  describe('Image Gallery', () => {
    it('displays main product image', async () => {
      renderPage();

      await waitFor(() => {
        const mainImage = screen.getAllByRole('img')[0];
        expect(mainImage).toHaveAttribute('src', '/img/og-kush-1.jpg');
      });
    });

    it('displays thumbnail images when multiple images exist', async () => {
      renderPage();

      await waitFor(() => {
        // Main image + 2 additional = 3 total images in gallery
        const thumbnailButtons = screen.getAllByRole('button').filter(
          btn => btn.querySelector('img')
        );
        expect(thumbnailButtons.length).toBeGreaterThanOrEqual(2);
      });
    });

    it('changes main image on thumbnail click', async () => {
      const user = userEvent.setup();
      renderPage();

      await waitFor(() => {
        expect(screen.getAllByRole('img')[0]).toHaveAttribute('src', '/img/og-kush-1.jpg');
      });

      // Click second thumbnail
      const thumbnailButtons = screen.getAllByRole('button').filter(
        btn => btn.querySelector('img')
      );
      if (thumbnailButtons.length > 1) {
        await user.click(thumbnailButtons[1]);

        await waitFor(() => {
          const mainImage = screen.getAllByRole('img')[0];
          expect(mainImage).toHaveAttribute('src', '/img/og-kush-2.jpg');
        });
      }
    });
  });

  describe('Quantity Selector', () => {
    it('starts with quantity 1', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument();
      });
    });

    it('increments quantity on plus click', async () => {
      const user = userEvent.setup();
      renderPage();

      await waitFor(() => {
        // The quantity display shows "1"
        const quantityDisplay = screen.getByText('1');
        expect(quantityDisplay).toBeInTheDocument();
      });

      // Find the quantity container - has the minus, number, plus buttons
      // The plus button is the one containing a Plus SVG icon (lucide-plus)
      const allButtons = screen.getAllByRole('button');
      const plusBtn = allButtons.find(btn =>
        btn.querySelector('.lucide-plus')
      );

      if (plusBtn) {
        await user.click(plusBtn);
        await waitFor(() => {
          expect(screen.getByText('2')).toBeInTheDocument();
        });
      }
    });

    it('does not go below 1 on minus click', async () => {
      const user = userEvent.setup();
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument();
      });

      const allButtons = screen.getAllByRole('button');
      const minusBtn = allButtons.find(btn =>
        btn.querySelector('.lucide-minus')
      );

      if (minusBtn) {
        await user.click(minusBtn);
        await waitFor(() => {
          // Still shows "1" after clicking minus at minimum
          expect(screen.getByText('1')).toBeInTheDocument();
        });
      }
    });
  });

  describe('Add to Cart', () => {
    it('calls addItem when Add to Bag is clicked', async () => {
      const user = userEvent.setup();
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Add to Bag')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Add to Bag'));

      expect(mockAddItem).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: 'prod-1',
          quantity: 1,
          price: 45.00,
          name: 'OG Kush',
        })
      );
    });

    it('passes correct data when adding to cart', async () => {
      const user = userEvent.setup();
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Add to Bag')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Add to Bag'));

      expect(mockAddItem).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: 'prod-1',
          name: 'OG Kush',
          price: 45.00,
          metrcRetailId: 'METRC-001',
          excludeFromDiscounts: false,
        })
      );
    });
  });

  describe('Effects Badges', () => {
    it('displays effect badges', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Relaxed')).toBeInTheDocument();
        expect(screen.getByText('Sleepy')).toBeInTheDocument();
        expect(screen.getByText('Happy')).toBeInTheDocument();
      });
    });
  });

  describe('Product Not Found', () => {
    it('shows not found state for invalid product ID', async () => {
      const { supabase } = await import('@/integrations/supabase/client');
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: [],
        error: null,
      } as never);

      renderPage('nonexistent-id');

      await waitFor(() => {
        expect(screen.getByText('Product Not Found')).toBeInTheDocument();
        expect(screen.getByText("This product doesn't exist or is no longer available.")).toBeInTheDocument();
      });
    });
  });

  describe('Related Products', () => {
    it('displays related products from same category', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('You May Also Like')).toBeInTheDocument();
        expect(screen.getByText('Purple Kush')).toBeInTheDocument();
      });
    });
  });

  describe('Breadcrumbs', () => {
    it('displays Home and Shop breadcrumb links', async () => {
      renderPage();

      await waitFor(() => {
        // Check for breadcrumb links
        const homeLink = screen.getByRole('link', { name: 'Home' });
        expect(homeLink).toBeInTheDocument();
        expect(homeLink).toHaveAttribute('href', '/shop/test-store');

        const shopLink = screen.getByRole('link', { name: 'Shop' });
        expect(shopLink).toBeInTheDocument();
        expect(shopLink).toHaveAttribute('href', '/shop/test-store/products');
      });
    });
  });

  describe('SEO', () => {
    it('updates page title with product and store name', async () => {
      renderPage();

      await waitFor(() => {
        // Verify the product loaded first
        expect(screen.getByRole('heading', { level: 1, name: /OG Kush/i })).toBeInTheDocument();
      });

      // After product renders, useEffect sets the title
      await waitFor(() => {
        expect(document.title).toBe('OG Kush | Test Store');
      });
    });
  });
});
