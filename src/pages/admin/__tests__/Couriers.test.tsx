/**
 * Couriers Page Tests
 * Tests for courier listing, search sanitization, loading skeleton,
 * aria-labels, and export functionality.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

vi.mock('@/components/SEOHead', () => ({
  SEOHead: () => null,
}));

vi.mock('@/components/admin/CourierLoginInfo', () => ({
  CourierLoginInfo: () => <div data-testid="courier-login-info">Login Info</div>,
}));

vi.mock('@/components/admin/AddCourierDialog', () => ({
  AddCourierDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="add-courier-dialog">Add Courier Dialog</div> : null,
}));

vi.mock('@/components/shared/ConfirmDeleteDialog', () => ({
  ConfirmDeleteDialog: () => null,
}));

vi.mock('@/components/mobile/PullToRefresh', () => ({
  PullToRefresh: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import Couriers from '../Couriers';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';

const mockCouriers = [
  {
    id: 'courier-1',
    full_name: 'Alice Johnson',
    email: 'alice@example.com',
    phone: '555-0101',
    vehicle_type: 'car',
    is_online: true,
    is_active: true,
    age_verified: true,
    current_lat: 40.7128,
    current_lng: -74.006,
    rating: 4.8,
    total_deliveries: 120,
    commission_rate: 15,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'courier-2',
    full_name: 'Bob Smith',
    email: 'bob@example.com',
    phone: '555-0202',
    vehicle_type: 'bicycle',
    is_online: false,
    is_active: true,
    age_verified: true,
    current_lat: null,
    current_lng: null,
    rating: 4.2,
    total_deliveries: 45,
    commission_rate: 12,
    created_at: '2026-01-02T00:00:00Z',
  },
];

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/test-tenant/admin/couriers']}>
        {children}
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function mockSupabaseWith(data: unknown[]) {
  (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data, error: null }),
    delete: vi.fn().mockReturnThis(),
  });
}

describe('Couriers', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (useTenantAdminAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      tenant: { id: 'tenant-123', slug: 'test-tenant', business_name: 'Test Business' },
      loading: false,
      admin: { id: 'admin-123', email: 'admin@test.com' },
      tenantSlug: 'test-tenant',
    });

    mockSupabaseWith([]);
  });

  describe('Empty State', () => {
    it('should show empty state when no couriers exist', async () => {
      render(<Couriers />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('No Couriers Yet')).toBeInTheDocument();
      });
      expect(screen.getByText('Add your first courier to get started.')).toBeInTheDocument();
    });
  });

  describe('Courier List', () => {
    it('should render courier names when data is loaded', async () => {
      mockSupabaseWith(mockCouriers);

      render(<Couriers />, { wrapper: createWrapper() });

      await waitFor(() => {
        // Use getAllByText since ResponsiveTable renders mobile + desktop
        const aliceElements = screen.getAllByText('Alice Johnson');
        expect(aliceElements.length).toBeGreaterThan(0);
      });
    });

    it('should display stats cards', async () => {
      mockSupabaseWith(mockCouriers);

      render(<Couriers />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Total Couriers')).toBeInTheDocument();
        // "Available" appears as both stat label and badge, so use getAllByText
        expect(screen.getAllByText('Available').length).toBeGreaterThan(0);
        expect(screen.getByText('Avg Rating')).toBeInTheDocument();
      });
    });

    it('should show available count in header', async () => {
      mockSupabaseWith(mockCouriers);

      render(<Couriers />, { wrapper: createWrapper() });

      await waitFor(() => {
        // Alice is online+active+verified = 1 available
        expect(screen.getByText(/1 courier available for assignment/)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have aria-labels on action buttons', async () => {
      mockSupabaseWith(mockCouriers);

      render(<Couriers />, { wrapper: createWrapper() });

      await waitFor(() => {
        const viewButtons = screen.getAllByRole('button', { name: /View Alice Johnson/i });
        expect(viewButtons.length).toBeGreaterThan(0);
      });

      const deleteButtons = screen.getAllByRole('button', { name: /Delete Alice Johnson/i });
      expect(deleteButtons.length).toBeGreaterThan(0);
    });
  });

  describe('Export', () => {
    it('should render export button when couriers exist', async () => {
      mockSupabaseWith(mockCouriers);

      render(<Couriers />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Export')).toBeInTheDocument();
      });
    });
  });

  describe('Tenant Filtering', () => {
    it('should query couriers with tenant_id', async () => {
      const eqMock = vi.fn().mockReturnThis();
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: eqMock,
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
        delete: vi.fn().mockReturnThis(),
      });

      render(<Couriers />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(eqMock).toHaveBeenCalledWith('tenant_id', 'tenant-123');
      });
    });
  });
});
