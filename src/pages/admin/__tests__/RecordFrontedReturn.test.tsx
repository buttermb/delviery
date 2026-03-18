/**
 * RecordFrontedReturn Tests
 * Tests for scanning and processing fronted inventory returns
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { mockNavigateToAdmin } = vi.hoisted(() => ({
  mockNavigateToAdmin: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
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

vi.mock('@/lib/navigation/tenantNavigation', () => ({
  useTenantNavigation: vi.fn().mockReturnValue({
    navigateToAdmin: mockNavigateToAdmin,
    buildAdminUrl: vi.fn((path: string) => `/test-tenant/admin/${path}`),
    tenantSlug: 'test-tenant',
    navigate: vi.fn(),
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
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

vi.mock('@/components/inventory/BarcodeScanner', () => ({
  BarcodeScanner: ({ onScan }: { onScan: (barcode: string) => void }) => (
    <div data-testid="barcode-scanner">
      <button data-testid="scan-trigger" onClick={() => onScan('TEST-BARCODE-001')}>
        Simulate Scan
      </button>
      <button data-testid="scan-trigger-2" onClick={() => onScan('TEST-BARCODE-002')}>
        Simulate Scan 2
      </button>
    </div>
  ),
}));

vi.mock('@/hooks/useCredits', () => ({
  useCreditGatedAction: vi.fn().mockReturnValue({
    execute: vi.fn((_action: string, fn: () => Promise<void>) => fn()),
  }),
}));

vi.mock('@/components/SEOHead', () => ({
  SEOHead: ({ title }: { title: string }) => <title>{title}</title>,
}));

// Import after mocks
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import RecordFrontedReturn from '../RecordFrontedReturn';

const mockFrontedItem = {
  id: 'front-123',
  quantity_returned: 0,
  quantity_damaged: 0,
  product_id: 'product-456',
  client_id: 'client-789',
  price_per_unit: 100,
  account_id: 'tenant-123',
  products: {
    name: 'Test Product',
    sku: 'SKU001',
    barcode: 'BARCODE001',
  },
};

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={createQueryClient()}>
    <MemoryRouter initialEntries={['/test-tenant/admin/inventory/fronted/front-123/return']}>
      <Routes>
        <Route path=":tenantSlug/admin/inventory/fronted/:id/return" element={children} />
      </Routes>
    </MemoryRouter>
  </QueryClientProvider>
);

function setupSupabaseMock(data: unknown = mockFrontedItem, error: unknown = null) {
  const maybeSingleMock = vi.fn().mockResolvedValue({ data, error });
  const eqMock = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock }), maybeSingle: maybeSingleMock });
  const selectMock = vi.fn().mockReturnValue({ eq: eqMock });

  (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
    select: selectMock,
    eq: eqMock,
    maybeSingle: maybeSingleMock,
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }),
    }),
    insert: vi.fn().mockResolvedValue({ data: null, error: null }),
  });

  return { selectMock, eqMock, maybeSingleMock };
}

describe('RecordFrontedReturn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupSupabaseMock();

    (useTenantAdminAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      tenant: { id: 'tenant-123', slug: 'test-tenant', business_name: 'Test Business' },
      loading: false,
      admin: { id: 'admin-123', email: 'admin@test.com' },
      tenantSlug: 'test-tenant',
    });
  });

  describe('Initial Render', () => {
    it('should show loading state initially then render page', async () => {
      render(<RecordFrontedReturn />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Scan Returns')).toBeInTheDocument();
      });
    });

    it('should display product name from fronted inventory', async () => {
      render(<RecordFrontedReturn />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText(/Test Product/)).toBeInTheDocument();
      });
    });

    it('should show scanner controls', async () => {
      render(<RecordFrontedReturn />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Start Scanning')).toBeInTheDocument();
      });
    });

    it('should show summary counters at zero initially', async () => {
      render(<RecordFrontedReturn />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Total Scanned')).toBeInTheDocument();
        expect(screen.getByText('Good Condition')).toBeInTheDocument();
        expect(screen.getByText('Damaged')).toBeInTheDocument();
      });
    });

    it('should render back button', async () => {
      render(<RecordFrontedReturn />, { wrapper });

      await waitFor(() => {
        expect(screen.getByLabelText('Back to fronted inventory details')).toBeInTheDocument();
      });
    });
  });

  describe('Tenant Validation', () => {
    it('should filter by account_id when loading fronted inventory', async () => {
      const { eqMock } = setupSupabaseMock();

      render(<RecordFrontedReturn />, { wrapper });

      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('fronted_inventory');
        expect(eqMock).toHaveBeenCalled();
      });
    });

    it('should not load data when tenant is missing', async () => {
      (useTenantAdminAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        tenant: null,
        loading: false,
        admin: null,
        tenantSlug: 'test-tenant',
      });

      render(<RecordFrontedReturn />, { wrapper });

      // Should remain in loading state
      expect(screen.queryByText('Scan Returns')).not.toBeInTheDocument();
    });
  });

  describe('Scanning', () => {
    it('should toggle scanner on button click', async () => {
      const user = userEvent.setup();
      render(<RecordFrontedReturn />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Start Scanning')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Start Scanning'));
      expect(screen.getByText('Stop Scanning')).toBeInTheDocument();
      expect(screen.getByTestId('barcode-scanner')).toBeInTheDocument();
    });

    it('should add scanned items to the list', async () => {
      const user = userEvent.setup();
      render(<RecordFrontedReturn />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Start Scanning')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Start Scanning'));
      await user.click(screen.getByTestId('scan-trigger'));

      expect(toast.success).toHaveBeenCalledWith('Item scanned');
      expect(screen.getByText('TEST-BARCODE-001')).toBeInTheDocument();
    });

    it('should prevent duplicate scans', async () => {
      const user = userEvent.setup();
      render(<RecordFrontedReturn />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Start Scanning')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Start Scanning'));
      await user.click(screen.getByTestId('scan-trigger'));
      await user.click(screen.getByTestId('scan-trigger'));

      expect(toast.error).toHaveBeenCalledWith('Item already scanned');
    });

    it('should remove scanned items', async () => {
      const user = userEvent.setup();
      render(<RecordFrontedReturn />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Start Scanning')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Start Scanning'));
      await user.click(screen.getByTestId('scan-trigger'));

      expect(screen.getByText('TEST-BARCODE-001')).toBeInTheDocument();

      await user.click(screen.getByLabelText('Remove return item'));
      expect(screen.queryByText('TEST-BARCODE-001')).not.toBeInTheDocument();
    });
  });

  describe('Process Return', () => {
    it('should show error when no items scanned', async () => {
      const user = userEvent.setup();
      render(<RecordFrontedReturn />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Process 0 Returns')).toBeInTheDocument();
      });

      // Button should be disabled with 0 items
      const processButton = screen.getByText('Process 0 Returns').closest('button');
      expect(processButton).toBeDisabled();
    });

    it('should call process_fronted_return_atomic RPC on process', async () => {
      const user = userEvent.setup();
      (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: null });

      render(<RecordFrontedReturn />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Start Scanning')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Start Scanning'));
      await user.click(screen.getByTestId('scan-trigger'));

      const processButton = screen.getByText('Process 1 Returns');
      await user.click(processButton);

      await waitFor(() => {
        expect(supabase.rpc).toHaveBeenCalledWith('process_fronted_return_atomic', {
          p_fronted_id: 'front-123',
          p_good_returns: 1,
          p_damaged_returns: 0,
          p_notes: null,
        });
      });
    });

    it('should batch insert scan records', async () => {
      const user = userEvent.setup();
      const insertMock = vi.fn().mockResolvedValue({ data: null, error: null });

      (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: null });
      (supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'fronted_inventory_scans') {
          return { insert: insertMock };
        }
        // Return default mock for fronted_inventory
        const maybeSingleMock = vi.fn().mockResolvedValue({ data: mockFrontedItem, error: null });
        const eqMock = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock }), maybeSingle: maybeSingleMock });
        return {
          select: vi.fn().mockReturnValue({ eq: eqMock }),
          eq: eqMock,
          maybeSingle: maybeSingleMock,
        };
      });

      render(<RecordFrontedReturn />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Start Scanning')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Start Scanning'));
      await user.click(screen.getByTestId('scan-trigger'));
      await user.click(screen.getByTestId('scan-trigger-2'));

      const processButton = screen.getByText('Process 2 Returns');
      await user.click(processButton);

      await waitFor(() => {
        expect(insertMock).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ barcode: 'TEST-BARCODE-001', scan_type: 'return' }),
            expect.objectContaining({ barcode: 'TEST-BARCODE-002', scan_type: 'return' }),
          ])
        );
      });
    });

    it('should navigate after successful return processing', async () => {
      const user = userEvent.setup();
      (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: null });

      render(<RecordFrontedReturn />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Start Scanning')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Start Scanning'));
      await user.click(screen.getByTestId('scan-trigger'));

      await user.click(screen.getByText('Process 1 Returns'));

      await waitFor(() => {
        expect(mockNavigateToAdmin).toHaveBeenCalledWith('inventory/fronted/front-123');
      });
    });

    it('should show success toast after processing', async () => {
      const user = userEvent.setup();
      (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: null });

      render(<RecordFrontedReturn />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Start Scanning')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Start Scanning'));
      await user.click(screen.getByTestId('scan-trigger'));
      await user.click(screen.getByText('Process 1 Returns'));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          'Return processed: 1 returned to inventory, 0 marked as damaged'
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle load failure gracefully', async () => {
      setupSupabaseMock(null, new Error('Database error'));

      render(<RecordFrontedReturn />, { wrapper });

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to load details');
        expect(logger.error).toHaveBeenCalled();
      });
    });

    it('should show error toast when return processing fails', async () => {
      const user = userEvent.setup();
      (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: { message: 'Processing failed', code: '50000' },
      });

      render(<RecordFrontedReturn />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Start Scanning')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Start Scanning'));
      await user.click(screen.getByTestId('scan-trigger'));
      await user.click(screen.getByText('Process 1 Returns'));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Failed to process return'));
      });
    });

    it('should log scan record insert errors', async () => {
      const user = userEvent.setup();
      const insertMock = vi.fn().mockResolvedValue({ data: null, error: { message: 'Insert failed' } });

      (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: null });
      (supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'fronted_inventory_scans') {
          return { insert: insertMock };
        }
        const maybeSingleMock = vi.fn().mockResolvedValue({ data: mockFrontedItem, error: null });
        const eqMock = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock }), maybeSingle: maybeSingleMock });
        return {
          select: vi.fn().mockReturnValue({ eq: eqMock }),
          eq: eqMock,
          maybeSingle: maybeSingleMock,
        };
      });

      render(<RecordFrontedReturn />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Start Scanning')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Start Scanning'));
      await user.click(screen.getByTestId('scan-trigger'));
      await user.click(screen.getByText('Process 1 Returns'));

      await waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith(
          'Failed to create scan records',
          expect.anything(),
          expect.objectContaining({ component: 'RecordFrontedReturn' })
        );
      });
    });
  });

  describe('Navigation', () => {
    it('should navigate back when back button is clicked', async () => {
      const user = userEvent.setup();
      render(<RecordFrontedReturn />, { wrapper });

      await waitFor(() => {
        expect(screen.getByLabelText('Back to fronted inventory details')).toBeInTheDocument();
      });

      await user.click(screen.getByLabelText('Back to fronted inventory details'));
      expect(mockNavigateToAdmin).toHaveBeenCalledWith('inventory/fronted/front-123');
    });

    it('should navigate back when cancel button is clicked', async () => {
      const user = userEvent.setup();
      render(<RecordFrontedReturn />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Cancel')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Cancel'));
      expect(mockNavigateToAdmin).toHaveBeenCalledWith('inventory/fronted/front-123');
    });
  });
});
