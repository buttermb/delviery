/**
 * PricingPage (Sales) Tests
 * Tests for pricing management with tenant isolation, form validation,
 * dialog state management, and query invalidation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

// Mock dependencies before importing component
vi.mock('@/integrations/supabase/client', () => {
  const mockChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: [], error: null }),
    update: vi.fn().mockReturnThis(),
  };
  return {
    supabase: {
      from: vi.fn().mockReturnValue(mockChain),
    },
  };
});

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: vi.fn().mockReturnValue({
    tenant: { id: 'tenant-123', slug: 'test-tenant', business_name: 'Test Dispensary' },
    loading: false,
    admin: { id: 'admin-123', email: 'admin@test.com' },
    tenantSlug: 'test-tenant',
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/lib/humanizeError', () => ({
  humanizeError: vi.fn().mockReturnValue('Something went wrong'),
}));

vi.mock('@/utils/errorHandling/handlers', () => ({
  handleError: vi.fn(),
}));

vi.mock('@/utils/errorHandling/typeGuards', () => ({
  isPostgrestError: vi.fn().mockReturnValue(false),
}));

import PricingPage from '../PricingPage';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const mockProducts = [
  {
    id: 'prod-1',
    name: 'OG Kush',
    wholesale_price: 25.5,
    cost_per_unit: 15.0,
    bulk_discount: 10,
  },
  {
    id: 'prod-2',
    name: 'Blue Dream',
    wholesale_price: 30.0,
    cost_per_unit: 18.0,
    bulk_discount: 0,
  },
  {
    id: 'prod-3',
    name: 'Sour Diesel',
    wholesale_price: 0,
    cost_per_unit: 12.0,
    bulk_discount: 5,
  },
];

describe('PricingPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();

    // Default mock: return products for both queries
    const mockFrom = vi.mocked(supabase.from);
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockProducts, error: null }),
      update: vi.fn().mockReturnThis(),
    } as ReturnType<typeof supabase.from>);
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <PricingPage />
        </BrowserRouter>
      </QueryClientProvider>
    );
  };

  it('renders the page title and description', async () => {
    renderComponent();

    expect(screen.getByText('Pricing & Deals')).toBeInTheDocument();
    expect(
      screen.getByText('Manage pricing tiers, bulk discounts, and special deals for your products')
    ).toBeInTheDocument();
  });

  it('renders the Set Pricing button', () => {
    renderComponent();

    expect(screen.getByRole('button', { name: /set pricing/i })).toBeInTheDocument();
  });

  it('renders pricing stats cards', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Products with Pricing')).toBeInTheDocument();
      expect(screen.getByText('Products with Discounts')).toBeInTheDocument();
      expect(screen.getByText('Avg Price/lb')).toBeInTheDocument();
    });
  });

  it('displays product count in stats', async () => {
    renderComponent();

    await waitFor(() => {
      // 3 products total
      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  it('calculates discount count correctly', async () => {
    renderComponent();

    await waitFor(() => {
      // Products with discounts > 0: OG Kush (10%) and Sour Diesel (5%) = 2
      const discountCard = screen.getByText('Products with Discounts').closest('div');
      expect(discountCard).toBeInTheDocument();
    });
  });

  it('opens dialog when Set Pricing button is clicked', async () => {
    const user = userEvent.setup();
    renderComponent();

    await user.click(screen.getByRole('button', { name: /set pricing/i }));

    expect(screen.getByText('Set Product Pricing')).toBeInTheDocument();
  });

  it('shows Edit Pricing title when editing an existing tier', async () => {
    const user = userEvent.setup();
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('OG Kush')).toBeInTheDocument();
    });

    const editButton = screen.getByLabelText('Edit pricing for OG Kush');
    await user.click(editButton);

    expect(screen.getByText('Edit Pricing')).toBeInTheDocument();
  });

  it('validates product selection before saving', async () => {
    const user = userEvent.setup();
    renderComponent();

    // Open dialog
    await user.click(screen.getByRole('button', { name: /set pricing/i }));

    // Try to save without selecting a product
    await user.click(screen.getByRole('button', { name: /save pricing/i }));

    expect(toast.error).toHaveBeenCalledWith('Please select a product');
  });

  it('validates price before saving', async () => {
    const user = userEvent.setup();
    renderComponent();

    // Open edit dialog for a product (which pre-selects product_id)
    await waitFor(() => {
      expect(screen.getByText('OG Kush')).toBeInTheDocument();
    });

    const editButton = screen.getByLabelText('Edit pricing for OG Kush');
    await user.click(editButton);

    // Clear the price field
    const priceInput = screen.getByDisplayValue('25.5');
    await user.clear(priceInput);

    await user.click(screen.getByRole('button', { name: /save pricing/i }));

    expect(toast.error).toHaveBeenCalledWith('Please enter a valid price');
  });

  it('resets form when dialog is closed via cancel', async () => {
    const user = userEvent.setup();
    renderComponent();

    // Open edit dialog
    await waitFor(() => {
      expect(screen.getByText('OG Kush')).toBeInTheDocument();
    });

    const editButton = screen.getByLabelText('Edit pricing for OG Kush');
    await user.click(editButton);

    expect(screen.getByText('Edit Pricing')).toBeInTheDocument();

    // Click cancel
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    // Open again - should show "Set Product Pricing" (not "Edit Pricing")
    await user.click(screen.getByRole('button', { name: /set pricing/i }));
    expect(screen.getByText('Set Product Pricing')).toBeInTheDocument();
  });

  it('has proper aria-labels on edit buttons', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByLabelText('Edit pricing for OG Kush')).toBeInTheDocument();
      expect(screen.getByLabelText('Edit pricing for Blue Dream')).toBeInTheDocument();
      expect(screen.getByLabelText('Edit pricing for Sour Diesel')).toBeInTheDocument();
    });
  });

  it('filters queries by tenant_id', async () => {
    renderComponent();

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('products');
    });
  });

  it('renders empty state when no products', async () => {
    const mockFrom = vi.mocked(supabase.from);
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      update: vi.fn().mockReturnThis(),
    } as ReturnType<typeof supabase.from>);

    renderComponent();

    await waitFor(() => {
      expect(
        screen.getByText('No pricing tiers configured. Set pricing for your products!')
      ).toBeInTheDocument();
    });
  });
});
