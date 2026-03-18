/**
 * ProductComparison Component Tests
 * Tests constants extraction, useEffect sync, and accessibility
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
  },
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: vi.fn().mockReturnValue({
    tenant: { id: 'tenant-123', slug: 'test-tenant' },
    loading: false,
  }),
}));

vi.mock('@/hooks/useProductVelocity', () => ({
  useBulkProductVelocity: vi.fn().mockReturnValue({
    velocities: new Map(),
    isLoading: false,
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/utils/formatCurrency', () => ({
  formatCurrency: (value: number) => `$${value.toFixed(2)}`,
}));

import { ProductComparison } from '../ProductComparison';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

describe('ProductComparison', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows minimum product count message when fewer than 2 products selected', () => {
    render(
      <ProductComparison productIds={['p1']} open={true} onClose={vi.fn()} />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText(/select at least 2 products to compare/i)).toBeInTheDocument();
  });

  it('shows maximum product count message when more than 4 products selected', () => {
    render(
      <ProductComparison
        productIds={['p1', 'p2', 'p3', 'p4', 'p5']}
        open={true}
        onClose={vi.fn()}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText(/select up to 4 products to compare/i)).toBeInTheDocument();
  });

  it('renders comparison dialog with loading state for valid product count', async () => {
    render(
      <ProductComparison
        productIds={['p1', 'p2']}
        open={true}
        onClose={vi.fn()}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Product Comparison')).toBeInTheDocument();
  });

  it('does not render dialog when open is false', () => {
    render(
      <ProductComparison
        productIds={['p1', 'p2']}
        open={false}
        onClose={vi.fn()}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.queryByText('Product Comparison')).not.toBeInTheDocument();
  });

  it('syncs local product IDs when prop changes', async () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <ProductComparison productIds={['p1', 'p2']} open={true} onClose={onClose} />,
      { wrapper: createWrapper() }
    );

    // Rerender with different productIds
    rerender(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <ProductComparison productIds={['p1', 'p2', 'p3']} open={true} onClose={onClose} />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/comparing 3 products/i)).toBeInTheDocument();
    });
  });
});
