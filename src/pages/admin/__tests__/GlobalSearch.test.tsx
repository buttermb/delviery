/**
 * Tests for GlobalSearch component
 *
 * These tests verify the Global Search functionality including:
 * - Rendering initial empty state
 * - Search input behavior and debounce
 * - Result display across categories (users, orders, products, addresses)
 * - Navigation to correct detail pages
 * - Error state display
 * - Accessibility (aria-labels, keyboard navigation)
 * - Null/undefined field handling
 * - Tenant isolation in queries
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

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
    tenant: { id: 'test-tenant-id', name: 'Test Tenant', slug: 'test-tenant' },
    tenantSlug: 'test-tenant',
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const mockUsers = [
  {
    id: 'profile-1',
    user_id: 'user-1',
    full_name: 'John Doe',
    email: 'john@example.com',
    phone: '5551234567',
    trust_level: 'vip',
    total_orders: 15,
    risk_score: 'low',
    user_roles: [{ role: 'customer' }],
  },
  {
    id: 'profile-2',
    user_id: 'user-2',
    full_name: 'Jane Smith',
    email: 'jane@example.com',
    phone: null,
    trust_level: 'regular',
    total_orders: 3,
    risk_score: null,
    user_roles: [],
  },
];

const mockOrders = [
  {
    id: 'order-1',
    order_number: 'ORD-001',
    tracking_code: 'TRK-ABC',
    customer_name: 'John Doe',
    status: 'delivered',
    total_amount: 150.0,
    created_at: '2026-03-15T10:00:00Z',
    profiles: { full_name: 'John Doe' },
  },
  {
    id: 'order-2',
    order_number: 'ORD-002',
    tracking_code: null,
    customer_name: null,
    status: 'pending',
    total_amount: 75.5,
    created_at: '2026-03-17T14:30:00Z',
    profiles: null,
  },
];

const mockProducts = [
  {
    id: 'product-1',
    name: 'Blue Dream',
    description: 'A popular sativa-dominant hybrid',
    category: 'Flower',
    price: 45.0,
    stock_quantity: 100,
    average_rating: 4.5,
    image_url: 'https://example.com/blue-dream.jpg',
  },
  {
    id: 'product-2',
    name: 'Gummy Bears',
    description: null,
    category: 'Edible',
    price: 25.0,
    stock_quantity: 0,
    average_rating: null,
    image_url: null,
  },
];

const mockAddresses = [
  {
    id: 'addr-1',
    user_id: 'user-1',
    street: '123 Main St',
    neighborhood: 'Downtown',
    borough: 'Manhattan',
    zip_code: '10001',
    is_default: true,
    risk_zone: 'green',
    profiles: { full_name: 'John Doe' },
  },
  {
    id: 'addr-2',
    user_id: 'user-2',
    street: '456 Oak Ave',
    neighborhood: null,
    borough: null,
    zip_code: '20002',
    is_default: false,
    risk_zone: 'red',
    profiles: { full_name: 'Jane Smith' },
  },
];

// Track all query calls for tenant isolation verification
const queryCalls: Array<{ table: string; filters: Record<string, string> }> = [];

vi.mock('@/integrations/supabase/client', () => {
  const createChain = (table: string, data: unknown[]) => {
    const filters: Record<string, string> = {};
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn((key: string, value: string) => {
        filters[key] = value;
        queryCalls.push({ table, filters: { ...filters } });
        return chain;
      }),
      or: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data, error: null }),
    };
    return chain;
  };

  return {
    supabase: {
      from: vi.fn((table: string) => {
        switch (table) {
          case 'profiles':
            return createChain(table, mockUsers);
          case 'orders':
            return createChain(table, mockOrders);
          case 'products':
            return createChain(table, mockProducts);
          case 'addresses':
            return createChain(table, mockAddresses);
          default:
            return createChain(table, []);
        }
      }),
    },
  };
});

vi.mock('@/hooks/useDebounce', () => ({
  useDebounce: (value: string) => value,
}));

import GlobalSearch from '../GlobalSearch';

function renderGlobalSearch() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <GlobalSearch />
      </BrowserRouter>
    </QueryClientProvider>,
  );
}

describe('GlobalSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    queryCalls.length = 0;
  });

  describe('Initial Rendering', () => {
    it('renders page title and description', () => {
      renderGlobalSearch();
      expect(screen.getByRole('heading', { level: 1, name: 'Global Search' })).toBeInTheDocument();
      expect(
        screen.getByText('Search across all users, orders, products, and addresses'),
      ).toBeInTheDocument();
    });

    it('renders search input with placeholder', () => {
      renderGlobalSearch();
      const input = screen.getByPlaceholderText(
        'Search by name, email, order number, product, address...',
      );
      expect(input).toBeInTheDocument();
    });

    it('shows empty state when search term is less than 2 characters', () => {
      renderGlobalSearch();
      expect(
        screen.getByText('Enter at least 2 characters to search across users, orders, products, and addresses.'),
      ).toBeInTheDocument();
    });

    it('renders search input with aria-label', () => {
      renderGlobalSearch();
      const input = screen.getByRole('textbox', { name: /global search/i });
      expect(input).toBeInTheDocument();
    });

    it('has a sr-only label for the search input', () => {
      renderGlobalSearch();
      expect(
        screen.getByText('Search by name, email, order number, product, or address'),
      ).toBeInTheDocument();
    });
  });

  describe('Search Results Display', () => {
    it('displays results after typing 2+ characters', async () => {
      const user = userEvent.setup();
      renderGlobalSearch();

      const input = screen.getByPlaceholderText(
        'Search by name, email, order number, product, address...',
      );
      await user.type(input, 'john');

      await waitFor(() => {
        expect(screen.getByText('Users (2)')).toBeInTheDocument();
        expect(screen.getByText('Orders (2)')).toBeInTheDocument();
        expect(screen.getByText('Products (2)')).toBeInTheDocument();
        expect(screen.getByText('Addresses (2)')).toBeInTheDocument();
      });
    });

    it('shows total result count', async () => {
      const user = userEvent.setup();
      renderGlobalSearch();

      await user.type(
        screen.getByPlaceholderText('Search by name, email, order number, product, address...'),
        'test',
      );

      await waitFor(() => {
        expect(screen.getByText('Found 8 results across all categories')).toBeInTheDocument();
      });
    });
  });

  describe('User Results', () => {
    it('displays user name and trust level badge', async () => {
      const user = userEvent.setup();
      renderGlobalSearch();

      await user.type(
        screen.getByPlaceholderText('Search by name, email, order number, product, address...'),
        'john',
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('vip')).toBeInTheDocument();
      });
    });

    it('shows order count and risk score', async () => {
      const user = userEvent.setup();
      renderGlobalSearch();

      await user.type(
        screen.getByPlaceholderText('Search by name, email, order number, product, address...'),
        'john',
      );

      await waitFor(() => {
        expect(screen.getByText(/Orders: 15/)).toBeInTheDocument();
        expect(screen.getByText(/Risk: low/)).toBeInTheDocument();
      });
    });

    it('displays N/A for null risk score', async () => {
      const user = userEvent.setup();
      renderGlobalSearch();

      await user.type(
        screen.getByPlaceholderText('Search by name, email, order number, product, address...'),
        'test',
      );

      await waitFor(() => {
        expect(screen.getByText(/Risk: N\/A/)).toBeInTheDocument();
      });
    });
  });

  describe('Order Results', () => {
    it('displays order number and status', async () => {
      const user = userEvent.setup();
      renderGlobalSearch();

      await user.type(
        screen.getByPlaceholderText('Search by name, email, order number, product, address...'),
        'test',
      );

      // Switch to orders tab
      await waitFor(() => {
        expect(screen.getByText('Orders (2)')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Orders (2)'));

      await waitFor(() => {
        expect(screen.getByText('Order #ORD-001')).toBeInTheDocument();
      });
    });

    it('shows N/A for null tracking code', async () => {
      const user = userEvent.setup();
      renderGlobalSearch();

      await user.type(
        screen.getByPlaceholderText('Search by name, email, order number, product, address...'),
        'test',
      );

      await waitFor(() => {
        expect(screen.getByText('Orders (2)')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Orders (2)'));

      await waitFor(() => {
        expect(screen.getByText('Tracking: N/A')).toBeInTheDocument();
      });
    });

    it('shows Guest for order with no customer', async () => {
      const user = userEvent.setup();
      renderGlobalSearch();

      await user.type(
        screen.getByPlaceholderText('Search by name, email, order number, product, address...'),
        'test',
      );

      await waitFor(() => {
        expect(screen.getByText('Orders (2)')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Orders (2)'));

      await waitFor(() => {
        expect(screen.getByText('Customer: Guest')).toBeInTheDocument();
      });
    });
  });

  describe('Product Results', () => {
    it('displays product name and category badge', async () => {
      const user = userEvent.setup();
      renderGlobalSearch();

      await user.type(
        screen.getByPlaceholderText('Search by name, email, order number, product, address...'),
        'test',
      );

      await waitFor(() => {
        expect(screen.getByText('Products (2)')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Products (2)'));

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
        expect(screen.getByText('Flower')).toBeInTheDocument();
      });
    });

    it('shows stock quantity', async () => {
      const user = userEvent.setup();
      renderGlobalSearch();

      await user.type(
        screen.getByPlaceholderText('Search by name, email, order number, product, address...'),
        'test',
      );

      await waitFor(() => {
        expect(screen.getByText('Products (2)')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Products (2)'));

      await waitFor(() => {
        expect(screen.getByText('Stock: 100')).toBeInTheDocument();
        expect(screen.getByText('Stock: 0')).toBeInTheDocument();
      });
    });

    it('renders rating with star icon instead of emoji', async () => {
      const user = userEvent.setup();
      renderGlobalSearch();

      await user.type(
        screen.getByPlaceholderText('Search by name, email, order number, product, address...'),
        'test',
      );

      await waitFor(() => {
        expect(screen.getByText('Products (2)')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Products (2)'));

      await waitFor(() => {
        expect(screen.getByText('4.5')).toBeInTheDocument();
        // Verify no emoji characters are used
        const productSection = screen.getByText('4.5').closest('div');
        expect(productSection?.textContent).not.toContain('\u2B50');
      });
    });

    it('hides description when null', async () => {
      const user = userEvent.setup();
      renderGlobalSearch();

      await user.type(
        screen.getByPlaceholderText('Search by name, email, order number, product, address...'),
        'test',
      );

      await waitFor(() => {
        expect(screen.getByText('Products (2)')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Products (2)'));

      await waitFor(() => {
        expect(screen.getByText('A popular sativa-dominant hybrid')).toBeInTheDocument();
        // Gummy Bears has null description — no empty paragraph
        const gummyCard = screen.getByText('Gummy Bears').closest('[class*="CardContent"]');
        const paragraphs = gummyCard?.querySelectorAll('p');
        const emptyParagraphs = Array.from(paragraphs ?? []).filter(
          (p) => p.textContent?.trim() === '',
        );
        expect(emptyParagraphs.length).toBe(0);
      });
    });
  });

  describe('Address Results', () => {
    it('displays address with risk zone badge', async () => {
      const user = userEvent.setup();
      renderGlobalSearch();

      await user.type(
        screen.getByPlaceholderText('Search by name, email, order number, product, address...'),
        'test',
      );

      await waitFor(() => {
        expect(screen.getByText('Addresses (2)')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Addresses (2)'));

      await waitFor(() => {
        expect(screen.getByText('123 Main St')).toBeInTheDocument();
        expect(screen.getByText('green zone')).toBeInTheDocument();
        expect(screen.getByText('red zone')).toBeInTheDocument();
      });
    });

    it('shows Default badge for default addresses', async () => {
      const user = userEvent.setup();
      renderGlobalSearch();

      await user.type(
        screen.getByPlaceholderText('Search by name, email, order number, product, address...'),
        'test',
      );

      await waitFor(() => {
        expect(screen.getByText('Addresses (2)')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Addresses (2)'));

      await waitFor(() => {
        expect(screen.getByText('Default')).toBeInTheDocument();
      });
    });

    it('handles null neighborhood and borough gracefully', async () => {
      const user = userEvent.setup();
      renderGlobalSearch();

      await user.type(
        screen.getByPlaceholderText('Search by name, email, order number, product, address...'),
        'test',
      );

      await waitFor(() => {
        expect(screen.getByText('Addresses (2)')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Addresses (2)'));

      await waitFor(() => {
        // addr-2 has null neighborhood and borough, should only show zip
        expect(screen.getByText('20002')).toBeInTheDocument();
      });
    });
  });

  describe('Navigation', () => {
    it('navigates to individual order detail when clicking order card', async () => {
      const user = userEvent.setup();
      renderGlobalSearch();

      await user.type(
        screen.getByPlaceholderText('Search by name, email, order number, product, address...'),
        'test',
      );

      await waitFor(() => {
        expect(screen.getByText('Orders (2)')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Orders (2)'));

      await waitFor(() => {
        expect(screen.getByText('Order #ORD-001')).toBeInTheDocument();
      });

      const viewButton = screen.getAllByRole('button', { name: /view order/i })[0];
      await user.click(viewButton);

      expect(mockNavigate).toHaveBeenCalledWith('/test-tenant/admin/orders/order-1');
    });

    it('navigates to individual product detail when clicking product card', async () => {
      const user = userEvent.setup();
      renderGlobalSearch();

      await user.type(
        screen.getByPlaceholderText('Search by name, email, order number, product, address...'),
        'test',
      );

      await waitFor(() => {
        expect(screen.getByText('Products (2)')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Products (2)'));

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      });

      const viewButton = screen.getAllByRole('button', { name: /view product/i })[0];
      await user.click(viewButton);

      expect(mockNavigate).toHaveBeenCalledWith('/test-tenant/admin/products/product-1');
    });

    it('navigates to user profile when clicking user card', async () => {
      const user = userEvent.setup();
      renderGlobalSearch();

      await user.type(
        screen.getByPlaceholderText('Search by name, email, order number, product, address...'),
        'test',
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const viewButton = screen.getAllByRole('button', { name: /view profile/i })[0];
      await user.click(viewButton);

      expect(mockNavigate).toHaveBeenCalledWith('/test-tenant/admin/users/user-1');
    });

    it('navigates to user profile when clicking address card', async () => {
      const user = userEvent.setup();
      renderGlobalSearch();

      await user.type(
        screen.getByPlaceholderText('Search by name, email, order number, product, address...'),
        'test',
      );

      await waitFor(() => {
        expect(screen.getByText('Addresses (2)')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Addresses (2)'));

      await waitFor(() => {
        expect(screen.getByText('123 Main St')).toBeInTheDocument();
      });

      const viewButton = screen.getAllByRole('button', { name: /view user/i })[0];
      await user.click(viewButton);

      expect(mockNavigate).toHaveBeenCalledWith('/test-tenant/admin/users/user-1');
    });
  });

  describe('Accessibility', () => {
    it('result cards have role=button and aria-labels', async () => {
      const user = userEvent.setup();
      renderGlobalSearch();

      await user.type(
        screen.getByPlaceholderText('Search by name, email, order number, product, address...'),
        'test',
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const buttons = screen.getAllByRole('button', { name: /view profile for john doe/i });
      expect(buttons.length).toBeGreaterThanOrEqual(1);
    });

    it('action buttons have aria-labels', async () => {
      const user = userEvent.setup();
      renderGlobalSearch();

      await user.type(
        screen.getByPlaceholderText('Search by name, email, order number, product, address...'),
        'test',
      );

      await waitFor(() => {
        expect(screen.getByText('Orders (2)')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Orders (2)'));

      await waitFor(() => {
        const orderButtons = screen.getAllByRole('button', { name: /view order #ord-001/i });
        expect(orderButtons.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('Tenant Isolation', () => {
    it('filters profiles by account_id (tenant_id)', async () => {
      const { supabase } = await import('@/integrations/supabase/client');
      const user = userEvent.setup();
      renderGlobalSearch();

      await user.type(
        screen.getByPlaceholderText('Search by name, email, order number, product, address...'),
        'test',
      );

      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('profiles');
      });

      const profileCall = queryCalls.find((c) => c.table === 'profiles');
      expect(profileCall?.filters.account_id).toBe('test-tenant-id');
    });

    it('filters orders by tenant_id', async () => {
      const { supabase } = await import('@/integrations/supabase/client');
      const user = userEvent.setup();
      renderGlobalSearch();

      await user.type(
        screen.getByPlaceholderText('Search by name, email, order number, product, address...'),
        'test',
      );

      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('orders');
      });

      const orderCall = queryCalls.find((c) => c.table === 'orders');
      expect(orderCall?.filters.tenant_id).toBe('test-tenant-id');
    });

    it('filters products by tenant_id', async () => {
      const { supabase } = await import('@/integrations/supabase/client');
      const user = userEvent.setup();
      renderGlobalSearch();

      await user.type(
        screen.getByPlaceholderText('Search by name, email, order number, product, address...'),
        'test',
      );

      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('products');
      });

      const productCall = queryCalls.find((c) => c.table === 'products');
      expect(productCall?.filters.tenant_id).toBe('test-tenant-id');
    });

    it('filters addresses by tenant_id', async () => {
      const { supabase } = await import('@/integrations/supabase/client');
      const user = userEvent.setup();
      renderGlobalSearch();

      await user.type(
        screen.getByPlaceholderText('Search by name, email, order number, product, address...'),
        'test',
      );

      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('addresses');
      });

      const addressCall = queryCalls.find((c) => c.table === 'addresses');
      expect(addressCall?.filters.tenant_id).toBe('test-tenant-id');
    });
  });
});
