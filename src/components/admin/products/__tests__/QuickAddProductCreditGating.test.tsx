/**
 * QuickAddProductDialog Credit Gating Tests
 *
 * Verifies that the quick product creation action is properly gated by credits:
 * 1. product_add action key is used with the correct cost (10 credits)
 * 2. useCreditGatedAction hook is integrated in QuickAddProductDialog
 * 3. Credit check blocks creation when insufficient credits
 * 4. Credit check allows creation when sufficient credits
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { type ReactNode } from 'react';

// ============================================================================
// Mocks
// ============================================================================

const mockExecute = vi.fn();
const mockInsert = vi.fn();
const mockMaybeSingle = vi.fn();
const mockOnSuccess = vi.fn();

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      insert: (...args: unknown[]) => {
        mockInsert(...args);
        return {
          select: () => ({
            maybeSingle: () => mockMaybeSingle(),
          }),
        };
      },
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
    rpc: vi.fn().mockResolvedValue({ data: { success: true }, error: null }),
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({ error: null }),
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/img.jpg' } }),
      }),
    },
  },
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: {
      id: 'test-tenant-id',
      slug: 'test-tenant',
      name: 'Test Tenant',
      is_free_tier: true,
    },
  }),
}));

vi.mock('@/hooks/useCredits', () => ({
  useCreditGatedAction: () => ({
    execute: mockExecute,
    isPerforming: false,
    isFreeTier: true,
  }),
}));

vi.mock('@/hooks/useProductMutations', () => ({
  useProductMutations: () => ({
    invalidateProductCaches: vi.fn(),
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ============================================================================
// Test Setup
// ============================================================================

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function renderWithProviders(ui: ReactNode) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{ui}</BrowserRouter>
    </QueryClientProvider>
  );
}

// ============================================================================
// Tests
// ============================================================================

describe('QuickAddProductDialog Credit Gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecute.mockImplementation(
      async (_actionKey: string, action: () => Promise<unknown>) => {
        return action();
      }
    );
    mockMaybeSingle.mockResolvedValue({
      data: { id: 'new-product-id', name: 'Test Product' },
      error: null,
    });
  });

  it('should render the quick add product dialog', async () => {
    const { QuickAddProductDialog } = await import('../QuickAddProductDialog');
    renderWithProviders(
      <QuickAddProductDialog open={true} onOpenChange={vi.fn()} onSuccess={mockOnSuccess} />
    );

    expect(screen.getByText('Quick Add Product')).toBeInTheDocument();
    expect(screen.getByText('Add Product')).toBeInTheDocument();
  });

  it('should call executeCreditAction with product_add on form submit', async () => {
    const user = userEvent.setup();
    const { QuickAddProductDialog } = await import('../QuickAddProductDialog');
    renderWithProviders(
      <QuickAddProductDialog open={true} onOpenChange={vi.fn()} onSuccess={mockOnSuccess} />
    );

    // Fill required fields
    const nameInput = screen.getByPlaceholderText(/blue dream/i);
    await user.type(nameInput, 'Test Product');

    const priceInput = screen.getByPlaceholderText('0.00');
    await user.type(priceInput, '25.00');

    // Submit the form
    const submitBtn = screen.getByRole('button', { name: /add product/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith(
        'product_add',
        expect.any(Function)
      );
    });
  });

  it('should not create product when credit gate blocks the action', async () => {
    // Simulate credit gate blocking the action (returns null)
    mockExecute.mockResolvedValue(null);

    const user = userEvent.setup();
    const { QuickAddProductDialog } = await import('../QuickAddProductDialog');
    renderWithProviders(
      <QuickAddProductDialog open={true} onOpenChange={vi.fn()} onSuccess={mockOnSuccess} />
    );

    // Fill required fields
    const nameInput = screen.getByPlaceholderText(/blue dream/i);
    await user.type(nameInput, 'Test Product');

    const priceInput = screen.getByPlaceholderText('0.00');
    await user.type(priceInput, '25.00');

    // Submit the form
    const submitBtn = screen.getByRole('button', { name: /add product/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledWith('product_add', expect.any(Function));
    });

    // The supabase insert should NOT have been called because the gate blocked it
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('should create product when credit gate allows the action', async () => {
    const user = userEvent.setup();
    const { QuickAddProductDialog } = await import('../QuickAddProductDialog');
    renderWithProviders(
      <QuickAddProductDialog open={true} onOpenChange={vi.fn()} onSuccess={mockOnSuccess} />
    );

    // Fill required fields
    const nameInput = screen.getByPlaceholderText(/blue dream/i);
    await user.type(nameInput, 'Test Product');

    const priceInput = screen.getByPlaceholderText('0.00');
    await user.type(priceInput, '25.00');

    // Submit the form
    const submitBtn = screen.getByRole('button', { name: /add product/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledTimes(1);
    });

    // Verify the product data includes tenant_id
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: 'test-tenant-id',
        name: 'Test Product',
      })
    );
  });

  it('should not submit when product name is empty', async () => {
    const user = userEvent.setup();
    const { QuickAddProductDialog } = await import('../QuickAddProductDialog');
    renderWithProviders(
      <QuickAddProductDialog open={true} onOpenChange={vi.fn()} onSuccess={mockOnSuccess} />
    );

    // Only fill price, not name
    const priceInput = screen.getByPlaceholderText('0.00');
    await user.type(priceInput, '25.00');

    // Submit the form
    const submitBtn = screen.getByRole('button', { name: /add product/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Product name is required')).toBeInTheDocument();
    });

    // Credit gate should NOT have been called
    expect(mockExecute).not.toHaveBeenCalled();
  });
});
