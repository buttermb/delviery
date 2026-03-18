import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import type { DriverProfile } from '@/pages/drivers/DriverProfilePage';
import { OverviewTab } from '../OverviewTab';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockNavigateToAdmin = vi.fn();

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/navigation/tenantNavigation', () => ({
  useTenantNavigation: () => ({
    navigateToAdmin: mockNavigateToAdmin,
    buildAdminUrl: (p: string) => `/test-tenant/admin/${p}`,
    tenantSlug: 'test-tenant',
    navigate: vi.fn(),
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              gte: () => ({
                // count query shape
                then: (cb: (v: { count: number }) => void) => cb({ count: 0 }),
              }),
            }),
            gte: () => ({
              then: (cb: (v: { count: number }) => void) => cb({ count: 0 }),
            }),
            in: () => ({
              limit: () => ({
                maybeSingle: () => Promise.resolve({ data: null, error: null }),
              }),
            }),
            order: () => Promise.resolve({ data: [], error: null }),
          }),
          then: (cb: (v: { data: never[] }) => void) => cb({ data: [] }),
        }),
      }),
    }),
  },
}));

vi.mock('@/lib/queryKeys', () => ({
  queryKeys: {
    couriersAdmin: { byTenant: () => ['couriers'] },
  },
}));

vi.mock('sonner', () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: ({ className }: { className?: string }) => (
    <div data-testid="skeleton" className={className} />
  ),
}));

vi.mock('@/components/ui/lazy-recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Line: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  Tooltip: () => <div />,
  CartesianGrid: () => <div />,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDriver(overrides: Partial<DriverProfile> = {}): DriverProfile {
  return {
    id: 'driver-123',
    user_id: null,
    full_name: 'Test Driver',
    display_name: null,
    email: 'test@example.com',
    phone: '555-0100',
    vehicle_type: null,
    vehicle_make: null,
    vehicle_model: null,
    vehicle_year: null,
    vehicle_color: null,
    vehicle_plate: null,
    zone_id: null,
    zone_name: null,
    status: 'active',
    availability: 'online',
    commission_rate: null,
    is_active: true,
    is_online: true,
    notes: null,
    last_seen_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    suspended_at: null,
    suspended_until: null,
    suspend_reason: null,
    current_lat: 40.7128,
    current_lng: -74.006,
    ...overrides,
  };
}

function renderOverviewTab(driver: DriverProfile = makeDriver()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/test-tenant/admin/drivers/driver-123']}>
        <Routes>
          <Route
            path="/:tenantSlug/admin/drivers/:driverId"
            element={<OverviewTab driver={driver} tenantId="tenant-abc" />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OverviewTab – Open full map button', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the "Open full map" button', () => {
    renderOverviewTab();
    expect(screen.getByText(/Open full map/)).toBeInTheDocument();
  });

  it('navigates to fleet map with driver query param when location is available', () => {
    const driver = makeDriver({ current_lat: 40.7128, current_lng: -74.006 });
    renderOverviewTab(driver);

    fireEvent.click(screen.getByText(/Open full map/));

    expect(mockNavigateToAdmin).toHaveBeenCalledWith('fleet?driver=driver-123');
  });

  it('shows toast when no location data is available', async () => {
    const { toast } = await import('sonner');
    const driver = makeDriver({ current_lat: null, current_lng: null });
    renderOverviewTab(driver);

    fireEvent.click(screen.getByText(/Open full map/));

    expect(mockNavigateToAdmin).not.toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalledWith('No location data available');
  });
});
