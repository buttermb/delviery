/**
 * Delivery Zone Map Preview Component
 * Displays delivery zones on a mini Leaflet map with visual markers for each zone.
 * Uses OpenStreetMap (free, no API key needed) for tile rendering.
 */

import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, Info, AlertCircle } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface DeliveryZone {
  zip_code: string;
  fee: number;
  min_order?: number;
}

interface DeliveryZoneMapPreviewProps {
  zones: DeliveryZone[];
  defaultCenter?: [number, number];
  height?: number;
  className?: string;
}

interface ZoneLocation {
  zip_code: string;
  fee: number;
  min_order?: number;
  lat: number;
  lng: number;
}

// US ZIP code prefixes to approximate geographic regions
// This provides rough geographical clustering for ZIP codes
const ZIP_PREFIX_REGIONS: Record<string, { lat: number; lng: number; name: string }> = {
  // Northeast
  '100': { lat: 40.7128, lng: -74.0060, name: 'New York, NY' },
  '101': { lat: 40.7831, lng: -73.9712, name: 'Manhattan, NY' },
  '102': { lat: 40.7282, lng: -73.7949, name: 'Queens, NY' },
  '103': { lat: 40.5795, lng: -74.1502, name: 'Staten Island, NY' },
  '104': { lat: 40.8448, lng: -73.8648, name: 'Bronx, NY' },
  '110': { lat: 40.6892, lng: -73.8239, name: 'Queens, NY' },
  '111': { lat: 40.7282, lng: -73.7949, name: 'Long Island City, NY' },
  '112': { lat: 40.6782, lng: -73.9442, name: 'Brooklyn, NY' },
  '113': { lat: 40.6892, lng: -73.9422, name: 'Brooklyn, NY' },
  '114': { lat: 40.6501, lng: -73.9496, name: 'Brooklyn, NY' },
  '115': { lat: 40.5623, lng: -73.9496, name: 'Brooklyn, NY' },
  '116': { lat: 40.7580, lng: -73.9855, name: 'Manhattan, NY' },
  '117': { lat: 40.7484, lng: -73.4252, name: 'Long Island, NY' },
  '118': { lat: 40.8676, lng: -73.4252, name: 'Long Island, NY' },
  '119': { lat: 40.7282, lng: -73.2137, name: 'Long Island, NY' },
  '120': { lat: 42.6526, lng: -73.7562, name: 'Albany, NY' },
  '021': { lat: 42.3601, lng: -71.0589, name: 'Boston, MA' },
  '022': { lat: 42.3751, lng: -71.1056, name: 'Cambridge, MA' },
  '191': { lat: 39.9526, lng: -75.1652, name: 'Philadelphia, PA' },
  '200': { lat: 38.9072, lng: -77.0369, name: 'Washington, DC' },
  '201': { lat: 38.8816, lng: -77.0910, name: 'Arlington, VA' },
  // Southeast
  '300': { lat: 33.7490, lng: -84.3880, name: 'Atlanta, GA' },
  '330': { lat: 25.7617, lng: -80.1918, name: 'Miami, FL' },
  '331': { lat: 26.1224, lng: -80.1373, name: 'Fort Lauderdale, FL' },
  '332': { lat: 26.7153, lng: -80.0534, name: 'West Palm Beach, FL' },
  '333': { lat: 26.0112, lng: -80.1495, name: 'Hollywood, FL' },
  '334': { lat: 26.1224, lng: -80.1373, name: 'Pompano Beach, FL' },
  '335': { lat: 27.9506, lng: -82.4572, name: 'Tampa, FL' },
  '336': { lat: 27.7676, lng: -82.6403, name: 'St. Petersburg, FL' },
  '337': { lat: 28.0395, lng: -81.9498, name: 'Lakeland, FL' },
  // Midwest
  '600': { lat: 41.8781, lng: -87.6298, name: 'Chicago, IL' },
  '480': { lat: 42.3314, lng: -83.0458, name: 'Detroit, MI' },
  // Southwest
  '850': { lat: 33.4484, lng: -112.0740, name: 'Phoenix, AZ' },
  '750': { lat: 32.7767, lng: -96.7970, name: 'Dallas, TX' },
  '770': { lat: 29.7604, lng: -95.3698, name: 'Houston, TX' },
  // West
  '900': { lat: 34.0522, lng: -118.2437, name: 'Los Angeles, CA' },
  '901': { lat: 34.0195, lng: -118.4912, name: 'Santa Monica, CA' },
  '902': { lat: 33.9425, lng: -118.4081, name: 'Inglewood, CA' },
  '903': { lat: 33.8958, lng: -118.2201, name: 'Long Beach, CA' },
  '904': { lat: 33.8958, lng: -118.2201, name: 'Long Beach, CA' },
  '905': { lat: 33.7701, lng: -118.1937, name: 'Torrance, CA' },
  '906': { lat: 34.0195, lng: -118.1445, name: 'Pasadena, CA' },
  '907': { lat: 34.1808, lng: -118.3090, name: 'Burbank, CA' },
  '908': { lat: 34.1425, lng: -118.2551, name: 'Glendale, CA' },
  '910': { lat: 34.1808, lng: -118.3090, name: 'Burbank, CA' },
  '911': { lat: 34.0736, lng: -118.4004, name: 'Beverly Hills, CA' },
  '912': { lat: 34.0736, lng: -118.4004, name: 'West Hollywood, CA' },
  '913': { lat: 34.2011, lng: -118.5341, name: 'Woodland Hills, CA' },
  '914': { lat: 34.2805, lng: -118.5041, name: 'Northridge, CA' },
  '915': { lat: 34.1425, lng: -118.2551, name: 'Glendale, CA' },
  '916': { lat: 34.4285, lng: -118.5551, name: 'San Fernando, CA' },
  '917': { lat: 34.0622, lng: -117.9145, name: 'Pomona, CA' },
  '918': { lat: 34.0622, lng: -117.9145, name: 'San Dimas, CA' },
  '919': { lat: 33.9850, lng: -117.3754, name: 'Riverside, CA' },
  '920': { lat: 32.7157, lng: -117.1611, name: 'San Diego, CA' },
  '921': { lat: 32.7157, lng: -117.1611, name: 'San Diego, CA' },
  '940': { lat: 37.7749, lng: -122.4194, name: 'San Francisco, CA' },
  '941': { lat: 37.7749, lng: -122.4194, name: 'San Francisco, CA' },
  '942': { lat: 37.5585, lng: -122.2711, name: 'San Mateo, CA' },
  '943': { lat: 37.3382, lng: -121.8863, name: 'San Jose, CA' },
  '944': { lat: 37.8044, lng: -122.2712, name: 'Oakland, CA' },
  '945': { lat: 37.8044, lng: -122.2712, name: 'Oakland, CA' },
  '946': { lat: 37.8716, lng: -122.2727, name: 'Berkeley, CA' },
  '947': { lat: 37.9161, lng: -122.3108, name: 'Richmond, CA' },
  '980': { lat: 47.6062, lng: -122.3321, name: 'Seattle, WA' },
  '972': { lat: 45.5152, lng: -122.6784, name: 'Portland, OR' },
  '891': { lat: 36.1699, lng: -115.1398, name: 'Las Vegas, NV' },
  '802': { lat: 39.7392, lng: -104.9903, name: 'Denver, CO' },
};

// Get approximate location for a ZIP code
const getZipLocation = (zipCode: string): { lat: number; lng: number; name: string } | null => {
  // Try exact 3-digit prefix match first
  const prefix3 = zipCode.substring(0, 3);
  if (ZIP_PREFIX_REGIONS[prefix3]) {
    return ZIP_PREFIX_REGIONS[prefix3];
  }

  // Try 2-digit prefix for broader region
  const prefix2 = zipCode.substring(0, 2);
  const matchingPrefixes = Object.entries(ZIP_PREFIX_REGIONS)
    .filter(([key]) => key.startsWith(prefix2))
    .sort((a, b) => a[0].localeCompare(b[0]));

  if (matchingPrefixes.length > 0) {
    return matchingPrefixes[0][1];
  }

  // Try 1-digit prefix for very broad region
  const prefix1 = zipCode.substring(0, 1);
  const broadMatches = Object.entries(ZIP_PREFIX_REGIONS)
    .filter(([key]) => key.startsWith(prefix1))
    .sort((a, b) => a[0].localeCompare(b[0]));

  if (broadMatches.length > 0) {
    return broadMatches[0][1];
  }

  return null;
};

// Generate a color based on delivery fee (green for low, red for high)
const getFeeColor = (fee: number, maxFee: number): string => {
  if (maxFee === 0) return '#10b981'; // emerald
  const ratio = Math.min(fee / maxFee, 1);
  // Interpolate from emerald (#10b981) to amber (#f59e0b) to red (#ef4444)
  if (ratio < 0.5) {
    // Emerald to amber
    const t = ratio * 2;
    return `rgb(${Math.round(16 + t * (245 - 16))}, ${Math.round(185 + t * (158 - 185))}, ${Math.round(129 + t * (11 - 129))})`;
  } else {
    // Amber to red
    const t = (ratio - 0.5) * 2;
    return `rgb(${Math.round(245 + t * (239 - 245))}, ${Math.round(158 + t * (68 - 158))}, ${Math.round(11 + t * (68 - 11))})`;
  }
};

// Create custom marker icon
const createZoneMarker = (zone: ZoneLocation, color: string): L.DivIcon => {
  return L.divIcon({
    className: 'delivery-zone-marker',
    html: `
      <div style="
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
      ">
        <div style="
          background-color: ${color};
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          white-space: nowrap;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          border: 2px solid white;
        ">
          ${zone.zip_code} • $${zone.fee.toFixed(0)}
        </div>
        <div style="
          width: 0;
          height: 0;
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-top: 8px solid ${color};
          margin-top: -1px;
        "></div>
      </div>
    `,
    iconSize: [80, 40],
    iconAnchor: [40, 40],
  });
};

export function DeliveryZoneMapPreview({
  zones,
  defaultCenter = [39.8283, -98.5795], // Center of USA
  height = 280,
  className = '',
}: DeliveryZoneMapPreviewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const [isMapReady, setIsMapReady] = useState(false);
  const [unmappedZones, setUnmappedZones] = useState<string[]>([]);

  // Convert zones to locations with coordinates
  const zoneLocations = useMemo(() => {
    const locations: ZoneLocation[] = [];
    const unmapped: string[] = [];

    zones.forEach((zone) => {
      if (!zone.zip_code || zone.zip_code.length < 3) {
        unmapped.push(zone.zip_code || 'empty');
        return;
      }

      const location = getZipLocation(zone.zip_code);
      if (location) {
        // Add slight randomness to prevent overlapping markers for same region
        const jitter = 0.02;
        locations.push({
          ...zone,
          lat: location.lat + (Math.random() - 0.5) * jitter,
          lng: location.lng + (Math.random() - 0.5) * jitter,
        });
      } else {
        unmapped.push(zone.zip_code);
      }
    });

    setUnmappedZones(unmapped);
    return locations;
  }, [zones]);

  // Calculate max fee for color scaling
  const maxFee = useMemo(() => {
    return Math.max(...zones.map((z) => z.fee || 0), 10);
  }, [zones]);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      zoomControl: true,
      scrollWheelZoom: false,
      dragging: true,
      touchZoom: true,
      doubleClickZoom: true,
    }).setView(defaultCenter, 4);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 18,
    }).addTo(map);

    mapInstanceRef.current = map;
    setIsMapReady(true);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      setIsMapReady(false);
    };
  }, [defaultCenter]);

  // Update markers when zones change
  const updateMarkers = useCallback(() => {
    if (!mapInstanceRef.current || !isMapReady) return;

    const map = mapInstanceRef.current;

    // Clear existing markers
    markersRef.current.forEach((marker) => {
      map.removeLayer(marker);
    });
    markersRef.current = [];

    if (zoneLocations.length === 0) return;

    // Add new markers
    zoneLocations.forEach((zone) => {
      const color = getFeeColor(zone.fee, maxFee);
      const marker = L.marker([zone.lat, zone.lng], {
        icon: createZoneMarker(zone, color),
      });

      marker.bindPopup(`
        <div style="min-width: 120px; font-family: system-ui, sans-serif;">
          <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">
            ZIP: ${zone.zip_code}
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 2px;">
            <span style="color: #666;">Delivery Fee:</span>
            <span style="font-weight: 500;">$${zone.fee.toFixed(2)}</span>
          </div>
          ${zone.min_order ? `
          <div style="display: flex; justify-content: space-between; font-size: 13px;">
            <span style="color: #666;">Min Order:</span>
            <span style="font-weight: 500;">$${zone.min_order.toFixed(2)}</span>
          </div>
          ` : ''}
        </div>
      `, {
        closeButton: true,
        className: 'zone-popup',
      });

      marker.addTo(map);
      markersRef.current.push(marker);
    });

    // Fit map to markers with padding
    if (zoneLocations.length > 0) {
      const bounds = L.latLngBounds(
        zoneLocations.map((loc) => [loc.lat, loc.lng] as [number, number])
      );
      map.fitBounds(bounds, {
        padding: [30, 30],
        maxZoom: 10,
      });
    }
  }, [zoneLocations, maxFee, isMapReady]);

  useEffect(() => {
    updateMarkers();
  }, [updateMarkers]);

  const hasZones = zones.length > 0;
  const hasMappableZones = zoneLocations.length > 0;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-sm font-medium">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Zone Map Preview
          </div>
          {hasZones && (
            <Badge variant="secondary" className="text-xs">
              {zones.length} zone{zones.length !== 1 ? 's' : ''}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {!hasZones ? (
          <div
            className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30"
            style={{ height }}
          >
            <MapPin className="h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">No delivery zones configured</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Add zones above to see them on the map</p>
          </div>
        ) : (
          <>
            <div
              ref={mapRef}
              className="w-full rounded-lg border overflow-hidden"
              style={{ height }}
            />

            {/* Legend */}
            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#10b981' }} />
                <span>Low fee</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#f59e0b' }} />
                <span>Medium</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#ef4444' }} />
                <span>High fee</span>
              </div>
            </div>

            {/* Info about unmapped zones */}
            {unmappedZones.length > 0 && (
              <div className="flex items-start gap-2 mt-3 p-2 rounded-md bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 text-xs">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>
                  {unmappedZones.length === 1
                    ? `ZIP "${unmappedZones[0]}" could not be mapped.`
                    : `${unmappedZones.length} ZIP codes could not be mapped: ${unmappedZones.slice(0, 3).join(', ')}${unmappedZones.length > 3 ? '...' : ''}`
                  }
                </span>
              </div>
            )}

            {/* Tip */}
            <div className="flex items-start gap-2 mt-3 text-xs text-muted-foreground">
              <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>Click markers to view zone details. Locations are approximate based on ZIP code regions.</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
