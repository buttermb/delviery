/**
 * QualityControlPage Tests
 * Tests for quality control batch listing, aria-labels, and tenant isolation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

// Mock dependencies before importing the component
const mockFrom = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({ error: null }),
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/coa.pdf' } }),
      }),
    },
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

vi.mock('@/hooks/useCredits', () => ({
  useCreditGatedAction: () => ({
    execute: (_action: string, fn: () => Promise<void>) => fn(),
  }),
}));

vi.mock('@/lib/fileValidation', () => ({
  validateFile: vi.fn().mockResolvedValue({ isValid: true }),
  generateSecureStoragePath: vi.fn().mockReturnValue('coas/tenant-123/file.pdf'),
  FILE_SIZE_LIMITS: { document: 10_000_000 },
  formatFileSize: vi.fn().mockReturnValue('10MB'),
}));

vi.mock('@/lib/humanizeError', () => ({
  humanizeError: vi.fn().mockReturnValue('Something went wrong'),
}));

// Import after mocks
import QualityControlPage from '../QualityControlPage';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/test-tenant/admin/quality-control']}>
        {children}
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const mockBatches = [
  {
    id: 'batch-1',
    batch_number: 'BATCH-001',
    product_id: 'product-1',
    product: { name: 'Blue Dream', image_url: null },
    test_results: { thc: 24.5, cbd: 0.3 },
    lab_name: 'Green Labs',
    test_date: '2026-03-15',
    coa_url: 'https://example.com/coa1.pdf',
    compliance_status: 'verified',
    status: 'active',
    tenant_id: 'tenant-123',
  },
  {
    id: 'batch-2',
    batch_number: 'BATCH-002',
    product_id: 'product-2',
    product: { name: 'OG Kush', image_url: null },
    test_results: null,
    lab_name: null,
    test_date: null,
    coa_url: null,
    compliance_status: 'pending',
    status: 'active',
    tenant_id: 'tenant-123',
  },
  {
    id: 'batch-3',
    batch_number: 'BATCH-003',
    product_id: 'product-3',
    product: { name: 'Sour Diesel', image_url: null },
    test_results: null,
    lab_name: 'Test Labs',
    test_date: '2026-03-10',
    coa_url: null,
    compliance_status: 'failed',
    status: 'quarantined',
    tenant_id: 'tenant-123',
  },
];

function setupMockFrom(data: unknown[] = mockBatches) {
  const chainable = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data, error: null }),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    delete: vi.fn().mockReturnThis(),
    then: vi.fn(),
  };
  mockFrom.mockReturnValue(chainable);
  return chainable;
}

describe('QualityControlPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (useTenantAdminAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      tenant: { id: 'tenant-123', slug: 'test-tenant', business_name: 'Test Business' },
      loading: false,
      admin: { id: 'admin-123', email: 'admin@test.com' },
      tenantSlug: 'test-tenant',
    });

    setupMockFrom();
  });

  describe('Initial Render', () => {
    it('should render the page title and description', async () => {
      render(<QualityControlPage />, { wrapper: createWrapper() });

      expect(screen.getByText('Quality Control & Lab Testing')).toBeInTheDocument();
      expect(screen.getByText('Manage COAs, track test results, and ensure compliance')).toBeInTheDocument();
    });

    it('should render batch list with data', async () => {
      render(<QualityControlPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('BATCH-001')).toBeInTheDocument();
        expect(screen.getByText('BATCH-002')).toBeInTheDocument();
        expect(screen.getByText('BATCH-003')).toBeInTheDocument();
      });
    });

    it('should show product names', async () => {
      render(<QualityControlPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
        expect(screen.getByText('OG Kush')).toBeInTheDocument();
        expect(screen.getByText('Sour Diesel')).toBeInTheDocument();
      });
    });

    it('should render empty state when no batches exist', async () => {
      setupMockFrom([]);

      render(<QualityControlPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('No Batches Found')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have aria-label on View Test Results button', async () => {
      render(<QualityControlPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('BATCH-001')).toBeInTheDocument();
      });

      const viewButton = screen.getByLabelText('View test results for batch BATCH-001');
      expect(viewButton).toBeInTheDocument();
    });

    it('should have aria-label on Upload COA button', async () => {
      render(<QualityControlPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('BATCH-001')).toBeInTheDocument();
      });

      const uploadButton = screen.getByLabelText('Upload COA for batch BATCH-001');
      expect(uploadButton).toBeInTheDocument();
    });

    it('should have aria-label on Quarantine button for failed batches', async () => {
      render(<QualityControlPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('BATCH-003')).toBeInTheDocument();
      });

      const quarantineButton = screen.getByLabelText('Quarantine batch BATCH-003');
      expect(quarantineButton).toBeInTheDocument();
    });

    it('should have aria-label on search input', async () => {
      render(<QualityControlPage />, { wrapper: createWrapper() });

      const searchInput = screen.getByLabelText('Search by batch number, product, or lab');
      expect(searchInput).toBeInTheDocument();
    });
  });

  describe('Tenant Isolation', () => {
    it('should query inventory_batches table', async () => {
      render(<QualityControlPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(mockFrom).toHaveBeenCalledWith('inventory_batches');
      });
    });

    it('should filter by tenant_id', async () => {
      const chainable = setupMockFrom();

      render(<QualityControlPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(chainable.eq).toHaveBeenCalledWith('tenant_id', 'tenant-123');
      });
    });
  });

  describe('Search and Filter', () => {
    it('should filter batches by search term', async () => {
      const user = userEvent.setup();
      render(<QualityControlPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('BATCH-001')).toBeInTheDocument();
      });

      const searchInput = screen.getByLabelText('Search by batch number, product, or lab');
      await user.type(searchInput, 'Blue Dream');

      expect(screen.getByText('BATCH-001')).toBeInTheDocument();
      expect(screen.queryByText('BATCH-002')).not.toBeInTheDocument();
      expect(screen.queryByText('BATCH-003')).not.toBeInTheDocument();
    });

    it('should filter batches by lab name', async () => {
      const user = userEvent.setup();
      render(<QualityControlPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('BATCH-001')).toBeInTheDocument();
      });

      const searchInput = screen.getByLabelText('Search by batch number, product, or lab');
      await user.type(searchInput, 'Green Labs');

      expect(screen.getByText('BATCH-001')).toBeInTheDocument();
      expect(screen.queryByText('BATCH-002')).not.toBeInTheDocument();
    });
  });

  describe('Compliance Status Badges', () => {
    it('should show verified badge for verified batches', async () => {
      render(<QualityControlPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Verified')).toBeInTheDocument();
      });
    });

    it('should show pending badge for pending batches', async () => {
      render(<QualityControlPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Pending')).toBeInTheDocument();
      });
    });

    it('should show failed badge for failed batches', async () => {
      render(<QualityControlPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Failed')).toBeInTheDocument();
      });
    });
  });

  describe('COA Status', () => {
    it('should show Available badge when COA exists', async () => {
      render(<QualityControlPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Available')).toBeInTheDocument();
      });
    });

    it('should show Not Uploaded badge when no COA', async () => {
      render(<QualityControlPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        const notUploaded = screen.getAllByText('Not Uploaded');
        expect(notUploaded.length).toBe(2);
      });
    });
  });

  describe('Quarantine Button Visibility', () => {
    it('should only show quarantine button for failed batches', async () => {
      render(<QualityControlPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('BATCH-003')).toBeInTheDocument();
      });

      // Only batch-3 (failed) should have a quarantine button
      expect(screen.getByLabelText('Quarantine batch BATCH-003')).toBeInTheDocument();
      expect(screen.queryByLabelText('Quarantine batch BATCH-001')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Quarantine batch BATCH-002')).not.toBeInTheDocument();
    });
  });
});
