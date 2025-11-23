import { logger } from '@/lib/logger';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { MapPin, Truck, Layers, Map as MapIcon } from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { useMapboxToken } from '@/hooks/useMapboxToken';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

interface CourierLocation {
  id: string;
  full_name: string;
  is_online: boolean;
  current_lat: number;
  current_lng: number;
}

export default function LiveMap() {
  const [couriers, setCouriers] = useState<CourierLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapStyle, setMapStyle] = useState<'streets' | 'satellite' | 'dark'>('streets');
  const [showHeatmap, setShowHeatmap] = useState(false);
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<{ [key: string]: mapboxgl.Marker }>({});
  const [mapLoaded, setMapLoaded] = useState(false);

  const { token: mapboxToken, loading: tokenLoading } = useMapboxToken();

  // Map style URLs
  const mapStyles = {
    streets: 'mapbox://styles/mapbox/streets-v12',
    satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
    dark: 'mapbox://styles/mapbox/dark-v11'
  };

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: mapStyles[mapStyle],
      center: [-73.935242, 40.730610], // NYC center
      zoom: 12,
      pitch: 45,
    });

    // Add controls
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.current.addControl(new mapboxgl.FullscreenControl(), 'top-right');

    map.current.on('load', () => {
      setMapLoaded(true);

      // Add 3D buildings
      if (map.current) {
        const layers = map.current.getStyle().layers;
        const labelLayerId = layers?.find(
          (layer) => layer.type === 'symbol' && layer.layout?.['text-field']
        )?.id;

        map.current.addLayer(
          {
            id: '3d-buildings',
            source: 'composite',
            'source-layer': 'building',
            filter: ['==', 'extrude', 'true'],
            type: 'fill-extrusion',
            minzoom: 15,
            paint: {
              'fill-extrusion-color': '#aaa',
              'fill-extrusion-height': [
                'interpolate',
                ['linear'],
                ['zoom'],
                15,
                0,
                15.05,
                ['get', 'height'],
              ],
              'fill-extrusion-base': [
                'interpolate',
                ['linear'],
                ['zoom'],
                15,
                0,
                15.05,
                ['get', 'min_height'],
              ],
              'fill-extrusion-opacity': 0.6,
            },
          },
          labelLayerId
        );
      }
    });

    return () => {
      map.current?.remove();
    };
  }, [mapboxToken]);

  // Change map style
  useEffect(() => {
    if (map.current && mapLoaded) {
      map.current.setStyle(mapStyles[mapStyle]);
    }
  }, [mapStyle, mapLoaded]);

  // Load couriers
  useEffect(() => {
    loadCourierLocations();

    // Set up realtime subscription
    const channel = supabase
      .channel('couriers-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'couriers'
        },
        () => {
          loadCourierLocations();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.info('Realtime subscription active', { component: 'LiveMap', table: 'couriers' });
        } else if (status === 'CHANNEL_ERROR') {
          logger.warn('Realtime subscription error, retrying', { component: 'LiveMap' });
          setTimeout(() => loadCourierLocations(), 5000);
        } else if (status === 'TIMED_OUT') {
          logger.error('Realtime subscription timed out', null, { component: 'LiveMap' });
          loadCourierLocations();
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadCourierLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('couriers')
        .select('id, full_name, is_online, current_lat, current_lng')
        .eq('is_online', true)
        .not('current_lat', 'is', null)
        .not('current_lng', 'is', null);

      if (error) throw error;
      setCouriers(data || []);
    } catch (error) {
      logger.error('Error loading courier locations', error, { component: 'LiveMap' });
      toast.error('Failed to load courier locations');
    } finally {
      setLoading(false);
    }
  };

  // Update markers when couriers change
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Remove markers that no longer exist
    Object.keys(markers.current).forEach((courierId) => {
      if (!couriers.find((c) => c.id === courierId)) {
        markers.current[courierId].remove();
        delete markers.current[courierId];
      }
    });

    // Add or update markers
    couriers.forEach((courier) => {
      if (markers.current[courier.id]) {
        // Update existing marker
        markers.current[courier.id].setLngLat([courier.current_lng, courier.current_lat]);
      } else {
        // Create new marker
        const el = document.createElement('div');
        el.className = 'courier-marker';
        el.innerHTML = `
          <div class="relative">
            <div class="absolute inset-0 bg-primary/20 rounded-full animate-ping"></div>
            <div class="relative bg-gradient-to-br from-primary to-primary/80 text-primary-foreground rounded-full w-12 h-12 flex items-center justify-center shadow-lg border-2 border-background hover:scale-110 transition-transform cursor-pointer">
              <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"/>
                <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z"/>
              </svg>
            </div>
          </div>
        `;

        const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
          <div class="p-2">
            <div class="font-semibold text-sm mb-1">${courier.full_name}</div>
            <div class="flex items-center gap-1 mb-1">
              <span class="inline-block w-2 h-2 rounded-full" style="background-color: hsl(var(--success))"></span>
              <span class="text-xs text-muted-foreground">Online</span>
            </div>
            <div class="text-xs text-muted-foreground">
              ${courier.current_lat.toFixed(4)}, ${courier.current_lng.toFixed(4)}
            </div>
          </div>
        `);

        const marker = new mapboxgl.Marker(el)
          .setLngLat([courier.current_lng, courier.current_lat])
          .setPopup(popup)
          .addTo(map.current!);

        markers.current[courier.id] = marker;
      }
    });

    // Fit bounds to show all couriers
    if (couriers.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      couriers.forEach((courier) => {
        bounds.extend([courier.current_lng, courier.current_lat]);
      });
      map.current.fitBounds(bounds, { padding: 100, maxZoom: 15 });
    }
  }, [couriers, mapLoaded]);

  // Toggle heatmap
  useEffect(() => {
    if (!map.current || !mapLoaded || couriers.length === 0) return;

    if (showHeatmap) {
      if (!map.current.getSource('couriers-heat')) {
        map.current.addSource('couriers-heat', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: couriers.map((courier) => ({
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'Point',
                coordinates: [courier.current_lng, courier.current_lat],
              },
            })),
          },
        });

        map.current.addLayer({
          id: 'couriers-heat-layer',
          type: 'heatmap',
          source: 'couriers-heat',
          paint: {
            'heatmap-weight': 1,
            'heatmap-intensity': 1,
            'heatmap-radius': 50,
            'heatmap-opacity': 0.7,
          },
        });
      }
    } else {
      if (map.current.getLayer('couriers-heat-layer')) {
        map.current.removeLayer('couriers-heat-layer');
      }
      if (map.current.getSource('couriers-heat')) {
        map.current.removeSource('couriers-heat');
      }
    }
  }, [showHeatmap, couriers, mapLoaded]);

  if (!mapboxToken) {
    return (
      <>
        <SEOHead
          title="Live Map | Admin"
          description="Real-time courier tracking"
        />
        <div className="container mx-auto p-6">
          <Card className="p-6">
            <div className="text-center space-y-2">
              <MapPin className="h-12 w-12 mx-auto text-destructive" />
              <p className="text-sm text-muted-foreground">Mapbox token not configured</p>
            </div>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <SEOHead
        title="Live Map | Admin"
        description="Real-time courier tracking"
      />

      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Live Courier Map</h1>
          <Badge variant="default" className="animate-pulse">Live</Badge>
        </div>

        <Card className="p-4">
          <div className="flex gap-2 mb-4 flex-wrap">
            <Button
              variant={mapStyle === 'streets' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMapStyle('streets')}
            >
              <MapIcon className="h-4 w-4 mr-1" />
              Streets
            </Button>
            <Button
              variant={mapStyle === 'satellite' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMapStyle('satellite')}
            >
              <Layers className="h-4 w-4 mr-1" />
              Satellite
            </Button>
            <Button
              variant={mapStyle === 'dark' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMapStyle('dark')}
            >
              <MapIcon className="h-4 w-4 mr-1" />
              Dark
            </Button>
            <Button
              variant={showHeatmap ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowHeatmap(!showHeatmap)}
            >
              <Layers className="h-4 w-4 mr-1" />
              Heatmap
            </Button>
          </div>

          <div
            ref={mapContainer}
            className="w-full h-[600px] rounded-lg overflow-hidden shadow-lg"
          />

          <div className="mt-4 space-y-2">
            <h3 className="font-semibold flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Online Couriers ({couriers.length})
            </h3>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : couriers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No couriers online</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {couriers.map((courier) => (
                  <Card key={courier.id} className="p-3 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{courier.full_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {courier.current_lat?.toFixed(4)}, {courier.current_lng?.toFixed(4)}
                        </p>
                      </div>
                      <Badge variant="default" className="text-xs">Online</Badge>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      <style>{`
        .courier-marker {
          cursor: pointer;
        }
        
        .mapboxgl-popup-content {
          padding: 0;
          border-radius: 0.5rem;
        }
        
        @keyframes ping {
          75%, 100% {
            transform: scale(2);
            opacity: 0;
          }
        }
        
        .animate-ping {
          animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
      `}</style>
    </>
  );
}
