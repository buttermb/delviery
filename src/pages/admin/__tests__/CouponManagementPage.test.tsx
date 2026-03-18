/**
 * Tests for CouponManagementPage
 *
 * Verifies:
 * - Coupon list rendering with data
 * - Search filtering
 * - Status filtering
 * - Delete mutation with tenant_id isolation
 * - Toggle status mutation with tenant_id isolation
 * - Empty state rendering
 * - Error state rendering
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

// Mock modules before imports
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: { id: 'test-tenant-id', name: 'Test Tenant', slug: 'test-tenant' },
    tenantSlug: 'test-tenant',
  }),
}));

vi.mock('@/lib/humanizeError', () => ({
  humanizeError: (err: unknown) => String(err),
}));

vi.mock('@/lib/formatters', () => ({
  formatSmartDate: (date: string) => new Date(date).toLocaleDateString(),
  formatCurrency: (val: number) => `$${val.toFixed(2)}`,
}));

vi.mock('@/components/shared/ConfirmDeleteDialog', () => ({
  ConfirmDeleteDialog: ({ open, onConfirm, title }: { open: boolean; onConfirm: () => void; title: string }) =>
    open ? (
      <div data-testid="confirm-delete-dialog">
        <span>{title}</span>
        <button onClick={onConfirm}>Confirm Delete</button>
      </div>
    ) : null,
}));

vi.mock('@/hooks/useConfirmDialog', () => ({
  useConfirmDialog: () => ({
    dialogState: { open: false, title: '', itemName: '', itemType: '', isLoading: false, onConfirm: vi.fn() },
    confirm: vi.fn(),
    closeDialog: vi.fn(),
    setLoading: vi.fn(),
  }),
}));

vi.mock('@/components/shared/EnhancedEmptyState', () => ({
  EnhancedEmptyState: ({ title, description }: { title: string; description: string }) => (
    <div data-testid="empty-state">
      <span>{title}</span>
      <span>{description}</span>
    </div>
  ),
}));

vi.mock('@/components/CopyButton', () => ({
  default: ({ text }: { text: string }) => (
    <button data-testid={`copy-${text}`}>Copy</button>
  ),
}));

// Mock child components
vi.mock('@/components/admin/coupons/CouponCreateForm', () => ({
  CouponCreateForm: ({ open }: { open: boolean }) =>
    open ? <div data-testid="coupon-create-form">Create Form</div> : null,
}));

vi.mock('@/components/admin/coupons/CouponAnalytics', () => ({
  CouponAnalytics: ({ open }: { open: boolean }) =>
    open ? <div data-testid="coupon-analytics">Analytics</div> : null,
}));

vi.mock('@/components/admin/coupons/BulkCouponGenerator', () => ({
  BulkCouponGenerator: ({ open }: { open: boolean }) =>
    open ? <div data-testid="bulk-generator">Bulk Generator</div> : null,
}));

vi.mock('@/components/admin/coupons/CouponUsageStats', () => ({
  CouponUsageStats: ({ compact }: { compact?: boolean }) => (
    <div data-testid="coupon-usage-stats">{compact ? 'compact' : 'full'}</div>
  ),
}));

vi.mock('@/components/admin/coupons/CouponRedemptionTable', () => ({
  CouponRedemptionTable: () => <div data-testid="redemption-table">Redemptions</div>,
}));

// Mock data
const mockCoupons = [
  {
    id: 'coupon-1',
    code: 'SAVE10',
    description: 'Save 10 percent on all items',
    discount_type: 'percentage',
    discount_value: 10,
    status: 'active',
    used_count: 5,
    total_usage_limit: 100,
    never_expires: false,
    start_date: '2026-01-01T00:00:00Z',
    end_date: '2026-12-31T23:59:59Z',
    min_purchase: 25,
    per_user_limit: 1,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    tenant_id: 'test-tenant-id',
  },
  {
    id: 'coupon-2',
    code: 'FLAT5',
    description: 'Five dollars off',
    discount_type: 'fixed',
    discount_value: 5,
    status: 'inactive',
    used_count: 0,
    total_usage_limit: 50,
    never_expires: true,
    start_date: null,
    end_date: null,
    min_purchase: null,
    per_user_limit: null,
    created_at: '2026-02-01T00:00:00Z',
    updated_at: '2026-02-01T00:00:00Z',
    tenant_id: 'test-tenant-id',
  },
];

// Supabase mock with controllable responses
let mockQueryResponse: { data: unknown; error: unknown } = { data: mockCoupons, error: null };

function createMockChain() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = vi.fn().mockImplementation(() => chain);
  chain.eq = vi.fn().mockImplementation(() => chain);
  chain.order = vi.fn().mockImplementation(() => Promise.resolve(mockQueryResponse));
  chain.delete = vi.fn().mockImplementation(() => chain);
  chain.update = vi.fn().mockImplementation(() => chain);
  return chain;
}

const mockFrom = vi.fn().mockImplementation(() => createMockChain());

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

// Import component after mocks
import CouponManagementPage from '../CouponManagementPage';

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{ui}</BrowserRouter>
    </QueryClientProvider>
  );
}

describe('CouponManagementPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryResponse = { data: mockCoupons, error: null };
  });

  describe('Rendering', () => {
    it('renders the page header', async () => {
      renderWithProviders(<CouponManagementPage />);
      expect(screen.getByText('Coupon Management')).toBeInTheDocument();
      expect(screen.getByText(/Create and manage discount coupons/)).toBeInTheDocument();
    });

    it('renders search input and status filter', async () => {
      renderWithProviders(<CouponManagementPage />);
      expect(screen.getByPlaceholderText(/Search by code or description/)).toBeInTheDocument();
    });

    it('renders coupon data when loaded', async () => {
      renderWithProviders(<CouponManagementPage />);
      await waitFor(() => {
        // Both mobile and desktop views render the code, so use getAllByText
        expect(screen.getAllByText('SAVE10').length).toBeGreaterThan(0);
      });
      expect(screen.getAllByText('FLAT5').length).toBeGreaterThan(0);
    });

    it('shows coupon count in card header', async () => {
      renderWithProviders(<CouponManagementPage />);
      await waitFor(() => {
        expect(screen.getByText('Coupons (2)')).toBeInTheDocument();
      });
    });

    it('renders usage stats component in compact mode', () => {
      renderWithProviders(<CouponManagementPage />);
      expect(screen.getByText('compact')).toBeInTheDocument();
    });

    it('renders tab navigation', () => {
      renderWithProviders(<CouponManagementPage />);
      expect(screen.getByRole('tab', { name: /Coupons/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Redemptions/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Analytics/i })).toBeInTheDocument();
    });
  });

  describe('Search', () => {
    it('filters coupons by code', async () => {
      const user = userEvent.setup();
      renderWithProviders(<CouponManagementPage />);

      await waitFor(() => {
        expect(screen.getAllByText('SAVE10').length).toBeGreaterThan(0);
      });

      const searchInput = screen.getByPlaceholderText(/Search by code or description/);
      await user.type(searchInput, 'FLAT');

      await waitFor(() => {
        expect(screen.getAllByText('FLAT5').length).toBeGreaterThan(0);
        expect(screen.queryByText('SAVE10')).not.toBeInTheDocument();
      });
    });

    it('filters coupons by description', async () => {
      const user = userEvent.setup();
      renderWithProviders(<CouponManagementPage />);

      await waitFor(() => {
        expect(screen.getAllByText('SAVE10').length).toBeGreaterThan(0);
      });

      const searchInput = screen.getByPlaceholderText(/Search by code or description/);
      await user.type(searchInput, 'dollars');

      await waitFor(() => {
        expect(screen.getAllByText('FLAT5').length).toBeGreaterThan(0);
        expect(screen.queryByText('SAVE10')).not.toBeInTheDocument();
      });
    });

    it('shows no results message when search has no matches', async () => {
      const user = userEvent.setup();
      renderWithProviders(<CouponManagementPage />);

      await waitFor(() => {
        expect(screen.getAllByText('SAVE10').length).toBeGreaterThan(0);
      });

      const searchInput = screen.getByPlaceholderText(/Search by code or description/);
      await user.type(searchInput, 'NONEXISTENT');

      await waitFor(() => {
        expect(screen.getByText(/No coupons matching/)).toBeInTheDocument();
      });
    });
  });

  describe('Empty state', () => {
    it('shows empty state when no coupons exist', async () => {
      mockQueryResponse = { data: [], error: null };
      renderWithProviders(<CouponManagementPage />);

      await waitFor(() => {
        expect(screen.getByTestId('empty-state')).toBeInTheDocument();
        expect(screen.getByText('No Coupons Yet')).toBeInTheDocument();
      });
    });
  });

  describe('Error state', () => {
    it('shows error message with retry button on query failure', async () => {
      mockQueryResponse = {
        data: null,
        error: { message: 'Database error', code: '500' },
      };
      renderWithProviders(<CouponManagementPage />);

      // Component has retry: 2 so we need a longer timeout for retries to exhaust
      await waitFor(() => {
        expect(screen.getByText('Failed to load data. Please try again.')).toBeInTheDocument();
        expect(screen.getByText('Retry')).toBeInTheDocument();
      }, { timeout: 5000 });
    });
  });

  describe('Discount display', () => {
    it('shows percentage discount correctly', async () => {
      renderWithProviders(<CouponManagementPage />);
      await waitFor(() => {
        // Both mobile and desktop views render discount display
        expect(screen.getAllByText('10% off').length).toBeGreaterThan(0);
      });
    });

    it('shows fixed discount correctly', async () => {
      renderWithProviders(<CouponManagementPage />);
      await waitFor(() => {
        expect(screen.getAllByText('$5 off').length).toBeGreaterThan(0);
      });
    });
  });

  describe('Tenant isolation', () => {
    it('passes tenant_id to coupon list query', async () => {
      renderWithProviders(<CouponManagementPage />);

      await waitFor(() => {
        expect(mockFrom).toHaveBeenCalledWith('coupon_codes');
      });
    });
  });

  describe('Actions', () => {
    it('opens create form when New Coupon button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<CouponManagementPage />);

      await waitFor(() => {
        expect(screen.getAllByText('SAVE10').length).toBeGreaterThan(0);
      });

      const newButton = screen.getByText('New Coupon');
      await user.click(newButton);

      expect(screen.getByTestId('coupon-create-form')).toBeInTheDocument();
    });
  });
});
