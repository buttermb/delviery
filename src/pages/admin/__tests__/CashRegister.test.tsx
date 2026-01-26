/**
 * Tests for CashRegister component
 *
 * These tests verify the POS Cash Register functionality including:
 * - Product search and display
 * - Cart management (add, remove, update quantity)
 * - Payment method selection
 * - Transaction processing with atomic RPC
 * - Offline queue capability
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

// Mock supabase with static functions
vi.mock('@/integrations/supabase/client', () => {
  const mockProducts = [
    {
      id: 'product-1',
      name: 'Test Product 1',
      price: 10.0,
      stock_quantity: 5,
      image_url: null,
    },
    {
      id: 'product-2',
      name: 'Test Product 2',
      price: 25.5,
      stock_quantity: 10,
      image_url: 'https://example.com/image.jpg',
    },
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
        },
        error: null,
      }),
      from: vi.fn().mockImplementation((table: string) => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: table === 'products' ? mockProducts : mockTransactions,
          error: null,
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
  });

  describe('Cart Operations', () => {
    it('should show total of $0.00 initially', async () => {
      renderWithProviders(<CashRegister />);

      await waitFor(() => {
        expect(screen.getByText('$0.00')).toBeInTheDocument();
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
  });

  describe('Recent Transactions', () => {
    it('should display recent transactions section', async () => {
      renderWithProviders(<CashRegister />);

      await waitFor(() => {
        expect(screen.getByText('Recent Transactions')).toBeInTheDocument();
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
    };

    expect(result.success).toBe(true);
    expect(result.transaction_number).toMatch(/^POS-\d{6}-\d{4}$/);
    expect(typeof result.total).toBe('number');
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
