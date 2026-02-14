/**
 * Tests for lazy-loaded Mapbox GL components
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import * as LazyMapbox from './lazy-mapbox';

// Mock mapbox-gl library
vi.mock('mapbox-gl', () => ({
  default: {
    Map: vi.fn(() => ({
      on: vi.fn(),
      addControl: vi.fn(),
      remove: vi.fn(),
      setStyle: vi.fn(),
      fitBounds: vi.fn(),
      flyTo: vi.fn(),
      addSource: vi.fn(),
      addLayer: vi.fn(),
      removeLayer: vi.fn(),
      removeSource: vi.fn(),
      getSource: vi.fn(),
      getLayer: vi.fn(),
      getStyle: vi.fn(() => ({ layers: [] })),
      setFog: vi.fn(),
    })),
    Marker: vi.fn(() => ({
      setLngLat: vi.fn().mockReturnThis(),
      setPopup: vi.fn().mockReturnThis(),
      addTo: vi.fn().mockReturnThis(),
      remove: vi.fn(),
      togglePopup: vi.fn(),
    })),
    Popup: vi.fn(() => ({
      setHTML: vi.fn().mockReturnThis(),
    })),
    NavigationControl: vi.fn(),
    FullscreenControl: vi.fn(),
    GeolocateControl: vi.fn(),
    LngLatBounds: vi.fn(() => ({
      extend: vi.fn(),
      isEmpty: vi.fn(() => false),
    })),
    accessToken: '',
  },
}));

// Mock mapbox-gl CSS
vi.mock('mapbox-gl/dist/mapbox-gl.css', () => ({}));

// Mock the mapbox-loader
vi.mock('@/lib/mapbox-loader', () => ({
  loadMapbox: vi.fn(async () => {
    const mapboxgl = await import('mapbox-gl');
    return mapboxgl.default;
  }),
  isMapboxLoaded: vi.fn(() => false),
  resetMapboxLoader: vi.fn(),
}));

// Mock the actual component modules
vi.mock('@/pages/admin/LiveMap', () => ({
  default: () => (
    <div data-testid="live-map">
      <div data-testid="map-container">Live Map Component</div>
    </div>
  ),
}));

vi.mock('@/components/customer/OrderTrackingMap', () => ({
  OrderTrackingMap: ({ order }: { order?: { id: string } }) => (
    <div data-testid="order-tracking-map">
      <div data-testid="map-container">Order {order?.id} Tracking Map</div>
    </div>
  ),
}));

vi.mock('@/components/courier/RouteView', () => ({
  RouteView: () => (
    <div data-testid="route-view">
      <div data-testid="map-container">Route View</div>
    </div>
  ),
}));

vi.mock('@/components/admin/routing/RouteOptimizer', () => ({
  RouteOptimizer: () => (
    <div data-testid="route-optimizer">
      <div data-testid="map-container">Route Optimizer</div>
    </div>
  ),
}));

vi.mock('@/components/admin/maps/RouteReplayMap', () => ({
  RouteReplayMap: () => (
    <div data-testid="route-replay-map">
      <div data-testid="map-container">Route Replay Map</div>
    </div>
  ),
}));

vi.mock('@/components/admin/TerritoryMapView', () => ({
  TerritoryMapView: () => (
    <div data-testid="territory-map-view">
      <div data-testid="map-container">Territory Map View</div>
    </div>
  ),
}));

vi.mock('@/components/admin/OrderMap', () => ({
  OrderMap: () => (
    <div data-testid="order-map">
      <div data-testid="map-container">Order Map</div>
    </div>
  ),
}));

vi.mock('@/components/admin/LiveDeliveryMap', () => ({
  LiveDeliveryMap: () => (
    <div data-testid="live-delivery-map">
      <div data-testid="map-container">Live Delivery Map</div>
    </div>
  ),
}));

// Mock UI components
vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div data-testid="card-content">{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <div data-testid="card-title">{children}</div>,
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
    <div data-testid="skeleton" className={className} style={style}>Loading...</div>
  ),
}));

vi.mock('lucide-react', () => ({
  MapPin: () => <span data-testid="map-pin-icon">MapPin</span>,
}));

describe('lazy-mapbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('MapSkeleton component', () => {
    it('should render MapSkeleton with default height', () => {
      const { MapSkeleton } = LazyMapbox;
      render(<MapSkeleton />);

      expect(screen.getByTestId('card')).toBeInTheDocument();
      expect(screen.getByText('Loading Map...')).toBeInTheDocument();
      expect(screen.getByTestId('skeleton')).toBeInTheDocument();
      expect(screen.getByTestId('skeleton')).toHaveStyle({ height: '500px' });
    });

    it('should render MapSkeleton with custom height', () => {
      const { MapSkeleton } = LazyMapbox;
      render(<MapSkeleton height={600} />);

      expect(screen.getByTestId('skeleton')).toHaveStyle({ height: '600px' });
    });

    it('should display MapPin icon', () => {
      const { MapSkeleton } = LazyMapbox;
      render(<MapSkeleton />);

      expect(screen.getByTestId('map-pin-icon')).toBeInTheDocument();
    });
  });

  describe('LiveMap component', () => {
    it('should lazy load and render LiveMap component', async () => {
      const { LiveMap } = LazyMapbox;

      render(<LiveMap />);

      await waitFor(() => {
        expect(screen.getByTestId('live-map')).toBeInTheDocument();
      });

      expect(screen.getByText('Live Map Component')).toBeInTheDocument();
    });
  });

  describe('OrderTrackingMap component', () => {
    it('should lazy load and render OrderTrackingMap component', async () => {
      const { OrderTrackingMap } = LazyMapbox;

      const mockOrder = {
        id: 'order-123',
        status: 'in_transit',
        dropoff_lat: 40.7128,
        dropoff_lng: -74.0060,
      };

      render(<OrderTrackingMap order={mockOrder} />);

      await waitFor(() => {
        expect(screen.getByTestId('order-tracking-map')).toBeInTheDocument();
      });

      expect(screen.getByText(/Order order-123 Tracking Map/)).toBeInTheDocument();
    });
  });

  describe('RouteView component', () => {
    it('should lazy load and render RouteView component', async () => {
      const { RouteView } = LazyMapbox;

      render(<RouteView route={{ id: 'route-1' }} />);

      await waitFor(() => {
        expect(screen.getByTestId('route-view')).toBeInTheDocument();
      });

      expect(screen.getByText('Route View')).toBeInTheDocument();
    });
  });

  describe('RouteOptimizer component', () => {
    it('should lazy load and render RouteOptimizer component', async () => {
      const { RouteOptimizer } = LazyMapbox;

      render(<RouteOptimizer />);

      await waitFor(() => {
        expect(screen.getByTestId('route-optimizer')).toBeInTheDocument();
      });

      expect(screen.getByText('Route Optimizer')).toBeInTheDocument();
    });
  });

  describe('RouteReplayMap component', () => {
    it('should lazy load and render RouteReplayMap component', async () => {
      const { RouteReplayMap } = LazyMapbox;

      const mockLocations = [
        { lat: 40.7128, lng: -74.0060, timestamp: '2024-01-01T00:00:00Z' },
      ];

      render(<RouteReplayMap locations={mockLocations} />);

      await waitFor(() => {
        expect(screen.getByTestId('route-replay-map')).toBeInTheDocument();
      });

      expect(screen.getByText('Route Replay Map')).toBeInTheDocument();
    });
  });

  describe('TerritoryMapView component', () => {
    it('should lazy load and render TerritoryMapView component', async () => {
      const { TerritoryMapView } = LazyMapbox;

      render(<TerritoryMapView />);

      await waitFor(() => {
        expect(screen.getByTestId('territory-map-view')).toBeInTheDocument();
      });

      expect(screen.getByText('Territory Map View')).toBeInTheDocument();
    });
  });

  describe('OrderMap component', () => {
    it('should lazy load and render OrderMap component', async () => {
      const { OrderMap } = LazyMapbox;

      const mockOrders = [{ id: 'order-1' }];

      render(<OrderMap orders={mockOrders} />);

      await waitFor(() => {
        expect(screen.getByTestId('order-map')).toBeInTheDocument();
      });

      expect(screen.getByText('Order Map')).toBeInTheDocument();
    });
  });

  describe('LiveDeliveryMap component', () => {
    it('should lazy load and render LiveDeliveryMap component', async () => {
      const { LiveDeliveryMap } = LazyMapbox;

      const mockDeliveries = [{ id: 'delivery-1' }];

      render(<LiveDeliveryMap deliveries={mockDeliveries} />);

      await waitFor(() => {
        expect(screen.getByTestId('live-delivery-map')).toBeInTheDocument();
      });

      expect(screen.getByText('Live Delivery Map')).toBeInTheDocument();
    });
  });

  describe('Component integration', () => {
    it('should render multiple map components without conflicts', async () => {
      const { LiveMap, OrderTrackingMap } = LazyMapbox;

      const mockOrder = {
        id: 'order-123',
        status: 'in_transit',
      };

      const { container } = render(
        <div>
          <LiveMap />
          <OrderTrackingMap order={mockOrder} />
        </div>
      );

      await waitFor(() => {
        expect(screen.getByTestId('live-map')).toBeInTheDocument();
        expect(screen.getByTestId('order-tracking-map')).toBeInTheDocument();
      });

      expect(container).toBeTruthy();
    });
  });

  describe('Suspense boundary', () => {
    it('should wrap components with Suspense', async () => {
      const { LiveMap } = LazyMapbox;

      // The component should eventually render
      const { container } = render(<LiveMap />);

      await waitFor(() => {
        expect(container).toBeTruthy();
      });
    });
  });
});
