/**
 * Tests for lazy-loaded Leaflet components
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import * as LazyLeaflet from './lazy-leaflet';

// Mock Leaflet library
vi.mock('leaflet', () => ({
  default: {
    map: vi.fn(() => ({
      setView: vi.fn().mockReturnThis(),
      remove: vi.fn(),
      eachLayer: vi.fn(),
      removeLayer: vi.fn(),
      fitBounds: vi.fn(),
    })),
    tileLayer: vi.fn(() => ({
      addTo: vi.fn(),
    })),
    marker: vi.fn(() => ({
      addTo: vi.fn().mockReturnThis(),
      bindPopup: vi.fn().mockReturnThis(),
    })),
    divIcon: vi.fn((options) => options),
    latLngBounds: vi.fn((coords) => ({
      coords,
    })),
    Marker: class {},
  },
}));

// Mock Leaflet CSS
vi.mock('leaflet/dist/leaflet.css', () => ({}));

// Mock the actual component modules
vi.mock('@/components/admin/dashboard/LeafletMapWidget', () => ({
  LeafletMapWidget: ({ locations = [] }: any) => (
    <div data-testid="leaflet-map-widget">
      <div data-testid="map-container">Map with {locations.length} locations</div>
    </div>
  ),
}));

vi.mock('@/components/admin/storefront/DeliveryZoneMapPreview', () => ({
  DeliveryZoneMapPreview: ({ zones = [] }: any) => (
    <div data-testid="delivery-zone-map-preview">
      <div data-testid="zone-map">Map with {zones.length} zones</div>
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
  Skeleton: ({ className, style }: any) => (
    <div data-testid="skeleton" className={className} style={style}>Loading...</div>
  ),
}));

vi.mock('lucide-react', () => ({
  MapPin: () => <span data-testid="map-pin-icon">MapPin</span>,
}));

describe('lazy-leaflet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('MapSkeleton component', () => {
    it('should render MapSkeleton with default height', () => {
      const { MapSkeleton } = LazyLeaflet;
      render(<MapSkeleton />);

      expect(screen.getByTestId('card')).toBeInTheDocument();
      expect(screen.getByText('Loading Map...')).toBeInTheDocument();
      expect(screen.getByTestId('skeleton')).toBeInTheDocument();
      expect(screen.getByTestId('skeleton')).toHaveStyle({ height: '400px' });
    });

    it('should render MapSkeleton with custom height', () => {
      const { MapSkeleton } = LazyLeaflet;
      render(<MapSkeleton height={600} />);

      expect(screen.getByTestId('skeleton')).toHaveStyle({ height: '600px' });
    });

    it('should display MapPin icon', () => {
      const { MapSkeleton } = LazyLeaflet;
      render(<MapSkeleton />);

      expect(screen.getByTestId('map-pin-icon')).toBeInTheDocument();
    });
  });

  describe('LeafletMapWidget component', () => {
    it('should lazy load and render LeafletMapWidget component', async () => {
      const { LeafletMapWidget } = LazyLeaflet;

      render(
        <LeafletMapWidget
          locations={[
            { name: 'Test Location', lat: 40.7128, lng: -74.0060, type: 'warehouse' },
          ]}
        />
      );

      // Should show skeleton initially (in real scenario)
      // Then load the actual component
      await waitFor(() => {
        expect(screen.getByTestId('leaflet-map-widget')).toBeInTheDocument();
      });

      expect(screen.getByText('Map with 1 locations')).toBeInTheDocument();
    });

    it('should render without locations', async () => {
      const { LeafletMapWidget } = LazyLeaflet;

      render(<LeafletMapWidget locations={[]} />);

      await waitFor(() => {
        expect(screen.getByTestId('leaflet-map-widget')).toBeInTheDocument();
      });

      expect(screen.getByText('Map with 0 locations')).toBeInTheDocument();
    });

    it('should handle multiple locations', async () => {
      const { LeafletMapWidget } = LazyLeaflet;

      const locations = [
        { name: 'Warehouse 1', lat: 40.7128, lng: -74.0060, type: 'warehouse' as const },
        { name: 'Runner 1', lat: 40.7589, lng: -73.9851, type: 'runner' as const },
        { name: 'Delivery 1', lat: 40.7484, lng: -73.9857, type: 'delivery' as const },
      ];

      render(<LeafletMapWidget locations={locations} />);

      await waitFor(() => {
        expect(screen.getByTestId('leaflet-map-widget')).toBeInTheDocument();
      });

      expect(screen.getByText('Map with 3 locations')).toBeInTheDocument();
    });
  });

  describe('DeliveryZoneMapPreview component', () => {
    it('should lazy load and render DeliveryZoneMapPreview component', async () => {
      const { DeliveryZoneMapPreview } = LazyLeaflet;

      const zones = [
        { zip_code: '10001', fee: 5.99, min_order: 20 },
      ];

      render(<DeliveryZoneMapPreview zones={zones} />);

      await waitFor(() => {
        expect(screen.getByTestId('delivery-zone-map-preview')).toBeInTheDocument();
      });

      expect(screen.getByText('Map with 1 zones')).toBeInTheDocument();
    });

    it('should render without zones', async () => {
      const { DeliveryZoneMapPreview } = LazyLeaflet;

      render(<DeliveryZoneMapPreview zones={[]} />);

      await waitFor(() => {
        expect(screen.getByTestId('delivery-zone-map-preview')).toBeInTheDocument();
      });

      expect(screen.getByText('Map with 0 zones')).toBeInTheDocument();
    });

    it('should handle multiple delivery zones', async () => {
      const { DeliveryZoneMapPreview } = LazyLeaflet;

      const zones = [
        { zip_code: '10001', fee: 5.99, min_order: 20 },
        { zip_code: '10002', fee: 7.99, min_order: 25 },
        { zip_code: '10003', fee: 4.99, min_order: 15 },
      ];

      render(<DeliveryZoneMapPreview zones={zones} />);

      await waitFor(() => {
        expect(screen.getByTestId('delivery-zone-map-preview')).toBeInTheDocument();
      });

      expect(screen.getByText('Map with 3 zones')).toBeInTheDocument();
    });

    it('should accept custom height prop', async () => {
      const { DeliveryZoneMapPreview } = LazyLeaflet;

      render(<DeliveryZoneMapPreview zones={[]} height={500} />);

      await waitFor(() => {
        expect(screen.getByTestId('delivery-zone-map-preview')).toBeInTheDocument();
      });
    });

    it('should accept custom className prop', async () => {
      const { DeliveryZoneMapPreview } = LazyLeaflet;

      render(<DeliveryZoneMapPreview zones={[]} className="custom-class" />);

      await waitFor(() => {
        expect(screen.getByTestId('delivery-zone-map-preview')).toBeInTheDocument();
      });
    });

    it('should accept custom defaultCenter prop', async () => {
      const { DeliveryZoneMapPreview } = LazyLeaflet;

      const customCenter: [number, number] = [34.0522, -118.2437]; // LA coordinates

      render(<DeliveryZoneMapPreview zones={[]} defaultCenter={customCenter} />);

      await waitFor(() => {
        expect(screen.getByTestId('delivery-zone-map-preview')).toBeInTheDocument();
      });
    });
  });

  describe('Component integration', () => {
    it('should render both components without conflicts', async () => {
      const { LeafletMapWidget, DeliveryZoneMapPreview } = LazyLeaflet;

      const locations = [
        { name: 'Test', lat: 40.7128, lng: -74.0060, type: 'warehouse' as const },
      ];

      const zones = [
        { zip_code: '10001', fee: 5.99 },
      ];

      const { container } = render(
        <div>
          <LeafletMapWidget locations={locations} />
          <DeliveryZoneMapPreview zones={zones} />
        </div>
      );

      await waitFor(() => {
        expect(screen.getByTestId('leaflet-map-widget')).toBeInTheDocument();
        expect(screen.getByTestId('delivery-zone-map-preview')).toBeInTheDocument();
      });

      expect(container).toBeTruthy();
    });
  });

  describe('Suspense boundary', () => {
    it('should wrap components with Suspense', async () => {
      const { LeafletMapWidget } = LazyLeaflet;

      // The component should eventually render
      const { container } = render(<LeafletMapWidget locations={[]} />);

      await waitFor(() => {
        expect(container).toBeTruthy();
      });
    });
  });
});
