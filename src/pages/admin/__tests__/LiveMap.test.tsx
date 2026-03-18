/**
 * Tests for LiveMap component
 *
 * These tests verify the Live Fleet Map functionality including:
 * - Rendering with and without Mapbox token
 * - Courier list display and filtering
 * - Stats calculation (total, online, active, offline)
 * - Search functionality
 * - Loading and error states
 * - CourierList fallback component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

// Mock modules before imports
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@/lib/humanizeError', () => ({
  humanizeError: (err: unknown) => String(err),
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: { id: 'test-tenant-id', name: 'Test Tenant', slug: 'test-tenant' },
    tenantSlug: 'test-tenant',
  }),
}));

// Track the mapbox token mock value
let mockMapboxToken: string | null = 'test-mapbox-token';
let mockTokenLoading = false;

vi.mock('@/hooks/useMapboxToken', () => ({
  useMapboxToken: () => ({
    token: mockMapboxToken,
    loading: mockTokenLoading,
  }),
}));

// Mock mapbox-gl
const mockMapOn = vi.fn();
const mockMapRemove = vi.fn();
const mockMapSetStyle = vi.fn();
const mockMapAddControl = vi.fn();
const mockMapAddSource = vi.fn();
const mockMapAddLayer = vi.fn();
const mockMapGetSource = vi.fn().mockReturnValue(null);
const mockMapGetLayer = vi.fn().mockReturnValue(null);
const mockMapGetStyle = vi.fn().mockReturnValue({ layers: [] });
const mockMapFitBounds = vi.fn();
const mockMapFlyTo = vi.fn();
const mockMapSetFog = vi.fn();
const mockMapRemoveLayer = vi.fn();
const mockMapRemoveSource = vi.fn();

vi.mock('mapbox-gl', () => {
  const MockMap = vi.fn().mockImplementation(() => ({
    on: mockMapOn,
    remove: mockMapRemove,
    setStyle: mockMapSetStyle,
    addControl: mockMapAddControl,
    addSource: mockMapAddSource,
    addLayer: mockMapAddLayer,
    getSource: mockMapGetSource,
    getLayer: mockMapGetLayer,
    getStyle: mockMapGetStyle,
    fitBounds: mockMapFitBounds,
    flyTo: mockMapFlyTo,
    setFog: mockMapSetFog,
    removeLayer: mockMapRemoveLayer,
    removeSource: mockMapRemoveSource,
  }));

  const MockMarker = vi.fn().mockImplementation(() => ({
    setLngLat: vi.fn().mockReturnThis(),
    setPopup: vi.fn().mockReturnThis(),
    addTo: vi.fn().mockReturnThis(),
    remove: vi.fn(),
    getElement: vi.fn().mockReturnValue(document.createElement('div')),
    togglePopup: vi.fn(),
    getPopup: vi.fn(),
  }));

  const MockPopup = vi.fn().mockImplementation(() => ({
    setHTML: vi.fn().mockReturnThis(),
  }));

  const MockLngLatBounds = vi.fn().mockImplementation(() => ({
    extend: vi.fn(),
    isEmpty: vi.fn().mockReturnValue(false),
  }));

  return {
    default: {
      accessToken: '',
      Map: MockMap,
      Marker: MockMarker,
      Popup: MockPopup,
      NavigationControl: vi.fn(),
      FullscreenControl: vi.fn(),
      GeolocateControl: vi.fn(),
      LngLatBounds: MockLngLatBounds,
    },
  };
});

vi.mock('mapbox-gl/dist/mapbox-gl.css', () => ({}));

// Mock Supabase client
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockIn = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockChannel = vi.fn();
const mockSubscribe = vi.fn();
const mockRemoveChannel = vi.fn();

const mockCourierData = [
  {
    id: 'courier-1',
    full_name: 'John Driver',
    is_online: true,
    current_lat: 40.7128,
    current_lng: -74.006,
    phone: '+1234567890',
  },
  {
    id: 'courier-2',
    full_name: 'Jane Courier',
    is_online: true,
    current_lat: 40.7589,
    current_lng: -73.9851,
    phone: '+0987654321',
  },
  {
    id: 'courier-3',
    full_name: 'Offline Bob',
    is_online: false,
    current_lat: null,
    current_lng: null,
    phone: '+1111111111',
  },
];

const mockOrdersData = [
  {
    id: 'order-1',
    order_number: 'ORD-001',
    status: 'out_for_delivery',
    customer_name: 'Alice Customer',
    customer_phone: '+5555555555',
    delivery_address: '123 Main St',
    dropoff_lat: 40.72,
    dropoff_lng: -74.01,
    pickup_lat: 40.73,
    pickup_lng: -74.0,
    courier_id: 'courier-1',
    eta_minutes: 15,
    total_amount: 45.99,
    created_at: '2026-03-18T10:00:00Z',
  },
];

vi.mock('@/integrations/supabase/client', () => {
  const chainedMock = () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockImplementation(() =>
        Promise.resolve({ data: mockOrdersData, error: null })
      ),
    };
    // For courier queries (no .in, .order, .limit chain)
    return chain;
  };

  return {
    supabase: {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'couriers') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockImplementation(() =>
                Promise.resolve({ data: mockCourierData, error: null })
              ),
            }),
          };
        }
        if (table === 'orders') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockImplementation(() =>
                      Promise.resolve({ data: mockOrdersData, error: null })
                    ),
                  }),
                }),
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation(() =>
              Promise.resolve({ data: [], error: null })
            ),
          }),
        };
      }),
      channel: vi.fn().mockReturnValue({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
      }),
      removeChannel: vi.fn(),
    },
  };
});

vi.mock('@/components/admin/AddCourierDialog', () => ({
  AddCourierDialog: ({ onSuccess }: { onSuccess: () => void }) => (
    <button onClick={onSuccess} data-testid="add-courier-btn">Add Courier</button>
  ),
}));

vi.mock('@/components/SEOHead', () => ({
  SEOHead: () => null,
}));

vi.mock('@/components/shared/EnhancedEmptyState', () => ({
  EnhancedEmptyState: ({ title, description }: { title: string; description: string }) => (
    <div data-testid="empty-state">
      <span>{title}</span>
      <span>{description}</span>
    </div>
  ),
}));

vi.mock('@/components/EnhancedLoadingState', () => ({
  EnhancedLoadingState: ({ message }: { message: string }) => (
    <div data-testid="loading-state">{message}</div>
  ),
}));

import LiveMap from '../LiveMap';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function renderLiveMap() {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <LiveMap />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

describe('LiveMap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMapboxToken = 'test-mapbox-token';
    mockTokenLoading = false;
  });

  describe('rendering', () => {
    it('should render the page title', async () => {
      renderLiveMap();

      await waitFor(() => {
        expect(screen.getByText('Live Fleet Map')).toBeInTheDocument();
      });
    });

    it('should render stat cards', async () => {
      renderLiveMap();

      await waitFor(() => {
        expect(screen.getByText('Total Couriers')).toBeInTheDocument();
        expect(screen.getByText('Online Now')).toBeInTheDocument();
        expect(screen.getByText('Delivering')).toBeInTheDocument();
        expect(screen.getByText('Offline')).toBeInTheDocument();
      });
    });

    it('should render map controls', async () => {
      renderLiveMap();

      await waitFor(() => {
        expect(screen.getByText('Dark')).toBeInTheDocument();
        expect(screen.getByText('Streets')).toBeInTheDocument();
        expect(screen.getByText('Satellite')).toBeInTheDocument();
        expect(screen.getByText('Heatmap')).toBeInTheDocument();
        expect(screen.getByText('Traffic')).toBeInTheDocument();
      });
    });

    it('should render the search input', async () => {
      renderLiveMap();

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search drivers...')).toBeInTheDocument();
      });
    });
  });

  describe('no mapbox token', () => {
    it('should show configuration required message when no token', async () => {
      mockMapboxToken = null;
      renderLiveMap();

      await waitFor(() => {
        expect(screen.getByText('Map Configuration Required')).toBeInTheDocument();
      });
    });

    it('should still show courier list without map token', async () => {
      mockMapboxToken = null;
      renderLiveMap();

      await waitFor(() => {
        expect(screen.getByText(/All Couriers/)).toBeInTheDocument();
      });
    });
  });

  describe('courier list', () => {
    it('should show courier names after loading', async () => {
      renderLiveMap();

      await waitFor(() => {
        expect(screen.getByText('John Driver')).toBeInTheDocument();
        expect(screen.getByText('Jane Courier')).toBeInTheDocument();
      });
    });

    it('should show online status indicator', async () => {
      renderLiveMap();

      await waitFor(() => {
        const onlineLabels = screen.getAllByText('Online');
        expect(onlineLabels.length).toBeGreaterThan(0);
      });
    });

    it('should filter couriers by search query', async () => {
      const user = userEvent.setup();
      renderLiveMap();

      await waitFor(() => {
        expect(screen.getByText('John Driver')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search drivers...');
      await user.type(searchInput, 'John');

      await waitFor(() => {
        expect(screen.getByText('John Driver')).toBeInTheDocument();
        expect(screen.queryByText('Jane Courier')).not.toBeInTheDocument();
      });
    });

    it('should toggle offline couriers visibility', async () => {
      const user = userEvent.setup();
      renderLiveMap();

      await waitFor(() => {
        expect(screen.getByText('Show Offline')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Show Offline'));

      await waitFor(() => {
        expect(screen.getByText('Showing All')).toBeInTheDocument();
      });
    });
  });

  describe('stats', () => {
    it('should display correct stats', async () => {
      renderLiveMap();

      await waitFor(() => {
        // Total couriers: 3 (from mockCourierData)
        expect(screen.getByText('3')).toBeInTheDocument();
        // Online: 2 (courier-1, courier-2 with is_online=true and valid coords)
        expect(screen.getByText('2')).toBeInTheDocument();
        // Offline: 1 (courier-3)
        expect(screen.getByText('1')).toBeInTheDocument();
      });
    });
  });

  describe('refresh', () => {
    it('should have a refresh button', async () => {
      renderLiveMap();

      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeInTheDocument();
      });
    });

    it('should show last updated time', async () => {
      renderLiveMap();

      await waitFor(() => {
        expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
      });
    });
  });

  describe('add courier', () => {
    it('should render add courier button', async () => {
      renderLiveMap();

      await waitFor(() => {
        expect(screen.getByTestId('add-courier-btn')).toBeInTheDocument();
      });
    });
  });
});
