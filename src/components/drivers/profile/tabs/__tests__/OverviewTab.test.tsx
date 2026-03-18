/**
 * OverviewTab — Location display tests
 *
 * Verifies the "Last location" card shows:
 *   - "No location data" when lat/lng are null
 *   - Coordinates as immediate fallback while reverse-geocoding
 *   - A human-readable address once Nominatim responds
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

import type { DriverProfile } from '@/pages/drivers/DriverProfilePage';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              gte: () => ({ data: null, count: 0, error: null }),
              in: () => ({
                limit: () => ({
                  maybeSingle: () => ({ data: null, error: null }),
                }),
              }),
            }),
            gte: () => ({ data: null, count: 0, error: null }),
          }),
          gte: () => ({ data: null, count: 0, error: null }),
          data: null,
          count: 0,
          error: null,
        }),
        data: null,
        count: 0,
        error: null,
      }),
    }),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/lib/navigation/tenantNavigation', () => ({
  useTenantNavigation: () => ({
    navigateToAdmin: vi.fn(),
    tenantSlug: 'test-tenant',
  }),
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

vi.mock('sonner', () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDriver(overrides: Partial<DriverProfile> = {}): DriverProfile {
  return {
    id: 'driver-1',
    user_id: null,
    full_name: 'Jane Doe',
    display_name: null,
    email: 'jane@example.com',
    phone: '555-1234',
    vehicle_type: 'car',
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
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    suspended_at: null,
    suspended_until: null,
    suspend_reason: null,
    current_lat: null,
    current_lng: null,
    ...overrides,
  };
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
    },
  });
}

function renderWithProviders(ui: React.ReactElement) {
  const qc = createQueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <BrowserRouter>{ui}</BrowserRouter>
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// Dynamic import so mocks are set up first
const { OverviewTab } = await import('../OverviewTab');

describe('OverviewTab — location display', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('shows "Location unavailable" and "No location data" when lat/lng are null', () => {
    const driver = makeDriver({ current_lat: null, current_lng: null });

    renderWithProviders(<OverviewTab driver={driver} tenantId="t-1" />);

    expect(screen.getByText('Location unavailable')).toBeInTheDocument();
    expect(screen.getByText('No location data')).toBeInTheDocument();
  });

  it('shows coordinates as fallback before reverse geocode resolves', () => {
    // Never-resolving fetch so the query stays pending
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () => new Promise<Response>(() => {}),
    );

    const driver = makeDriver({ current_lat: 40.6782, current_lng: -73.9442 });

    renderWithProviders(<OverviewTab driver={driver} tenantId="t-1" />);

    // While the reverse geocode query is still loading, the fallback shows coords
    expect(screen.getAllByText('40.6782, -73.9442').length).toBeGreaterThanOrEqual(1);
  });

  it('shows reverse-geocoded address when Nominatim responds', async () => {
    const nominatimResponse = {
      display_name: '123 Broadway, Downtown Brooklyn, Kings County, NY, US',
      address: {
        road: 'Broadway',
        neighbourhood: 'Downtown Brooklyn',
        suburb: 'Brooklyn',
        city: 'New York',
        state: 'New York',
      },
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(nominatimResponse), { status: 200 }),
    );

    const driver = makeDriver({ current_lat: 40.6782, current_lng: -73.9442 });

    renderWithProviders(<OverviewTab driver={driver} tenantId="t-1" />);

    // Wait for the reverse geocode query to settle
    await waitFor(() => {
      expect(screen.getAllByText('Downtown Brooklyn, New York').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('falls back to coordinates when Nominatim returns an error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Server Error', { status: 500 }),
    );

    const driver = makeDriver({ current_lat: 40.6782, current_lng: -73.9442 });

    renderWithProviders(<OverviewTab driver={driver} tenantId="t-1" />);

    // After the error, coordinates should still be displayed as fallback
    await waitFor(() => {
      expect(screen.getAllByText('40.6782, -73.9442').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('builds concise label from display_name when address fields are absent', async () => {
    const nominatimResponse = {
      display_name: '789 Ocean Pkwy, Kensington, Brooklyn, Kings County, NY, US',
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(nominatimResponse), { status: 200 }),
    );

    const driver = makeDriver({ current_lat: 40.6501, current_lng: -73.9496 });

    renderWithProviders(<OverviewTab driver={driver} tenantId="t-1" />);

    await waitFor(() => {
      // Should take first 3 parts of display_name
      expect(
        screen.getAllByText('789 Ocean Pkwy, Kensington, Brooklyn').length,
      ).toBeGreaterThanOrEqual(1);
    });
  });
});
