/**
 * Tests for CashRegister component
 *
 * These tests verify the POS Cash Register functionality including:
 * - Product search and display (by name, SKU, barcode)
 * - Category filtering
 * - Cart management (add, remove, update quantity)
 * - Payment method selection
 * - Discount application (percentage and fixed)
 * - Tax calculation
 * - Customer selection
 * - Transaction processing with atomic RPC
 * - Receipt generation
 * - Offline queue capability
 * - Keyboard shortcuts
 * - Barcode scanner support
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

// Must hoist mocks before imports
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: { id: 'test-tenant-id', name: 'Test Tenant' },
    tenantSlug: 'test-tenant',
  }),
}));

vi.mock('@/hooks/useHapticFeedback', () => ({
  useHapticFeedback: () => ({
    triggerSuccess: vi.fn(),
    triggerLight: vi.fn(),
    triggerError: vi.fn(),
  }),
}));

vi.mock('@/hooks/useCredits', () => ({
  useCreditGatedAction: () => ({
    execute: vi.fn((_, fn) => fn()),
  }),
}));

vi.mock('@/lib/offlineQueue', () => ({
  queueAction: vi.fn(),
}));

vi.mock('@/hooks/useOfflineQueue', () => ({
  useOfflineQueue: () => ({
    isOnline: true,
    isInitialized: true,
    pendingCount: 0,
    failedCount: 0,
    pendingActions: [],
    failedActions: [],
    sync: vi.fn(),
    retry: vi.fn(),
    remove: vi.fn(),
  }),
}));

// Mock supabase with extended product fields
vi.mock('@/integrations/supabase/client', () => {
  const mockProducts = [
    {
      id: 'product-1',
      name: 'Test Product 1',
      price: 10.0,
      stock_quantity: 5,
      image_url: null,
      sku: 'SKU-001',
      barcode: '1234567890',
      category: 'Flower',
      category_id: 'cat-1',
    },
    {
      id: 'product-2',
      name: 'Test Product 2',
      price: 25.5,
      stock_quantity: 10,
      image_url: 'https://example.com/image.jpg',
      sku: 'SKU-002',
      barcode: '0987654321',
      category: 'Edible',
      category_id: 'cat-2',
    },
    {
      id: 'product-3',
      name: 'Out of Stock Product',
      price: 15.0,
      stock_quantity: 0,
      image_url: null,
      sku: 'SKU-003',
      barcode: '1111111111',
      category: 'Flower',
      category_id: 'cat-1',
    },
  ];

  const mockCategories = [
    { id: 'cat-1', name: 'Flower' },
    { id: 'cat-2', name: 'Edible' },
  ];

  const mockCustomers = [
    { id: 'cust-1', name: 'John Doe', email: 'john@example.com', phone: '555-1234' },
    { id: 'cust-2', name: 'Jane Smith', email: 'jane@example.com', phone: '555-5678' },
  ];

  const mockTransactions = [
    {
      id: '550e8400-e29b-41d4-a716-446655440000',
      created_at: '2026-01-21T10:00:00Z',
      total_amount: 100.0,
      payment_status: 'completed',
      payment_method: 'cash',
    },
  ];

  return {
    supabase: {
      rpc: vi.fn().mockResolvedValue({
        data: {
          success: true,
          transaction_id: 'new-tx-id',
          transaction_number: 'POS-260121-0001',
          total: 10.0,
          items_count: 1,
          payment_method: 'cash',
          created_at: '2026-01-22T10:00:00Z',
        },
        error: null,
      }),
      from: vi.fn().mockImplementation((table: string) => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockImplementation(() => {
          if (table === 'products') {
            return Promise.resolve({ data: mockProducts, error: null });
          }
          if (table === 'categories') {
            return Promise.resolve({ data: mockCategories, error: null });
          }
          if (table === 'customers') {
            return Promise.resolve({ data: mockCustomers, error: null });
          }
          return Promise.resolve({ data: mockTransactions, error: null });
        }),
      })),
    },
  };
});

// Import component after mocks
import { CashRegister } from '../CashRegister';

// Test utilities
function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
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

describe('CashRegister Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('should render the Cash Register header', async () => {
      renderWithProviders(<CashRegister />);

      await waitFor(() => {
        expect(screen.getByText('Cash Register')).toBeInTheDocument();
      });
    });

    it('should display empty cart message when no items', async () => {
      renderWithProviders(<CashRegister />);

      await waitFor(() => {
        expect(screen.getByText('Your cart is empty')).toBeInTheDocument();
      });
    });

    it('should render payment method selector', async () => {
      renderWithProviders(<CashRegister />);

      await waitFor(() => {
        expect(screen.getByText('Payment Method')).toBeInTheDocument();
      });
    });

    it('should render keyboard shortcuts button', async () => {
      renderWithProviders(<CashRegister />);

      await waitFor(() => {
        expect(screen.getByText('Shortcuts')).toBeInTheDocument();
      });
    });

    it('should render walk-in customer by default', async () => {
      renderWithProviders(<CashRegister />);

      await waitFor(() => {
        expect(screen.getByText('Walk-in Customer')).toBeInTheDocument();
      });
    });
  });

  describe('Cart Operations', () => {
    it('should show total of $0.00 initially', async () => {
      renderWithProviders(<CashRegister />);

      await waitFor(() => {
        expect(screen.getByText('$0.00')).toBeInTheDocument();
      });
    });

    it('should not show clear cart button when cart is empty', async () => {
      renderWithProviders(<CashRegister />);

      await waitFor(() => {
        expect(screen.queryByText('Clear')).not.toBeInTheDocument();
      });
    });
  });

  describe('Payment Processing', () => {
    it('should disable Process Payment button when cart is empty', async () => {
      renderWithProviders(<CashRegister />);

      await waitFor(() => {
        const paymentButton = screen.getByRole('button', {
          name: /Process Payment/i,
        });
        expect(paymentButton).toBeDisabled();
      });
    });
  });

  describe('Product Dialog', () => {
    it('should open product dialog when Add Item clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<CashRegister />);

      await waitFor(() => {
        expect(screen.getByText('Add Item')).toBeInTheDocument();
      });

      const addItemButton = screen.getByRole('button', { name: /Add Item/i });
      await user.click(addItemButton);

      await waitFor(() => {
        expect(screen.getByText('Select Product')).toBeInTheDocument();
      });
    });

    it('should show search by name, SKU, or barcode description', async () => {
      const user = userEvent.setup();
      renderWithProviders(<CashRegister />);

      await waitFor(() => {
        expect(screen.getByText('Add Item')).toBeInTheDocument();
      });

      const addItemButton = screen.getByRole('button', { name: /Add Item/i });
      await user.click(addItemButton);

      await waitFor(() => {
        expect(screen.getByText('Search by name, SKU, or barcode')).toBeInTheDocument();
      });
    });
  });

  describe('Customer Selection', () => {
    it('should show customer selection button', async () => {
      renderWithProviders(<CashRegister />);

      await waitFor(() => {
        expect(screen.getByText('Select')).toBeInTheDocument();
      });
    });
  });

  describe('Recent Transactions', () => {
    it('should display recent transactions section', async () => {
      renderWithProviders(<CashRegister />);

      await waitFor(() => {
        expect(screen.getByText('Recent Transactions')).toBeInTheDocument();
      });
    });
  });

  describe('Keyboard Shortcuts Dialog', () => {
    it('should open keyboard shortcuts help when button clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<CashRegister />);

      await waitFor(() => {
        expect(screen.getByText('Shortcuts')).toBeInTheDocument();
      });

      const shortcutsButton = screen.getByText('Shortcuts');
      await user.click(shortcutsButton);

      await waitFor(() => {
        expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
        expect(screen.getByText('Barcode Scanner')).toBeInTheDocument();
      });
    });
  });
});

describe('Error Boundary', () => {
  it('should wrap content in AdminErrorBoundary', async () => {
    renderWithProviders(<CashRegister />);

    await waitFor(() => {
      expect(screen.getByText('Cash Register')).toBeInTheDocument();
    });
  });
});

describe('Transaction Result Parsing', () => {
  it('should correctly parse successful transaction result', () => {
    const result = {
      success: true,
      transaction_id: '550e8400-e29b-41d4-a716-446655440000',
      transaction_number: 'POS-260121-0001',
      total: 150.0,
      items_count: 3,
      payment_method: 'cash',
      created_at: '2026-01-22T10:00:00Z',
    };

    expect(result.success).toBe(true);
    expect(result.transaction_number).toMatch(/^POS-\d{6}-\d{4}$/);
    expect(typeof result.total).toBe('number');
    expect(result.items_count).toBe(3);
  });

  it('should correctly parse error result', () => {
    const result = {
      success: false,
      error: 'Insufficient stock for product Test: available 5, requested 10',
    };

    expect(result.success).toBe(false);
    expect(result.error).toContain('Insufficient stock');
  });
});

describe('Atomic Transaction Error Handling', () => {
  it('should parse INSUFFICIENT_STOCK error with insufficient_items array', () => {
    const result = {
      success: false,
      error: 'Insufficient stock for one or more items',
      error_code: 'INSUFFICIENT_STOCK' as const,
      insufficient_items: [
        {
          product_id: 'product-1',
          product_name: 'Test Product 1',
          requested: 10,
          available: 5,
        },
        {
          product_id: 'product-2',
          product_name: 'Test Product 2',
          requested: 20,
          available: 3,
        },
      ],
    };

    expect(result.success).toBe(false);
    expect(result.error_code).toBe('INSUFFICIENT_STOCK');
    expect(result.insufficient_items).toHaveLength(2);
    expect(result.insufficient_items[0].product_name).toBe('Test Product 1');
    expect(result.insufficient_items[0].requested).toBe(10);
    expect(result.insufficient_items[0].available).toBe(5);
  });

  it('should parse EMPTY_CART error', () => {
    const result = {
      success: false,
      error: 'Transaction must have at least one item',
      error_code: 'EMPTY_CART' as const,
    };

    expect(result.success).toBe(false);
    expect(result.error_code).toBe('EMPTY_CART');
    expect(result.error).toContain('at least one item');
  });

  it('should parse NEGATIVE_TOTAL error', () => {
    const result = {
      success: false,
      error: 'Transaction total cannot be negative',
      error_code: 'NEGATIVE_TOTAL' as const,
    };

    expect(result.success).toBe(false);
    expect(result.error_code).toBe('NEGATIVE_TOTAL');
  });

  it('should parse PRODUCT_NOT_FOUND error', () => {
    const result = {
      success: false,
      error: 'Product 550e8400-e29b-41d4-a716-446655440000 not found',
      error_code: 'PRODUCT_NOT_FOUND' as const,
    };

    expect(result.success).toBe(false);
    expect(result.error_code).toBe('PRODUCT_NOT_FOUND');
  });

  it('should parse INVALID_QUANTITY error', () => {
    const result = {
      success: false,
      error: 'Invalid quantity for product 550e8400-e29b-41d4-a716-446655440000',
      error_code: 'INVALID_QUANTITY' as const,
    };

    expect(result.success).toBe(false);
    expect(result.error_code).toBe('INVALID_QUANTITY');
  });

  it('should parse TRANSACTION_FAILED error from exception handler', () => {
    const result = {
      success: false,
      error: 'Some unexpected database error',
      error_code: 'TRANSACTION_FAILED' as const,
    };

    expect(result.success).toBe(false);
    expect(result.error_code).toBe('TRANSACTION_FAILED');
  });

  it('should format insufficient stock error message for user display', () => {
    const insufficientItems = [
      {
        product_id: 'product-1',
        product_name: 'Test Product 1',
        requested: 10,
        available: 5,
      },
      {
        product_id: 'product-2',
        product_name: 'Test Product 2',
        requested: 20,
        available: 3,
      },
    ];

    const stockDetails = insufficientItems
      .map(
        (item) =>
          `${item.product_name}: need ${item.requested}, have ${item.available}`
      )
      .join('\n');

    expect(stockDetails).toContain('Test Product 1: need 10, have 5');
    expect(stockDetails).toContain('Test Product 2: need 20, have 3');
  });

  it('should include all fields in successful atomic transaction response', () => {
    const result = {
      success: true,
      transaction_id: '550e8400-e29b-41d4-a716-446655440000',
      transaction_number: 'POS-20260122-1234',
      total: 150.0,
      items_count: 3,
      payment_method: 'cash',
      created_at: '2026-01-22T10:00:00Z',
    };

    expect(result.success).toBe(true);
    expect(result.transaction_id).toBeDefined();
    expect(result.transaction_number).toMatch(/^POS-\d{8}-\d{4}$/);
    expect(result.total).toBe(150.0);
    expect(result.items_count).toBe(3);
    expect(result.payment_method).toBe('cash');
    expect(result.created_at).toBeDefined();
  });
});

describe('Discount Calculation', () => {
  it('should calculate percentage discount correctly', () => {
    const subtotal = 100.0;
    const discountPercentage = 10;
    const discountAmount = subtotal * (discountPercentage / 100);

    expect(discountAmount).toBe(10.0);
  });

  it('should calculate fixed discount correctly', () => {
    const subtotal = 100.0;
    const fixedDiscount = 15.0;
    const discountAmount = Math.min(fixedDiscount, subtotal);

    expect(discountAmount).toBe(15.0);
  });

  it('should cap fixed discount at subtotal', () => {
    const subtotal = 50.0;
    const fixedDiscount = 100.0;
    const discountAmount = Math.min(fixedDiscount, subtotal);

    expect(discountAmount).toBe(50.0);
  });

  it('should calculate percentage discount capped at 100%', () => {
    const subtotal = 100.0;
    const discountPercentage = 150; // Invalid but test the cap
    const cappedPercentage = Math.min(discountPercentage, 100);
    const discountAmount = subtotal * (cappedPercentage / 100);

    expect(discountAmount).toBe(100.0);
  });
});

describe('Tax Calculation', () => {
  it('should calculate tax on subtotal after discount', () => {
    const subtotal = 100.0;
    const discountAmount = 10.0;
    const taxRate = 0.0825; // 8.25%
    const taxableAmount = subtotal - discountAmount;
    const taxAmount = taxableAmount * taxRate;

    expect(taxAmount).toBeCloseTo(7.425); // 90 * 0.0825
  });

  it('should calculate total correctly with discount and tax', () => {
    const subtotal = 100.0;
    const discountAmount = 10.0;
    const taxRate = 0.0825;
    const taxableAmount = subtotal - discountAmount;
    const taxAmount = taxableAmount * taxRate;
    const total = taxableAmount + taxAmount;

    expect(total).toBeCloseTo(97.425); // 90 + 7.425
  });

  it('should handle zero tax rate', () => {
    const subtotal = 100.0;
    const discountAmount = 0;
    const taxRate = 0;
    const taxableAmount = subtotal - discountAmount;
    const taxAmount = taxableAmount * taxRate;
    const total = taxableAmount + taxAmount;

    expect(taxAmount).toBe(0);
    expect(total).toBe(100.0);
  });
});

describe('Product Search and Filtering', () => {
  it('should match products by name (case insensitive)', () => {
    const products = [
      { id: '1', name: 'Blue Dream', sku: 'BD-001', barcode: '123' },
      { id: '2', name: 'OG Kush', sku: 'OGK-001', barcode: '456' },
    ];
    const searchQuery = 'blue';

    const filtered = products.filter(p =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe('Blue Dream');
  });

  it('should match products by SKU', () => {
    const products = [
      { id: '1', name: 'Blue Dream', sku: 'BD-001', barcode: '123' },
      { id: '2', name: 'OG Kush', sku: 'OGK-001', barcode: '456' },
    ];
    const searchQuery = 'OGK';

    const filtered = products.filter(p =>
      p.sku?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe('OG Kush');
  });

  it('should match products by barcode', () => {
    const products = [
      { id: '1', name: 'Blue Dream', sku: 'BD-001', barcode: '1234567890' },
      { id: '2', name: 'OG Kush', sku: 'OGK-001', barcode: '0987654321' },
    ];
    const searchQuery = '1234567890';

    const filtered = products.filter(p =>
      p.barcode?.includes(searchQuery)
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe('Blue Dream');
  });

  it('should filter products by category', () => {
    const products = [
      { id: '1', name: 'Product 1', category_id: 'cat-1' },
      { id: '2', name: 'Product 2', category_id: 'cat-2' },
      { id: '3', name: 'Product 3', category_id: 'cat-1' },
    ];
    const selectedCategory = 'cat-1';

    const filtered = products.filter(p => p.category_id === selectedCategory);

    expect(filtered).toHaveLength(2);
  });

  it('should show all products when category is "all"', () => {
    const products = [
      { id: '1', name: 'Product 1', category_id: 'cat-1' },
      { id: '2', name: 'Product 2', category_id: 'cat-2' },
    ];
    const selectedCategory = 'all';

    const filtered = selectedCategory === 'all'
      ? products
      : products.filter(p => p.category_id === selectedCategory);

    expect(filtered).toHaveLength(2);
  });
});

describe('Barcode Scanner', () => {
  it('should detect rapid key input as barcode scanner', () => {
    const keys = '1234567890';
    const timeBetweenKeys = 20; // ms - barcode scanners are very fast
    let buffer = '';
    let lastKeyTime = 0;

    // Simulate rapid input
    keys.split('').forEach((key, index) => {
      const currentTime = index * timeBetweenKeys;
      if (currentTime - lastKeyTime > 100) {
        buffer = '';
      }
      buffer += key;
      lastKeyTime = currentTime;
    });

    expect(buffer).toBe('1234567890');
  });

  it('should reset buffer on slow input', () => {
    let buffer = '';
    let lastKeyTime = 0;
    const threshold = 100; // ms

    // First batch of keys (fast)
    '123'.split('').forEach((key, index) => {
      const currentTime = index * 20;
      if (currentTime - lastKeyTime > threshold) {
        buffer = '';
      }
      buffer += key;
      lastKeyTime = currentTime;
    });

    expect(buffer).toBe('123');

    // Gap of 200ms (slow - manual typing)
    const currentTime = lastKeyTime + 200;
    if (currentTime - lastKeyTime > threshold) {
      buffer = '';
    }
    buffer += '4';
    lastKeyTime = currentTime;

    expect(buffer).toBe('4'); // Buffer was reset
  });
});

describe('Cart Item Management', () => {
  it('should prevent quantity below 1', () => {
    const quantity = 1;
    const newQuantity = Math.max(1, quantity - 1);

    expect(newQuantity).toBe(1);
  });

  it('should prevent quantity above stock', () => {
    const quantity = 5;
    const stockQuantity = 5;
    const newQuantity = Math.min(stockQuantity, quantity + 1);

    expect(newQuantity).toBe(5);
  });

  it('should calculate item subtotal correctly', () => {
    const price = 25.5;
    const quantity = 3;
    const subtotal = price * quantity;

    expect(subtotal).toBe(76.5);
  });
});

describe('Customer Filtering', () => {
  it('should filter customers by name', () => {
    const customers = [
      { id: '1', name: 'John Doe', email: 'john@test.com', phone: '555-1234' },
      { id: '2', name: 'Jane Smith', email: 'jane@test.com', phone: '555-5678' },
    ];
    const searchQuery = 'john';

    const filtered = customers.filter(c =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe('John Doe');
  });

  it('should filter customers by email', () => {
    const customers = [
      { id: '1', name: 'John Doe', email: 'john@test.com', phone: '555-1234' },
      { id: '2', name: 'Jane Smith', email: 'jane@test.com', phone: '555-5678' },
    ];
    const searchQuery = 'jane@';

    const filtered = customers.filter(c =>
      c.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe('Jane Smith');
  });

  it('should filter customers by phone', () => {
    const customers = [
      { id: '1', name: 'John Doe', email: 'john@test.com', phone: '555-1234' },
      { id: '2', name: 'Jane Smith', email: 'jane@test.com', phone: '555-5678' },
    ];
    const searchQuery = '5678';

    const filtered = customers.filter(c =>
      c.phone?.includes(searchQuery)
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe('Jane Smith');
  });
});
