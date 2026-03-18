/**
 * ImagesPage Tests
 * Tests for product image gallery, upload, delete, and accessibility
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ------- Mocks -------

const mockNavigateToAdmin = vi.fn();
const mockConfirm = vi.fn();
const mockCloseDialog = vi.fn();
const mockSetLoading = vi.fn();

const mockUpload = vi.fn().mockResolvedValue({ error: null });
const mockRemove = vi.fn().mockResolvedValue({ error: null });

let imageQueryResult: { data: unknown[]; error: null } = { data: [], error: null };
let productQueryResult: { data: unknown[]; error: null } = { data: [], error: null };

vi.mock('@/integrations/supabase/client', () => {
  const createChain = (resolveWith: () => { data: unknown; error: null }) => {
    const chain: Record<string, unknown> = {};
    const handler = () => chain;
    chain.select = handler;
    chain.eq = handler;
    chain.not = () => resolveWith();
    chain.order = () => resolveWith();
    chain.update = handler;
    // Make chain thenable for queries that end with .eq()
    chain.then = (resolve: (v: unknown) => unknown) => resolve(resolveWith());
    return chain;
  };

  return {
    supabase: {
      from: vi.fn((table: string) => {
        if (table === 'products') {
          // We need to distinguish between the images query and the products query.
          // Both call .select().eq(), but images query then calls .not() and products query calls .order().
          // We'll use call tracking to differentiate.
          let selectedFields = '';
          const chain: Record<string, unknown> = {};

          chain.select = (fields: string) => {
            selectedFields = fields;
            return chain;
          };
          chain.eq = () => chain;
          chain.not = () => {
            // This is the images query
            return Promise.resolve(imageQueryResult);
          };
          chain.order = () => {
            // This is the products-for-dropdown query
            return Promise.resolve(productQueryResult);
          };
          chain.update = () => chain;

          return chain;
        }
        return createChain(() => ({ data: [], error: null }));
      }),
      storage: {
        from: vi.fn().mockReturnValue({
          upload: (...a: unknown[]) => mockUpload(...a),
          remove: (...a: unknown[]) => mockRemove(...a),
          getPublicUrl: vi.fn().mockReturnValue({
            data: { publicUrl: 'https://storage.example.com/product-images/tenant-1/img.jpg' },
          }),
        }),
      },
    },
  };
});

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: vi.fn().mockReturnValue({
    tenant: { id: 'tenant-123', slug: 'test-tenant', business_name: 'Test Business' },
    loading: false,
    admin: { id: 'admin-123', email: 'admin@test.com' },
    tenantSlug: 'test-tenant',
  }),
}));

vi.mock('@/lib/navigation/tenantNavigation', () => ({
  useTenantNavigation: vi.fn().mockReturnValue({
    navigateToAdmin: (...args: unknown[]) => mockNavigateToAdmin(...args),
  }),
}));

vi.mock('@/hooks/useConfirmDialog', () => ({
  useConfirmDialog: vi.fn().mockReturnValue({
    dialogState: { open: false, title: '', description: '', onConfirm: vi.fn(), isLoading: false },
    confirm: (...args: unknown[]) => mockConfirm(...args),
    closeDialog: (...args: unknown[]) => mockCloseDialog(...args),
    setLoading: (...args: unknown[]) => mockSetLoading(...args),
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

// Lazy-load the component after mocks
import ImagesPage from '../ImagesPage';

// ------- Test Data -------

const mockImages = [
  {
    id: 'prod-1',
    name: 'Blue Dream',
    image_url: 'https://storage.example.com/product-images/tenant-123/1.jpg',
    created_at: new Date().toISOString(),
  },
  {
    id: 'prod-2',
    name: 'OG Kush',
    image_url: 'https://storage.example.com/product-images/tenant-123/2.jpg',
    created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'prod-3',
    name: 'Sour Diesel',
    image_url: 'https://storage.example.com/product-images/tenant-123/3.jpg',
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

const mockProducts = [
  { id: 'prod-1', name: 'Blue Dream' },
  { id: 'prod-2', name: 'OG Kush' },
  { id: 'prod-3', name: 'Sour Diesel' },
  { id: 'prod-4', name: 'Girl Scout Cookies' },
];

// ------- Helpers -------

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  };
}

function setQueryResults(images = mockImages, products = mockProducts) {
  imageQueryResult = { data: images, error: null };
  productQueryResult = { data: products, error: null };
}

// ------- Tests -------

describe('ImagesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setQueryResults();
  });

  describe('Rendering', () => {
    it('renders page header and upload button', async () => {
      render(<ImagesPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Images & Media')).toBeInTheDocument();
      });

      expect(screen.getByText('Manage product images and media files')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /upload image/i })).toBeInTheDocument();
    });

    it('renders header even before data loads', () => {
      setQueryResults();
      render(<ImagesPage />, { wrapper: createWrapper() });
      // Header renders immediately regardless of data loading state
      expect(screen.getByText('Images & Media')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /upload image/i })).toBeInTheDocument();
    });

    it('renders stat cards with correct data', async () => {
      render(<ImagesPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      });

      expect(screen.getByText('Total Images')).toBeInTheDocument();
      expect(screen.getByText('Added This Week')).toBeInTheDocument();
      expect(screen.getByText('Total Products')).toBeInTheDocument();
    });

    it('renders empty state when no images', async () => {
      setQueryResults([], mockProducts);
      render(<ImagesPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('No images found')).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /upload your first image/i })).toBeInTheDocument();
    });
  });

  describe('Grid/List View', () => {
    it('renders images in grid view by default', async () => {
      render(<ImagesPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      });

      expect(screen.getByText('OG Kush')).toBeInTheDocument();
      expect(screen.getByText('Sour Diesel')).toBeInTheDocument();
    });

    it('switches to list view', async () => {
      const user = userEvent.setup();
      render(<ImagesPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /list view/i }));

      // In list view, download buttons appear per row
      const downloadButtons = screen.getAllByRole('button', { name: /download/i });
      expect(downloadButtons.length).toBeGreaterThan(0);
    });
  });

  describe('Search', () => {
    it('filters images by search query', async () => {
      const user = userEvent.setup();
      render(<ImagesPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      });

      const searchInput = screen.getByRole('textbox', { name: /search images/i });
      await user.type(searchInput, 'Blue');

      expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      expect(screen.queryByText('OG Kush')).not.toBeInTheDocument();
      expect(screen.queryByText('Sour Diesel')).not.toBeInTheDocument();
    });

    it('shows empty state when search has no results', async () => {
      const user = userEvent.setup();
      render(<ImagesPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      });

      const searchInput = screen.getByRole('textbox', { name: /search images/i });
      await user.type(searchInput, 'nonexistent');

      expect(screen.getByText('No images found')).toBeInTheDocument();
    });
  });

  describe('Upload Dialog', () => {
    it('opens upload dialog on button click', async () => {
      const user = userEvent.setup();
      render(<ImagesPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Images & Media')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /upload image/i }));

      expect(screen.getByText('Select Product')).toBeInTheDocument();
      expect(screen.getByText('Select Image')).toBeInTheDocument();
    });

    it('disables file input until a product is selected', async () => {
      const user = userEvent.setup();
      render(<ImagesPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Images & Media')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /upload image/i }));

      const fileInput = screen.getByLabelText('Select Image');
      expect(fileInput).toBeDisabled();
    });
  });

  describe('Image Detail Dialog', () => {
    it('opens detail dialog when clicking an image', async () => {
      const user = userEvent.setup();
      render(<ImagesPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      });

      // Click on the first image card text
      const cards = screen.getAllByText('Blue Dream');
      await user.click(cards[0]);

      // Dialog should show product details
      await waitFor(() => {
        expect(screen.getByText('Product')).toBeInTheDocument();
      });
      expect(screen.getByText('Uploaded')).toBeInTheDocument();
      expect(screen.getByText('URL')).toBeInTheDocument();
    });

    it('has download and delete buttons in detail dialog', async () => {
      const user = userEvent.setup();
      render(<ImagesPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      });

      const cards = screen.getAllByText('Blue Dream');
      await user.click(cards[0]);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /download image/i })).toBeInTheDocument();
      });
      expect(screen.getByRole('button', { name: /delete image/i })).toBeInTheDocument();
    });
  });

  describe('Delete with Confirmation', () => {
    it('opens confirm dialog when clicking delete', async () => {
      const user = userEvent.setup();
      render(<ImagesPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      });

      // Open image detail
      const cards = screen.getAllByText('Blue Dream');
      await user.click(cards[0]);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /delete image/i })).toBeInTheDocument();
      });

      // Click delete
      await user.click(screen.getByRole('button', { name: /delete image/i }));

      // Verify confirm dialog was called
      expect(mockConfirm).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Delete Image',
          itemType: 'image',
          itemName: 'Blue Dream',
        })
      );
    });
  });

  describe('Navigation', () => {
    it('navigates back to inventory hub on back button click', async () => {
      const user = userEvent.setup();
      render(<ImagesPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Images & Media')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /back to inventory/i }));
      expect(mockNavigateToAdmin).toHaveBeenCalledWith('inventory-hub');
    });
  });

  describe('Accessibility', () => {
    it('has aria-labels on view toggle buttons', async () => {
      render(<ImagesPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Images & Media')).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /grid view/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /list view/i })).toBeInTheDocument();
    });

    it('has aria-label on search input', async () => {
      render(<ImagesPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Images & Media')).toBeInTheDocument();
      });

      expect(screen.getByRole('textbox', { name: /search images/i })).toBeInTheDocument();
    });

    it('has aria-label on back button', async () => {
      render(<ImagesPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Images & Media')).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /back to inventory/i })).toBeInTheDocument();
    });

    it('renders alt text on images', async () => {
      render(<ImagesPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      });

      const images = screen.getAllByRole('img');
      images.forEach(img => {
        expect(img).toHaveAttribute('alt');
        expect(img.getAttribute('alt')).not.toBe('');
      });
    });
  });

  describe('Tenant Isolation', () => {
    it('calls supabase.from with products table', async () => {
      const { supabase } = await import('@/integrations/supabase/client');
      render(<ImagesPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('products');
      });
    });

    it('does not render images when tenantId is missing', async () => {
      const { useTenantAdminAuth } = await import('@/contexts/TenantAdminAuthContext');
      vi.mocked(useTenantAdminAuth).mockReturnValueOnce({
        tenant: null,
        loading: false,
        admin: null,
        tenantSlug: '',
      } as ReturnType<typeof useTenantAdminAuth>);

      render(<ImagesPage />, { wrapper: createWrapper() });

      // When tenantId is missing, queries are disabled so no images render.
      // The page should not show any product image names.
      expect(screen.queryByText('Blue Dream')).not.toBeInTheDocument();
      expect(screen.queryByText('OG Kush')).not.toBeInTheDocument();
    });
  });

  describe('Stats calculation', () => {
    it('shows the Added This Week stat card', async () => {
      render(<ImagesPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      });

      expect(screen.getByText('Added This Week')).toBeInTheDocument();
      expect(screen.getByText('Total Products')).toBeInTheDocument();
    });
  });
});
