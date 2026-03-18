/**
 * AuditTrail Tests
 * Tests for audit trail page with search, filtering, and pagination
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock dependencies before importing the component
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
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

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@/lib/formatters', () => ({
  formatSmartDate: vi.fn().mockReturnValue('Mar 18, 2026 10:30 AM'),
}));

// Import after mocks
import AuditTrail from '../AuditTrail';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={createQueryClient()}>
    <MemoryRouter initialEntries={['/test-tenant/admin/audit-trail']}>
      {children}
    </MemoryRouter>
  </QueryClientProvider>
);

const mockAuditLogs = [
  {
    id: 'log-1',
    action: 'product.created',
    user_email: 'admin@test.com',
    description: 'Created product "Blue Dream"',
    entity_type: 'product',
    created_at: '2026-03-18T10:30:00Z',
  },
  {
    id: 'log-2',
    action: 'order.status_updated',
    user_email: 'staff@test.com',
    description: 'Order #123 status changed to delivered',
    entity_type: 'order',
    created_at: '2026-03-18T09:15:00Z',
  },
  {
    id: 'log-3',
    action: 'product.updated',
    user_email: 'admin@test.com',
    description: 'Updated product price',
    entity_type: 'product',
    created_at: '2026-03-17T14:00:00Z',
  },
  {
    id: 'log-4',
    action: 'customer.deleted',
    user_email: 'admin@test.com',
    description: 'Deleted customer record',
    entity_type: 'customer',
    created_at: '2026-03-17T11:00:00Z',
  },
];

function setupSupabaseMock(data: unknown[] = [], error: unknown = null) {
  const limitMock = vi.fn().mockResolvedValue({ data, error });
  const orderMock = vi.fn().mockReturnValue({ limit: limitMock });
  const eqMock = vi.fn().mockReturnValue({ order: orderMock });
  const selectMock = vi.fn().mockReturnValue({ eq: eqMock });

  (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
    select: selectMock,
    eq: eqMock,
    order: orderMock,
    limit: limitMock,
  });

  return { selectMock, eqMock, orderMock, limitMock };
}

describe('AuditTrail', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (useTenantAdminAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      tenant: { id: 'tenant-123', slug: 'test-tenant', business_name: 'Test Business' },
      loading: false,
      admin: { id: 'admin-123', email: 'admin@test.com' },
      tenantSlug: 'test-tenant',
    });

    setupSupabaseMock();
  });

  describe('Initial Render', () => {
    it('should render page title and description', async () => {
      render(<AuditTrail />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Audit Trail')).toBeInTheDocument();
        expect(
          screen.getByText('Complete history of system changes and user actions')
        ).toBeInTheDocument();
      });
    });

    it('should render search input', async () => {
      render(<AuditTrail />, { wrapper });

      await waitFor(() => {
        expect(
          screen.getByLabelText('Search by action, user, or description')
        ).toBeInTheDocument();
      });
    });

    it('should render action filter dropdown', async () => {
      render(<AuditTrail />, { wrapper });

      await waitFor(() => {
        expect(screen.getByLabelText('Filter by action type')).toBeInTheDocument();
      });
    });

    it('should show empty state when no logs exist', async () => {
      render(<AuditTrail />, { wrapper });

      await waitFor(() => {
        expect(
          screen.getByText('No audit logs recorded yet. Activity will appear here as actions are performed.')
        ).toBeInTheDocument();
      });
    });
  });

  describe('Data Loading', () => {
    it('should display audit logs when data is loaded', async () => {
      setupSupabaseMock(mockAuditLogs);

      render(<AuditTrail />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('product.created')).toBeInTheDocument();
        expect(screen.getByText('Created product "Blue Dream"')).toBeInTheDocument();
        expect(screen.getAllByText('admin@test.com').length).toBeGreaterThanOrEqual(1);
      });
    });

    it('should show entity type badges', async () => {
      setupSupabaseMock(mockAuditLogs);

      render(<AuditTrail />, { wrapper });

      await waitFor(() => {
        const badges = screen.getAllByText('product');
        expect(badges.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('should show event count in card description', async () => {
      setupSupabaseMock(mockAuditLogs);

      render(<AuditTrail />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('4 events')).toBeInTheDocument();
      });
    });
  });

  describe('Tenant Isolation', () => {
    it('should filter audit logs by tenant_id', async () => {
      const { eqMock } = setupSupabaseMock();

      render(<AuditTrail />, { wrapper });

      await waitFor(() => {
        expect(eqMock).toHaveBeenCalledWith('tenant_id', 'tenant-123');
      });
    });

    it('should not load logs when tenant is missing', async () => {
      (useTenantAdminAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        tenant: null,
        loading: false,
        admin: { id: 'admin-123', email: 'admin@test.com' },
        tenantSlug: 'test-tenant',
      });

      const fromMock = vi.fn();
      (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(fromMock);

      render(<AuditTrail />, { wrapper });

      await waitFor(() => {
        expect(fromMock).not.toHaveBeenCalled();
      });
    });
  });

  describe('Search', () => {
    it('should filter logs by search term matching action', async () => {
      setupSupabaseMock(mockAuditLogs);
      const user = userEvent.setup();

      render(<AuditTrail />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('product.created')).toBeInTheDocument();
      });

      const searchInput = screen.getByLabelText('Search by action, user, or description');
      await user.type(searchInput, 'product');

      await waitFor(() => {
        expect(screen.getByText('product.created')).toBeInTheDocument();
        expect(screen.getByText('product.updated')).toBeInTheDocument();
        expect(screen.queryByText('order.status_updated')).not.toBeInTheDocument();
      });
    });

    it('should show no results message when search finds nothing', async () => {
      setupSupabaseMock(mockAuditLogs);
      const user = userEvent.setup();

      render(<AuditTrail />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('product.created')).toBeInTheDocument();
      });

      const searchInput = screen.getByLabelText('Search by action, user, or description');
      await user.type(searchInput, 'nonexistent');

      await waitFor(() => {
        expect(screen.getByText('No audit logs matching your filters')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle table-not-found error gracefully', async () => {
      const limitMock = vi.fn().mockResolvedValue({
        data: null,
        error: { code: '42P01', message: 'relation does not exist' },
      });
      const orderMock = vi.fn().mockReturnValue({ limit: limitMock });
      const eqMock = vi.fn().mockReturnValue({ order: orderMock });
      const selectMock = vi.fn().mockReturnValue({ eq: eqMock });

      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: selectMock,
        eq: eqMock,
        order: orderMock,
        limit: limitMock,
      });

      render(<AuditTrail />, { wrapper });

      await waitFor(() => {
        expect(
          screen.getByText('No audit logs recorded yet. Activity will appear here as actions are performed.')
        ).toBeInTheDocument();
      });
    });
  });

  describe('Fallback Values', () => {
    it('should show "Unknown action" when action is null', async () => {
      setupSupabaseMock([
        {
          id: 'log-no-action',
          action: null,
          user_email: 'admin@test.com',
          description: 'Something happened',
          entity_type: 'system',
          created_at: '2026-03-18T10:00:00Z',
        },
      ]);

      render(<AuditTrail />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Unknown action')).toBeInTheDocument();
      });
    });

    it('should show "System" when user_email is null', async () => {
      setupSupabaseMock([
        {
          id: 'log-no-email',
          action: 'system.cleanup',
          user_email: null,
          description: 'Automated cleanup',
          entity_type: 'system',
          created_at: '2026-03-18T10:00:00Z',
        },
      ]);

      render(<AuditTrail />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('System')).toBeInTheDocument();
      });
    });

    it('should show "system" badge when entity_type is null', async () => {
      setupSupabaseMock([
        {
          id: 'log-no-entity',
          action: 'config.updated',
          user_email: 'admin@test.com',
          description: 'Updated config',
          entity_type: null,
          created_at: '2026-03-18T10:00:00Z',
        },
      ]);

      render(<AuditTrail />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('system')).toBeInTheDocument();
      });
    });
  });
});
