import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import Map, { Marker, NavigationControl } from 'react-map-gl/mapbox';
import type { MapRef } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';

import { cn } from '@/lib/utils';
import { DriverMapPopup, type PopupDriver } from '@/components/fleet/DriverMapPopup';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MapDriver {
  id: string;
  full_name: string;
  status: 'online' | 'delivering' | 'idle' | 'offline';
  current_lat: number | null;
  current_lng: number | null;
  phone?: string;
  vehicle_type?: string;
  current_order_number?: string | null;
  current_delivery_address?: string | null;
  eta_minutes?: number | null;
  last_location_update?: string;
}

interface FleetLiveMapProps {
  mapboxToken: string;
  drivers: MapDriver[];
  selectedDriverId?: string | null;
  onSelectDriver?: (driverId: string) => void;
  onTrackOrder?: (driverId: string) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAP_STYLES = {
  dark: 'mapbox://styles/mapbox/dark-v11',
  streets: 'mapbox://styles/mapbox/streets-v12',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
} as const;

type MapStyleKey = keyof typeof MAP_STYLES;

const STATUS_COLORS: Record<MapDriver['status'], string> = {
  online: '#10B981',
  delivering: '#F59E0B',
  idle: '#94A3B8',
  offline: '#64748B',
};

const DEFAULT_VIEW = {
  latitude: 34.0522,
  longitude: -118.2437,
  zoom: 11,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FleetLiveMap({
  mapboxToken,
  drivers,
  selectedDriverId,
  onSelectDriver,
  onTrackOrder,
  className,
}: FleetLiveMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [mapStyleKey, setMapStyleKey] = useState<MapStyleKey>('dark');
  const [popupDriver, setPopupDriver] = useState<PopupDriver | null>(null);
  const prevDriversRef = useRef<string>('');

  // Drivers with valid lat/lng
  const locatedDrivers = useMemo(
    () => drivers.filter((d) => d.current_lat != null && d.current_lng != null),
    [drivers],
  );

  // Fit map to driver bounds on first load
  useEffect(() => {
    const key = locatedDrivers.map((d) => d.id).sort().join(',');
    if (key === prevDriversRef.current || locatedDrivers.length === 0) return;
    prevDriversRef.current = key;

    const map = mapRef.current;
    if (!map) return;

    if (locatedDrivers.length === 1) {
      map.flyTo({
        center: [locatedDrivers[0].current_lng!, locatedDrivers[0].current_lat!],
        zoom: 14,
        duration: 800,
      });
      return;
    }

    const lats = locatedDrivers.map((d) => d.current_lat!);
    const lngs = locatedDrivers.map((d) => d.current_lng!);
    map.fitBounds(
      [
        [Math.min(...lngs) - 0.01, Math.min(...lats) - 0.01],
        [Math.max(...lngs) + 0.01, Math.max(...lats) + 0.01],
      ],
      { padding: 60, duration: 800 },
    );
  }, [locatedDrivers]);

  // Fly to selected driver
  useEffect(() => {
    if (!selectedDriverId) return;
    const driver = locatedDrivers.find((d) => d.id === selectedDriverId);
    if (!driver) return;
    mapRef.current?.flyTo({
      center: [driver.current_lng!, driver.current_lat!],
      zoom: 15,
      duration: 600,
    });
    setPopupDriver(driver as PopupDriver);
  }, [selectedDriverId, locatedDrivers]);

  const handleMarkerClick = useCallback(
    (driver: MapDriver) => {
      setPopupDriver(driver as PopupDriver);
      onSelectDriver?.(driver.id);
      mapRef.current?.flyTo({
        center: [driver.current_lng!, driver.current_lat!],
        zoom: 15,
        duration: 600,
      });
    },
    [onSelectDriver],
  );

  return (
    <div className={cn('relative h-full w-full', className)}>
      <Map
        ref={mapRef}
        mapboxAccessToken={mapboxToken}
        initialViewState={DEFAULT_VIEW}
        mapStyle={MAP_STYLES[mapStyleKey]}
        attributionControl={false}
        reuseMaps
      >
        <NavigationControl position="top-left" showCompass={false} />

        {/* Driver markers */}
        {locatedDrivers.map((driver) => {
          const color = STATUS_COLORS[driver.status];
          const isSelected = driver.id === popupDriver?.id;

          return (
            <Marker
              key={driver.id}
              latitude={driver.current_lat!}
              longitude={driver.current_lng!}
              anchor="center"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                handleMarkerClick(driver);
              }}
            >
              <div
                className={cn(
                  'flex items-center justify-center rounded-full border-2 transition-transform',
                  isSelected ? 'scale-125' : 'hover:scale-110',
                )}
                style={{
                  width: 28,
                  height: 28,
                  backgroundColor: `${color}20`,
                  borderColor: color,
                }}
              >
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: color }}
                />
              </div>
            </Marker>
          );
        })}
      </Map>

      {/* Popup */}
      {popupDriver && (
        <div className="absolute left-4 bottom-4 z-10">
          <DriverMapPopup
            driver={popupDriver}
            onClose={() => setPopupDriver(null)}
            onTrackOrder={onTrackOrder}
          />
        </div>
      )}

      {/* Map style switcher */}
      <div className="absolute right-3 top-3 z-10 flex rounded-lg border border-border bg-card p-0.5 shadow-lg">
        {(Object.keys(MAP_STYLES) as MapStyleKey[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setMapStyleKey(key)}
            className={cn(
              'rounded-md px-2.5 py-1 text-[10px] font-medium capitalize transition-colors',
              mapStyleKey === key
                ? 'bg-emerald-500 text-white'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {key}
          </button>
        ))}
      </div>

      {/* Legend */}
      <div className="absolute left-3 bottom-4 z-10 flex items-center gap-3 rounded-lg border border-border bg-card/90 px-3 py-1.5 backdrop-blur-sm">
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[10px] capitalize text-muted-foreground">{status}</span>
          </div>
        ))}
      </div>

      {/* Driver count */}
      <div className="absolute left-3 top-3 z-10 rounded-lg border border-border bg-card/90 px-3 py-1.5 backdrop-blur-sm">
        <span className="font-['Space_Grotesk'] text-sm font-semibold text-foreground">
          {locatedDrivers.length}
        </span>
        <span className="ml-1.5 text-xs text-muted-foreground">on map</span>
      </div>
    </div>
  );
}
