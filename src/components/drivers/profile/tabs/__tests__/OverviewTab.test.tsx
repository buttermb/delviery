import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

import type { DriverProfile } from '@/pages/drivers/DriverProfilePage';
import { OverviewTab } from '../OverviewTab';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockNavigateToAdmin = vi.fn();

vi.mock('@/lib/navigation/tenantNavigation', () => ({
  useTenantNavigation: () => ({
    navigateToAdmin: mockNavigateToAdmin,
    buildAdminUrl: (path: string) => `/test-tenant/admin/${path}`,
    tenantSlug: 'test-tenant',
    navigate: vi.fn(),
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock recharts to avoid rendering issues in tests
vi.mock('@/components/ui/lazy-recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  CartesianGrid: () => null,
}));

// Supabase mock with configurable responses
const mockActiveOrderData = {
  id: 'order-abc-123',
  order_number: 'ORD-999',
  status: 'in_transit',
  customer_name: 'Jane Doe',
  delivery_address: '456 Oak Ave',
  merchants: { address: '123 Main St' },
};

let mockFromResponses: Record<string, unknown> = {};

function createChainableMock(finalValue: unknown) {
  const chain: Record<string, unknown> = {};
  const handler = {
    get(_target: unknown, prop: string): unknown {
      if (prop === 'then') return undefined; // not a promise
      // Terminal methods return the final value
      if (prop === 'maybeSingle' || prop === 'single') {
        return () => Promise.resolve(finalValue);
      }
      // count-style queries
      if (typeof finalValue === 'object' && finalValue !== null && 'count' in (finalValue as Record<string, unknown>) && prop === 'gte') {
        return () => Promise.resolve(finalValue);
      }
      // Continue chaining
      return () => new Proxy(chain, handler);
    },
  };
  return new Proxy(chain, handler);
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      if (mockFromResponses[table]) {
        return createChainableMock(mockFromResponses[table]);
      }
      // Default: return empty/zero
      return createChainableMock({ data: null, error: null, count: 0 });
    },
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

const baseDriver: DriverProfile = {
  id: 'driver-001',
  user_id: 'user-001',
  full_name: 'John Driver',
  display_name: 'Johnny',
  email: 'john@example.com',
  phone: '+1234567890',
  vehicle_type: 'car',
  vehicle_make: 'Toyota',
  vehicle_model: 'Camry',
  vehicle_year: 2022,
  vehicle_color: 'Blue',
  vehicle_plate: 'ABC-1234',
  zone_id: 'zone-1',
  zone_name: 'Zone A',
  status: 'active',
  availability: 'on_delivery',
  commission_rate: 15,
  is_active: true,
  is_online: true,
  notes: null,
  last_seen_at: new Date().toISOString(),
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  suspended_at: null,
  suspended_until: null,
  suspend_reason: null,
  current_lat: 40.7128,
  current_lng: -74.006,
};

function renderOverviewTab(driver: DriverProfile = baseDriver) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/test-tenant/admin/drivers/driver-001']}>
        <Routes>
          <Route
            path="/:tenantSlug/admin/drivers/:driverId"
            element={<OverviewTab driver={driver} tenantId="tenant-001" />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OverviewTab - View Order Details button', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFromResponses = {
      orders: { data: mockActiveOrderData, error: null },
      driver_activity_log: { data: null, error: null, count: 0 },
      courier_earnings: { data: [], error: null },
      delivery_ratings: { data: [], error: null },
    };
  });

  it('renders "View Order Details" button when active order exists', async () => {
    renderOverviewTab();

    await waitFor(() => {
      expect(screen.getByText('View Order Details')).toBeInTheDocument();
    });
  });

  it('navigates to order detail page on click', async () => {
    const user = userEvent.setup();
    renderOverviewTab();

    await waitFor(() => {
      expect(screen.getByText('View Order Details')).toBeInTheDocument();
    });

    await user.click(screen.getByText('View Order Details'));

    expect(mockNavigateToAdmin).toHaveBeenCalledWith('orders/order-abc-123');
  });

  it('shows active order number and customer name', async () => {
    renderOverviewTab();

    await waitFor(() => {
      expect(screen.getByText('ORD-999')).toBeInTheDocument();
    });
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
  });

  it('does not render button when no active delivery', async () => {
    mockFromResponses = {
      ...mockFromResponses,
      orders: { data: null, error: null },
    };

    renderOverviewTab();

    // Wait for queries to settle
    await waitFor(() => {
      expect(screen.getByText('No active delivery')).toBeInTheDocument();
    });

    expect(screen.queryByText('View Order Details')).not.toBeInTheDocument();
  });

  it('shows driver availability when no active delivery', async () => {
    mockFromResponses = {
      ...mockFromResponses,
      orders: { data: null, error: null },
    };

    const offlineDriver = { ...baseDriver, availability: 'offline' as const };
    renderOverviewTab(offlineDriver);

    await waitFor(() => {
      expect(screen.getByText('No active delivery')).toBeInTheDocument();
    });
    expect(screen.getByText(/offline/i)).toBeInTheDocument();
  });
});
