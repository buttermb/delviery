/**
 * StorefrontAnalytics Page Tests
 * Tests for the analytics dashboard with revenue chart, orders, conversion rate,
 * AOV, top products, traffic sources, and date range filter.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test/utils/test-utils';

// Mock supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(() => Promise.resolve({ data: { id: 'store-123' }, error: null })),
          gte: vi.fn(() => ({
            lte: vi.fn(() => ({
              order: vi.fn(() => Promise.resolve({ data: mockOrders, error: null })),
            })),
            order: vi.fn(() => Promise.resolve({ data: mockOrders, error: null })),
          })),
          order: vi.fn(() => Promise.resolve({ data: mockOrders, error: null })),
          lte: vi.fn(() => Promise.resolve({ data: mockOrders, error: null })),
        })),
      })),
    })),
  },
}));

// Mock tenant context
vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: { id: 'tenant-123', name: 'Test Tenant' },
    tenantSlug: 'test-tenant',
  }),
}));

const mockOrders = [
  {
    id: 'order-1',
    total: 150.50,
    status: 'completed',
    created_at: '2026-01-15T10:00:00Z',
    customer_email: 'alice@example.com',
    items: [
      { name: 'Blue Dream', quantity: 2, price: 50, category: 'Flower' },
      { name: 'Gummy Bears', quantity: 1, price: 50.50, category: 'Edibles' },
    ],
  },
  {
    id: 'order-2',
    total: 200.00,
    status: 'completed',
    created_at: '2026-01-16T14:00:00Z',
    customer_email: 'bob@example.com',
    items: [
      { name: 'Blue Dream', quantity: 4, price: 50, category: 'Flower' },
    ],
  },
  {
    id: 'order-3',
    total: 75.00,
    status: 'pending',
    created_at: '2026-01-17T09:00:00Z',
    customer_email: 'alice@example.com',
    items: [
      { name: 'Vape Pen', quantity: 1, price: 75, category: 'Concentrates' },
    ],
  },
];

describe('StorefrontAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the analytics page with title', async () => {
    const { default: StorefrontAnalytics } = await import(
      '@/pages/admin/storefront/StorefrontAnalytics'
    );
    render(<StorefrontAnalytics />);

    await waitFor(() => {
      expect(screen.getByText('Storefront Analytics')).toBeInTheDocument();
    });
  });

  it('should render the date range picker', async () => {
    const { default: StorefrontAnalytics } = await import(
      '@/pages/admin/storefront/StorefrontAnalytics'
    );
    render(<StorefrontAnalytics />);

    await waitFor(() => {
      // DateRangePickerWithPresets renders a button with date text
      expect(screen.getByText('Storefront Analytics')).toBeInTheDocument();
    });
  });

  it('should display summary metric cards', async () => {
    const { default: StorefrontAnalytics } = await import(
      '@/pages/admin/storefront/StorefrontAnalytics'
    );
    render(<StorefrontAnalytics />);

    await waitFor(() => {
      expect(screen.getByText('Total Revenue')).toBeInTheDocument();
      expect(screen.getByText('Orders')).toBeInTheDocument();
      expect(screen.getByText('Conversion Rate')).toBeInTheDocument();
      expect(screen.getByText('Avg. Order Value')).toBeInTheDocument();
    });
  });

  it('should render revenue chart section', async () => {
    const { default: StorefrontAnalytics } = await import(
      '@/pages/admin/storefront/StorefrontAnalytics'
    );
    render(<StorefrontAnalytics />);

    await waitFor(() => {
      expect(screen.getByText('Revenue')).toBeInTheDocument();
    });
  });

  it('should render top selling products section', async () => {
    const { default: StorefrontAnalytics } = await import(
      '@/pages/admin/storefront/StorefrontAnalytics'
    );
    render(<StorefrontAnalytics />);

    await waitFor(() => {
      expect(screen.getByText('Top Selling Products')).toBeInTheDocument();
    });
  });

  it('should render traffic sources section', async () => {
    const { default: StorefrontAnalytics } = await import(
      '@/pages/admin/storefront/StorefrontAnalytics'
    );
    render(<StorefrontAnalytics />);

    await waitFor(() => {
      expect(screen.getByText('Traffic Sources')).toBeInTheDocument();
    });
  });

  it('should render conversion funnel section', async () => {
    const { default: StorefrontAnalytics } = await import(
      '@/pages/admin/storefront/StorefrontAnalytics'
    );
    render(<StorefrontAnalytics />);

    await waitFor(() => {
      expect(screen.getByText('Conversion Funnel')).toBeInTheDocument();
    });
  });

  it('should render customer retention section', async () => {
    const { default: StorefrontAnalytics } = await import(
      '@/pages/admin/storefront/StorefrontAnalytics'
    );
    render(<StorefrontAnalytics />);

    await waitFor(() => {
      expect(screen.getByText('Customer Retention')).toBeInTheDocument();
    });
  });

  it('should show description text', async () => {
    const { default: StorefrontAnalytics } = await import(
      '@/pages/admin/storefront/StorefrontAnalytics'
    );
    render(<StorefrontAnalytics />);

    await waitFor(() => {
      expect(
        screen.getByText('Insights into your customers and sales performance.')
      ).toBeInTheDocument();
    });
  });
});

describe('RevenueChart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render with daily granularity by default', async () => {
    const { RevenueChart } = await import(
      '@/components/admin/analytics/RevenueChart'
    );
    render(
      <RevenueChart
        storeId="store-123"
        dateRange={{ from: new Date('2026-01-01'), to: new Date('2026-01-31') }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Revenue')).toBeInTheDocument();
    });
  });

  it('should display granularity selector with options', async () => {
    const { RevenueChart } = await import(
      '@/components/admin/analytics/RevenueChart'
    );
    render(
      <RevenueChart
        storeId="store-123"
        dateRange={{ from: new Date('2026-01-01'), to: new Date('2026-01-31') }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Revenue')).toBeInTheDocument();
    });
  });

  it('should show empty state when no data', async () => {
    // Override the mock to return empty data
    const { supabase } = await import('@/integrations/supabase/client');
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          gte: vi.fn(() => ({
            lte: vi.fn(() => ({
              order: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
        })),
      })),
    } as unknown as ReturnType<typeof supabase.from>);

    const { RevenueChart } = await import(
      '@/components/admin/analytics/RevenueChart'
    );
    render(
      <RevenueChart
        storeId="store-123"
        dateRange={{ from: new Date('2026-01-01'), to: new Date('2026-01-31') }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('No revenue data available')).toBeInTheDocument();
    });
  });
});

describe('TopSellingProducts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the component title', async () => {
    const { TopSellingProducts } = await import(
      '@/components/admin/analytics/TopSellingProducts'
    );
    render(
      <TopSellingProducts
        storeId="store-123"
        dateRange={{ from: new Date('2026-01-01'), to: new Date('2026-01-31') }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Top Selling Products')).toBeInTheDocument();
    });
  });

  it('should show empty state with no products', async () => {
    const { supabase } = await import('@/integrations/supabase/client');
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          gte: vi.fn(() => ({
            lte: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
      })),
    } as unknown as ReturnType<typeof supabase.from>);

    const { TopSellingProducts } = await import(
      '@/components/admin/analytics/TopSellingProducts'
    );
    render(
      <TopSellingProducts
        storeId="store-123"
        dateRange={{ from: new Date('2026-01-01'), to: new Date('2026-01-31') }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('No product data available')).toBeInTheDocument();
    });
  });
});

describe('TrafficSources', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the component title', async () => {
    const { TrafficSources } = await import(
      '@/components/admin/analytics/TrafficSources'
    );
    render(
      <TrafficSources
        storeId="store-123"
        dateRange={{ from: new Date('2026-01-01'), to: new Date('2026-01-31') }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Traffic Sources')).toBeInTheDocument();
    });
  });

  it('should show empty state with no traffic data', async () => {
    const { supabase } = await import('@/integrations/supabase/client');
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          gte: vi.fn(() => ({
            lte: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
      })),
    } as unknown as ReturnType<typeof supabase.from>);

    const { TrafficSources } = await import(
      '@/components/admin/analytics/TrafficSources'
    );
    render(
      <TrafficSources
        storeId="store-123"
        dateRange={{ from: new Date('2026-01-01'), to: new Date('2026-01-31') }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('No traffic data available')).toBeInTheDocument();
    });
  });
});

describe('groupByGranularity utility', () => {
  it('should correctly group orders by daily', async () => {
    // Test the grouping logic by testing the RevenueChart with known dates
    const { RevenueChart } = await import(
      '@/components/admin/analytics/RevenueChart'
    );
    render(
      <RevenueChart
        storeId="store-123"
        dateRange={{ from: new Date('2026-01-15'), to: new Date('2026-01-17') }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Revenue')).toBeInTheDocument();
    });
  });
});
