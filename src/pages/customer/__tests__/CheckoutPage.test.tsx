/**
 * CheckoutPage Tests
 * Tests real order creation via create_unified_order RPC,
 * cart clearing, loading states, and error handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

// Mock supabase
const mockRpc = vi.fn();
const mockFrom = vi.fn();
const mockDelete = vi.fn();
const mockDeleteEq = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (...args: unknown[]) => mockFrom(...args),
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'user-1', email: 'test@example.com', user_metadata: { first_name: 'Test', last_name: 'User', phone: '5551234567' } } } },
      }),
    },
  },
}));

// Mock toast
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
    info: vi.fn(),
    warning: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock customer auth
vi.mock('@/contexts/CustomerAuthContext', () => ({
  useCustomerAuth: () => ({
    customer: { id: 'customer-1', email: 'test@example.com', tenant_id: 'tenant-1' },
    tenant: { id: 'tenant-1', business_name: 'Test Store', slug: 'test-store' },
    token: 'mock-token',
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
    refreshToken: vi.fn(),
    connectionStatus: { online: true, wasOffline: false },
  }),
}));

// Mock guest cart
vi.mock('@/hooks/useGuestCart', () => ({
  useGuestCart: () => ({
    guestCart: [],
    addToGuestCart: vi.fn(),
    updateGuestCartItem: vi.fn(),
    removeFromGuestCart: vi.fn(),
    clearGuestCart: vi.fn(),
    getGuestCartCount: vi.fn().mockReturnValue(0),
  }),
}));

// Mock customer nav components
vi.mock('@/components/customer/CustomerMobileNav', () => ({
  CustomerMobileNav: () => <div data-testid="mobile-nav" />,
}));
vi.mock('@/components/customer/CustomerMobileBottomNav', () => ({
  CustomerMobileBottomNav: () => <div data-testid="mobile-bottom-nav" />,
}));
vi.mock('@/components/shared/SuccessState', () => ({
  SuccessState: ({ type, details }: { type: string; details: string }) => (
    <div data-testid="success-state" data-type={type} data-details={details}>
      Order Placed: {details}
    </div>
  ),
}));

// Mock formatters
vi.mock('@/lib/utils/formatCurrency', () => ({
  formatCurrency: (val: number) => `$${val.toFixed(2)}`,
}));
vi.mock('@/lib/formatters', () => ({
  formatSmartDate: (date: string) => date,
}));

// Import after mocks
import CheckoutPage from '../CheckoutPage';

// Helpers
function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function renderCheckoutPage() {
  const queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/test-store/shop/checkout']}>
        <CheckoutPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// Mock product data for cart_items query
const mockCartItems = [
  {
    id: 'cart-1',
    user_id: 'user-1',
    product_id: 'prod-1',
    quantity: 2,
    selected_weight: 'unit',
    products: {
      id: 'prod-1',
      name: 'Test Product',
      price: 25.0,
      prices: null,
      image_url: 'https://example.com/img.jpg',
      sku: 'TP-001',
    },
  },
  {
    id: 'cart-2',
    user_id: 'user-1',
    product_id: 'prod-2',
    quantity: 1,
    selected_weight: '3.5g',
    products: {
      id: 'prod-2',
      name: 'Another Product',
      price: 40.0,
      prices: { '3.5g': 35 },
      image_url: null,
      sku: 'AP-002',
    },
  },
];

const mockAddresses = [
  {
    id: 'addr-1',
    street: '123 Main St',
    apartment: 'Apt 4',
    city: 'New York',
    state: 'NY',
    zip_code: '10001',
    borough: 'Manhattan',
    is_default: true,
  },
];

describe('CheckoutPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: cart_items query returns items, also handles delete
    mockFrom.mockImplementation((table: string) => {
      if (table === 'cart_items') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: mockCartItems, error: null }),
          }),
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'addresses') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: mockAddresses, error: null }),
            }),
          }),
        };
      }
      if (table === 'account_settings') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { tax_rate: 8.5 }, error: null }),
            }),
          }),
        };
      }
      if (table === 'unified_orders') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: { order_number: 'ORD-1001' }, error: null }),
              }),
            }),
          }),
        };
      }
      // Default fallback
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      };
    });

    // Default: RPC succeeds
    mockRpc.mockResolvedValue({
      data: 'order-uuid-123',
      error: null,
    });
  });

  it('renders checkout steps', async () => {
    renderCheckoutPage();

    await waitFor(() => {
      expect(screen.getByText('Delivery')).toBeInTheDocument();
      expect(screen.getByText('Payment')).toBeInTheDocument();
      expect(screen.getByText('Review')).toBeInTheDocument();
    });
  });

  it('calls create_unified_order RPC on place order', async () => {
    const user = userEvent.setup();
    renderCheckoutPage();

    // Wait for cart to load
    await waitFor(() => {
      expect(screen.getByText('Delivery Information')).toBeInTheDocument();
    });

    // Navigate through steps: Delivery -> Payment -> Review
    const continueButtons = screen.getAllByRole('button', { name: /continue/i });
    await user.click(continueButtons[0]); // to payment

    await waitFor(() => {
      expect(screen.getByText('Payment Method')).toBeInTheDocument();
    });

    const continueButtons2 = screen.getAllByRole('button', { name: /continue/i });
    await user.click(continueButtons2[0]); // to review

    await waitFor(() => {
      expect(screen.getByText('Review Your Order')).toBeInTheDocument();
    });

    // Place order
    const placeOrderButtons = screen.getAllByRole('button', { name: /place order/i });
    await user.click(placeOrderButtons[0]);

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith(
        'create_unified_order',
        expect.objectContaining({
          p_tenant_id: 'tenant-1',
          p_order_type: 'retail',
          p_source: 'portal',
          p_payment_method: 'card',
          p_contact_name: 'Test User',
        }),
      );
    });
  });

  it('shows success state after order is placed', async () => {
    const user = userEvent.setup();
    renderCheckoutPage();

    await waitFor(() => {
      expect(screen.getByText('Delivery Information')).toBeInTheDocument();
    });

    // Navigate to review step
    const continueButtons = screen.getAllByRole('button', { name: /continue/i });
    await user.click(continueButtons[0]);
    await waitFor(() => expect(screen.getByText('Payment Method')).toBeInTheDocument());

    const continueButtons2 = screen.getAllByRole('button', { name: /continue/i });
    await user.click(continueButtons2[0]);
    await waitFor(() => expect(screen.getByText('Review Your Order')).toBeInTheDocument());

    // Place order
    const placeOrderButtons = screen.getAllByRole('button', { name: /place order/i });
    await user.click(placeOrderButtons[0]);

    // Verify success state shows
    await waitFor(() => {
      expect(screen.getByTestId('success-state')).toBeInTheDocument();
    });

    // Verify toast was called (order number may come from the UUID fallback or the mock)
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith(
        'Order placed successfully!',
        expect.objectContaining({
          description: expect.stringContaining('has been placed.'),
        }),
      );
    });
  });

  it('shows error toast when order creation fails', async () => {
    // Make RPC fail
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'Insufficient stock', code: 'P0001' },
    });

    const user = userEvent.setup();
    renderCheckoutPage();

    await waitFor(() => {
      expect(screen.getByText('Delivery Information')).toBeInTheDocument();
    });

    // Navigate to review
    const continueButtons = screen.getAllByRole('button', { name: /continue/i });
    await user.click(continueButtons[0]);
    await waitFor(() => expect(screen.getByText('Payment Method')).toBeInTheDocument());

    const continueButtons2 = screen.getAllByRole('button', { name: /continue/i });
    await user.click(continueButtons2[0]);
    await waitFor(() => expect(screen.getByText('Review Your Order')).toBeInTheDocument());

    // Place order
    const placeOrderButtons = screen.getAllByRole('button', { name: /place order/i });
    await user.click(placeOrderButtons[0]);

    // Verify error toast
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        'Error placing order',
        expect.objectContaining({ description: 'Insufficient stock' }),
      );
    });

    // Should NOT show success state
    expect(screen.queryByTestId('success-state')).not.toBeInTheDocument();
  });

  it('sends correct item data in RPC call', async () => {
    const user = userEvent.setup();
    renderCheckoutPage();

    await waitFor(() => {
      expect(screen.getByText('Delivery Information')).toBeInTheDocument();
    });

    // Navigate to review and place order
    const continueButtons = screen.getAllByRole('button', { name: /continue/i });
    await user.click(continueButtons[0]);
    await waitFor(() => expect(screen.getByText('Payment Method')).toBeInTheDocument());

    const continueButtons2 = screen.getAllByRole('button', { name: /continue/i });
    await user.click(continueButtons2[0]);
    await waitFor(() => expect(screen.getByText('Review Your Order')).toBeInTheDocument());

    const placeOrderButtons = screen.getAllByRole('button', { name: /place order/i });
    await user.click(placeOrderButtons[0]);

    await waitFor(() => {
      const rpcCall = mockRpc.mock.calls[0];
      expect(rpcCall[0]).toBe('create_unified_order');

      const params = rpcCall[1] as Record<string, unknown>;
      const items = params.p_items as Array<Record<string, unknown>>;

      // First product: regular price
      expect(items[0]).toEqual(
        expect.objectContaining({
          product_id: 'prod-1',
          product_name: 'Test Product',
          quantity: 2,
          unit_price: 25.0,
          sku: 'TP-001',
        }),
      );

      // Second product: weight-based price
      expect(items[1]).toEqual(
        expect.objectContaining({
          product_id: 'prod-2',
          product_name: 'Another Product',
          quantity: 1,
          unit_price: 35, // from prices['3.5g']
        }),
      );
    });
  });

  it('includes delivery address from selected address', async () => {
    const user = userEvent.setup();
    renderCheckoutPage();

    await waitFor(() => {
      expect(screen.getByText('Delivery Information')).toBeInTheDocument();
    });

    // Navigate to review and place order
    const continueButtons = screen.getAllByRole('button', { name: /continue/i });
    await user.click(continueButtons[0]);
    await waitFor(() => expect(screen.getByText('Payment Method')).toBeInTheDocument());

    const continueButtons2 = screen.getAllByRole('button', { name: /continue/i });
    await user.click(continueButtons2[0]);
    await waitFor(() => expect(screen.getByText('Review Your Order')).toBeInTheDocument());

    const placeOrderButtons = screen.getAllByRole('button', { name: /place order/i });
    await user.click(placeOrderButtons[0]);

    await waitFor(() => {
      const rpcCall = mockRpc.mock.calls[0];
      const params = rpcCall[1] as Record<string, unknown>;

      expect(params.p_delivery_address).toContain('123 Main St');
      expect(params.p_delivery_address).toContain('Apt 4');
      expect(params.p_delivery_address).toContain('New York');
      expect(params.p_delivery_address).toContain('NY');
      expect(params.p_delivery_address).toContain('10001');
    });
  });

  it('prevents double submission', async () => {
    // Slow down the RPC response
    mockRpc.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ data: 'order-uuid-123', error: null }), 200)),
    );

    const user = userEvent.setup();
    renderCheckoutPage();

    await waitFor(() => {
      expect(screen.getByText('Delivery Information')).toBeInTheDocument();
    });

    // Navigate to review
    const continueButtons = screen.getAllByRole('button', { name: /continue/i });
    await user.click(continueButtons[0]);
    await waitFor(() => expect(screen.getByText('Payment Method')).toBeInTheDocument());

    const continueButtons2 = screen.getAllByRole('button', { name: /continue/i });
    await user.click(continueButtons2[0]);
    await waitFor(() => expect(screen.getByText('Review Your Order')).toBeInTheDocument());

    // Click place order twice rapidly
    const placeOrderButtons = screen.getAllByRole('button', { name: /place order/i });
    await user.click(placeOrderButtons[0]);
    await user.click(placeOrderButtons[0]);

    // RPC should only be called once
    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledTimes(1);
    });
  });
});
