// @ts-ignore - react-map-gl type definitions
import Map, { Marker, Source, Layer } from 'react-map-gl';
import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Navigation as NavigationIcon, Phone, MapPin, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import 'mapbox-gl/dist/mapbox-gl.css';

interface Delivery {
  id: string;
  order_number: string;
  customer_name: string;
  delivery_address: string;
  total_amount: number;
  dropoff_lat: number;
  dropoff_lng: number;
  customer_phone?: string;
  eta?: string;
  status: string;
}

interface RouteViewProps {
  deliveries: Delivery[];
  currentLat?: number;
  currentLng?: number;
}

export function RouteView({ deliveries, currentLat, currentLng }: RouteViewProps) {
  const [route, setRoute] = useState<any>(null);
  const [mapboxToken] = useState(import.meta.env.VITE_MAPBOX_TOKEN || '');

  useEffect(() => {
    if (deliveries.length === 0 || !mapboxToken) return;

    const fetchRoute = async () => {
      try {
        // Create waypoints array
        const waypoints = deliveries.map(d => `${d.dropoff_lng},${d.dropoff_lat}`);
        
        // Add current location if available
        const coordinates = currentLat && currentLng 
          ? [`${currentLng},${currentLat}`, ...waypoints]
          : waypoints;

        // Fetch route from Mapbox Directions API
        const response = await fetch(
          `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates.join(';')}?geometries=geojson&access_token=${mapboxToken}`
        );
        
        const data = await response.json();
        if (data.routes && data.routes[0]) {
          setRoute(data.routes[0]);
        }
      } catch (error) {
        console.error('Error fetching route:', error);
      }
    };

    fetchRoute();
  }, [deliveries, currentLat, currentLng, mapboxToken]);

  const openNavigation = (delivery: Delivery) => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const url = isIOS
      ? `maps://maps.apple.com/?daddr=${delivery.dropoff_lat},${delivery.dropoff_lng}&dirflg=d`
      : `https://www.google.com/maps/dir/?api=1&destination=${delivery.dropoff_lat},${delivery.dropoff_lng}&travelmode=driving`;
    
    window.open(url, '_blank');
  };

  const callCustomer = (phone: string) => {
    window.location.href = `tel:${phone}`;
  };

  const centerLat = currentLat || deliveries[0]?.dropoff_lat || 40.7580;
  const centerLng = currentLng || deliveries[0]?.dropoff_lng || -73.9855;

  if (!mapboxToken) {
    return (
      <div className="p-4 bg-muted rounded-lg">
        <p className="text-sm text-muted-foreground">Map unavailable - Mapbox token not configured</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Map */}
      <div className="flex-1 relative">
        <Map
          mapboxAccessToken={mapboxToken}
          initialViewState={{
            latitude: centerLat,
            longitude: centerLng,
            zoom: 12
          }}
          style={{ width: '100%', height: '100%' }}
          mapStyle="mapbox://styles/mapbox/streets-v12"
        >
          {/* Current location marker */}
          {currentLat && currentLng && (
            <Marker latitude={currentLat} longitude={currentLng}>
              <div className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg" />
            </Marker>
          )}

          {/* Delivery markers */}
          {deliveries.map((delivery, index) => (
            <Marker
              key={delivery.id}
              latitude={delivery.dropoff_lat}
              longitude={delivery.dropoff_lng}
            >
              <div className="bg-primary text-white w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-lg border-2 border-white">
                {index + 1}
              </div>
            </Marker>
          ))}

          {/* Route line */}
          {route && (
            <Source type="geojson" data={route.geometry}>
              <Layer
                type="line"
                paint={{
                  'line-color': '#10b981',
                  'line-width': 4,
                  'line-opacity': 0.8
                }}
              />
            </Source>
          )}
        </Map>
      </div>

      {/* Delivery list */}
      <div className="h-72 overflow-y-auto bg-background border-t">
        <div className="p-4 space-y-3">
          <h3 className="font-bold text-lg mb-3">
            Deliveries ({deliveries.length})
          </h3>
          {deliveries.map((delivery, index) => (
              <Card key={delivery.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
                  {index + 1}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold truncate">{delivery.customer_name}</span>
                    <Badge variant="secondary" className="flex-shrink-0">{delivery.order_number}</Badge>
                  </div>
                  
                  <div className="flex items-start gap-1 text-sm text-muted-foreground mb-2">
                    <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span className="break-words">{delivery.delivery_address}</span>
                  </div>
                  
                  {delivery.eta && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>ETA: {delivery.eta}</span>
                    </div>
                  )}
                </div>
                
                <div className="text-right flex-shrink-0">
                  <div className="font-bold text-primary mb-2">${delivery.total_amount.toFixed(2)}</div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openNavigation(delivery)}
                    >
                      <NavigationIcon className="w-4 h-4" />
                    </Button>
                    {delivery.customer_phone && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => callCustomer(delivery.customer_phone!)}
                      >
                        <Phone className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}