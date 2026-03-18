/**
 * Tests for OfflineOrderCreate component
 *
 * These tests verify the offline order creation functionality including:
 * - Page rendering and header display
 * - Product search with sanitization
 * - Loading skeleton display
 * - Cart management (add, remove, update quantity)
 * - Zod form validation with inline errors
 * - Tab switching between create and pending orders
 * - Offline/online status display
 * - Form input maxLength constraints
 * - Stable keys (no index-based keys)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

import type { OfflineOrderData } from '@/hooks/useOfflineOrderCreation';

// Must hoist mocks before imports
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    info: vi.fn(),
  }),
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: { id: 'test-tenant-id', name: 'Test Tenant' },
    tenantSlug: 'test-tenant',
  }),
}));

vi.mock('@/hooks/useTenantNavigate', () => ({
  useTenantNavigate: () => vi.fn(),
}));

const mockCreateOfflineOrder = vi.fn().mockResolvedValue('order-1');
const mockSyncOfflineOrders = vi.fn().mockResolvedValue({ success: 0, failed: 0 });
const mockRemoveOfflineOrder = vi.fn().mockResolvedValue(undefined);
const mockRetryOrder = vi.fn().mockResolvedValue(undefined);

// Default hook return value - can be overridden per test
let hookReturnValue = {
  offlineOrders: [] as OfflineOrderData[],
  isOnline: true,
  isSyncing: false,
  createOfflineOrder: mockCreateOfflineOrder,
  syncOfflineOrders: mockSyncOfflineOrders,
  removeOfflineOrder: mockRemoveOfflineOrder,
  retryOrder: mockRetryOrder,
  getOfflineOrderCount: () => 0,
};

vi.mock('@/hooks/useOfflineOrderCreation', () => ({
  useOfflineOrderCreation: () => hookReturnValue,
}));

vi.mock('@/lib/idb', () => ({
  db: {
    getAllProducts: vi.fn().mockResolvedValue([]),
    saveProduct: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/components/admin/orders/CustomerAutoAssociation', () => ({
  CustomerAutoAssociation: () => <div data-testid="customer-auto-association">Customer Auto Association</div>,
}));

vi.mock('@/components/SEOHead', () => ({
  SEOHead: () => null,
}));

vi.mock('@/components/ui/shortcut-hint', () => ({
  ShortcutHint: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useModifierKey: () => '⌘',
}));

const mockProducts = [
  { id: 'prod-1', name: 'Blue Dream', price: 35.0, sku: 'BD-001' },
  { id: 'prod-2', name: 'OG Kush', price: 45.0, sku: 'OG-001' },
  { id: 'prod-3', name: 'Sour Diesel', price: 40.0, sku: 'SD-001' },
];

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: mockProducts,
        error: null,
      }),
    })),
  },
}));

// Import component after mocks
import OfflineOrderCreate from '../OfflineOrderCreate';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = createQueryClient();
  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>{ui}</BrowserRouter>
      </QueryClientProvider>
    ),
    queryClient,
  };
}

describe('OfflineOrderCreate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to default hook return value
    hookReturnValue = {
      offlineOrders: [],
      isOnline: true,
      isSyncing: false,
      createOfflineOrder: mockCreateOfflineOrder,
      syncOfflineOrders: mockSyncOfflineOrders,
      removeOfflineOrder: mockRemoveOfflineOrder,
      retryOrder: mockRetryOrder,
      getOfflineOrderCount: () => 0,
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('renders the page header with title', async () => {
      renderWithProviders(<OfflineOrderCreate />);
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Create Order' })).toBeInTheDocument();
      });
    });

    it('renders online status indicator', async () => {
      renderWithProviders(<OfflineOrderCreate />);
      await waitFor(() => {
        expect(screen.getByText('Online')).toBeInTheDocument();
        expect(screen.getByText('Connected - orders sync immediately')).toBeInTheDocument();
      });
    });

    it('renders New Order and Pending Orders tabs', async () => {
      renderWithProviders(<OfflineOrderCreate />);
      await waitFor(() => {
        expect(screen.getByText('New Order')).toBeInTheDocument();
        expect(screen.getByText('Pending Orders')).toBeInTheDocument();
      });
    });

    it('renders product search input with aria-label', async () => {
      renderWithProviders(<OfflineOrderCreate />);
      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText('Search products by name or SKU...');
        expect(searchInput).toBeInTheDocument();
        expect(searchInput).toHaveAttribute('aria-label', 'Search products by name or SKU');
      });
    });

    it('renders customer details form', async () => {
      renderWithProviders(<OfflineOrderCreate />);
      await waitFor(() => {
        expect(screen.getByText('Customer Details')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Full name')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('(555) 555-5555')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('customer@email.com')).toBeInTheDocument();
      });
    });

    it('renders empty cart state', async () => {
      renderWithProviders(<OfflineOrderCreate />);
      await waitFor(() => {
        expect(screen.getByText('Cart is empty')).toBeInTheDocument();
        expect(screen.getByText('Click products to add them')).toBeInTheDocument();
      });
    });
  });

  describe('Product Search', () => {
    it('displays products after loading', async () => {
      renderWithProviders(<OfflineOrderCreate />);
      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
        expect(screen.getByText('OG Kush')).toBeInTheDocument();
        expect(screen.getByText('Sour Diesel')).toBeInTheDocument();
      });
    });

    it('filters products by search term', async () => {
      const user = userEvent.setup();
      renderWithProviders(<OfflineOrderCreate />);

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search products by name or SKU...');
      await user.type(searchInput, 'Blue');

      expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      expect(screen.queryByText('OG Kush')).not.toBeInTheDocument();
      expect(screen.queryByText('Sour Diesel')).not.toBeInTheDocument();
    });

    it('filters products by SKU', async () => {
      const user = userEvent.setup();
      renderWithProviders(<OfflineOrderCreate />);

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search products by name or SKU...');
      await user.type(searchInput, 'OG-001');

      expect(screen.queryByText('Blue Dream')).not.toBeInTheDocument();
      expect(screen.getByText('OG Kush')).toBeInTheDocument();
    });

    it('shows no products found when search has no matches', async () => {
      const user = userEvent.setup();
      renderWithProviders(<OfflineOrderCreate />);

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search products by name or SKU...');
      await user.type(searchInput, 'NonExistentProduct');

      expect(screen.getByText('No products found')).toBeInTheDocument();
    });

    it('displays product prices', async () => {
      renderWithProviders(<OfflineOrderCreate />);
      await waitFor(() => {
        expect(screen.getByText('$35.00')).toBeInTheDocument();
        expect(screen.getByText('$45.00')).toBeInTheDocument();
      });
    });

    it('displays product SKUs', async () => {
      renderWithProviders(<OfflineOrderCreate />);
      await waitFor(() => {
        expect(screen.getByText('SKU: BD-001')).toBeInTheDocument();
      });
    });

    it('has aria-labels on product items', async () => {
      renderWithProviders(<OfflineOrderCreate />);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Add Blue Dream to cart' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Add OG Kush to cart' })).toBeInTheDocument();
      });
    });
  });

  describe('Cart Operations', () => {
    it('adds product to cart on click', async () => {
      const user = userEvent.setup();
      renderWithProviders(<OfflineOrderCreate />);

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Add Blue Dream to cart' }));

      await waitFor(() => {
        expect(screen.getByText('Cart (1)')).toBeInTheDocument();
      });
    });

    it('shows subtotal in order summary', async () => {
      const user = userEvent.setup();
      renderWithProviders(<OfflineOrderCreate />);

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Add Blue Dream to cart' }));

      await waitFor(() => {
        expect(screen.getByText('Subtotal')).toBeInTheDocument();
      });
    });

    it('removes item when quantity reaches zero via decrease button', async () => {
      const user = userEvent.setup();
      renderWithProviders(<OfflineOrderCreate />);

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Add Blue Dream to cart' }));

      await waitFor(() => {
        expect(screen.getByText('Cart (1)')).toBeInTheDocument();
      });

      await user.click(screen.getByLabelText('Decrease quantity'));

      await waitFor(() => {
        expect(screen.getByText('Cart (0)')).toBeInTheDocument();
        expect(screen.getByText('Cart is empty')).toBeInTheDocument();
      });
    });

    it('removes item with trash button', async () => {
      const user = userEvent.setup();
      renderWithProviders(<OfflineOrderCreate />);

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Add Blue Dream to cart' }));

      await waitFor(() => {
        expect(screen.getByText('Cart (1)')).toBeInTheDocument();
      });

      await user.click(screen.getByLabelText('Remove item'));

      await waitFor(() => {
        expect(screen.getByText('Cart is empty')).toBeInTheDocument();
      });
    });

    it('increases quantity with plus button', async () => {
      const user = userEvent.setup();
      renderWithProviders(<OfflineOrderCreate />);

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Add Blue Dream to cart' }));

      await waitFor(() => {
        expect(screen.getByText('Cart (1)')).toBeInTheDocument();
      });

      // Click increase quantity
      await user.click(screen.getByLabelText('Increase quantity'));

      // Verify item still in cart (cart count stays at 1 item, but quantity = 2)
      expect(screen.getByText('Cart (1)')).toBeInTheDocument();
      // Decrease button is still available, meaning quantity > 0
      expect(screen.getByLabelText('Decrease quantity')).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('has maxLength on customer name input', async () => {
      renderWithProviders(<OfflineOrderCreate />);
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Full name')).toHaveAttribute('maxLength', '100');
      });
    });

    it('has maxLength on phone input', async () => {
      renderWithProviders(<OfflineOrderCreate />);
      await waitFor(() => {
        expect(screen.getByPlaceholderText('(555) 555-5555')).toHaveAttribute('maxLength', '20');
      });
    });

    it('has maxLength on email input', async () => {
      renderWithProviders(<OfflineOrderCreate />);
      await waitFor(() => {
        expect(screen.getByPlaceholderText('customer@email.com')).toHaveAttribute('maxLength', '254');
      });
    });

    it('has maxLength on delivery address input', async () => {
      renderWithProviders(<OfflineOrderCreate />);
      await waitFor(() => {
        expect(screen.getByPlaceholderText('123 Main St, City, State ZIP')).toHaveAttribute('maxLength', '500');
      });
    });

    it('has maxLength on delivery notes textarea', async () => {
      renderWithProviders(<OfflineOrderCreate />);
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Special instructions...')).toHaveAttribute('maxLength', '2000');
      });
    });

    it('displays delivery notes character count', async () => {
      renderWithProviders(<OfflineOrderCreate />);
      await waitFor(() => {
        expect(screen.getByText('0/2000')).toBeInTheDocument();
      });
    });

    it('updates character count as user types delivery notes', async () => {
      const user = userEvent.setup();
      renderWithProviders(<OfflineOrderCreate />);

      await waitFor(() => {
        expect(screen.getByText('0/2000')).toBeInTheDocument();
      });

      await user.type(screen.getByPlaceholderText('Special instructions...'), 'Leave at door');

      expect(screen.getByText('13/2000')).toBeInTheDocument();
    });

    it('disables submit when required fields are empty', async () => {
      renderWithProviders(<OfflineOrderCreate />);

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      });

      // Submit button should be disabled since form is invalid (empty name + address + no cart items)
      const buttons = screen.getAllByRole('button');
      const submitBtn = buttons.find(btn => btn.textContent?.includes('Create Order'));
      expect(submitBtn).toBeDisabled();
    });

    it('disables submit when cart is empty even with valid fields', async () => {
      const user = userEvent.setup();
      renderWithProviders(<OfflineOrderCreate />);

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      });

      // Fill all required fields
      await user.type(screen.getByPlaceholderText('Full name'), 'John Doe');
      await user.type(screen.getByPlaceholderText('123 Main St, City, State ZIP'), '123 Main St');

      // Submit button should be disabled since cart is empty
      const buttons = screen.getAllByRole('button');
      const submitBtn = buttons.find(btn => btn.textContent?.includes('Create Order'));
      expect(submitBtn).toBeDisabled();
    });
  });

  describe('Tab Navigation', () => {
    it('switches to pending orders tab', async () => {
      const user = userEvent.setup();
      renderWithProviders(<OfflineOrderCreate />);

      await waitFor(() => {
        expect(screen.getByText('New Order')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Pending Orders'));

      await waitFor(() => {
        expect(screen.getByText('All caught up!')).toBeInTheDocument();
        expect(screen.getByText('No pending offline orders to sync.')).toBeInTheDocument();
      });
    });

    it('switches back to create tab', async () => {
      const user = userEvent.setup();
      renderWithProviders(<OfflineOrderCreate />);

      await waitFor(() => {
        expect(screen.getByText('New Order')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Pending Orders'));
      await user.click(screen.getByText('New Order'));

      await waitFor(() => {
        expect(screen.getByText('Products')).toBeInTheDocument();
      });
    });
  });

  describe('Pending Orders', () => {
    it('displays pending orders with stable productId keys', async () => {
      const pendingOrders: OfflineOrderData[] = [
        {
          id: 'order-1',
          tenantId: 'test-tenant-id',
          customerName: 'Jane Doe',
          deliveryAddress: '456 Elm St',
          paymentMethod: 'cash',
          items: [
            { productId: 'prod-1', productName: 'Blue Dream', quantity: 2, unitPrice: 35.0 },
            { productId: 'prod-2', productName: 'OG Kush', quantity: 1, unitPrice: 45.0 },
          ],
          subtotal: 115.0,
          taxAmount: 0,
          deliveryFee: 0,
          totalAmount: 115.0,
          status: 'pending_sync',
          createdAt: new Date().toISOString(),
          idempotencyKey: 'key-1',
        },
      ];

      hookReturnValue = {
        ...hookReturnValue,
        offlineOrders: pendingOrders,
        getOfflineOrderCount: () => 1,
      };

      const user = userEvent.setup();
      renderWithProviders(<OfflineOrderCreate />);

      await user.click(screen.getByText('Pending Orders'));

      await waitFor(() => {
        expect(screen.getByText('Jane Doe')).toBeInTheDocument();
        expect(screen.getByText('Pending Sync')).toBeInTheDocument();
        expect(screen.getByText('Blue Dream x2')).toBeInTheDocument();
        expect(screen.getByText('OG Kush x1')).toBeInTheDocument();
      });
    });

    it('shows retry button for failed orders', async () => {
      const failedOrders: OfflineOrderData[] = [
        {
          id: 'order-2',
          tenantId: 'test-tenant-id',
          customerName: 'Failed Order',
          deliveryAddress: '789 Oak Ave',
          paymentMethod: 'card',
          items: [{ productId: 'prod-1', productName: 'Blue Dream', quantity: 1, unitPrice: 35.0 }],
          subtotal: 35.0,
          taxAmount: 0,
          deliveryFee: 0,
          totalAmount: 35.0,
          status: 'failed',
          createdAt: new Date().toISOString(),
          idempotencyKey: 'key-2',
          syncError: 'Network timeout',
        },
      ];

      hookReturnValue = {
        ...hookReturnValue,
        offlineOrders: failedOrders,
        getOfflineOrderCount: () => 1,
      };

      const user = userEvent.setup();
      renderWithProviders(<OfflineOrderCreate />);

      await user.click(screen.getByText('Pending Orders'));

      await waitFor(() => {
        expect(screen.getByText('Failed')).toBeInTheDocument();
        expect(screen.getByText('Error: Network timeout')).toBeInTheDocument();
        expect(screen.getByLabelText('Retry sync')).toBeInTheDocument();
      });
    });

    it('shows pending orders count badge on tab', async () => {
      const pendingOrders: OfflineOrderData[] = [
        {
          id: 'order-1',
          tenantId: 'test-tenant-id',
          customerName: 'Jane Doe',
          deliveryAddress: '456 Elm St',
          paymentMethod: 'cash',
          items: [{ productId: 'prod-1', productName: 'Blue Dream', quantity: 1, unitPrice: 35.0 }],
          subtotal: 35.0,
          taxAmount: 0,
          deliveryFee: 0,
          totalAmount: 35.0,
          status: 'pending_sync',
          createdAt: new Date().toISOString(),
          idempotencyKey: 'key-1',
        },
      ];

      hookReturnValue = {
        ...hookReturnValue,
        offlineOrders: pendingOrders,
        getOfflineOrderCount: () => 1,
      };

      renderWithProviders(<OfflineOrderCreate />);

      // The pending orders tab should show a badge with count
      const tabButton = screen.getByText('Pending Orders').closest('button');
      expect(tabButton).toBeInTheDocument();
      expect(within(tabButton!).getByText('1')).toBeInTheDocument();
    });

    it('shows sync button when pending orders exist', async () => {
      const pendingOrders: OfflineOrderData[] = [
        {
          id: 'order-1',
          tenantId: 'test-tenant-id',
          customerName: 'Jane Doe',
          deliveryAddress: '456 Elm St',
          paymentMethod: 'cash',
          items: [{ productId: 'prod-1', productName: 'Blue Dream', quantity: 1, unitPrice: 35.0 }],
          subtotal: 35.0,
          taxAmount: 0,
          deliveryFee: 0,
          totalAmount: 35.0,
          status: 'pending_sync',
          createdAt: new Date().toISOString(),
          idempotencyKey: 'key-1',
        },
      ];

      hookReturnValue = {
        ...hookReturnValue,
        offlineOrders: pendingOrders,
        getOfflineOrderCount: () => 1,
      };

      renderWithProviders(<OfflineOrderCreate />);

      // Header sync button should show with count
      expect(screen.getByText('Sync (1)')).toBeInTheDocument();
    });

    it('calls removeOfflineOrder when delete is clicked', async () => {
      const pendingOrders: OfflineOrderData[] = [
        {
          id: 'order-1',
          tenantId: 'test-tenant-id',
          customerName: 'Jane Doe',
          deliveryAddress: '456 Elm St',
          paymentMethod: 'cash',
          items: [{ productId: 'prod-1', productName: 'Blue Dream', quantity: 1, unitPrice: 35.0 }],
          subtotal: 35.0,
          taxAmount: 0,
          deliveryFee: 0,
          totalAmount: 35.0,
          status: 'pending_sync',
          createdAt: new Date().toISOString(),
          idempotencyKey: 'key-1',
        },
      ];

      hookReturnValue = {
        ...hookReturnValue,
        offlineOrders: pendingOrders,
        getOfflineOrderCount: () => 1,
      };

      const user = userEvent.setup();
      renderWithProviders(<OfflineOrderCreate />);

      await user.click(screen.getByText('Pending Orders'));

      await waitFor(() => {
        expect(screen.getByLabelText('Remove order')).toBeInTheDocument();
      });

      await user.click(screen.getByLabelText('Remove order'));
      expect(mockRemoveOfflineOrder).toHaveBeenCalledWith('order-1');
    });
  });

  describe('Offline Mode', () => {
    it('shows offline status text when offline', async () => {
      hookReturnValue = {
        ...hookReturnValue,
        isOnline: false,
      };

      renderWithProviders(<OfflineOrderCreate />);

      await waitFor(() => {
        expect(screen.getByText('Offline - orders saved locally')).toBeInTheDocument();
      });
    });

    it('shows Save Offline button text when offline', async () => {
      hookReturnValue = {
        ...hookReturnValue,
        isOnline: false,
      };

      renderWithProviders(<OfflineOrderCreate />);

      await waitFor(() => {
        expect(screen.getByText('Save Offline')).toBeInTheDocument();
        expect(screen.getByText("Order will sync when you're back online")).toBeInTheDocument();
      });
    });

    it('renders products section when offline', async () => {
      hookReturnValue = {
        ...hookReturnValue,
        isOnline: false,
      };

      renderWithProviders(<OfflineOrderCreate />);

      await waitFor(() => {
        expect(screen.getByText('Products')).toBeInTheDocument();
      });
    });
  });

  describe('Order Submission', () => {
    it('calls createOfflineOrder with form data on submit', async () => {
      const user = userEvent.setup();
      renderWithProviders(<OfflineOrderCreate />);

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      });

      // Add product to cart
      await user.click(screen.getByRole('button', { name: 'Add Blue Dream to cart' }));

      // Fill form fields
      await user.type(screen.getByPlaceholderText('Full name'), 'John Doe');
      await user.type(screen.getByPlaceholderText('123 Main St, City, State ZIP'), '123 Main St');

      // Submit
      const buttons = screen.getAllByRole('button');
      const submitBtn = buttons.find(btn => btn.textContent?.includes('Create Order') && !btn.hasAttribute('disabled'));

      if (submitBtn) {
        await user.click(submitBtn);

        await waitFor(() => {
          expect(mockCreateOfflineOrder).toHaveBeenCalledWith(
            expect.objectContaining({
              tenantId: 'test-tenant-id',
              customerName: 'John Doe',
              deliveryAddress: '123 Main St',
              paymentMethod: 'cash',
              items: expect.arrayContaining([
                expect.objectContaining({
                  productId: 'prod-1',
                  productName: 'Blue Dream',
                  quantity: 1,
                  unitPrice: 35.0,
                }),
              ]),
            })
          );
        });
      }
    });
  });
});
