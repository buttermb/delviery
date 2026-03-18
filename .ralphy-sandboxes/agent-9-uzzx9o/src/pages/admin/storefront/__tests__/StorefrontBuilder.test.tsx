/**
 * StorefrontBuilder Tests
 * Tests for storefront builder including store creation, section management,
 * and publish/unpublish functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock all external dependencies
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
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

vi.mock('@/hooks/useCreditGatedAction', () => ({
  useCreditGatedAction: vi.fn().mockReturnValue({
    execute: vi.fn().mockResolvedValue({ success: true }),
    showOutOfCreditsModal: false,
    closeOutOfCreditsModal: vi.fn(),
    blockedAction: null,
    isExecuting: false,
  }),
}));

vi.mock('@/components/credits/OutOfCreditsModal', () => ({
  OutOfCreditsModal: () => null,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/components/admin/storefront/ThemePresetSelector', () => ({
  ThemePresetStrip: () => <div data-testid="theme-strip">Theme Strip</div>,
}));

vi.mock('@/lib/storefrontThemes', () => ({
  THEME_PRESETS: [],
  applyThemeToConfig: vi.fn(),
}));

// Mock section components
vi.mock('@/components/shop/sections/HeroSection', () => ({
  HeroSection: () => <div data-testid="hero-section">Hero Section</div>,
}));

vi.mock('@/components/shop/sections/FeaturesSection', () => ({
  FeaturesSection: () => <div data-testid="features-section">Features</div>,
}));

vi.mock('@/components/shop/sections/ProductGridSection', () => ({
  ProductGridSection: () => <div data-testid="product-grid-section">Products</div>,
}));

vi.mock('@/components/shop/sections/TestimonialsSection', () => ({
  TestimonialsSection: () => <div data-testid="testimonials-section">Testimonials</div>,
}));

vi.mock('@/components/shop/sections/NewsletterSection', () => ({
  NewsletterSection: () => <div data-testid="newsletter-section">Newsletter</div>,
}));

vi.mock('@/components/shop/sections/GallerySection', () => ({
  GallerySection: () => <div data-testid="gallery-section">Gallery</div>,
}));

vi.mock('@/components/shop/sections/FAQSection', () => ({
  FAQSection: () => <div data-testid="faq-section">FAQ</div>,
}));

vi.mock('@/components/shop/sections/CustomHTMLSection', () => ({
  CustomHTMLSection: () => <div data-testid="custom-html-section">Custom HTML</div>,
}));

// Mock dnd-kit
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  closestCenter: vi.fn(),
  KeyboardSensor: vi.fn(),
  PointerSensor: vi.fn(),
  useSensor: vi.fn(),
  useSensors: vi.fn().mockReturnValue([]),
}));

vi.mock('@dnd-kit/sortable', () => ({
  arrayMove: vi.fn((arr) => arr),
  SortableContext: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  sortableKeyboardCoordinates: vi.fn(),
  useSortable: vi.fn().mockReturnValue({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
  verticalListSortingStrategy: vi.fn(),
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: vi.fn() } },
}));

// Import component after all mocks
import { StorefrontBuilder } from '../StorefrontBuilder';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useCreditGatedAction } from '@/hooks/useCreditGatedAction';

const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={createQueryClient()}>
    <MemoryRouter initialEntries={['/test-tenant/admin/storefront/builder']}>
      {children}
    </MemoryRouter>
  </QueryClientProvider>
);

describe('StorefrontBuilder', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (useTenantAdminAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      tenant: { id: 'tenant-123', slug: 'test-tenant', business_name: 'Test Business' },
      loading: false,
      admin: { id: 'admin-123', email: 'admin@test.com' },
      tenantSlug: 'test-tenant',
    });

    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    (useCreditGatedAction as ReturnType<typeof vi.fn>).mockReturnValue({
      execute: vi.fn().mockResolvedValue({ success: true }),
      showOutOfCreditsModal: false,
      closeOutOfCreditsModal: vi.fn(),
      blockedAction: null,
      isExecuting: false,
    });
  });

  describe('Initial Render', () => {
    it('should render the store builder header', async () => {
      render(<StorefrontBuilder />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Store Builder')).toBeInTheDocument();
      });
    });

    it('should render zoom percentage', async () => {
      render(<StorefrontBuilder />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('85%')).toBeInTheDocument();
      });
    });
  });

  describe('Section Types', () => {
    it('should have 8 section type buttons', async () => {
      render(<StorefrontBuilder />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Hero')).toBeInTheDocument();
        expect(screen.getByText('Features')).toBeInTheDocument();
        expect(screen.getByText('Product')).toBeInTheDocument();
        expect(screen.getByText('Testimonials')).toBeInTheDocument();
        expect(screen.getByText('Newsletter')).toBeInTheDocument();
        expect(screen.getByText('Gallery')).toBeInTheDocument();
        expect(screen.getByText('FAQ')).toBeInTheDocument();
        expect(screen.getByText('Custom')).toBeInTheDocument();
      });
    });
  });

  describe('Store Creation', () => {
    it('should show create store button when no store exists', async () => {
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

      render(<StorefrontBuilder />, { wrapper });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Create Store/i })).toBeInTheDocument();
      });
    });

    it('should display 500 credits cost for store creation', async () => {
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

      render(<StorefrontBuilder />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText(/500 credits/i)).toBeInTheDocument();
      });
    });
  });

  describe('Publish/Unpublish States', () => {
    it('should show Draft status and Publish button for unpublished store', async () => {
      const mockStore = {
        id: 'store-123',
        tenant_id: 'tenant-123',
        store_name: 'Test Store',
        slug: 'test-store',
        is_public: false,
        layout_config: [],
        theme_config: {},
      };

      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: mockStore, error: null }),
        update: vi.fn().mockReturnThis(),
      });

      render(<StorefrontBuilder />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Draft')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Publish/i })).toBeInTheDocument();
      });
    });

    it('should show Published status and Unpublish button for published store', async () => {
      const mockStore = {
        id: 'store-123',
        tenant_id: 'tenant-123',
        store_name: 'Test Store',
        slug: 'test-store',
        is_public: true,
        layout_config: [],
        theme_config: {},
      };

      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: mockStore, error: null }),
        update: vi.fn().mockReturnThis(),
      });

      render(<StorefrontBuilder />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Published')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Unpublish/i })).toBeInTheDocument();
      });
    });

    it('should show Save Draft button when store exists', async () => {
      const mockStore = {
        id: 'store-123',
        tenant_id: 'tenant-123',
        store_name: 'Test Store',
        slug: 'test-store',
        is_public: false,
        layout_config: [],
        theme_config: {},
      };

      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: mockStore, error: null }),
        update: vi.fn().mockReturnThis(),
      });

      render(<StorefrontBuilder />, { wrapper });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Save Draft/i })).toBeInTheDocument();
      });
    });
  });

  describe('Templates', () => {
    it('should display template tab', async () => {
      render(<StorefrontBuilder />, { wrapper });

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /Templates/i })).toBeInTheDocument();
      });
    });

    it('should show template options when templates tab is clicked', async () => {
      const user = userEvent.setup();
      render(<StorefrontBuilder />, { wrapper });

      const templatesTab = screen.getByRole('tab', { name: /Templates/i });
      await user.click(templatesTab);

      await waitFor(() => {
        expect(screen.getByText('Minimal')).toBeInTheDocument();
        expect(screen.getByText('Standard')).toBeInTheDocument();
      });
    });
  });

  describe('Theme Tab', () => {
    it('should display theme tab', async () => {
      render(<StorefrontBuilder />, { wrapper });

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /Theme/i })).toBeInTheDocument();
      });
    });

    it('should show color options when theme tab is clicked', async () => {
      const user = userEvent.setup();
      render(<StorefrontBuilder />, { wrapper });

      const themeTab = screen.getByRole('tab', { name: /Theme/i });
      await user.click(themeTab);

      await waitFor(() => {
        expect(screen.getByText('Global Colors')).toBeInTheDocument();
        expect(screen.getByText('Typography')).toBeInTheDocument();
      });
    });
  });

  describe('Empty State', () => {
    it('should show empty canvas message when no sections exist', async () => {
      const mockStore = {
        id: 'store-123',
        tenant_id: 'tenant-123',
        store_name: 'Test Store',
        slug: 'test-store',
        is_public: false,
        layout_config: [],
        theme_config: {},
      };

      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: mockStore, error: null }),
        update: vi.fn().mockReturnThis(),
      });

      render(<StorefrontBuilder />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Your store canvas is empty')).toBeInTheDocument();
      });
    });
  });
});

describe('StorefrontBuilder Section Order Persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (useTenantAdminAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      tenant: { id: 'tenant-123', slug: 'test-tenant', business_name: 'Test Business' },
      loading: false,
      admin: { id: 'admin-123', email: 'admin@test.com' },
      tenantSlug: 'test-tenant',
    });
  });

  it('should persist layout_config section order when saving draft', async () => {
    const orderedSections = [
      { id: 'sec-faq', type: 'faq', content: { heading: 'FAQ' }, styles: {}, visible: true },
      { id: 'sec-hero', type: 'hero', content: { heading_line_1: 'Hello' }, styles: {}, visible: true },
      { id: 'sec-features', type: 'features', content: { heading_small: 'Features' }, styles: {}, visible: true },
    ];

    const mockStore = {
      id: 'store-123',
      tenant_id: 'tenant-123',
      store_name: 'Test Store',
      slug: 'test-store',
      is_public: false,
      layout_config: orderedSections,
      theme_config: { colors: { primary: '#000', background: '#fff' } },
    };

    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: mockStore, error: null }),
      update: updateMock,
    });

    (useCreditGatedAction as ReturnType<typeof vi.fn>).mockReturnValue({
      execute: vi.fn().mockResolvedValue({ success: true }),
      showOutOfCreditsModal: false,
      closeOutOfCreditsModal: vi.fn(),
      blockedAction: null,
      isExecuting: false,
    });

    const user = userEvent.setup();
    render(<StorefrontBuilder />, { wrapper });

    // Wait for store to load and builder to render
    await waitFor(() => {
      expect(screen.getByText('Store Builder')).toBeInTheDocument();
    });

    // Switch to advanced mode to use the drag-and-drop builder
    const advancedButton = screen.getByRole('button', { name: /Advanced/i });
    await user.click(advancedButton);

    // Click Save Draft
    const saveButton = screen.getByRole('button', { name: /Save Draft/i });
    await user.click(saveButton);

    // Verify Supabase update was called with layout_config preserving section order
    await waitFor(() => {
      expect(updateMock).toHaveBeenCalled();
      const updatePayload = updateMock.mock.calls[0][0] as Record<string, unknown>;
      const savedConfig = updatePayload.layout_config as Array<{ id: string; type: string }>;

      // layout_config should be an array with sections in the same order
      expect(Array.isArray(savedConfig)).toBe(true);
      expect(savedConfig.length).toBe(3);
      expect(savedConfig[0].type).toBe('faq');
      expect(savedConfig[1].type).toBe('hero');
      expect(savedConfig[2].type).toBe('features');
    });
  });

  it('should render builder sections in layout_config order', async () => {
    const orderedSections = [
      { id: 'sec-testimonials', type: 'testimonials', content: {}, styles: {}, visible: true },
      { id: 'sec-hero', type: 'hero', content: {}, styles: {}, visible: true },
      { id: 'sec-faq', type: 'faq', content: {}, styles: {}, visible: true },
    ];

    const mockStore = {
      id: 'store-123',
      tenant_id: 'tenant-123',
      store_name: 'Order Test Store',
      slug: 'order-test',
      is_public: false,
      layout_config: orderedSections,
      theme_config: {},
    };

    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: mockStore, error: null }),
      update: vi.fn().mockReturnThis(),
    });

    (useCreditGatedAction as ReturnType<typeof vi.fn>).mockReturnValue({
      execute: vi.fn().mockResolvedValue({ success: true }),
      showOutOfCreditsModal: false,
      closeOutOfCreditsModal: vi.fn(),
      blockedAction: null,
      isExecuting: false,
    });

    const user = userEvent.setup();
    render(<StorefrontBuilder />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('Store Builder')).toBeInTheDocument();
    });

    // Switch to advanced mode
    const advancedButton = screen.getByRole('button', { name: /Advanced/i });
    await user.click(advancedButton);

    // Verify section items appear in DOM order matching layout_config
    await waitFor(() => {
      const sectionItems = screen.getAllByTestId(/^builder-section-/);
      expect(sectionItems.length).toBe(3);
      expect(sectionItems[0].getAttribute('data-section-type')).toBe('testimonials');
      expect(sectionItems[1].getAttribute('data-section-type')).toBe('hero');
      expect(sectionItems[2].getAttribute('data-section-type')).toBe('faq');
    });
  });
});

describe('StorefrontBuilder Credit Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (useTenantAdminAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      tenant: { id: 'tenant-123', slug: 'test-tenant', business_name: 'Test Business' },
      loading: false,
      admin: { id: 'admin-123', email: 'admin@test.com' },
      tenantSlug: 'test-tenant',
    });

    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'new-store' }, error: null }),
    });
  });

  it('should use storefront_create action key for credit deduction', async () => {
    const executeMock = vi.fn().mockResolvedValue({ success: true });

    (useCreditGatedAction as ReturnType<typeof vi.fn>).mockReturnValue({
      execute: executeMock,
      showOutOfCreditsModal: false,
      closeOutOfCreditsModal: vi.fn(),
      blockedAction: null,
      isExecuting: false,
    });

    const user = userEvent.setup();
    render(<StorefrontBuilder />, { wrapper });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Create Store/i })).toBeInTheDocument();
    });

    // Open create dialog
    await user.click(screen.getByRole('button', { name: /Create Store/i }));

    await waitFor(() => {
      expect(screen.getByText('Create Your Storefront')).toBeInTheDocument();
    });

    // Fill in form
    const nameInput = screen.getByLabelText('Store Name');
    await user.type(nameInput, 'My New Store');

    // Submit form
    const submitButton = screen.getByRole('button', { name: /Create Store \(500 credits\)/ });
    await user.click(submitButton);

    await waitFor(() => {
      expect(executeMock).toHaveBeenCalledWith(
        expect.objectContaining({
          actionKey: 'storefront_create',
        })
      );
    });
  });
});
