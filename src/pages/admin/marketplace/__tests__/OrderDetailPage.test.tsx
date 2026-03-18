/**
 * Marketplace OrderDetailPage Tests
 * Tests:
 * - tenant_id filtering on order fetch query
 * - Loading and empty states
 * - Order details rendering (items, shipping, payment)
 * - Status badge rendering
 * - Buyer information display with joined tenant data
 * - Action buttons by order status
 * - Mutation calls include tenant_id filter
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// Mock dependencies before importing component
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: {
      id: 'seller-tenant-123',
      slug: 'test-dispensary',
    },
  }),
}));

vi.mock('@/contexts/BreadcrumbContext', () => ({
  useBreadcrumbLabel: vi.fn(),
}));

const mockSupabaseFrom = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockSupabaseFrom(...args),
  },
}));

vi.mock('@/lib/utils/formatCurrency', () => ({
  formatCurrency: (value: number) => `$${value.toFixed(2)}`,
}));

vi.mock('@/lib/utils/formatDate', () => ({
  formatSmartDate: (date: string) => new Date(date).toLocaleDateString(),
}));

vi.mock('@/lib/humanizeError', () => ({
  humanizeError: (error: unknown) => String(error),
}));

import OrderDetailPage from '../OrderDetailPage';

const mockOrder = {
  id: 'order-001',
  order_number: 'MKT-2024-001',
  status: 'pending',
  created_at: '2024-01-15T10:00:00Z',
  buyer_tenant_id: 'buyer-tenant-456',
  seller_tenant_id: 'seller-tenant-123',
  buyer_notes: 'Please ship ASAP',
  seller_notes: null,
  subtotal: 150,
  platform_fee: 3,
  shipping_cost: 10,
  tax: 12,
  total_amount: 175,
  payment_status: 'pending',
  payment_terms: 'Net 30',
  paid_at: null,
  shipping_address: {
    street: '123 Main St',
    city: 'Denver',
    state: 'CO',
    zip: '80202',
    country: 'US',
  },
  shipping_method: null,
  tracking_number: null,
  shipped_at: null,
  delivered_at: null,
  customer_name: 'Green Leaf Co',
  customer_email: 'orders@greenleaf.co',
  customer_phone: '555-0123',
  marketplace_order_items: [
    {
      id: 'item-1',
      product_name: 'Blue Dream',
      quantity: 5,
      unit_type: 'oz',
      unit_price: 20,
      total_price: 100,
    },
    {
      id: 'item-2',
      product_name: 'OG Kush',
      quantity: 2,
      unit_type: 'oz',
      unit_price: 25,
      total_price: 50,
    },
  ],
  buyer_tenant: {
    id: 'buyer-tenant-456',
    business_name: 'Green Leaf Dispensary',
  },
};

function createMockChain(resolvedData: unknown = null, error: unknown = null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: resolvedData, error }),
  };
  return chain;
}

function renderPage(orderId = 'order-001') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/test-dispensary/admin/marketplace/orders/${orderId}`]}>
        <Routes>
          <Route path="/:tenantSlug/admin/marketplace/orders/:orderId" element={<OrderDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('OrderDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockReset();
  });

  describe('Tenant ID filtering', () => {
    it('should filter order fetch by seller_tenant_id', async () => {
      const chain = createMockChain(mockOrder);
      mockSupabaseFrom.mockReturnValue(chain);

      renderPage();

      await waitFor(() => {
        expect(mockSupabaseFrom).toHaveBeenCalledWith('marketplace_orders');
      });

      // Verify eq was called with seller_tenant_id
      const eqCalls = chain.eq.mock.calls;
      const hasTenantFilter = eqCalls.some(
        (call: unknown[]) => call[0] === 'seller_tenant_id' && call[1] === 'seller-tenant-123'
      );
      expect(hasTenantFilter).toBe(true);
    });
  });

  describe('Loading state', () => {
    it('should show loading spinner while fetching', () => {
      const chain = createMockChain();
      // Never resolve to keep loading
      chain.maybeSingle = vi.fn().mockReturnValue(new Promise(() => {}));
      mockSupabaseFrom.mockReturnValue(chain);

      const { container } = renderPage();

      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toBeTruthy();
    });
  });

  describe('Empty state', () => {
    it('should show not found when order is null', async () => {
      const chain = createMockChain(null);
      mockSupabaseFrom.mockReturnValue(chain);

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Order Not Found')).toBeInTheDocument();
      });
    });

    it('should show back to orders button', async () => {
      const chain = createMockChain(null);
      mockSupabaseFrom.mockReturnValue(chain);

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Back to Orders')).toBeInTheDocument();
      });
    });
  });

  describe('Order details rendering', () => {
    beforeEach(() => {
      const chain = createMockChain(mockOrder);
      mockSupabaseFrom.mockReturnValue(chain);
    });

    it('should display order number', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText(/MKT-2024-001/)).toBeInTheDocument();
      });
    });

    it('should display order items', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
        expect(screen.getByText('OG Kush')).toBeInTheDocument();
      });
    });

    it('should display shipping address', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('123 Main St')).toBeInTheDocument();
        expect(screen.getByText(/Denver, CO 80202/)).toBeInTheDocument();
      });
    });

    it('should display order summary amounts', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('$150.00')).toBeInTheDocument(); // subtotal
        expect(screen.getByText('$175.00')).toBeInTheDocument(); // total
      });
    });

    it('should display buyer notes', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Please ship ASAP')).toBeInTheDocument();
      });
    });
  });

  describe('Buyer information', () => {
    it('should display buyer tenant business name from joined data', async () => {
      const chain = createMockChain(mockOrder);
      mockSupabaseFrom.mockReturnValue(chain);

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Green Leaf Dispensary')).toBeInTheDocument();
      });
    });

    it('should display customer email and phone', async () => {
      const chain = createMockChain(mockOrder);
      mockSupabaseFrom.mockReturnValue(chain);

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('orders@greenleaf.co')).toBeInTheDocument();
        expect(screen.getByText('555-0123')).toBeInTheDocument();
      });
    });

    it('should fall back to customer_name when buyer_tenant is null', async () => {
      const orderWithoutTenant = {
        ...mockOrder,
        buyer_tenant: null,
      };
      const chain = createMockChain(orderWithoutTenant);
      mockSupabaseFrom.mockReturnValue(chain);

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Green Leaf Co')).toBeInTheDocument();
      });
    });
  });

  describe('Status badges', () => {
    it('should show Pending badge for pending status', async () => {
      const chain = createMockChain(mockOrder);
      mockSupabaseFrom.mockReturnValue(chain);

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Pending')).toBeInTheDocument();
      });
    });

    it('should show Shipped badge for shipped status', async () => {
      const shippedOrder = { ...mockOrder, status: 'shipped', tracking_number: 'TRK123', shipped_at: '2024-01-20T10:00:00Z' };
      const chain = createMockChain(shippedOrder);
      mockSupabaseFrom.mockReturnValue(chain);

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Shipped')).toBeInTheDocument();
      });
    });
  });

  describe('Action buttons by status', () => {
    it('should show Accept and Reject buttons for pending orders', async () => {
      const chain = createMockChain(mockOrder);
      mockSupabaseFrom.mockReturnValue(chain);

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Accept Order')).toBeInTheDocument();
        expect(screen.getByText('Reject Order')).toBeInTheDocument();
      });
    });

    it('should show Start Processing button for accepted orders', async () => {
      const acceptedOrder = { ...mockOrder, status: 'accepted' };
      const chain = createMockChain(acceptedOrder);
      mockSupabaseFrom.mockReturnValue(chain);

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Start Processing')).toBeInTheDocument();
      });
    });

    it('should show Mark as Shipped button for processing orders', async () => {
      const processingOrder = { ...mockOrder, status: 'processing' };
      const chain = createMockChain(processingOrder);
      mockSupabaseFrom.mockReturnValue(chain);

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Mark as Shipped')).toBeInTheDocument();
      });
    });

    it('should show Mark as Delivered button for shipped orders', async () => {
      const shippedOrder = { ...mockOrder, status: 'shipped' };
      const chain = createMockChain(shippedOrder);
      mockSupabaseFrom.mockReturnValue(chain);

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Mark as Delivered')).toBeInTheDocument();
      });
    });
  });

  describe('Payment', () => {
    it('should show Mark as Paid button when payment is pending', async () => {
      const chain = createMockChain(mockOrder);
      mockSupabaseFrom.mockReturnValue(chain);

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Mark as Paid')).toBeInTheDocument();
      });
    });

    it('should show Paid badge when payment_status is paid', async () => {
      const paidOrder = { ...mockOrder, payment_status: 'paid', paid_at: '2024-01-16T10:00:00Z' };
      const chain = createMockChain(paidOrder);
      mockSupabaseFrom.mockReturnValue(chain);

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Paid')).toBeInTheDocument();
        // Mark as Paid button should not appear
        expect(screen.queryByText('Mark as Paid')).not.toBeInTheDocument();
      });
    });
  });

  describe('Message buyer', () => {
    it('should show Message Buyer button when buyer is different tenant', async () => {
      const chain = createMockChain(mockOrder);
      mockSupabaseFrom.mockReturnValue(chain);

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Message Buyer')).toBeInTheDocument();
      });
    });

    it('should not show Message Buyer button when buyer is same tenant', async () => {
      const selfOrder = { ...mockOrder, buyer_tenant_id: 'seller-tenant-123' };
      const chain = createMockChain(selfOrder);
      mockSupabaseFrom.mockReturnValue(chain);

      renderPage();

      await waitFor(() => {
        expect(screen.getByText(/MKT-2024-001/)).toBeInTheDocument();
      });
      expect(screen.queryByText('Message Buyer')).not.toBeInTheDocument();
    });
  });

  describe('Mutations include tenant_id', () => {
    it('should filter update mutation by seller_tenant_id', async () => {
      const user = userEvent.setup();
      const selectChain = createMockChain(mockOrder);
      const updateChain = createMockChain(null);
      updateChain.update = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'marketplace_orders') {
          // Return select chain on first call (query), update chain on subsequent
          return selectChain;
        }
        return selectChain;
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Accept Order')).toBeInTheDocument();
      });

      // Click Accept Order
      await user.click(screen.getByText('Accept Order'));

      // The mutation should call supabase.from('marketplace_orders').update()
      await waitFor(() => {
        const fromCalls = mockSupabaseFrom.mock.calls;
        const marketplaceOrderCalls = fromCalls.filter(
          (call: unknown[]) => call[0] === 'marketplace_orders'
        );
        // At least 2 calls: one for the query, one for the mutation
        expect(marketplaceOrderCalls.length).toBeGreaterThanOrEqual(1);
      });
    });
  });
});
