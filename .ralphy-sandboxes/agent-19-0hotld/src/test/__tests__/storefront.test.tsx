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
  sanitizeWithLineBreaks: (html: string) => html,
  sanitizeHtml: (html: string) => html,
  sanitizeWithLineBreaks: (text: string) => text,
}));

// Mock framer-motion to avoid animation issues in tests
// All motion.* elements render as their plain HTML equivalents
vi.mock('framer-motion', () => {
  const SKIP_PROPS = new Set([
    'initial', 'animate', 'exit', 'transition', 'variants',
    'whileHover', 'whileTap', 'whileInView', 'whileFocus', 'whileDrag',
    'viewport', 'layout', 'layoutId', 'layoutDependency',
    'drag', 'dragConstraints', 'dragElastic', 'dragMomentum',
    'onAnimationStart', 'onAnimationComplete', 'onDragStart', 'onDragEnd',
  ]);

  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop: string) {
      return function MotionComponent(allProps: Record<string, unknown>) {
        const { children, ...rest } = allProps;
        const clean: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(rest)) {
          if (!SKIP_PROPS.has(k)) clean[k] = v;
        }
        const El = prop as unknown as React.ElementType;
        return <El {...clean}>{children as React.ReactNode}</El>;
      };
    },
  };

  return {
    motion: new Proxy({} as Record<string, unknown>, handler),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

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
import { FeaturesSection } from '@/components/shop/sections/FeaturesSection';
import { TestimonialsSection } from '@/components/shop/sections/TestimonialsSection';
import { FAQSection } from '@/components/shop/sections/FAQSection';

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
          screen.getByText(/doesn't exist or has been taken offline/i)
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
        // Hero section heading should render (combined headline)
        expect(screen.getByText('Premium Cannabis Delivered')).toBeInTheDocument();
      });
    });

    it('should render FeaturesSection TestimonialsSection and FAQSection from layout_config', async () => {
      const storeWithAllSections = {
        ...mockStore,
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
            },
            styles: {
              background_gradient_start: '#000000',
              background_gradient_end: '#022c22',
              text_color: '#ffffff',
              accent_color: '#34d399',
            },
          },
          {
            id: 'features-section',
            type: 'features',
            content: {
              heading_small: 'Why Us',
              heading_large: 'Top Quality',
              features: [
                { icon: 'shield', title: 'Lab Tested', description: 'Every product verified' },
              ],
            },
            styles: { background_color: '#171717', text_color: '#ffffff', icon_color: '#34d399' },
          },
          {
            id: 'testimonials-section',
            type: 'testimonials',
            content: {
              heading: 'Reviews',
              subheading: 'Trusted by thousands',
              testimonials: [
                { name: 'Jane D.', role: 'Customer', quote: 'Amazing quality!', rating: 5 },
              ],
            },
            styles: { background_color: '#ffffff', text_color: '#000000', accent_color: '#10b981', card_background: '#f9fafb' },
          },
          {
            id: 'faq-section',
            type: 'faq',
            content: {
              heading: 'FAQ',
              subheading: 'Quick answers',
              faqs: [
                { question: 'Is delivery free?', answer: 'Free for orders over $100.' },
              ],
            },
            styles: { background_color: '#f9fafb', text_color: '#000000', accent_color: '#10b981', border_color: '#e5e7eb' },
    it('should render sections in correct order from layout_config', async () => {
      const storeWithOrderedSections = {
        ...mockStore,
        layout_config: [
          {
            id: 'section-hero',
            type: 'hero',
            content: {
              heading_line_1: 'First',
              heading_line_2: 'Section',
              heading_line_3: 'Hero',
              subheading: 'Hero subheading',
              cta_primary_text: 'CTA',
              cta_primary_link: '/shop',
              cta_secondary_text: 'CTA2',
              cta_secondary_link: '/shop',
            },
            styles: {
              background_gradient_start: '#000',
              background_gradient_end: '#111',
              text_color: '#fff',
              accent_color: '#0f0',
            },
          },
          {
            id: 'section-features',
            type: 'features',
            content: { heading_small: 'Why Us', heading_large: 'Second Section Features' },
            styles: { background_color: '#fff', text_color: '#000', icon_color: '#0f0' },
          },
          {
            id: 'section-products',
            type: 'product_grid',
            content: { heading: 'Third Section Products', subheading: 'Shop now' },
            styles: { accent_color: '#10b981' },
          },
        ],
      };

      mockRpc.mockImplementation((fnName: string) => {
        if (fnName === 'get_marketplace_store_by_slug') {
          return Promise.resolve({ data: [storeWithAllSections], error: null });
        }
        if (fnName === 'get_marketplace_products') {
          return Promise.resolve({ data: [], error: null });
          return Promise.resolve({ data: [storeWithOrderedSections], error: null });
        }
        if (fnName === 'get_marketplace_products') {
          return Promise.resolve({ data: mockProducts, error: null });
        }
        return Promise.resolve({ data: [], error: null });
      });

      render(<TestWrapper />);

      await waitFor(() => {
        // Features section
        expect(screen.getByText('Why Us')).toBeInTheDocument();
        expect(screen.getByText('Top Quality')).toBeInTheDocument();
        expect(screen.getByText('Lab Tested')).toBeInTheDocument();

        // Testimonials section
        expect(screen.getByText('Reviews')).toBeInTheDocument();
        expect(screen.getByText('Jane D.')).toBeInTheDocument();

        // FAQ section
        expect(screen.getByText('FAQ')).toBeInTheDocument();
        expect(screen.getByText('Is delivery free?')).toBeInTheDocument();
      });

      // Verify data-testid attributes for section types
      const featuresSection = screen.getByTestId('storefront-section-features');
      expect(featuresSection).toBeInTheDocument();
      const testimonialsSection = screen.getByTestId('storefront-section-testimonials');
      expect(testimonialsSection).toBeInTheDocument();
      const faqSection = screen.getByTestId('storefront-section-faq');
      expect(faqSection).toBeInTheDocument();
      const { container } = render(<TestWrapper />);

      await waitFor(() => {
        // Verify all three sections rendered
        expect(screen.getByText('First')).toBeInTheDocument();
        expect(screen.getByText('Second Section Features')).toBeInTheDocument();
        expect(screen.getByText('Third Section Products')).toBeInTheDocument();
      });

      // Verify ordering via data-section-index attributes
      const sections = container.querySelectorAll('[data-section-type]');
      expect(sections.length).toBe(3);
      expect(sections[0].getAttribute('data-section-type')).toBe('hero');
      expect(sections[0].getAttribute('data-section-index')).toBe('0');
      expect(sections[1].getAttribute('data-section-type')).toBe('features');
      expect(sections[1].getAttribute('data-section-index')).toBe('1');
      expect(sections[2].getAttribute('data-section-type')).toBe('product_grid');
      expect(sections[2].getAttribute('data-section-index')).toBe('2');
    });

    it('should skip sections with visible=false', async () => {
      const storeWithHiddenSection = {
        ...mockStore,
        layout_config: [
          {
            id: 'visible-hero',
            type: 'hero',
            content: {
              heading_line_1: 'Visible',
              heading_line_2: 'Hero',
              heading_line_3: 'Here',
              subheading: 'Visible section',
              cta_primary_text: 'CTA',
              cta_primary_link: '/shop',
              cta_secondary_text: 'CTA2',
              cta_secondary_link: '/shop',
            },
            styles: {
              background_gradient_start: '#000',
              background_gradient_end: '#111',
              text_color: '#fff',
              accent_color: '#0f0',
            },
          },
          {
            id: 'hidden-features',
            type: 'features',
            visible: false,
            content: { heading_small: 'Hidden', heading_large: 'Hidden Features' },
            styles: { background_color: '#fff', text_color: '#000', icon_color: '#0f0' },
          },
          {
            id: 'visible-products',
            type: 'product_grid',
            content: { heading: 'Visible Products', subheading: 'Shop' },
            styles: { accent_color: '#10b981' },
          },
        ],
      };

      mockRpc.mockImplementation((fnName: string) => {
        if (fnName === 'get_marketplace_store_by_slug') {
          return Promise.resolve({ data: [storeWithHiddenSection], error: null });
        }
        if (fnName === 'get_marketplace_products') {
          return Promise.resolve({ data: mockProducts, error: null });
        }
        return Promise.resolve({ data: [], error: null });
      });

      const { container } = render(<TestWrapper />);

      await waitFor(() => {
        expect(screen.getByText('Visible')).toBeInTheDocument();
        expect(screen.getByText('Visible Products')).toBeInTheDocument();
      });

      // Hidden features section should NOT be rendered
      expect(screen.queryByText('Hidden Features')).not.toBeInTheDocument();

      // Only 2 sections should be rendered (hero and product_grid)
      const sections = container.querySelectorAll('[data-section-type]');
      expect(sections.length).toBe(2);
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
    it('should display hero section with headline', async () => {
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
        expect(screen.getByText('Premium Cannabis Delivered')).toBeInTheDocument();
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
        expect(screen.getByTestId('empty-product-grid')).toBeInTheDocument();
      }, { timeout: 5000 });
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

      // Skeleton components render with role="status" and bg-muted class
      const skeletons = container.querySelectorAll('[role="status"]');
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

  it('should render combined headline from heading lines', () => {
    render(
      <MemoryRouter>
        <HeroSection content={defaultContent} styles={defaultStyles} />
      </MemoryRouter>
    );

    expect(screen.getByText('Test Hero Section')).toBeInTheDocument();
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

    // Default headline
    expect(screen.getByText('Premium Flower Delivered')).toBeInTheDocument();
  });
});

describe('FeaturesSection Component', () => {
  const defaultContent = {
    heading_small: 'Why Choose Us',
    heading_large: 'Our Advantages',
    features: [
      { icon: 'clock', title: 'Fast Delivery', description: 'Same-day service' },
      { icon: 'shield', title: 'Lab Tested', description: 'Quality guaranteed' },
    ],
  };

  const defaultStyles = {
    background_color: '#171717',
    text_color: '#ffffff',
    icon_color: '#34d399',
  };

  it('should render heading text', () => {
    render(<FeaturesSection content={defaultContent} styles={defaultStyles} />);

    expect(screen.getByText('Why Choose Us')).toBeInTheDocument();
    expect(screen.getByText('Our Advantages')).toBeInTheDocument();
  });

  it('should render feature items with titles and descriptions', () => {
    render(<FeaturesSection content={defaultContent} styles={defaultStyles} />);

    expect(screen.getByText('Fast Delivery')).toBeInTheDocument();
    expect(screen.getByText('Same-day service')).toBeInTheDocument();
    expect(screen.getByText('Lab Tested')).toBeInTheDocument();
    expect(screen.getByText('Quality guaranteed')).toBeInTheDocument();
  });

  it('should apply background and text color styles', () => {
    const { container } = render(<FeaturesSection content={defaultContent} styles={defaultStyles} />);

    const section = container.querySelector('section');
    expect(section).toHaveStyle({ backgroundColor: '#171717' });
  });

  it('should use default values when content/styles are undefined', () => {
    render(
      <FeaturesSection
        content={undefined as unknown as typeof defaultContent}
        styles={undefined as unknown as typeof defaultStyles}
      />
    );

    expect(screen.getByText('The Difference')).toBeInTheDocument();
    expect(screen.getByText('Excellence in Every Detail')).toBeInTheDocument();
    expect(screen.getByText('Same-Day Delivery')).toBeInTheDocument();
  });

  it('should fall back to defaults when features array is empty', () => {
    render(
      <FeaturesSection
        content={{ ...defaultContent, features: [] }}
        styles={defaultStyles}
      />
    );

    // Should render default features instead of empty grid
    expect(screen.getByText('Same-Day Delivery')).toBeInTheDocument();
    expect(screen.getByText('Lab Verified')).toBeInTheDocument();
  });
});

describe('TestimonialsSection Component', () => {
  const defaultContent = {
    heading: 'Customer Reviews',
    subheading: 'Hear from our community',
    testimonials: [
      { name: 'Alice B.', role: 'VIP Member', quote: 'Absolutely fantastic service!', rating: 5 },
      { name: 'Bob C.', role: 'First-Timer', quote: 'Will definitely order again.', rating: 4 },
    ],
  };

  const defaultStyles = {
    background_color: '#ffffff',
    text_color: '#000000',
    accent_color: '#10b981',
    card_background: '#f9fafb',
  };

  it('should render heading and subheading', () => {
    render(<TestimonialsSection content={defaultContent} styles={defaultStyles} />);

    expect(screen.getByText('Customer Reviews')).toBeInTheDocument();
    expect(screen.getByText('Hear from our community')).toBeInTheDocument();
  });

  it('should render testimonial quotes and author info', () => {
    render(<TestimonialsSection content={defaultContent} styles={defaultStyles} />);

    expect(screen.getByText(/"Absolutely fantastic service!"/)).toBeInTheDocument();
    expect(screen.getByText('Alice B.')).toBeInTheDocument();
    expect(screen.getByText('VIP Member')).toBeInTheDocument();
    expect(screen.getByText(/"Will definitely order again."/)).toBeInTheDocument();
    expect(screen.getByText('Bob C.')).toBeInTheDocument();
  });

  it('should render star ratings', () => {
    const { container } = render(<TestimonialsSection content={defaultContent} styles={defaultStyles} />);

    // 2 testimonials x 5 stars each = 10 star SVGs
    const stars = container.querySelectorAll('.lucide-star');
    expect(stars.length).toBe(10);
  });

  it('should use default values when content/styles are undefined', () => {
    render(
      <TestimonialsSection
        content={undefined as unknown as typeof defaultContent}
        styles={undefined as unknown as typeof defaultStyles}
      />
    );

    expect(screen.getByText('What Our Customers Say')).toBeInTheDocument();
    expect(screen.getByText('Sarah M.')).toBeInTheDocument();
  });

  it('should fall back to defaults when testimonials array is empty', () => {
    render(
      <TestimonialsSection
        content={{ ...defaultContent, testimonials: [] }}
        styles={defaultStyles}
      />
    );

    // Should render default testimonials instead of empty grid
    expect(screen.getByText('Sarah M.')).toBeInTheDocument();
    expect(screen.getByText('Michael R.')).toBeInTheDocument();
  });
});

describe('FAQSection Component', () => {
  const defaultContent = {
    heading: 'Common Questions',
    subheading: 'Find your answers here',
    faqs: [
      { question: 'Do you deliver on weekends?', answer: 'Yes, we deliver 7 days a week.' },
      { question: 'What is the return policy?', answer: 'Full refund within 24 hours.' },
    ],
  };

  const defaultStyles = {
    background_color: '#f9fafb',
    text_color: '#000000',
    accent_color: '#10b981',
    border_color: '#e5e7eb',
  };

  it('should render heading and subheading', () => {
    render(<FAQSection content={defaultContent} styles={defaultStyles} />);

    expect(screen.getByText('Common Questions')).toBeInTheDocument();
    expect(screen.getByText('Find your answers here')).toBeInTheDocument();
  });

  it('should render FAQ questions as accordion triggers', () => {
    render(<FAQSection content={defaultContent} styles={defaultStyles} />);

    expect(screen.getByText('Do you deliver on weekends?')).toBeInTheDocument();
    expect(screen.getByText('What is the return policy?')).toBeInTheDocument();
  });

  it('should apply background color style', () => {
    const { container } = render(<FAQSection content={defaultContent} styles={defaultStyles} />);

    const section = container.querySelector('section');
    expect(section).toHaveStyle({ backgroundColor: '#f9fafb' });
  });

  it('should use default values when content/styles are undefined', () => {
    render(
      <FAQSection
        content={undefined as unknown as typeof defaultContent}
        styles={undefined as unknown as typeof defaultStyles}
      />
    );

    expect(screen.getByText('Frequently Asked Questions')).toBeInTheDocument();
    expect(screen.getByText('What are your delivery hours?')).toBeInTheDocument();
  });

  it('should fall back to defaults when faqs array is empty', () => {
    render(
      <FAQSection
        content={{ ...defaultContent, faqs: [] }}
        styles={defaultStyles}
      />
    );

    // Should render default FAQs instead of empty accordion
    expect(screen.getByText('What are your delivery hours?')).toBeInTheDocument();
    expect(screen.getByText('How do I track my order?')).toBeInTheDocument();
  });
});
