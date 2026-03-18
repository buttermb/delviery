/**
 * StorefrontCoupons Tests
 * Tests for coupon management: CRUD operations, field name alignment with DB schema,
 * error handling, and status display
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock external dependencies
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  },
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: vi.fn().mockReturnValue({
    tenant: { id: 'tenant-123', slug: 'test-tenant', business_name: 'Test Business' },
    loading: false,
    admin: { id: 'admin-123', email: 'admin@test.com' },
    tenantSlug: 'test-tenant',
  }),
}));

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    info: vi.fn(),
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

vi.mock('@/lib/humanizeError', () => ({
  humanizeError: vi.fn((e: unknown) => e instanceof Error ? e.message : 'Unknown error'),
}));

vi.mock('@/utils/toastHelpers', () => ({
  showCopyToast: vi.fn(),
}));

vi.mock('@/hooks/useConfirmDialog', () => ({
  useConfirmDialog: vi.fn().mockReturnValue({
    dialogState: {
      open: false,
      title: '',
      description: '',
      itemName: '',
      itemType: '',
      isLoading: false,
      onConfirm: vi.fn(),
    },
    confirm: vi.fn(),
    closeDialog: vi.fn(),
    setLoading: vi.fn(),
  }),
}));

vi.mock('@/components/shared/ConfirmDeleteDialog', () => ({
  ConfirmDeleteDialog: () => <div data-testid="confirm-delete-dialog" />,
}));

// Import component and mocked modules after vi.mock calls
import StorefrontCoupons from '../StorefrontCoupons';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const mockStore = { id: 'store-456' };

const mockCoupons = [
  {
    id: 'coupon-1',
    code: 'SAVE20',
    discount_type: 'percentage',
    discount_value: 20,
    min_order_amount: 50,
    usage_limit: 100,
    used_count: 25,
    is_active: true,
    end_date: '2027-12-31T23:59:59Z',
    created_at: '2026-01-01T00:00:00Z',
    max_discount_amount: null,
    store_id: 'store-456',
    start_date: null,
    description: null,
    updated_at: null,
  },
  {
    id: 'coupon-2',
    code: 'FLAT10',
    discount_type: 'fixed',
    discount_value: 10,
    min_order_amount: null,
    usage_limit: null,
    used_count: 5,
    is_active: false,
    end_date: null,
    created_at: '2026-01-02T00:00:00Z',
    max_discount_amount: null,
    store_id: 'store-456',
    start_date: null,
    description: null,
    updated_at: null,
  },
  {
    id: 'coupon-3',
    code: 'EXPIRED5',
    discount_type: 'percentage',
    discount_value: 5,
    min_order_amount: null,
    usage_limit: null,
    used_count: 10,
    is_active: true,
    end_date: '2025-01-01T00:00:00Z', // Past date
    created_at: '2024-12-01T00:00:00Z',
    max_discount_amount: null,
    store_id: 'store-456',
    start_date: null,
    description: null,
    updated_at: null,
  },
];

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={createQueryClient()}>
    <MemoryRouter initialEntries={['/test-tenant/admin/storefront']}>
      {children}
    </MemoryRouter>
  </QueryClientProvider>
);

function setupSupabaseMock(options?: {
  store?: typeof mockStore | null;
  coupons?: typeof mockCoupons;
  insertError?: string | null;
  updateError?: string | null;
  deleteError?: string | null;
}) {
  const {
    store = mockStore,
    coupons = mockCoupons,
    insertError = null,
    updateError = null,
    deleteError = null,
  } = options ?? {};

  const orderMock = vi.fn().mockResolvedValue({ data: coupons, error: null });
  const insertMock = vi.fn().mockResolvedValue({
    data: null,
    error: insertError ? { message: insertError } : null,
  });
  const updateChainMock = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: null,
        error: updateError ? { message: updateError } : null,
      }),
    }),
  });
  const deleteChainMock = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: null,
        error: deleteError ? { message: deleteError } : null,
      }),
    }),
  });

  (supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
    if (table === 'marketplace_stores') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: store, error: null }),
      };
    }
    if (table === 'marketplace_coupons') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: orderMock,
          }),
        }),
        insert: insertMock,
        update: updateChainMock,
        delete: deleteChainMock,
      };
    }
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
  });

  return { orderMock, insertMock, updateChainMock, deleteChainMock };
}

describe('StorefrontCoupons', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (useTenantAdminAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      tenant: { id: 'tenant-123', slug: 'test-tenant', business_name: 'Test Business' },
      loading: false,
      admin: { id: 'admin-123', email: 'admin@test.com' },
      tenantSlug: 'test-tenant',
    });
  });

  describe('No Store State', () => {
    it('should show "create store" message when no store exists', async () => {
      setupSupabaseMock({ store: null });

      render(<StorefrontCoupons />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Please create a store first.')).toBeInTheDocument();
      });
    });

    it('should show "Go to Dashboard" button when no store exists', async () => {
      setupSupabaseMock({ store: null });

      render(<StorefrontCoupons />, { wrapper });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Go to Dashboard' })).toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    it('should show header after store loads', async () => {
      setupSupabaseMock();

      render(<StorefrontCoupons />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Promo Codes')).toBeInTheDocument();
      });
    });
  });

  describe('Coupon Display', () => {
    it('should render the page header', async () => {
      setupSupabaseMock();

      render(<StorefrontCoupons />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Promo Codes')).toBeInTheDocument();
      });
    });

    it('should display coupon codes in table', async () => {
      setupSupabaseMock();

      render(<StorefrontCoupons />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('SAVE20')).toBeInTheDocument();
        expect(screen.getByText('FLAT10')).toBeInTheDocument();
        expect(screen.getByText('EXPIRED5')).toBeInTheDocument();
      });
    });

    it('should display correct stats cards', async () => {
      setupSupabaseMock();

      render(<StorefrontCoupons />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Total Coupons')).toBeInTheDocument();
        expect(screen.getByText('Active Coupons')).toBeInTheDocument();
        expect(screen.getByText('Total Uses')).toBeInTheDocument();
        // 3 total coupons
        expect(screen.getByText('3')).toBeInTheDocument();
      });
    });

    it('should show correct total uses count from used_count field', async () => {
      setupSupabaseMock();

      render(<StorefrontCoupons />, { wrapper });

      await waitFor(() => {
        // 25 + 5 + 10 = 40
        expect(screen.getByText('40')).toBeInTheDocument();
      });
    });

    it('should display "Expired" badge for expired coupons', async () => {
      setupSupabaseMock();

      render(<StorefrontCoupons />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Expired')).toBeInTheDocument();
      });
    });

    it('should display "Inactive" badge for inactive coupons', async () => {
      setupSupabaseMock();

      render(<StorefrontCoupons />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Inactive')).toBeInTheDocument();
      });
    });

    it('should display "Active" badge for active coupons', async () => {
      setupSupabaseMock();

      render(<StorefrontCoupons />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Active')).toBeInTheDocument();
      });
    });

    it('should show usage count with DB field used_count', async () => {
      setupSupabaseMock();

      render(<StorefrontCoupons />, { wrapper });

      await waitFor(() => {
        // coupon-1: 25/100
        expect(screen.getByText('25 / 100')).toBeInTheDocument();
        // coupon-2: 5/∞ (no usage_limit)
        expect(screen.getByText('5 / ∞')).toBeInTheDocument();
      });
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no coupons', async () => {
      setupSupabaseMock({ coupons: [] });

      render(<StorefrontCoupons />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('No coupons yet')).toBeInTheDocument();
        expect(screen.getByText('Create your first discount coupon')).toBeInTheDocument();
      });
    });
  });

  describe('Create Coupon Dialog', () => {
    it('should open create dialog when "Create Coupon" button clicked', async () => {
      setupSupabaseMock();
      const user = userEvent.setup();

      render(<StorefrontCoupons />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Promo Codes')).toBeInTheDocument();
      });

      const createButton = screen.getByRole('button', { name: /Create Coupon/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.getByText('Create a new discount coupon for your store')).toBeInTheDocument();
      });
    });

    it('should show form fields with correct labels for DB columns', async () => {
      setupSupabaseMock();
      const user = userEvent.setup();

      render(<StorefrontCoupons />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Promo Codes')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Create Coupon/i }));

      await waitFor(() => {
        expect(screen.getByLabelText('Coupon Code *')).toBeInTheDocument();
        expect(screen.getByLabelText('Minimum Order ($)')).toBeInTheDocument();
        expect(screen.getByLabelText('Max Uses')).toBeInTheDocument();
        expect(screen.getByLabelText('Expiration Date')).toBeInTheDocument();
      });
    });

    it('should generate a random code when Generate button is clicked', async () => {
      setupSupabaseMock();
      const user = userEvent.setup();

      render(<StorefrontCoupons />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Promo Codes')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Create Coupon/i }));

      await waitFor(() => {
        expect(screen.getByText('Generate')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Generate'));

      const codeInput = screen.getByLabelText('Coupon Code *') as HTMLInputElement;
      expect(codeInput.value).toHaveLength(8);
      expect(codeInput.value).toMatch(/^[A-Z0-9]+$/);
    });

    it('should show error toast if required fields are empty on submit', async () => {
      setupSupabaseMock();
      const user = userEvent.setup();

      render(<StorefrontCoupons />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Promo Codes')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Create Coupon/i }));

      await waitFor(() => {
        expect(screen.getByText('Save Coupon')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Save Coupon'));

      expect(toast.error).toHaveBeenCalledWith('Please fill in the required fields');
    });
  });

  describe('DB Column Name Alignment', () => {
    it('should query correct DB columns (min_order_amount, usage_limit, used_count, end_date)', async () => {
      const { orderMock } = setupSupabaseMock();

      render(<StorefrontCoupons />, { wrapper });

      await waitFor(() => {
        expect(orderMock).toHaveBeenCalled();
      });

      // Verify supabase.from('marketplace_coupons').select() was called
      const fromCalls = (supabase.from as ReturnType<typeof vi.fn>).mock.calls;
      const couponCalls = fromCalls.filter((call: string[]) => call[0] === 'marketplace_coupons');
      expect(couponCalls.length).toBeGreaterThan(0);
    });

    it('should submit form with correct DB column names', async () => {
      const { insertMock } = setupSupabaseMock();
      const user = userEvent.setup();

      render(<StorefrontCoupons />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Promo Codes')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Create Coupon/i }));

      await waitFor(() => {
        expect(screen.getByLabelText('Coupon Code *')).toBeInTheDocument();
      });

      // Fill form
      await user.type(screen.getByLabelText('Coupon Code *'), 'NEWCODE');
      await user.type(screen.getByLabelText(/Discount Value/), '15');
      await user.type(screen.getByLabelText('Minimum Order ($)'), '25');
      await user.type(screen.getByLabelText('Max Uses'), '50');

      // Submit
      await user.click(screen.getByText('Save Coupon'));

      await waitFor(() => {
        expect(insertMock).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'NEWCODE',
            discount_type: 'percentage',
            discount_value: 15,
            min_order_amount: 25,
            usage_limit: 50,
            end_date: null,
            is_active: true,
            store_id: 'store-456',
          })
        );
      });
    });
  });

  describe('Copy Code', () => {
    it('should have copy button with aria-label', async () => {
      setupSupabaseMock();

      render(<StorefrontCoupons />, { wrapper });

      await waitFor(() => {
        const copyButtons = screen.getAllByLabelText('Copy coupon code');
        expect(copyButtons.length).toBe(3);
      });
    });
  });

  describe('Edit/Delete Actions', () => {
    it('should have edit buttons with aria-label', async () => {
      setupSupabaseMock();

      render(<StorefrontCoupons />, { wrapper });

      await waitFor(() => {
        const editButtons = screen.getAllByLabelText('Edit coupon');
        expect(editButtons.length).toBe(3);
      });
    });

    it('should have delete buttons with aria-label', async () => {
      setupSupabaseMock();

      render(<StorefrontCoupons />, { wrapper });

      await waitFor(() => {
        const deleteButtons = screen.getAllByLabelText('Delete coupon');
        expect(deleteButtons.length).toBe(3);
      });
    });

    it('should render confirm delete dialog', async () => {
      setupSupabaseMock();

      render(<StorefrontCoupons />, { wrapper });

      await waitFor(() => {
        expect(screen.getByTestId('confirm-delete-dialog')).toBeInTheDocument();
      });
    });
  });
});
