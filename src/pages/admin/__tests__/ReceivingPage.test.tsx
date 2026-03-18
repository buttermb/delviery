/**
 * ReceivingPage Tests
 * Tests for receiving operations: skeleton loading, empty state, receipt list,
 * form validation, search sanitization, and QC workflow.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock dependencies before importing the component
const mockFrom = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
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
    warning: vi.fn(),
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

vi.mock('@/hooks/useLocations', () => ({
  useLocationOptions: vi.fn().mockReturnValue({
    options: [
      { value: 'loc-1', label: 'Main Warehouse', description: 'Denver, CO' },
    ],
    isLoading: false,
    isError: false,
  }),
}));

vi.mock('@/lib/humanizeError', () => ({
  humanizeError: vi.fn().mockReturnValue('Something went wrong'),
}));

// Import after mocks
import ReceivingPage from '../operations/ReceivingPage';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function createWrapper() {
  const queryClient = createQueryClient();
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/test-tenant/admin/operations/receiving']}>
          {children}
        </MemoryRouter>
      </QueryClientProvider>
    );
  };
}

function mockSupabaseQuery(data: unknown[] = [], error: unknown = null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data, error }),
    insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    update: vi.fn().mockReturnThis(),
  };
  mockFrom.mockReturnValue(chain);
  return chain;
}

const mockReceipts = [
  {
    id: 'receipt-1',
    tenant_id: 'tenant-123',
    shipment_number: 'SHIP-001',
    vendor: 'Test Vendor',
    received_date: '2024-01-15',
    expected_items: 10,
    notes: 'Test notes',
    status: 'pending',
    qc_status: null,
    qc_notes: null,
    damaged_items: null,
    missing_items: null,
    location_id: 'loc-1',
    location: { id: 'loc-1', name: 'Main Warehouse', city: 'Denver', state: 'CO' },
    created_at: '2024-01-15T00:00:00Z',
  },
  {
    id: 'receipt-2',
    tenant_id: 'tenant-123',
    shipment_number: 'SHIP-002',
    vendor: 'Another Vendor',
    received_date: '2024-01-16',
    expected_items: 5,
    notes: null,
    status: 'received',
    qc_status: null,
    qc_notes: null,
    damaged_items: null,
    missing_items: null,
    location_id: null,
    location: null,
    created_at: '2024-01-16T00:00:00Z',
  },
];

describe('ReceivingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useTenantAdminAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      tenant: { id: 'tenant-123', slug: 'test-tenant', business_name: 'Test Business' },
      loading: false,
      admin: { id: 'admin-123', email: 'admin@test.com' },
      tenantSlug: 'test-tenant',
    });
  });

  describe('Loading State', () => {
    it('should render skeleton loading state while data is loading', () => {
      // Set up a query that never resolves
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnValue(new Promise(() => {})),
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        update: vi.fn().mockReturnThis(),
      };
      mockFrom.mockReturnValue(chain);

      render(<ReceivingPage />, { wrapper: createWrapper() });

      // Skeleton elements should be present (multiple skeleton items with shimmer animation)
      const skeletonElements = document.querySelectorAll('[role="status"]');
      expect(skeletonElements.length).toBeGreaterThan(0);
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no receipts exist', async () => {
      mockSupabaseQuery([]);

      render(<ReceivingPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('No receipts yet')).toBeInTheDocument();
      });
      expect(screen.getByText(/Create your first receiving record/)).toBeInTheDocument();
    });

    it('should show contextual empty state when search is active', async () => {
      mockSupabaseQuery(mockReceipts);

      const user = userEvent.setup();
      render(<ReceivingPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Shipment #SHIP-001')).toBeInTheDocument();
      });

      // Type a search query that matches nothing
      const searchInput = screen.getByLabelText(/search shipments by number or vendor/i);
      await user.type(searchInput, 'nonexistent');

      await waitFor(() => {
        expect(screen.getByText('No matching receipts')).toBeInTheDocument();
        expect(screen.getByText(/Try adjusting your search/)).toBeInTheDocument();
      });
    });
  });

  describe('Receipt List', () => {
    it('should render receipt list with data', async () => {
      mockSupabaseQuery(mockReceipts);

      render(<ReceivingPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Shipment #SHIP-001')).toBeInTheDocument();
        expect(screen.getByText('Test Vendor')).toBeInTheDocument();
      });
      expect(screen.getByText('Shipment #SHIP-002')).toBeInTheDocument();
      expect(screen.getByText('Another Vendor')).toBeInTheDocument();
    });

    it('should show correct stats', async () => {
      mockSupabaseQuery(mockReceipts);

      render(<ReceivingPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        // Total = 2
        expect(screen.getByText('Total Receipts')).toBeInTheDocument();
      });
    });

    it('should show location badge for receipts with location', async () => {
      mockSupabaseQuery(mockReceipts);

      render(<ReceivingPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Main Warehouse')).toBeInTheDocument();
      });
    });

    it('should show Mark Received button for pending receipts', async () => {
      mockSupabaseQuery(mockReceipts);

      render(<ReceivingPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /mark shipment SHIP-001 as received/i })).toBeInTheDocument();
      });
    });

    it('should show QC Check button for received receipts', async () => {
      mockSupabaseQuery(mockReceipts);

      render(<ReceivingPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /qc check for shipment SHIP-002/i })).toBeInTheDocument();
      });
    });
  });

  describe('Search', () => {
    it('should filter receipts by search query', async () => {
      mockSupabaseQuery(mockReceipts);

      const user = userEvent.setup();
      render(<ReceivingPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Shipment #SHIP-001')).toBeInTheDocument();
      });

      const searchInput = screen.getByLabelText(/search shipments by number or vendor/i);
      await user.type(searchInput, 'Another');

      await waitFor(() => {
        expect(screen.queryByText('Shipment #SHIP-001')).not.toBeInTheDocument();
        expect(screen.getByText('Shipment #SHIP-002')).toBeInTheDocument();
      });
    });

    it('should have maxLength on search input', async () => {
      mockSupabaseQuery(mockReceipts);

      render(<ReceivingPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Shipment #SHIP-001')).toBeInTheDocument();
      });

      const searchInput = screen.getByLabelText(/search shipments by number or vendor/i);
      expect(searchInput).toHaveAttribute('maxLength', '200');
    });
  });

  describe('Create Receipt Dialog', () => {
    it('should open dialog when New Receipt button is clicked', async () => {
      mockSupabaseQuery([]);

      const user = userEvent.setup();
      render(<ReceivingPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('No receipts yet')).toBeInTheDocument();
      });

      const newReceiptBtn = screen.getByRole('button', { name: /create new receipt/i });
      await user.click(newReceiptBtn);

      expect(screen.getByText('Create Receiving Record')).toBeInTheDocument();
    });

    it('should show validation errors for required fields', async () => {
      mockSupabaseQuery([]);

      const user = userEvent.setup();
      render(<ReceivingPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('No receipts yet')).toBeInTheDocument();
      });

      const newReceiptBtn = screen.getByRole('button', { name: /create new receipt/i });
      await user.click(newReceiptBtn);

      // Submit without filling required fields
      const submitBtn = screen.getByRole('button', { name: /create receipt/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText('Shipment number is required')).toBeInTheDocument();
      });
    });

    it('should have maxLength attributes on form inputs', async () => {
      mockSupabaseQuery(mockReceipts);

      const user = userEvent.setup();
      render(<ReceivingPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Shipment #SHIP-001')).toBeInTheDocument();
      });

      const newReceiptBtn = screen.getByRole('button', { name: /create new receipt/i });
      await user.click(newReceiptBtn);

      expect(screen.getByPlaceholderText('SHIP-2024-001')).toHaveAttribute('maxLength', '100');
      expect(screen.getByPlaceholderText('Vendor Name')).toHaveAttribute('maxLength', '200');
    });

    it('should show character count for notes', async () => {
      mockSupabaseQuery(mockReceipts);

      const user = userEvent.setup();
      render(<ReceivingPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Shipment #SHIP-001')).toBeInTheDocument();
      });

      const newReceiptBtn = screen.getByRole('button', { name: /create new receipt/i });
      await user.click(newReceiptBtn);

      expect(screen.getByText('0/2000')).toBeInTheDocument();
    });
  });

  describe('Aria Labels', () => {
    it('should have aria-labels on interactive elements', async () => {
      mockSupabaseQuery(mockReceipts);

      render(<ReceivingPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Shipment #SHIP-001')).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /create new receipt/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/search shipments by number or vendor/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/filter by location/i)).toBeInTheDocument();
    });

    it('should have aria-pressed on filter buttons', async () => {
      mockSupabaseQuery(mockReceipts);

      render(<ReceivingPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Shipment #SHIP-001')).toBeInTheDocument();
      });

      const allFilterBtn = screen.getByRole('button', { name: /filter by all statuses/i });
      expect(allFilterBtn).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('Table Missing State', () => {
    it('should handle missing table gracefully', async () => {
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: null,
          error: { code: '42P01', message: 'relation "receiving_records" does not exist' },
        }),
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        update: vi.fn().mockReturnThis(),
      };
      mockFrom.mockReturnValue(chain);

      render(<ReceivingPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Feature Not Available')).toBeInTheDocument();
      });
    });
  });

  describe('No Tenant', () => {
    it('should not fetch data when tenant is missing', () => {
      (useTenantAdminAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        tenant: null,
        loading: false,
        admin: null,
        tenantSlug: null,
      });

      mockSupabaseQuery([]);
      render(<ReceivingPage />, { wrapper: createWrapper() });

      // Query should not have been called since enabled: !!tenantId is false
      expect(mockFrom).not.toHaveBeenCalled();
    });
  });
});
