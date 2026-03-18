/**
 * DataExport Tests
 * Tests for rendering, history display, and the getStatusBadgeVariant helper
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Use vi.hoisted so mock functions are available in vi.mock factories
const { mockInsert, mockMaybeSingle, mockInvoke, mockLimit } = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockMaybeSingle: vi.fn(),
  mockInvoke: vi.fn(),
  mockLimit: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: mockLimit,
      insert: mockInsert.mockReturnValue({
        select: vi.fn().mockReturnValue({
          maybeSingle: mockMaybeSingle,
        }),
      }),
    })),
    functions: {
      invoke: mockInvoke,
    },
  },
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: vi.fn().mockReturnValue({
    tenant: { id: 'tenant-123', slug: 'test-tenant', business_name: 'Test Business' },
    loading: false,
    admin: { id: 'admin-123', email: 'admin@test.com', userId: 'user-uuid-123' },
    tenantSlug: 'test-tenant',
  }),
}));

vi.mock('@/hooks/useCredits', () => ({
  useCredits: vi.fn().mockReturnValue({
    isFreeTier: false,
    performAction: vi.fn().mockResolvedValue({ success: true }),
    balance: 100,
  }),
}));

vi.mock('@/components/credits', () => ({
  CreditCostBadge: () => null,
  CreditCostIndicator: () => null,
  useCreditConfirm: vi.fn().mockImplementation(({ onConfirm }: { onConfirm: () => void }) => ({
    trigger: onConfirm,
    dialogProps: { open: false, onOpenChange: vi.fn() },
  })),
  CreditConfirmDialog: () => null,
}));

vi.mock('@/components/auth/PermissionGuard', () => ({
  PermissionGuard: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
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

vi.mock('@/utils/errorHandling/typeGuards', () => ({
  isPostgrestError: vi.fn().mockReturnValue(false),
}));

vi.mock('@/lib/formatters', () => ({
  formatSmartDate: vi.fn().mockReturnValue('Mar 18, 2026 10:00 AM'),
}));

// Import after mocks
import DataExport from '../DataExport';
import { toast } from 'sonner';

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

const renderWithProviders = () => {
  const queryClient = createQueryClient();
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/test-tenant/admin/data-export']}>
        {children}
      </MemoryRouter>
    </QueryClientProvider>
  );
  return { ...render(<DataExport />, { wrapper: Wrapper }), queryClient };
};

describe('DataExport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMaybeSingle.mockResolvedValue({
      data: { id: 'export-job-123' },
      error: null,
    });
    mockInvoke.mockResolvedValue({ data: { success: true }, error: null });
    mockLimit.mockResolvedValue({ data: [], error: null });
  });

  describe('rendering', () => {
    it('renders the export form and history sections', () => {
      renderWithProviders();

      expect(screen.getByText('Data Export')).toBeInTheDocument();
      expect(screen.getByText('Select data type and format')).toBeInTheDocument();
      expect(screen.getByText('Export History')).toBeInTheDocument();
      expect(screen.getByText('Export your data in various formats')).toBeInTheDocument();
    });

    it('renders data type and format selects', () => {
      renderWithProviders();

      expect(screen.getByText('Data Type')).toBeInTheDocument();
      expect(screen.getByText('Export Format')).toBeInTheDocument();
    });

    it('renders export button', () => {
      renderWithProviders();

      const exportButton = screen.getByRole('button', { name: /export data/i });
      expect(exportButton).toBeInTheDocument();
    });

    it('shows empty history message when no exports exist', async () => {
      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByText(/No export history/)).toBeInTheDocument();
      });
    });

    it('shows loading skeletons while history loads', () => {
      // Don't resolve the mock to keep loading state
      mockLimit.mockReturnValue(new Promise(() => {}));
      renderWithProviders();

      // Skeleton component renders with role="status" and aria-label="Loading..."
      const skeletons = screen.getAllByRole('status');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('export button validation', () => {
    it('export button is disabled when no data type is selected', () => {
      renderWithProviders();

      const exportButton = screen.getByRole('button', { name: /export data/i });
      expect(exportButton).toBeDisabled();
    });
  });

  describe('export history display', () => {
    it('renders completed exports with download links', async () => {
      const historyData = [
        {
          id: 'export-1',
          data_type: 'orders',
          format: 'csv',
          created_at: '2026-03-18T10:00:00Z',
          status: 'completed',
          download_url: 'https://example.com/export.csv',
          row_count: 150,
          error_message: null,
        },
      ];

      mockLimit.mockResolvedValue({ data: historyData, error: null });
      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByText('orders')).toBeInTheDocument();
        expect(screen.getByText('completed')).toBeInTheDocument();
        expect(screen.getByText('csv')).toBeInTheDocument();
      });

      const downloadLink = screen.getByLabelText('Download orders export');
      expect(downloadLink).toHaveAttribute('href', 'https://example.com/export.csv');
      expect(downloadLink).toHaveAttribute('target', '_blank');
      expect(downloadLink).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('shows row count when available', async () => {
      mockLimit.mockResolvedValue({
        data: [{
          id: 'export-1',
          data_type: 'orders',
          format: 'csv',
          created_at: '2026-03-18T10:00:00Z',
          status: 'completed',
          download_url: 'https://example.com/export.csv',
          row_count: 150,
          error_message: null,
        }],
        error: null,
      });

      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByText(/150 rows/)).toBeInTheDocument();
      });
    });

    it('shows error message for failed exports', async () => {
      mockLimit.mockResolvedValue({
        data: [{
          id: 'export-2',
          data_type: 'products',
          format: 'json',
          created_at: '2026-03-17T09:00:00Z',
          status: 'failed',
          download_url: null,
          row_count: null,
          error_message: 'Table not found',
        }],
        error: null,
      });

      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByText('failed')).toBeInTheDocument();
        expect(screen.getByText('Table not found')).toBeInTheDocument();
      });
    });

    it('does not show download link for non-completed exports', async () => {
      mockLimit.mockResolvedValue({
        data: [{
          id: 'export-3',
          data_type: 'customers',
          format: 'csv',
          created_at: '2026-03-18T10:00:00Z',
          status: 'processing',
          download_url: null,
          row_count: null,
          error_message: null,
        }],
        error: null,
      });

      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByText('processing')).toBeInTheDocument();
      });

      expect(screen.queryByLabelText(/download/i)).not.toBeInTheDocument();
    });

    it('renders multiple history items', async () => {
      mockLimit.mockResolvedValue({
        data: [
          {
            id: 'export-1',
            data_type: 'orders',
            format: 'csv',
            created_at: '2026-03-18T10:00:00Z',
            status: 'completed',
            download_url: 'https://example.com/export.csv',
            row_count: 150,
            error_message: null,
          },
          {
            id: 'export-2',
            data_type: 'products',
            format: 'json',
            created_at: '2026-03-17T09:00:00Z',
            status: 'failed',
            download_url: null,
            row_count: null,
            error_message: 'Error occurred',
          },
          {
            id: 'export-3',
            data_type: 'customers',
            format: 'csv',
            created_at: '2026-03-16T08:00:00Z',
            status: 'pending',
            download_url: null,
            row_count: null,
            error_message: null,
          },
        ],
        error: null,
      });

      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByText('orders')).toBeInTheDocument();
        expect(screen.getByText('products')).toBeInTheDocument();
        expect(screen.getByText('customers')).toBeInTheDocument();
        expect(screen.getByText('completed')).toBeInTheDocument();
        expect(screen.getByText('failed')).toBeInTheDocument();
        expect(screen.getByText('pending')).toBeInTheDocument();
      });
    });
  });
});
