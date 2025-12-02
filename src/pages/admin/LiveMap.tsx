import { logger } from '@/lib/logger';
import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { 
  MapPin, Truck, Layers, Map as MapIcon, Search, 
  Phone, Navigation, Clock, Zap, Users, Activity,
  ChevronRight, RefreshCw, Maximize2, Filter, Eye
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { useMapboxToken } from '@/hooks/useMapboxToken';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { cn } from '@/lib/utils';

interface CourierLocation {
  id: string;
  full_name: string;
  is_online: boolean;
  current_lat: number;
  current_lng: number;
  phone?: string;
  status?: string;
  last_updated?: string;
}

export default function LiveMap() {
  const { tenant } = useTenantAdminAuth();
  const [couriers, setCouriers] = useState<CourierLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapStyle, setMapStyle] = useState<'streets' | 'satellite' | 'dark'>('dark');
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourier, setSelectedCourier] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
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

  // Filter couriers based on search
  const filteredCouriers = useMemo(() => {
    if (!searchQuery) return couriers;
    return couriers.filter(c => 
      c.full_name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [couriers, searchQuery]);

  // Stats
  const stats = useMemo(() => ({
    online: couriers.length,
    active: couriers.filter(c => c.status === 'delivering').length,
    idle: couriers.filter(c => c.status !== 'delivering').length,
  }), [couriers]);

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
      bearing: -17.6,
      antialias: true,
    });

    // Add controls
    map.current.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'top-right');
    map.current.addControl(new mapboxgl.FullscreenControl(), 'top-right');
    map.current.addControl(new mapboxgl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showUserHeading: true
    }), 'top-right');

    map.current.on('load', () => {
      setMapLoaded(true);

      // Add 3D buildings for immersive experience
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
              'fill-extrusion-color': mapStyle === 'dark' ? '#1a1a2e' : '#aaa',
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

        // Add atmosphere effect for dark mode
        if (mapStyle === 'dark') {
          map.current.setFog({
            color: 'rgb(20, 20, 30)',
            'high-color': 'rgb(36, 36, 50)',
            'horizon-blend': 0.02,
            'space-color': 'rgb(11, 11, 25)',
            'star-intensity': 0.6
          });
        }
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

    // Auto-refresh every 30 seconds
    const refreshInterval = setInterval(() => {
      loadCourierLocations();
      setLastRefresh(new Date());
    }, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(refreshInterval);
    };
  }, [tenant?.id]);

  const loadCourierLocations = async () => {
    if (!tenant?.id) return;

    try {
      const { data, error } = await supabase
        .from('couriers')
        .select('id, full_name, is_online, current_lat, current_lng, phone, status')
        .eq('tenant_id', tenant.id)
        .eq('is_online', true)
        .not('current_lat', 'is', null)
        .not('current_lng', 'is', null);

      if (error) throw error;
      setCouriers(data || []);
      setLastRefresh(new Date());
    } catch (error) {
      logger.error('Error loading courier locations', error, { component: 'LiveMap' });
      toast.error('Failed to load courier locations');
    } finally {
      setLoading(false);
    }
  };

  // Focus on a specific courier
  const focusOnCourier = (courier: CourierLocation) => {
    setSelectedCourier(courier.id);
    if (map.current) {
      map.current.flyTo({
        center: [courier.current_lng, courier.current_lat],
        zoom: 16,
        pitch: 60,
        bearing: Math.random() * 360,
        duration: 2000,
        essential: true
      });

      // Open the popup for this marker
      const marker = markers.current[courier.id];
      if (marker) {
        marker.togglePopup();
      }
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
        // Create new marker with enhanced styling
        const el = document.createElement('div');
        el.className = 'courier-marker';
        el.innerHTML = `
          <div class="relative group cursor-pointer">
            <div class="absolute inset-0 bg-emerald-500/30 rounded-full animate-ping"></div>
            <div class="absolute inset-0 bg-emerald-500/20 rounded-full animate-pulse scale-150"></div>
            <div class="relative bg-gradient-to-br from-emerald-400 to-emerald-600 text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg shadow-emerald-500/30 border-2 border-white/80 hover:scale-110 transition-all duration-300">
              <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"/>
                <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z"/>
              </svg>
            </div>
          </div>
        `;

        const popup = new mapboxgl.Popup({ 
          offset: 25,
          closeButton: false,
          className: 'courier-popup'
        }).setHTML(`
          <div class="p-4 min-w-[200px]">
            <div class="flex items-center gap-3 mb-3">
              <div class="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-bold">
                ${courier.full_name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div class="font-semibold text-sm">${courier.full_name}</div>
                <div class="flex items-center gap-1">
                  <span class="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span class="text-xs text-gray-500">Online</span>
                </div>
              </div>
            </div>
            <div class="space-y-2 text-xs text-gray-600 border-t pt-2">
              <div class="flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
                <span>${courier.current_lat.toFixed(4)}, ${courier.current_lng.toFixed(4)}</span>
              </div>
              ${courier.phone ? `
                <a href="tel:${courier.phone}" class="flex items-center gap-2 text-emerald-600 hover:text-emerald-700 font-medium">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                  </svg>
                  Call Driver
                </a>
              ` : ''}
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
    if (couriers.length > 0 && !selectedCourier) {
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
            'heatmap-color': [
              'interpolate',
              ['linear'],
              ['heatmap-density'],
              0, 'rgba(33,102,172,0)',
              0.2, 'rgb(103,169,207)',
              0.4, 'rgb(209,229,240)',
              0.6, 'rgb(253,219,199)',
              0.8, 'rgb(239,138,98)',
              1, 'rgb(178,24,43)'
            ]
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
          <Card className="p-8 bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-red-500/20 flex items-center justify-center">
                <MapPin className="h-8 w-8 text-red-400" />
              </div>
              <h3 className="text-xl font-semibold text-white">Map Configuration Required</h3>
              <p className="text-sm text-gray-400 max-w-md mx-auto">
                The Mapbox token needs to be configured to enable real-time fleet tracking. 
                Please contact your administrator.
              </p>
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

      <div className={cn(
        "flex flex-col h-[calc(100vh-4rem)]",
        isFullscreen && "fixed inset-0 z-50 h-screen bg-background"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Navigation className="h-6 w-6 text-emerald-500" />
                Live Fleet Map
              </h1>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Clock className="h-3 w-3" />
                Last updated: {lastRefresh.toLocaleTimeString()}
              </p>
            </div>
            <Badge variant="outline" className="gap-1 px-3 py-1 border-emerald-500/50 bg-emerald-500/10 text-emerald-600">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              {stats.online} Online
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadCourierLocations()}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="gap-2"
            >
              <Maximize2 className="h-4 w-4" />
              {isFullscreen ? 'Exit' : 'Fullscreen'}
            </Button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-80 border-r bg-muted/30 flex flex-col overflow-hidden">
            {/* Stats */}
            <div className="p-4 border-b grid grid-cols-3 gap-2">
              <Card className="p-3 bg-emerald-500/10 border-emerald-500/30">
                <div className="text-2xl font-bold text-emerald-600">{stats.online}</div>
                <div className="text-xs text-muted-foreground">Online</div>
              </Card>
              <Card className="p-3 bg-blue-500/10 border-blue-500/30">
                <div className="text-2xl font-bold text-blue-600">{stats.active}</div>
                <div className="text-xs text-muted-foreground">Delivering</div>
              </Card>
              <Card className="p-3 bg-amber-500/10 border-amber-500/30">
                <div className="text-2xl font-bold text-amber-600">{stats.idle}</div>
                <div className="text-xs text-muted-foreground">Available</div>
              </Card>
            </div>

            {/* Search */}
            <div className="p-4 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search drivers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Courier List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">
                  <RefreshCw className="h-6 w-6 mx-auto animate-spin mb-2" />
                  Loading drivers...
                </div>
              ) : filteredCouriers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No drivers online</p>
                </div>
              ) : (
                filteredCouriers.map((courier) => (
                  <Card
                    key={courier.id}
                    className={cn(
                      "p-3 cursor-pointer transition-all hover:shadow-md hover:border-emerald-500/50",
                      selectedCourier === courier.id && "border-emerald-500 bg-emerald-500/10"
                    )}
                    onClick={() => focusOnCourier(courier)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-bold shadow-sm">
                        {courier.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{courier.full_name}</div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Online
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                    {courier.phone && (
                      <a
                        href={`tel:${courier.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-2 flex items-center gap-2 text-xs text-emerald-600 hover:text-emerald-700"
                      >
                        <Phone className="h-3 w-3" />
                        {courier.phone}
                      </a>
                    )}
                  </Card>
                ))
              )}
            </div>
          </div>

          {/* Map Container */}
          <div className="flex-1 relative">
            {/* Map Controls Overlay */}
            <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
              <Card className="p-1 flex gap-1 bg-background/95 backdrop-blur-sm shadow-lg">
                <Button
                  variant={mapStyle === 'dark' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setMapStyle('dark')}
                  className="gap-1"
                >
                  <MapIcon className="h-4 w-4" />
                  Dark
                </Button>
                <Button
                  variant={mapStyle === 'streets' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setMapStyle('streets')}
                  className="gap-1"
                >
                  <MapIcon className="h-4 w-4" />
                  Streets
                </Button>
                <Button
                  variant={mapStyle === 'satellite' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setMapStyle('satellite')}
                  className="gap-1"
                >
                  <Layers className="h-4 w-4" />
                  Satellite
                </Button>
              </Card>
              
              <Button
                variant={showHeatmap ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowHeatmap(!showHeatmap)}
                className="gap-2 bg-background/95 backdrop-blur-sm shadow-lg"
              >
                <Activity className="h-4 w-4" />
                Heatmap
              </Button>
            </div>

            {/* Map */}
            <div
              ref={mapContainer}
              className="w-full h-full"
            />
          </div>
        </div>
      </div>

      <style>{`
        .courier-marker {
          cursor: pointer;
        }
        
        .courier-popup .mapboxgl-popup-content {
          padding: 0;
          border-radius: 12px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.2);
          border: 1px solid rgba(0,0,0,0.1);
        }
        
        .courier-popup .mapboxgl-popup-tip {
          border-top-color: white;
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
        
        .mapboxgl-ctrl-group {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(8px);
          border-radius: 8px !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
        }
        
        .mapboxgl-ctrl-group button {
          border-radius: 6px !important;
        }
      `}</style>
    </>
  );
}
