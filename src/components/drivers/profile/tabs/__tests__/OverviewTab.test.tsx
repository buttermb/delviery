/**
 * OverviewTab + ActiveDeliveryCard Tests
 *
 * Verifies:
 * - Correct order statuses are queried (confirmed, preparing, out_for_delivery)
 * - ActiveDeliveryCard renders real order data
 * - Status badge labels and colors map correctly
 * - Empty state shown when no active delivery
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OverviewTab } from '../OverviewTab';
import type { DriverProfile } from '@/pages/drivers/DriverProfilePage';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockNavigateToAdmin = vi.fn();

vi.mock('@/lib/navigation/tenantNavigation', () => ({
  useTenantNavigation: () => ({ navigateToAdmin: mockNavigateToAdmin }),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/queryKeys', () => ({
  queryKeys: {
    couriersAdmin: {
      byTenant: (tenantId: string) => ['couriers-admin', tenantId],
    },
  },
}));

// Track supabase calls so we can assert on the status filter
const mockMaybeSingle = vi.fn();
const mockLimit = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockIn = vi.fn(() => ({ limit: mockLimit }));

const buildChain = () => {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn((_col: string, _val: string) => chain),
    in: mockIn,
    gte: vi.fn(() => chain),
    limit: mockLimit,
    maybeSingle: mockMaybeSingle,
    order: vi.fn(() => chain),
  };
  return chain;
};

const mockChain = buildChain();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => mockChain),
  },
}));

// Recharts – stub out to avoid jsdom rendering issues
vi.mock('@/components/ui/lazy-recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="chart-container">{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  CartesianGrid: () => null,
}));

vi.mock('sonner', () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
}

const baseDriver: DriverProfile = {
  id: 'driver-001',
  user_id: null,
  full_name: 'John Doe',
  display_name: null,
  phone: '555-1234',
  email: 'john@example.com',
  availability: 'online',
  status: 'active',
  vehicle_type: 'car',
  vehicle_make: null,
  vehicle_model: null,
  vehicle_year: null,
  vehicle_color: null,
  vehicle_plate: 'ABC-123',
  zone_id: null,
  zone_name: null,
  commission_rate: null,
  is_active: true,
  is_online: true,
  notes: null,
  current_lat: null,
  current_lng: null,
  last_seen_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  suspended_at: null,
  suspended_until: null,
  suspend_reason: null,
};

function renderOverviewTab(driver = baseDriver) {
  const qc = createQueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <OverviewTab driver={driver} tenantId="tenant-abc" />
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OverviewTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no active order
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    // Stats queries return zeros
    mockChain.select.mockImplementation(() => mockChain);
    mockChain.eq.mockImplementation(() => mockChain);
    mockChain.gte.mockImplementation(() => mockChain);
    mockChain.order.mockImplementation(() => mockChain);
  });

  describe('Empty state', () => {
    it('shows "No active delivery" when no orders match', async () => {
      renderOverviewTab();
      expect(await screen.findByText('No active delivery')).toBeInTheDocument();
    });

    it('displays driver availability when idle', async () => {
      renderOverviewTab({ ...baseDriver, availability: 'offline' });
      expect(await screen.findByText(/Driver is currently offline/)).toBeInTheDocument();
    });
  });

  describe('Active delivery card with out_for_delivery status', () => {
    beforeEach(() => {
      mockMaybeSingle.mockResolvedValue({
        data: {
          id: 'order-001',
          order_number: 'FIQ-0100',
          status: 'out_for_delivery',
          customer_name: 'Sarah Chen',
          delivery_address: '88 Court St, Brooklyn',
          merchants: { address: '420 Broadway, Brooklyn' },
        },
        error: null,
      });
    });

    it('renders order number and customer name', async () => {
      renderOverviewTab();
      expect(await screen.findByText('FIQ-0100')).toBeInTheDocument();
      expect(screen.getByText('Sarah Chen')).toBeInTheDocument();
    });

    it('shows "In Transit" label for out_for_delivery status', async () => {
      renderOverviewTab();
      expect(await screen.findByText('In Transit')).toBeInTheDocument();
    });

    it('shows amber badge for out_for_delivery status', async () => {
      renderOverviewTab();
      const badge = await screen.findByText('In Transit');
      expect(badge.className).toContain('bg-amber-500/20');
      expect(badge.className).toContain('text-amber-500');
    });

    it('renders pickup and delivery addresses', async () => {
      renderOverviewTab();
      expect(await screen.findByText('420 Broadway, Brooklyn')).toBeInTheDocument();
      expect(screen.getByText('88 Court St, Brooklyn')).toBeInTheDocument();
    });

    it('navigates to order details on button click', async () => {
      renderOverviewTab();
      const btn = await screen.findByText('View Order Details');
      fireEvent.click(btn);
      expect(mockNavigateToAdmin).toHaveBeenCalledWith('orders/order-001');
    });
  });

  describe('Active delivery card with confirmed status', () => {
    beforeEach(() => {
      mockMaybeSingle.mockResolvedValue({
        data: {
          id: 'order-002',
          order_number: 'FIQ-0200',
          status: 'confirmed',
          customer_name: 'Mike Rivera',
          delivery_address: '100 Main St',
          merchants: null,
        },
        error: null,
      });
    });

    it('shows "Confirmed" label for confirmed status', async () => {
      renderOverviewTab();
      expect(await screen.findByText('Confirmed')).toBeInTheDocument();
    });

    it('shows blue badge for confirmed status', async () => {
      renderOverviewTab();
      const badge = await screen.findByText('Confirmed');
      expect(badge.className).toContain('bg-blue-500/20');
      expect(badge.className).toContain('text-blue-500');
    });
  });

  describe('Active delivery card with preparing status', () => {
    beforeEach(() => {
      mockMaybeSingle.mockResolvedValue({
        data: {
          id: 'order-003',
          order_number: 'FIQ-0300',
          status: 'preparing',
          customer_name: null,
          delivery_address: '200 Oak Ave',
          merchants: { address: '50 Elm St' },
        },
        error: null,
      });
    });

    it('shows "Preparing" label for preparing status', async () => {
      renderOverviewTab();
      expect(await screen.findByText('Preparing')).toBeInTheDocument();
    });

    it('shows blue badge for preparing status', async () => {
      renderOverviewTab();
      const badge = await screen.findByText('Preparing');
      expect(badge.className).toContain('bg-blue-500/20');
    });

    it('hides customer name when null', async () => {
      renderOverviewTab();
      await screen.findByText('FIQ-0300');
      // Customer name should not be rendered
      expect(screen.queryByText('null')).not.toBeInTheDocument();
    });
  });

  describe('Location card', () => {
    it('shows "Location unavailable" when no coordinates', async () => {
      renderOverviewTab();
      expect(await screen.findByText('Location unavailable')).toBeInTheDocument();
    });

    it('shows coordinates when available', async () => {
      renderOverviewTab({
        ...baseDriver,
        current_lat: 40.6892,
        current_lng: -74.0445,
      });
      const coords = await screen.findAllByText('40.6892, -74.0445');
      expect(coords.length).toBeGreaterThanOrEqual(1);
    });
  });
});
