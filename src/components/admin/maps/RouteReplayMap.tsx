import { logger } from '@/lib/logger';
import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Navigation, TrendingUp } from 'lucide-react';
import { LocationPoint, RouteStatistics } from '@/hooks/useRunnerLocationHistory';
import { RouteReplayControls } from './RouteReplayControls';
import { formatSmartDate } from '@/lib/formatters';
import { escapeHtml } from '@/lib/utils/sanitize';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN ?? '';

interface RouteReplayMapProps {
  locations: LocationPoint[];
  statistics?: RouteStatistics | null;
  runnerName?: string;
}

export function RouteReplayMap({ 
  locations, 
  statistics,
  runnerName = 'Runner' 
}: RouteReplayMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const runnerMarker = useRef<mapboxgl.Marker | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  
  // Playback state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const playbackInterval = useRef<NodeJS.Timeout | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;
    if (!MAPBOX_TOKEN || MAPBOX_TOKEN === '') return;

    try {
      mapboxgl.accessToken = MAPBOX_TOKEN;

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [-73.9808, 40.7648],
        zoom: 12,
      });

      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

      map.current.on('load', () => {
        setMapLoaded(true);
      });

      return () => {
        map.current?.remove();
      };
    } catch (error) {
      // Mapbox errors are handled silently - map just won't render
      if (import.meta.env.DEV) {
        logger.error('Mapbox error', error, { component: 'RouteReplayMap' });
      }
    }
  }, []);

  // Draw full route and update marker
  useEffect(() => {
    if (!map.current || !mapLoaded || locations.length === 0) return;

    // Clear existing route layers
    if (map.current.getLayer('route-line')) {
      map.current.removeLayer('route-line');
    }
    if (map.current.getLayer('route-traveled')) {
      map.current.removeLayer('route-traveled');
    }
    if (map.current.getSource('route')) {
      map.current.removeSource('route');
    }
    if (map.current.getSource('route-traveled')) {
      map.current.removeSource('route-traveled');
    }

    // Add full route
    const routeCoordinates = locations.map(loc => [loc.longitude, loc.latitude]);
    
    map.current.addSource('route', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: routeCoordinates,
        },
      },
    });

    map.current.addLayer({
      id: 'route-line',
      type: 'line',
      source: 'route',
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': '#cbd5e1',
        'line-width': 4,
        'line-dasharray': [2, 2],
      },
    });

    // Add traveled route
    const traveledCoordinates = routeCoordinates.slice(0, currentIndex + 1);
    
    map.current.addSource('route-traveled', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: traveledCoordinates.length > 1 ? traveledCoordinates : routeCoordinates.slice(0, 2),
        },
      },
    });

    map.current.addLayer({
      id: 'route-traveled',
      type: 'line',
      source: 'route-traveled',
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': '#3b82f6',
        'line-width': 5,
      },
    });

    // Fit bounds to show full route
    const bounds = new mapboxgl.LngLatBounds();
    routeCoordinates.forEach(coord => bounds.extend(coord as [number, number]));
    map.current.fitBounds(bounds, { padding: 50, maxZoom: 15 });

    // eslint-disable-next-line react-hooks/exhaustive-deps -- currentIndex is handled by the marker update effect; re-creating layers on every index change is unnecessary
  }, [mapLoaded, locations]);

  // Update runner marker position
  useEffect(() => {
    if (!map.current || !mapLoaded || locations.length === 0) return;

    const currentLocation = locations[currentIndex];
    if (!currentLocation) return;

    // Remove existing marker
    if (runnerMarker.current) {
      runnerMarker.current.remove();
    }

    // Create runner marker
    const el = document.createElement('div');
    el.className = 'runner-marker';
    el.style.width = '40px';
    el.style.height = '40px';
    el.style.backgroundColor = '#3b82f6';
    el.style.border = '3px solid white';
    el.style.borderRadius = '50%';
    el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.4)';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4z"/></svg>`;

    const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
      <div style="padding: 8px;">
        <h3 style="font-weight: 600; margin-bottom: 4px;">${escapeHtml(runnerName)}</h3>
        <p style="font-size: 12px; color: #555;">
          ${formatSmartDate(currentLocation.recorded_at, { includeTime: true })}
        </p>
        ${currentLocation.speed ? `
          <p style="font-size: 12px; margin-top: 4px;">
            Speed: <strong>${currentLocation.speed.toFixed(1)} km/h</strong>
          </p>
        ` : ''}
      </div>
    `);

    runnerMarker.current = new mapboxgl.Marker(el)
      .setLngLat([currentLocation.longitude, currentLocation.latitude])
      .setPopup(popup)
      .addTo(map.current!);

    // Update traveled route
    if (map.current.getSource('route-traveled')) {
      const traveledCoordinates = locations
        .slice(0, currentIndex + 1)
        .map(loc => [loc.longitude, loc.latitude]);
      
      (map.current.getSource('route-traveled') as mapboxgl.GeoJSONSource).setData({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: traveledCoordinates.length > 1 ? traveledCoordinates : locations.slice(0, 2).map(loc => [loc.longitude, loc.latitude]),
        },
      });
    }

  }, [currentIndex, locations, mapLoaded, runnerName]);

  // Playback logic
  useEffect(() => {
    if (isPlaying && currentIndex < locations.length - 1) {
      const interval = 1000 / playbackSpeed; // Adjust speed
      playbackInterval.current = setInterval(() => {
        setCurrentIndex(prev => {
          if (prev >= locations.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, interval);
    } else {
      if (playbackInterval.current) {
        clearInterval(playbackInterval.current);
        playbackInterval.current = null;
      }
    }

    return () => {
      if (playbackInterval.current) {
        clearInterval(playbackInterval.current);
      }
    };
  }, [isPlaying, currentIndex, locations.length, playbackSpeed]);

  if (!MAPBOX_TOKEN || MAPBOX_TOKEN === '') {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 text-amber-600">
          <AlertCircle className="h-5 w-5" />
          <div>
            <h3 className="font-semibold">Map Configuration Required</h3>
            <p className="text-sm text-muted-foreground">
              The Mapbox token needs to be configured. Please contact support.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="p-4 border-b bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Navigation className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Route Replay</h3>
              <Badge variant="outline">
                {locations.length} points
              </Badge>
            </div>
            {statistics && (
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span>{statistics.total_distance.toFixed(2)} km</span>
                </div>
                <Badge variant="secondary">
                  Avg: {statistics.average_speed.toFixed(1)} km/h
                </Badge>
              </div>
            )}
          </div>
        </div>

        <div 
          ref={mapContainer} 
          className="w-full h-[500px]"
          style={{ minHeight: '500px' }}
        />
      </Card>

      <RouteReplayControls
        locations={locations}
        currentIndex={currentIndex}
        isPlaying={isPlaying}
        playbackSpeed={playbackSpeed}
        onIndexChange={setCurrentIndex}
        onPlayPause={() => setIsPlaying(!isPlaying)}
        onReset={() => {
          setCurrentIndex(0);
          setIsPlaying(false);
        }}
        onSpeedChange={setPlaybackSpeed}
      />
    </div>
  );
}
