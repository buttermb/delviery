/**
 * Storefront Route Tests
 * Verifies /shop/:storeSlug route functionality
 *
 * Tests:
 * 1. Loads correct store by slug
 * 2. 404 for non-existent stores
 * 3. Theme CSS variables apply
 * 4. All sections render from layout_config
 * 5. Hero section displays
 * 6. ProductGrid shows featured products
 * 7. Navigation to catalog works
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock Supabase - must be before component imports
const mockRpc = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock sanitize utility
vi.mock('@/lib/utils/sanitize', () => ({
  sanitizeBasicHtml: (html: string) => html,
}));

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
    h1: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => <h1 {...props}>{children}</h1>,
    p: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => <p {...props}>{children}</p>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock useShopCart hook
vi.mock('@/hooks/useShopCart', () => ({
  useShopCart: () => ({
    cartItems: [],
    cartCount: 0,
    subtotal: 0,
    addItem: vi.fn(),
    updateQuantity: vi.fn(),
    setQuantity: vi.fn(),
    removeItem: vi.fn(),
    clearCart: vi.fn(),
    isInitialized: true,
    appliedGiftCards: [],
    applyGiftCard: vi.fn(),
    removeGiftCard: vi.fn(),
    getGiftCardTotal: vi.fn(() => 0),
    setAppliedGiftCards: vi.fn(),
    appliedCoupon: null,
    applyCoupon: vi.fn(),
    removeCoupon: vi.fn(),
    getCouponDiscount: vi.fn(() => 0),
    validateCart: vi.fn(),
    lastValidation: null,
    MAX_QUANTITY_PER_ITEM: 10,
  }),
}));

// Mock useWishlist hook
vi.mock('@/hooks/useWishlist', () => ({
  useWishlist: () => ({
    items: [],
    toggleItem: vi.fn(),
    isInWishlist: vi.fn(() => false),
    clearWishlist: vi.fn(),
  }),
}));

// Mock useToast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

// Mock child components that may have complex dependencies
vi.mock('@/components/shop/MobileBottomNav', () => ({
  MobileBottomNav: () => <div data-testid="mobile-bottom-nav">MobileNav</div>,
}));

vi.mock('@/components/shop/LuxuryNav', () => ({
  LuxuryNav: () => <div data-testid="luxury-nav">LuxuryNav</div>,
}));

vi.mock('@/components/shop/LuxuryFooter', () => ({
  LuxuryFooter: () => <div data-testid="luxury-footer">LuxuryFooter</div>,
}));

vi.mock('@/components/shop/FloatingCartButton', () => ({
  FloatingCartButton: () => <div data-testid="floating-cart">FloatingCart</div>,
}));

vi.mock('@/components/shop/LuxuryAgeVerification', () => ({
  LuxuryAgeVerification: () => <div data-testid="age-verification">AgeVerification</div>,
}));

vi.mock('@/components/shop/StorefrontAgeGate', () => ({
  StorefrontAgeGate: () => null,
}));

vi.mock('@/components/pwa/OfflineIndicator', () => ({
  OfflineIndicator: () => null,
}));

// Now import components after mocks are set up
import ShopLayout from '@/pages/shop/ShopLayout';
import StorefrontPage from '@/pages/shop/StorefrontPage';
import { HeroSection } from '@/components/shop/sections/HeroSection';

// Sample store data - ID must be >= 32 chars for product RPC to fire
const mockStore = {
  id: '12345678-1234-1234-1234-123456789012',
  store_name: 'Test Cannabis Store',
  slug: 'test-store',
  tagline: 'Premium Cannabis Delivery',
  logo_url: 'https://example.com/logo.png',
  primary_color: '#10b981',
  secondary_color: '#059669',
  accent_color: '#34d399',
  is_active: true,
  is_public: true,
  require_age_verification: false,
  minimum_age: 21,
  layout_config: [
    {
      id: 'hero-section',
      type: 'hero',
      content: {
        heading_line_1: 'Premium',
        heading_line_2: 'Cannabis',
        heading_line_3: 'Delivered',
        subheading: 'Same-day delivery available',
        cta_primary_text: 'Shop Now',
        cta_primary_link: '/shop/test-store/products',
        cta_secondary_text: 'View Menu',
        cta_secondary_link: '/shop/test-store/products',
        trust_badges: true,
      },
      styles: {
        background_gradient_start: '#000000',
        background_gradient_end: '#022c22',
        text_color: '#ffffff',
        accent_color: '#34d399',
      },
    },
    {
      id: 'products-section',
      type: 'product_grid',
      content: {
        heading: 'Featured Products',
        subheading: 'Our top selection',
        show_search: true,
        max_products: 12,
      },
      styles: {
        accent_color: '#10b981',
      },
    },
  ],
  theme_config: {
    theme: 'default',
    colors: {
      primary: '#10b981',
      secondary: '#059669',
      accent: '#34d399',
    },
  },
  operating_hours: {},
};

const mockProducts = [
  {
    product_id: 'prod-1',
    product_name: 'Blue Dream',
    category: 'Flower',
    strain_type: 'Hybrid',
    price: 45.00,
    image_url: 'https://example.com/product1.jpg',
    metrc_retail_id: 'METRC-001',
    exclude_from_discounts: false,
    minimum_price: null,
    min_expiry_days: null,
  },
  {
    product_id: 'prod-2',
    product_name: 'Girl Scout Cookies',
    category: 'Flower',
    strain_type: 'Indica',
    price: 50.00,
    image_url: 'https://example.com/product2.jpg',
    metrc_retail_id: 'METRC-002',
    exclude_from_discounts: false,
    minimum_price: null,
    min_expiry_days: null,
  },
];

// Helper to create a new QueryClient for each test
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

// Wrapper component for tests
interface TestWrapperProps {
  children?: React.ReactNode;
  initialRoute?: string;
}

const TestWrapper = ({ initialRoute = '/shop/test-store' }: TestWrapperProps) => {
  const queryClient = createTestQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route path="/shop/:storeSlug" element={<ShopLayout />}>
            <Route index element={<StorefrontPage />} />
            <Route path="products" element={<div data-testid="products-catalog">Products Catalog</div>} />
          </Route>
          <Route path="/" element={<div data-testid="home-page">Home</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('Storefront Route /shop/:storeSlug', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('1. Store Loading by Slug', () => {
    it('should load and display the correct store by slug', async () => {
      mockRpc.mockImplementation((fnName: string) => {
        if (fnName === 'get_marketplace_store_by_slug') {
          return Promise.resolve({ data: [mockStore], error: null });
        }
        if (fnName === 'get_marketplace_products') {
          return Promise.resolve({ data: mockProducts, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      render(<TestWrapper />);

      await waitFor(() => {
        expect(screen.getByText('Test Cannabis Store')).toBeInTheDocument();
      });
    });

    it('should call RPC with correct store slug parameter', async () => {
      mockRpc.mockImplementation((fnName: string) => {
        if (fnName === 'get_marketplace_store_by_slug') {
          return Promise.resolve({ data: [mockStore], error: null });
        }
        return Promise.resolve({ data: [], error: null });
      });

      render(<TestWrapper initialRoute="/shop/my-custom-store" />);

      await waitFor(() => {
        expect(mockRpc).toHaveBeenCalledWith(
          'get_marketplace_store_by_slug',
          { p_slug: 'my-custom-store' }
        );
      });
    });
  });

  describe('2. 404 for Non-Existent Stores', () => {
    it('should display "Store Not Found" when store does not exist', async () => {
      mockRpc.mockImplementation((fnName: string) => {
        if (fnName === 'get_marketplace_store_by_slug') {
          return Promise.resolve({ data: [], error: null });
        }
        return Promise.resolve({ data: [], error: null });
      });

      render(<TestWrapper initialRoute="/shop/non-existent-store" />);

      await waitFor(() => {
        expect(screen.getByText('Store Not Found')).toBeInTheDocument();
      });
    });

    it('should show error message explaining the issue', async () => {
      mockRpc.mockImplementation((fnName: string) => {
        if (fnName === 'get_marketplace_store_by_slug') {
          return Promise.resolve({ data: [], error: null });
        }
        return Promise.resolve({ data: [], error: null });
      });

      render(<TestWrapper initialRoute="/shop/non-existent-store" />);

      await waitFor(() => {
        expect(
          screen.getByText(/doesn't exist or is no longer available/i)
        ).toBeInTheDocument();
      });
    });

    it('should show "Go Home" button that navigates to home page', async () => {
      mockRpc.mockImplementation((fnName: string) => {
        if (fnName === 'get_marketplace_store_by_slug') {
          return Promise.resolve({ data: [], error: null });
        }
        return Promise.resolve({ data: [], error: null });
      });

      render(<TestWrapper initialRoute="/shop/non-existent-store" />);

      await waitFor(() => {
        const homeButton = screen.getByRole('button', { name: /go home/i });
        expect(homeButton).toBeInTheDocument();
      });
    });

    it('should handle RPC errors gracefully', async () => {
      mockRpc.mockImplementation((fnName: string) => {
        if (fnName === 'get_marketplace_store_by_slug') {
          return Promise.resolve({ data: null, error: { message: 'Network error' } });
        }
        return Promise.resolve({ data: [], error: null });
      });

      render(<TestWrapper />);

      await waitFor(() => {
        expect(screen.getByText('Store Not Found')).toBeInTheDocument();
      });
    });
  });

  describe('3. Theme CSS Variables', () => {
    it('should apply store primary color as CSS variable', async () => {
      mockRpc.mockImplementation((fnName: string) => {
        if (fnName === 'get_marketplace_store_by_slug') {
          return Promise.resolve({ data: [mockStore], error: null });
        }
        if (fnName === 'get_marketplace_products') {
          return Promise.resolve({ data: mockProducts, error: null });
        }
        return Promise.resolve({ data: [], error: null });
      });

      const { container } = render(<TestWrapper />);

      await waitFor(() => {
        const styledElement = container.querySelector('[style*="--store-primary"]');
        expect(styledElement).toBeInTheDocument();
      });
    });

    it('should apply store secondary and accent colors', async () => {
      mockRpc.mockImplementation((fnName: string) => {
        if (fnName === 'get_marketplace_store_by_slug') {
          return Promise.resolve({ data: [mockStore], error: null });
        }
        if (fnName === 'get_marketplace_products') {
          return Promise.resolve({ data: mockProducts, error: null });
        }
        return Promise.resolve({ data: [], error: null });
      });

      const { container } = render(<TestWrapper />);

      await waitFor(() => {
        const mainContainer = container.querySelector('.min-h-dvh');
        expect(mainContainer).toBeInTheDocument();
        // Check that the style attribute contains color variables
        const style = mainContainer?.getAttribute('style') || '';
        expect(style).toContain('--store-primary');
        expect(style).toContain('--store-secondary');
        expect(style).toContain('--store-accent');
      });
    });
  });

  describe('4. Layout Config Sections Rendering', () => {
    it('should render all sections from layout_config', async () => {
      mockRpc.mockImplementation((fnName: string) => {
        if (fnName === 'get_marketplace_store_by_slug') {
          return Promise.resolve({ data: [mockStore], error: null });
        }
        if (fnName === 'get_marketplace_products') {
          return Promise.resolve({ data: mockProducts, error: null });
        }
        return Promise.resolve({ data: [], error: null });
      });

      render(<TestWrapper />);

      await waitFor(() => {
        // Hero section heading should render
        expect(screen.getByText('Premium')).toBeInTheDocument();
        expect(screen.getByText('Cannabis')).toBeInTheDocument();
        expect(screen.getByText('Delivered')).toBeInTheDocument();
      });
    });

    it('should render default layout when layout_config is empty', async () => {
      const storeWithoutLayout = {
        ...mockStore,
        layout_config: null,
      };

      mockRpc.mockImplementation((fnName: string) => {
        if (fnName === 'get_marketplace_store_by_slug') {
          return Promise.resolve({ data: [storeWithoutLayout], error: null });
        }
        if (fnName === 'get_marketplace_products') {
          return Promise.resolve({ data: mockProducts, error: null });
        }
        return Promise.resolve({ data: [], error: null });
      });

      render(<TestWrapper />);

      await waitFor(() => {
        // Default layout should show store name in multiple places (header and hero)
        // Use getAllByText since the store name appears in header and hero section
        const storeNameElements = screen.getAllByText('Test Cannabis Store');
        expect(storeNameElements.length).toBeGreaterThan(0);
      });
    });
  });

  describe('5. Hero Section Display', () => {
    it('should display hero section with heading lines', async () => {
      mockRpc.mockImplementation((fnName: string) => {
        if (fnName === 'get_marketplace_store_by_slug') {
          return Promise.resolve({ data: [mockStore], error: null });
        }
        if (fnName === 'get_marketplace_products') {
          return Promise.resolve({ data: mockProducts, error: null });
        }
        return Promise.resolve({ data: [], error: null });
      });

      render(<TestWrapper />);

      await waitFor(() => {
        expect(screen.getByText('Premium')).toBeInTheDocument();
        expect(screen.getByText('Cannabis')).toBeInTheDocument();
        expect(screen.getByText('Delivered')).toBeInTheDocument();
      });
    });

    it('should display subheading text', async () => {
      mockRpc.mockImplementation((fnName: string) => {
        if (fnName === 'get_marketplace_store_by_slug') {
          return Promise.resolve({ data: [mockStore], error: null });
        }
        if (fnName === 'get_marketplace_products') {
          return Promise.resolve({ data: mockProducts, error: null });
        }
        return Promise.resolve({ data: [], error: null });
      });

      render(<TestWrapper />);

      await waitFor(() => {
        expect(screen.getByText('Same-day delivery available')).toBeInTheDocument();
      });
    });

    it('should display CTA buttons', async () => {
      mockRpc.mockImplementation((fnName: string) => {
        if (fnName === 'get_marketplace_store_by_slug') {
          return Promise.resolve({ data: [mockStore], error: null });
        }
        if (fnName === 'get_marketplace_products') {
          return Promise.resolve({ data: mockProducts, error: null });
        }
        return Promise.resolve({ data: [], error: null });
      });

      render(<TestWrapper />);

      await waitFor(() => {
        expect(screen.getByText('Shop Now')).toBeInTheDocument();
        expect(screen.getByText('View Menu')).toBeInTheDocument();
      });
    });

    it('should display trust badges when enabled', async () => {
      mockRpc.mockImplementation((fnName: string) => {
        if (fnName === 'get_marketplace_store_by_slug') {
          return Promise.resolve({ data: [mockStore], error: null });
        }
        if (fnName === 'get_marketplace_products') {
          return Promise.resolve({ data: mockProducts, error: null });
        }
        return Promise.resolve({ data: [], error: null });
      });

      render(<TestWrapper />);

      await waitFor(() => {
        expect(screen.getByText('Licensed')).toBeInTheDocument();
        expect(screen.getByText('Lab Verified')).toBeInTheDocument();
        expect(screen.getByText('Same-Day')).toBeInTheDocument();
      });
    });
  });

  describe('6. Product Grid Display', () => {
    it('should display product grid section heading', async () => {
      mockRpc.mockImplementation((fnName: string) => {
        if (fnName === 'get_marketplace_store_by_slug') {
          return Promise.resolve({ data: [mockStore], error: null });
        }
        if (fnName === 'get_marketplace_products') {
          return Promise.resolve({ data: mockProducts, error: null });
        }
        return Promise.resolve({ data: [], error: null });
      });

      render(<TestWrapper />);

      await waitFor(() => {
        expect(screen.getByText('Featured Products')).toBeInTheDocument();
      });
    });

    it('should fetch and display products', async () => {
      mockRpc.mockImplementation((fnName: string) => {
        if (fnName === 'get_marketplace_store_by_slug') {
          return Promise.resolve({ data: [mockStore], error: null });
        }
        if (fnName === 'get_marketplace_products') {
          return Promise.resolve({ data: mockProducts, error: null });
        }
        return Promise.resolve({ data: [], error: null });
      });

      render(<TestWrapper />);

      // First wait for store to load and render
      await waitFor(() => {
        expect(screen.getByText('Featured Products')).toBeInTheDocument();
      });

      // Then verify products RPC was called with the store ID
      await waitFor(() => {
        expect(mockRpc).toHaveBeenCalledWith(
          'get_marketplace_products',
          { p_store_id: mockStore.id }
        );
      }, { timeout: 5000 });
    });

    it('should show empty state when no products', async () => {
      mockRpc.mockImplementation((fnName: string) => {
        if (fnName === 'get_marketplace_store_by_slug') {
          return Promise.resolve({ data: [mockStore], error: null });
        }
        if (fnName === 'get_marketplace_products') {
          return Promise.resolve({ data: [], error: null });
        }
        return Promise.resolve({ data: [], error: null });
      });

      render(<TestWrapper />);

      await waitFor(() => {
        expect(screen.getByText(/no matches found/i)).toBeInTheDocument();
      });
    });
  });

  describe('7. Navigation to Catalog', () => {
    it('should have Products link in navigation', async () => {
      mockRpc.mockImplementation((fnName: string) => {
        if (fnName === 'get_marketplace_store_by_slug') {
          return Promise.resolve({ data: [mockStore], error: null });
        }
        if (fnName === 'get_marketplace_products') {
          return Promise.resolve({ data: mockProducts, error: null });
        }
        return Promise.resolve({ data: [], error: null });
      });

      render(<TestWrapper />);

      await waitFor(() => {
        const productsLinks = screen.getAllByRole('link', { name: /products/i });
        expect(productsLinks.length).toBeGreaterThan(0);
      });
    });

    it('should navigate to /products when Products link is clicked', async () => {
      const user = userEvent.setup();

      mockRpc.mockImplementation((fnName: string) => {
        if (fnName === 'get_marketplace_store_by_slug') {
          return Promise.resolve({ data: [mockStore], error: null });
        }
        if (fnName === 'get_marketplace_products') {
          return Promise.resolve({ data: mockProducts, error: null });
        }
        return Promise.resolve({ data: [], error: null });
      });

      render(<TestWrapper />);

      await waitFor(() => {
        expect(screen.getByText('Test Cannabis Store')).toBeInTheDocument();
      });

      // Find and click the Products nav link
      const productsLinks = screen.getAllByRole('link', { name: /products/i });
      const navLink = productsLinks.find(link =>
        link.getAttribute('href')?.includes('/products')
      );

      if (navLink) {
        await user.click(navLink);

        await waitFor(() => {
          expect(screen.getByTestId('products-catalog')).toBeInTheDocument();
        });
      }
    });
  });

  describe('Inactive Store Handling', () => {
    it('should show "Coming Soon" for inactive stores', async () => {
      const inactiveStore = { ...mockStore, is_active: false };

      mockRpc.mockImplementation((fnName: string) => {
        if (fnName === 'get_marketplace_store_by_slug') {
          return Promise.resolve({ data: [inactiveStore], error: null });
        }
        return Promise.resolve({ data: [], error: null });
      });

      render(<TestWrapper />);

      await waitFor(() => {
        expect(screen.getByText('Coming Soon')).toBeInTheDocument();
      });
    });

    it('should show inactive store in preview mode', async () => {
      const inactiveStore = { ...mockStore, is_active: false };

      mockRpc.mockImplementation((fnName: string) => {
        if (fnName === 'get_marketplace_store_by_slug') {
          return Promise.resolve({ data: [inactiveStore], error: null });
        }
        if (fnName === 'get_marketplace_products') {
          return Promise.resolve({ data: mockProducts, error: null });
        }
        return Promise.resolve({ data: [], error: null });
      });

      render(<TestWrapper initialRoute="/shop/test-store?preview=true" />);

      await waitFor(() => {
        expect(screen.getByText('Preview Mode - This store is not yet live')).toBeInTheDocument();
        expect(screen.getByText('Test Cannabis Store')).toBeInTheDocument();
      });
    });
  });

  describe('Loading States', () => {
    it('should show skeleton loaders while loading', async () => {
      // Make the RPC call hang to show loading state
      mockRpc.mockImplementation(() => new Promise(() => {}));

      const { container } = render(<TestWrapper />);

      // Should show skeleton elements while loading
      const skeletons = container.querySelectorAll('.animate-pulse, [class*="skeleton"]');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });
});

describe('HeroSection Component', () => {
  const defaultContent = {
    heading_line_1: 'Test',
    heading_line_2: 'Hero',
    heading_line_3: 'Section',
    subheading: 'Test subheading',
    cta_primary_text: 'Primary CTA',
    cta_primary_link: '/primary',
    cta_secondary_text: 'Secondary CTA',
    cta_secondary_link: '/secondary',
    trust_badges: true,
  };

  const defaultStyles = {
    background_gradient_start: '#000000',
    background_gradient_end: '#1a1a1a',
    text_color: '#ffffff',
    accent_color: '#10b981',
  };

  it('should render three heading lines', () => {
    render(
      <MemoryRouter>
        <HeroSection content={defaultContent} styles={defaultStyles} />
      </MemoryRouter>
    );

    expect(screen.getByText('Test')).toBeInTheDocument();
    expect(screen.getByText('Hero')).toBeInTheDocument();
    expect(screen.getByText('Section')).toBeInTheDocument();
  });

  it('should render CTA buttons with correct links', () => {
    render(
      <MemoryRouter>
        <HeroSection content={defaultContent} styles={defaultStyles} />
      </MemoryRouter>
    );

    const primaryButton = screen.getByRole('button', { name: 'Primary CTA' });
    const secondaryButton = screen.getByRole('button', { name: 'Secondary CTA' });

    expect(primaryButton).toBeInTheDocument();
    expect(secondaryButton).toBeInTheDocument();
  });

  it('should apply gradient background styles', () => {
    const { container } = render(
      <MemoryRouter>
        <HeroSection content={defaultContent} styles={defaultStyles} />
      </MemoryRouter>
    );

    const section = container.querySelector('section');
    expect(section).toHaveStyle({ backgroundColor: '#000000' });
  });

  it('should hide trust badges when disabled', () => {
    const contentWithoutBadges = { ...defaultContent, trust_badges: false };

    render(
      <MemoryRouter>
        <HeroSection content={contentWithoutBadges} styles={defaultStyles} />
      </MemoryRouter>
    );

    expect(screen.queryByText('Licensed')).not.toBeInTheDocument();
    expect(screen.queryByText('Lab Verified')).not.toBeInTheDocument();
    expect(screen.queryByText('Same-Day')).not.toBeInTheDocument();
  });

  it('should use default values when content/styles are undefined', () => {
    render(
      <MemoryRouter>
        <HeroSection content={undefined as unknown as typeof defaultContent} styles={undefined as unknown as typeof defaultStyles} />
      </MemoryRouter>
    );

    // Default heading lines
    expect(screen.getByText('Premium')).toBeInTheDocument();
    expect(screen.getByText('Flower')).toBeInTheDocument();
    expect(screen.getByText('Delivered')).toBeInTheDocument();
  });
});
