/**
 * OverviewTab Performance Stats Tests
 *
 * Verifies that on-time rate and avg delivery time are fetched from
 * real data sources instead of being hardcoded as null.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { OverviewTab } from '../OverviewTab';

import type { DriverProfile } from '@/pages/drivers/DriverProfilePage';

// ---------------------------------------------------------------------------
// Supabase mock helpers
// ---------------------------------------------------------------------------

type MockChain = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  not: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  lte: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
};

function createChain(terminal?: Record<string, unknown>): MockChain {
  const chain: MockChain = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    not: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    limit: vi.fn(),
    order: vi.fn(),
    maybeSingle: vi.fn(),
  };
  // Each method returns the chain so calls can be chained
  for (const key of Object.keys(chain) as (keyof MockChain)[]) {
    chain[key].mockReturnValue({ ...chain, ...terminal });
  }
  return chain;
}

/** Build a map of table → chain for the `supabase.from()` mock. */
function buildFromMock(tableMap: Record<string, MockChain>) {
  return vi.fn((table: string) => {
    if (table in tableMap) return tableMap[table];
    // Default chain that resolves with empty results
    return createChain({ data: null, count: 0 });
  });
}

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

const mockFrom = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));

vi.mock('@/lib/navigation/tenantNavigation', () => ({
  useTenantNavigation: () => ({ navigateToAdmin: vi.fn() }),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: ({ className }: { className?: string }) =>
    createElement('div', { 'data-testid': 'skeleton', className }),
}));

vi.mock('@/components/ui/lazy-recharts', () => ({
  ResponsiveContainer: ({ children }: { children?: ReactNode }) =>
    createElement('div', { 'data-testid': 'chart-container' }, children),
  LineChart: ({ children }: { children?: ReactNode }) =>
    createElement('div', { 'data-testid': 'line-chart' }, children),
  Line: () => createElement('div'),
  XAxis: () => createElement('div'),
  YAxis: () => createElement('div'),
  Tooltip: () => createElement('div'),
  CartesianGrid: () => createElement('div'),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TENANT_ID = 'test-tenant-id';
const DRIVER_ID = 'driver-abc-123';

const baseDriver: DriverProfile = {
  id: DRIVER_ID,
  user_id: 'user-1',
  full_name: 'Test Driver',
  display_name: 'Test',
  email: 'test@test.com',
  phone: '555-0100',
  vehicle_type: 'car',
  vehicle_make: 'Toyota',
  vehicle_model: 'Camry',
  vehicle_year: 2022,
  vehicle_color: 'Black',
  vehicle_plate: 'ABC123',
  zone_id: null,
  zone_name: null,
  status: 'active',
  availability: 'online',
  commission_rate: 0.15,
  is_active: true,
  is_online: true,
  notes: null,
  last_seen_at: new Date().toISOString(),
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-12-01T00:00:00Z',
  suspended_at: null,
  suspended_until: null,
  suspend_reason: null,
  current_lat: 40.7128,
  current_lng: -74.006,
};

// ---------------------------------------------------------------------------
// Wrapper
// ---------------------------------------------------------------------------

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OverviewTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Performance stats from real data', () => {
    it('displays on-time rate from couriers.on_time_rate', async () => {
      // Set up table-specific chains
      const activityChain = createChain({ data: null, count: 5 });
      const earningsChain = createChain({ data: [{ total_earned: 100 }] });
      const ratingsChain = createChain({ data: [{ rating: 4.5 }] });
      const couriersChain = createChain();
      couriersChain.maybeSingle.mockResolvedValue({
        data: { on_time_rate: 92.3 },
        error: null,
      });
      const metricsChain = createChain({
        data: [
          { avg_delivery_time_minutes: 25, deliveries_completed: 10 },
          { avg_delivery_time_minutes: 30, deliveries_completed: 5 },
        ],
      });
      const ordersChain = createChain({ data: null });
      const ratingTrendChain = createChain({ data: [], error: null });

      mockFrom.mockImplementation((table: string) => {
        switch (table) {
          case 'driver_activity_log': return activityChain;
          case 'courier_earnings': return earningsChain;
          case 'delivery_ratings': return ratingTrendChain;
          case 'couriers': return couriersChain;
          case 'courier_metrics': return metricsChain;
          case 'orders': return ordersChain;
          default: return createChain({ data: null, count: 0 });
        }
      });

      render(createElement(OverviewTab, { driver: baseDriver, tenantId: TENANT_ID }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.queryAllByTestId('skeleton')).toHaveLength(0);
      });

      // on_time_rate = 92.3 → rounded to 92
      expect(screen.getByText('92%')).toBeInTheDocument();
    });

    it('displays on-time rate computed from orders when couriers.on_time_rate is null', async () => {
      const activityChain = createChain({ data: null, count: 0 });
      const earningsChain = createChain({ data: [] });
      const ratingTrendChain = createChain({ data: [], error: null });

      // couriers.on_time_rate is null
      const couriersChain = createChain();
      couriersChain.maybeSingle.mockResolvedValue({
        data: { on_time_rate: null },
        error: null,
      });

      const metricsChain = createChain({ data: [] });

      // Orders fallback: 3 delivered, 2 on-time → 67%
      // Same chain is used for both on-time-rate query and avg-delivery-time
      // fallback since both hit the 'orders' table. The chain returns the same
      // data for all calls, so we use data that works for both computations.
      const ordersChain = createChain({
        data: [
          {
            delivered_at: '2025-06-01T10:00:00Z',
            estimated_delivery: '2025-06-01T11:00:00Z',
            created_at: '2025-06-01T09:30:00Z', // 30 min delivery
          },
          {
            delivered_at: '2025-06-02T10:00:00Z',
            estimated_delivery: '2025-06-02T09:00:00Z', // late
            created_at: '2025-06-02T09:15:00Z', // 45 min delivery
          },
          {
            delivered_at: '2025-06-03T10:00:00Z',
            estimated_delivery: '2025-06-03T12:00:00Z',
            created_at: '2025-06-03T09:20:00Z', // 40 min delivery
          },
        ],
      });

      // For the active-order query (which calls .maybeSingle())
      ordersChain.maybeSingle.mockResolvedValue({ data: null, error: null });

      mockFrom.mockImplementation((table: string) => {
        switch (table) {
          case 'driver_activity_log': return activityChain;
          case 'courier_earnings': return earningsChain;
          case 'delivery_ratings': return ratingTrendChain;
          case 'couriers': return couriersChain;
          case 'courier_metrics': return metricsChain;
          case 'orders': return ordersChain;
          default: return createChain({ data: null, count: 0 });
        }
      });

      render(createElement(OverviewTab, { driver: baseDriver, tenantId: TENANT_ID }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.queryAllByTestId('skeleton')).toHaveLength(0);
      });

      // 2/3 on time = 66.67% → rounded to 67%
      expect(screen.getByText('67%')).toBeInTheDocument();
    });

    it('displays avg delivery time from courier_metrics', async () => {
      const activityChain = createChain({ data: null, count: 3 });
      const earningsChain = createChain({ data: [{ total_earned: 250 }] });
      const ratingsChain = createChain({ data: [{ rating: 5 }] });
      const couriersChain = createChain();
      couriersChain.maybeSingle.mockResolvedValue({
        data: { on_time_rate: 100 },
        error: null,
      });
      // Weighted average: (20*10 + 40*5) / 15 = 400/15 ≈ 27
      const metricsChain = createChain({
        data: [
          { avg_delivery_time_minutes: 20, deliveries_completed: 10 },
          { avg_delivery_time_minutes: 40, deliveries_completed: 5 },
        ],
      });
      const ordersChain = createChain({ data: null });
      const ratingTrendChain = createChain({ data: [], error: null });

      mockFrom.mockImplementation((table: string) => {
        switch (table) {
          case 'driver_activity_log': return activityChain;
          case 'courier_earnings': return earningsChain;
          case 'delivery_ratings': return ratingTrendChain;
          case 'couriers': return couriersChain;
          case 'courier_metrics': return metricsChain;
          case 'orders': return ordersChain;
          default: return createChain({ data: null, count: 0 });
        }
      });

      render(createElement(OverviewTab, { driver: baseDriver, tenantId: TENANT_ID }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.queryAllByTestId('skeleton')).toHaveLength(0);
      });

      // (20*10 + 40*5) / 15 = 26.67 → 27
      expect(screen.getByText('27')).toBeInTheDocument();
    });

    it('shows N/A when no data exists for performance stats', async () => {
      const emptyChain = createChain({ data: null, count: 0 });
      const emptyArrayChain = createChain({ data: [] });
      const couriersChain = createChain();
      couriersChain.maybeSingle.mockResolvedValue({
        data: null,
        error: null,
      });
      const ratingTrendChain = createChain({ data: [], error: null });

      mockFrom.mockImplementation((table: string) => {
        switch (table) {
          case 'driver_activity_log': return emptyChain;
          case 'courier_earnings': return emptyArrayChain;
          case 'delivery_ratings': return ratingTrendChain;
          case 'couriers': return couriersChain;
          case 'courier_metrics': return emptyArrayChain;
          case 'orders': return createChain({ data: null });
          default: return createChain({ data: null, count: 0 });
        }
      });

      render(createElement(OverviewTab, { driver: baseDriver, tenantId: TENANT_ID }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.queryAllByTestId('skeleton')).toHaveLength(0);
      });

      // Both on-time rate and avg delivery time should display N/A
      const naElements = screen.getAllByText('N/A');
      expect(naElements.length).toBe(2);
    });

    it('queries couriers table with tenant_id filter', async () => {
      const couriersChain = createChain();
      couriersChain.maybeSingle.mockResolvedValue({
        data: { on_time_rate: 85 },
        error: null,
      });
      const defaultChain = createChain({ data: null, count: 0 });
      const emptyArrayChain = createChain({ data: [] });
      const ratingTrendChain = createChain({ data: [], error: null });

      mockFrom.mockImplementation((table: string) => {
        switch (table) {
          case 'couriers': return couriersChain;
          case 'delivery_ratings': return ratingTrendChain;
          case 'courier_earnings': return emptyArrayChain;
          case 'courier_metrics': return emptyArrayChain;
          default: return defaultChain;
        }
      });

      render(createElement(OverviewTab, { driver: baseDriver, tenantId: TENANT_ID }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        // Verify couriers table was queried
        expect(mockFrom).toHaveBeenCalledWith('couriers');
      });

      // Verify tenant_id and driver id were passed as eq filters
      expect(couriersChain.eq).toHaveBeenCalledWith('id', DRIVER_ID);
      expect(couriersChain.eq).toHaveBeenCalledWith('tenant_id', TENANT_ID);
    });

    it('queries courier_metrics table for avg delivery time', async () => {
      const metricsChain = createChain({
        data: [{ avg_delivery_time_minutes: 35, deliveries_completed: 8 }],
      });
      const couriersChain = createChain();
      couriersChain.maybeSingle.mockResolvedValue({
        data: { on_time_rate: 90 },
        error: null,
      });
      const defaultChain = createChain({ data: null, count: 0 });
      const emptyArrayChain = createChain({ data: [] });
      const ratingTrendChain = createChain({ data: [], error: null });

      mockFrom.mockImplementation((table: string) => {
        switch (table) {
          case 'courier_metrics': return metricsChain;
          case 'couriers': return couriersChain;
          case 'delivery_ratings': return ratingTrendChain;
          case 'courier_earnings': return emptyArrayChain;
          default: return defaultChain;
        }
      });

      render(createElement(OverviewTab, { driver: baseDriver, tenantId: TENANT_ID }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(mockFrom).toHaveBeenCalledWith('courier_metrics');
      });

      // Verify courier_id filter was applied
      expect(metricsChain.eq).toHaveBeenCalledWith('courier_id', DRIVER_ID);
    });
  });

  describe('Rendering', () => {
    it('renders loading skeletons initially', () => {
      const defaultChain = createChain({ data: null, count: 0 });
      mockFrom.mockReturnValue(defaultChain);

      render(createElement(OverviewTab, { driver: baseDriver, tenantId: TENANT_ID }), {
        wrapper: createWrapper(),
      });

      expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
    });

    it('renders delivery stat labels', () => {
      const defaultChain = createChain({ data: null, count: 0 });
      mockFrom.mockReturnValue(defaultChain);

      render(createElement(OverviewTab, { driver: baseDriver, tenantId: TENANT_ID }), {
        wrapper: createWrapper(),
      });

      expect(screen.getByText('Deliveries Today')).toBeInTheDocument();
      expect(screen.getByText('This Week')).toBeInTheDocument();
      expect(screen.getByText('This Month')).toBeInTheDocument();
      expect(screen.getByText('All Time')).toBeInTheDocument();
    });

    it('renders performance stat labels', () => {
      const defaultChain = createChain({ data: null, count: 0 });
      mockFrom.mockReturnValue(defaultChain);

      render(createElement(OverviewTab, { driver: baseDriver, tenantId: TENANT_ID }), {
        wrapper: createWrapper(),
      });

      expect(screen.getByText('Total Earned')).toBeInTheDocument();
      expect(screen.getByText('Avg Rating')).toBeInTheDocument();
      expect(screen.getByText('On-Time Rate')).toBeInTheDocument();
      expect(screen.getByText('Avg Delivery Time')).toBeInTheDocument();
    });
  });
});
