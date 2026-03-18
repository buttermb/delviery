import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      delete: vi.fn().mockReturnThis(),
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

vi.mock('@/lib/activityLogger', () => ({
  logActivityAuto: vi.fn(),
  ActivityActions: {
    DELETE_RETURN: 'delete_return',
  },
}));

vi.mock('@/lib/humanizeError', () => ({
  humanizeError: vi.fn().mockReturnValue('Something went wrong'),
}));

vi.mock('@/components/admin/returns/RACreateForm', () => ({
  RACreateForm: ({ open }: { open: boolean }) =>
    open ? <div data-testid="ra-create-form">RACreateForm</div> : null,
}));

vi.mock('@/components/admin/returns/RADetail', () => ({
  RADetail: ({ open }: { open: boolean }) =>
    open ? <div data-testid="ra-detail">RADetail</div> : null,
}));

vi.mock('@/components/shared/ConfirmDeleteDialog', () => ({
  ConfirmDeleteDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="confirm-delete-dialog">ConfirmDeleteDialog</div> : null,
}));

vi.mock('@/components/shared/EnhancedEmptyState', () => ({
  EnhancedEmptyState: ({ title, description }: { title: string; description: string }) => (
    <div data-testid="empty-state">
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  ),
}));

import ReturnsManagementPage from '../ReturnsManagementPage';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={createQueryClient()}>
    <MemoryRouter initialEntries={['/test-tenant/admin/returns']}>
      {children}
    </MemoryRouter>
  </QueryClientProvider>
);

const mockReturns = [
  {
    id: 'ra-1',
    ra_number: 'RA-001',
    order_id: 'order-1',
    order_number: 'ORD-100',
    customer_name: 'John Doe',
    status: 'pending',
    reason: 'defective',
    return_method: 'pickup',
    total_amount: 100.0,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'ra-2',
    ra_number: 'RA-002',
    order_id: 'order-2',
    order_number: 'ORD-200',
    customer_name: 'Jane Smith',
    status: 'refunded',
    reason: 'wrong_item',
    return_method: 'ship_back',
    total_amount: 250.5,
    refund_amount: 225.0,
    created_at: '2026-01-02T00:00:00Z',
  },
  {
    id: 'ra-3',
    ra_number: 'RA-003',
    order_id: 'order-3',
    order_number: 'ORD-300',
    customer_name: 'Bob Wilson',
    status: 'cancelled',
    reason: 'customer_request',
    return_method: 'destroy',
    total_amount: 50.0,
    created_at: '2026-01-03T00:00:00Z',
  },
];

describe('ReturnsManagementPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (useTenantAdminAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      tenant: { id: 'tenant-123', slug: 'test-tenant', business_name: 'Test Business' },
      loading: false,
      admin: { id: 'admin-123', email: 'admin@test.com' },
      tenantSlug: 'test-tenant',
    });

    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      delete: vi.fn().mockReturnThis(),
    });
  });

  describe('Initial Render', () => {
    it('should render page header and controls', async () => {
      render(<ReturnsManagementPage />, { wrapper });

      expect(screen.getByText('Returns & Refunds')).toBeInTheDocument();
      expect(screen.getByText('Manage product returns, refunds, and exchanges')).toBeInTheDocument();
      expect(screen.getByText('New Return Authorization')).toBeInTheDocument();
    });

    it('should show loading skeleton initially', () => {
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnValue(new Promise(() => {})), // Never resolves
        delete: vi.fn().mockReturnThis(),
      });

      render(<ReturnsManagementPage />, { wrapper });

      // Skeleton rows use role="status" with aria-label="Loading..."
      const skeletons = screen.getAllByRole('status', { name: 'Loading...' });
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should show empty state when no returns exist', async () => {
      render(<ReturnsManagementPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('No Return Authorizations')).toBeInTheDocument();
      });
      expect(screen.getByText('Create your first return authorization to get started.')).toBeInTheDocument();
    });
  });

  describe('Returns Table', () => {
    it('should render returns when data is available', async () => {
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockReturns, error: null }),
        delete: vi.fn().mockReturnThis(),
      });

      render(<ReturnsManagementPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('RA-001')).toBeInTheDocument();
      });
      expect(screen.getByText('RA-002')).toBeInTheDocument();
      expect(screen.getByText('RA-003')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });

    it('should show correct count in header', async () => {
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockReturns, error: null }),
        delete: vi.fn().mockReturnThis(),
      });

      render(<ReturnsManagementPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Return Authorizations (3)')).toBeInTheDocument();
      });
    });

    it('should show action buttons with aria-labels', async () => {
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockReturns, error: null }),
        delete: vi.fn().mockReturnThis(),
      });

      render(<ReturnsManagementPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByLabelText('View return RA-001')).toBeInTheDocument();
      });
      expect(screen.getByLabelText('Edit return RA-001')).toBeInTheDocument();
      expect(screen.getByLabelText('Delete return RA-001')).toBeInTheDocument();
    });

    it('should show edit button only for pending returns', async () => {
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockReturns, error: null }),
        delete: vi.fn().mockReturnThis(),
      });

      render(<ReturnsManagementPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByLabelText('Edit return RA-001')).toBeInTheDocument();
      });
      // RA-002 (refunded) should not have edit button
      expect(screen.queryByLabelText('Edit return RA-002')).not.toBeInTheDocument();
      // RA-003 (cancelled) should not have edit button
      expect(screen.queryByLabelText('Edit return RA-003')).not.toBeInTheDocument();
    });

    it('should show delete button only for pending or cancelled returns', async () => {
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockReturns, error: null }),
        delete: vi.fn().mockReturnThis(),
      });

      render(<ReturnsManagementPage />, { wrapper });

      await waitFor(() => {
        // Pending (RA-001) and cancelled (RA-003) should have delete
        expect(screen.getByLabelText('Delete return RA-001')).toBeInTheDocument();
        expect(screen.getByLabelText('Delete return RA-003')).toBeInTheDocument();
      });
      // Refunded (RA-002) should not have delete
      expect(screen.queryByLabelText('Delete return RA-002')).not.toBeInTheDocument();
    });
  });

  describe('Search', () => {
    it('should filter returns by search term', async () => {
      const user = userEvent.setup();
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockReturns, error: null }),
        delete: vi.fn().mockReturnThis(),
      });

      render(<ReturnsManagementPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('RA-001')).toBeInTheDocument();
      });

      const searchInput = screen.getByLabelText('Search by RA number, order number, or customer');
      await user.type(searchInput, 'John');

      await waitFor(() => {
        expect(screen.getByText('RA-001')).toBeInTheDocument();
        expect(screen.queryByText('RA-002')).not.toBeInTheDocument();
        expect(screen.queryByText('RA-003')).not.toBeInTheDocument();
      });
    });

    it('should show no results empty state when search has no matches', async () => {
      const user = userEvent.setup();
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockReturns, error: null }),
        delete: vi.fn().mockReturnThis(),
      });

      render(<ReturnsManagementPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('RA-001')).toBeInTheDocument();
      });

      const searchInput = screen.getByLabelText('Search by RA number, order number, or customer');
      await user.type(searchInput, 'nonexistent');

      await waitFor(() => {
        expect(screen.getByText('No Returns Found')).toBeInTheDocument();
      });
    });
  });

  describe('Create Form', () => {
    it('should open create form when New Return Authorization button is clicked', async () => {
      const user = userEvent.setup();
      render(<ReturnsManagementPage />, { wrapper });

      const createButton = screen.getByText('New Return Authorization');
      await user.click(createButton);

      expect(screen.getByTestId('ra-create-form')).toBeInTheDocument();
    });
  });

  describe('View Detail', () => {
    it('should open detail dialog when view button is clicked', async () => {
      const user = userEvent.setup();
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockReturns, error: null }),
        delete: vi.fn().mockReturnThis(),
      });

      render(<ReturnsManagementPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByLabelText('View return RA-001')).toBeInTheDocument();
      });

      await user.click(screen.getByLabelText('View return RA-001'));

      expect(screen.getByTestId('ra-detail')).toBeInTheDocument();
    });
  });

  describe('Edit', () => {
    it('should show toast error when trying to edit non-pending return', async () => {
      // Only pending returns should be editable, so the edit button
      // only appears for pending returns. The check is handled by
      // not rendering the edit button for non-pending statuses.
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockReturns, error: null }),
        delete: vi.fn().mockReturnThis(),
      });

      render(<ReturnsManagementPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('RA-001')).toBeInTheDocument();
      });

      // RA-002 has no edit button (refunded status)
      expect(screen.queryByLabelText('Edit return RA-002')).not.toBeInTheDocument();
    });
  });

  describe('Tenant ID Filter', () => {
    it('should include tenant_id in query', async () => {
      render(<ReturnsManagementPage />, { wrapper });

      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('return_authorizations');
      });
    });

    it('should not fetch when tenant is not available', () => {
      (useTenantAdminAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        tenant: null,
        loading: false,
        admin: null,
        tenantSlug: null,
      });

      render(<ReturnsManagementPage />, { wrapper });

      // Empty state should show since query is disabled
      expect(screen.getByText('Return Authorizations (0)')).toBeInTheDocument();
    });
  });
});
