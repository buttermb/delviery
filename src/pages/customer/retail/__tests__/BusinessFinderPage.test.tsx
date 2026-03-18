import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test/utils/test-utils';
import userEvent from '@testing-library/user-event';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// Mock safeStorage
vi.mock('@/constants/storageKeys', () => ({
  STORAGE_KEYS: { CUSTOMER_MODE: 'customer_mode' },
  safeStorage: { getItem: vi.fn(() => null), setItem: vi.fn() },
}));

// Mock SEOHead
vi.mock('@/components/SEOHead', () => ({
  SEOHead: () => null,
}));

// Mock ModeBanner
vi.mock('@/components/customer/ModeSwitcher', () => ({
  ModeBanner: ({ currentMode }: { currentMode: string }) => (
    <div data-testid="mode-banner">{currentMode}</div>
  ),
}));

// Mock react-router-dom (keep BrowserRouter from test-utils)
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ slug: 'test-slug' }),
    useNavigate: () => mockNavigate,
  };
});

// Mock CustomerAuthContext
vi.mock('@/contexts/CustomerAuthContext', () => ({
  useCustomerAuth: () => ({
    tenant: { slug: 'test-tenant', id: 'tenant-1' },
    customer: null,
    loading: false,
  }),
}));

// Supabase mock setup
const mockBusinesses = [
  {
    id: 'tenant-1',
    business_name: 'Green Leaf Dispensary',
    slug: 'green-leaf',
    state: 'CA',
    city: 'Los Angeles',
    subscription_status: 'active',
    metadata: {
      business_hours: {
        monday: { enabled: true, open: '09:00', close: '21:00' },
        tuesday: { enabled: true, open: '09:00', close: '21:00' },
        wednesday: { enabled: true, open: '09:00', close: '21:00' },
        thursday: { enabled: true, open: '09:00', close: '21:00' },
        friday: { enabled: true, open: '09:00', close: '21:00' },
        saturday: { enabled: true, open: '10:00', close: '18:00' },
        sunday: { enabled: false, open: '10:00', close: '18:00' },
      },
    },
    white_label: { logo: null, primary_color: '#000' },
  },
  {
    id: 'tenant-2',
    business_name: 'Purple Haze Shop',
    slug: 'purple-haze',
    state: 'CO',
    city: 'Denver',
    subscription_status: 'active',
    metadata: null,
    white_label: { logo: 'https://example.com/logo.png', primary_color: '#800080' },
  },
  {
    id: 'tenant-3',
    business_name: 'Sunset Cannabis',
    slug: 'sunset-cannabis',
    state: 'CA',
    city: 'San Francisco',
    subscription_status: 'active',
    metadata: {
      business_hours: {
        monday: { enabled: false, open: '09:00', close: '17:00' },
        tuesday: { enabled: false, open: '09:00', close: '17:00' },
        wednesday: { enabled: false, open: '09:00', close: '17:00' },
        thursday: { enabled: false, open: '09:00', close: '17:00' },
        friday: { enabled: false, open: '09:00', close: '17:00' },
        saturday: { enabled: false, open: '10:00', close: '16:00' },
        sunday: { enabled: false, open: '10:00', close: '16:00' },
      },
    },
    white_label: { logo: null, primary_color: '#FF6B35' },
  },
];

// Mock delivery zones: only tenant-1 and tenant-3 have active delivery zones
const mockDeliveryZones = [
  { tenant_id: 'tenant-1' },
  { tenant_id: 'tenant-3' },
];

vi.mock('@/integrations/supabase/client', () => {
  // Use a self-referencing proxy approach so any chain method returns itself
  // and acts as a thenable that resolves to the appropriate data
  const createChain = (resolveData: unknown) => {
    const handler: ProxyHandler<Record<string, unknown>> = {
      get(_target, prop) {
        if (prop === 'then') {
          // Make the chain thenable — resolve with { data, error: null }
          return (resolve: (v: unknown) => void) =>
            resolve({ data: resolveData, error: null });
        }
        // Any method call returns the proxy itself (chainable)
        return () => new Proxy({}, handler);
      },
    };
    return new Proxy({}, handler);
  };

  return {
    supabase: {
      from: vi.fn((table: string) => {
        if (table === 'delivery_zones') return createChain(mockDeliveryZones);
        return createChain(mockBusinesses);
      }),
    },
  };
});

// Import component AFTER all mocks
import BusinessFinderPage from '../BusinessFinderPage';

describe('BusinessFinderPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockReset();
  });

  it('renders the page header and search', async () => {
    render(<BusinessFinderPage />);

    await waitFor(() => {
      expect(screen.getByText('Find Businesses')).toBeInTheDocument();
    });
    expect(screen.getByLabelText('Search businesses')).toBeInTheDocument();
  });

  it('renders business cards with names and locations', async () => {
    render(<BusinessFinderPage />);

    await waitFor(() => {
      expect(screen.getByText('Green Leaf Dispensary')).toBeInTheDocument();
    });
    expect(screen.getByText('Purple Haze Shop')).toBeInTheDocument();
    expect(screen.getByText('Sunset Cannabis')).toBeInTheDocument();
    expect(screen.getByText('Los Angeles, CA')).toBeInTheDocument();
    expect(screen.getByText('Denver, CO')).toBeInTheDocument();
  });

  it('shows Delivery badge only for businesses with active delivery zones', async () => {
    render(<BusinessFinderPage />);

    // Wait for both the businesses query AND the delivery zones query to resolve
    await waitFor(() => {
      // tenant-1 and tenant-3 have delivery zones, tenant-2 does not
      const deliveryBadges = screen.getAllByText('Delivery');
      expect(deliveryBadges).toHaveLength(2);
    });
  });

  it('shows Closed badge for businesses without business hours metadata', async () => {
    render(<BusinessFinderPage />);

    await waitFor(() => {
      expect(screen.getByText('Purple Haze Shop')).toBeInTheDocument();
    });

    // Purple Haze has null metadata → should show Closed
    const closedBadges = screen.getAllByText('Closed');
    expect(closedBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('filters businesses by search query', async () => {
    const user = userEvent.setup();
    render(<BusinessFinderPage />);

    await waitFor(() => {
      expect(screen.getByText('Green Leaf Dispensary')).toBeInTheDocument();
    });

    const searchInput = screen.getByLabelText('Search businesses');
    await user.type(searchInput, 'Purple');

    expect(screen.getByText('Purple Haze Shop')).toBeInTheDocument();
    expect(screen.queryByText('Green Leaf Dispensary')).not.toBeInTheDocument();
    expect(screen.queryByText('Sunset Cannabis')).not.toBeInTheDocument();
  });

  it('filters by city in search query', async () => {
    const user = userEvent.setup();
    render(<BusinessFinderPage />);

    await waitFor(() => {
      expect(screen.getByText('Green Leaf Dispensary')).toBeInTheDocument();
    });

    const searchInput = screen.getByLabelText('Search businesses');
    await user.type(searchInput, 'Denver');

    expect(screen.getByText('Purple Haze Shop')).toBeInTheDocument();
    expect(screen.queryByText('Green Leaf Dispensary')).not.toBeInTheDocument();
  });

  it('navigates to business menu on Shop Now click', async () => {
    const user = userEvent.setup();
    render(<BusinessFinderPage />);

    await waitFor(() => {
      expect(screen.getByText('Green Leaf Dispensary')).toBeInTheDocument();
    });

    const shopButtons = screen.getAllByText('Shop Now');
    await user.click(shopButtons[0]);

    expect(mockNavigate).toHaveBeenCalledWith('/test-tenant/shop/retail/businesses/green-leaf/menu');
  });

  it('shows empty state when no businesses match search', async () => {
    const user = userEvent.setup();
    render(<BusinessFinderPage />);

    await waitFor(() => {
      expect(screen.getByText('Green Leaf Dispensary')).toBeInTheDocument();
    });

    const searchInput = screen.getByLabelText('Search businesses');
    await user.type(searchInput, 'nonexistent business xyz');

    expect(screen.getByText('No Businesses Found')).toBeInTheDocument();
    expect(screen.getByText('Try adjusting your search')).toBeInTheDocument();
  });
});

describe('isCurrentlyOpen', () => {
  // We test the logic indirectly through badge rendering
  // since isCurrentlyOpen is a module-level function

  it('shows Closed for business with all days disabled', async () => {
    render(<BusinessFinderPage />);

    await waitFor(() => {
      // Sunset Cannabis has all days disabled → always Closed
      expect(screen.getByText('Sunset Cannabis')).toBeInTheDocument();
    });

    // At least Sunset Cannabis and Purple Haze (no metadata) should be Closed
    const closedBadges = screen.getAllByText('Closed');
    expect(closedBadges.length).toBeGreaterThanOrEqual(2);
  });
});
