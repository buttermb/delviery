import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, Navigation, Layers, Route, Eye, EyeOff, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatStatus } from '@/utils/stringHelpers';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

interface OrderMapProps {
  orders: Array<{
    id: string;
    tracking_code: string;
    status: string;
    delivery_address: string;
    dropoff_lat?: number;
    dropoff_lng?: number;
    eta_minutes?: number;
    courier_id?: string;
    courier?: {
      full_name: string;
      current_lat?: number;
      current_lng?: number;
      vehicle_type?: string;
    };
  }>;
  activeCouriers?: Array<{
    id: string;
    full_name: string;
    current_lat?: number;
    current_lng?: number;
    vehicle_type?: string;
    rating?: number;
    is_online: boolean;
  }>;
  selectedOrderId?: string;
  onOrderSelect?: (orderId: string) => void;
}

export const OrderMap = ({ orders, activeCouriers = [], selectedOrderId, onOrderSelect }: OrderMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<{ [key: string]: mapboxgl.Marker }>({});
  const [mapLoaded, setMapLoaded] = useState(false);
  const [showRoutes, setShowRoutes] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showCouriers, setShowCouriers] = useState(true);
  const [mapStyle, setMapStyle] = useState<'streets' | 'satellite' | 'dark'>('streets');


  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      'pending': '#9ca3af',
      'confirmed': '#a855f7',
      'preparing': '#eab308',
      'out_for_delivery': '#3b82f6',
      'delivered': '#10b981',
      'cancelled': '#ef4444'
    };
    return colors[status] || '#9ca3af';
  };

  const getMapStyle = () => {
    const styles = {
      'streets': 'mapbox://styles/mapbox/streets-v12',
      'satellite': 'mapbox://styles/mapbox/satellite-streets-v12',
      'dark': 'mapbox://styles/mapbox/dark-v11'
    };
    return styles[mapStyle];
  };

  useEffect(() => {
    if (!mapContainer.current || !MAPBOX_TOKEN) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: getMapStyle(),
      center: [-73.935242, 40.730610], // NYC
      zoom: 11,
      pitch: 45,
      bearing: 0
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.current.addControl(new mapboxgl.FullscreenControl(), 'top-right');

    map.current.on('load', () => {
      setMapLoaded(true);
      
      // Add 3D buildings layer
      const layers = map.current!.getStyle().layers;
      const labelLayerId = layers?.find(
        (layer) => layer.type === 'symbol' && layer.layout?.['text-field']
      )?.id;

      map.current!.addLayer({
        'id': '3d-buildings',
        'source': 'composite',
        'source-layer': 'building',
        'filter': ['==', 'extrude', 'true'],
        'type': 'fill-extrusion',
        'minzoom': 15,
        'paint': {
          'fill-extrusion-color': '#aaa',
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': ['get', 'min_height'],
          'fill-extrusion-opacity': 0.6
        }
      }, labelLayerId);
    });

    return () => {
      map.current?.remove();
    };
  }, [mapStyle]);

  // Real-time courier position updates
  useEffect(() => {
    if (!mapLoaded) return;

    const channel = supabase
      .channel('courier-positions')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'couriers'
        },
        (payload) => {
          const courierId = payload.new.id;
          const marker = markersRef.current[`courier-${courierId}`];
          
          if (marker && payload.new.current_lat && payload.new.current_lng) {
            marker.setLngLat([payload.new.current_lng, payload.new.current_lat]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [mapLoaded]);

  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Clear existing markers
    Object.values(markersRef.current).forEach(marker => marker.remove());
    markersRef.current = {};

    // Remove existing route layers
    if (map.current.getLayer('routes')) map.current.removeLayer('routes');
    if (map.current.getSource('routes')) map.current.removeSource('routes');
    if (map.current.getLayer('heatmap')) map.current.removeLayer('heatmap');
    if (map.current.getSource('heatmap')) map.current.removeSource('heatmap');

    const bounds = new mapboxgl.LngLatBounds();
    let hasValidCoordinates = false;
    const routeFeatures: any[] = [];
    const heatmapPoints: any[] = [];

    orders.forEach(order => {
      const statusColor = getStatusColor(order.status);
      
      // Add delivery location marker
      if (order.dropoff_lat && order.dropoff_lng && 
          !isNaN(order.dropoff_lat) && !isNaN(order.dropoff_lng)) {
        
        const el = document.createElement('div');
        el.className = 'map-marker-delivery';
        const isSelected = order.id === selectedOrderId;
        const statusColor = getStatusColor(order.status);
        
        el.innerHTML = `
          <div style="
            width: ${isSelected ? '48px' : '40px'};
            height: ${isSelected ? '48px' : '40px'};
            background: ${statusColor};
            border: 3px solid white;
            border-radius: 50%;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: ${isSelected ? '24px' : '20px'};
            transition: all 0.3s ease;
            position: relative;
          ">
            📦
            ${order.status === 'out_for_delivery' ? `
              <div style="
                position: absolute;
                top: -4px;
                right: -4px;
                width: 12px;
                height: 12px;
                background: #10b981;
                border-radius: 50%;
                animation: pulse 2s infinite;
              "></div>
            ` : ''}
          </div>
        `;

        const popupContent = `
          <div style="padding: 12px; min-width: 200px;">
            <div style="font-weight: bold; font-size: 16px; margin-bottom: 8px; color: ${statusColor};">
              ${order.tracking_code}
            </div>
            <div style="font-size: 14px; margin-bottom: 4px;">
              📍 ${order.delivery_address}
            </div>
            <div style="font-size: 12px; color: #666; margin-bottom: 8px;">
              Status: <span style="color: ${statusColor}; font-weight: 600;">${formatStatus(order.status).toUpperCase()}</span>
            </div>
            ${order.eta_minutes ? `
              <div style="font-size: 12px; background: #eff6ff; padding: 6px; border-radius: 4px; border-left: 3px solid #3b82f6;">
                ⏱️ ETA: ${order.eta_minutes} min
              </div>
            ` : ''}
          </div>
        `;

        const marker = new mapboxgl.Marker(el)
          .setLngLat([order.dropoff_lng, order.dropoff_lat])
          .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(popupContent))
          .addTo(map.current!);

        el.addEventListener('click', () => onOrderSelect?.(order.id));
        markersRef.current[`order-${order.id}`] = marker;
        
        bounds.extend([order.dropoff_lng, order.dropoff_lat]);
        hasValidCoordinates = true;
        
        heatmapPoints.push({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [order.dropoff_lng, order.dropoff_lat]
          }
        });
      }

      // Add courier location marker with animation
      if (showCouriers && order.courier?.current_lat && order.courier?.current_lng &&
          !isNaN(order.courier.current_lat) && !isNaN(order.courier.current_lng)) {
        
        const courierEl = document.createElement('div');
        courierEl.innerHTML = `
          <div style="
            width: 50px;
            height: 50px;
            background: linear-gradient(135deg, #8b5cf6, #6366f1);
            border: 4px solid white;
            border-radius: 50%;
            cursor: pointer;
            box-shadow: 0 6px 16px rgba(139, 92, 246, 0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            animation: float 3s ease-in-out infinite;
            position: relative;
          ">
            🚗
            <div style="
              position: absolute;
              width: 100%;
              height: 100%;
              border: 2px solid #8b5cf6;
              border-radius: 50%;
              animation: ripple 2s infinite;
            "></div>
          </div>
        `;

        const courierPopup = `
          <div style="padding: 12px;">
            <div style="font-weight: bold; font-size: 16px; margin-bottom: 8px; color: #8b5cf6;">
              🚗 ${order.courier.full_name}
            </div>
            <div style="font-size: 12px; color: #666; margin-bottom: 4px;">
              Delivering: ${order.tracking_code}
            </div>
            <div style="font-size: 12px; color: #666;">
              Vehicle: ${order.courier.vehicle_type || 'N/A'}
            </div>
          </div>
        `;

        const courierMarker = new mapboxgl.Marker(courierEl)
          .setLngLat([order.courier.current_lng, order.courier.current_lat])
          .setPopup(new mapboxgl.Popup({ offset: 30 }).setHTML(courierPopup))
          .addTo(map.current!);

        markersRef.current[`courier-${order.courier_id}`] = courierMarker;
        bounds.extend([order.courier.current_lng, order.courier.current_lat]);
        hasValidCoordinates = true;

        // Draw route line if both pickup and dropoff exist
        if (showRoutes && order.dropoff_lat && order.dropoff_lng) {
          routeFeatures.push({
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: [
                [order.courier.current_lng, order.courier.current_lat],
                [order.dropoff_lng, order.dropoff_lat]
              ]
            },
            properties: {
              status: order.status,
              color: statusColor
            }
          });
        }
      }
    });

    // Add all active couriers that aren't assigned to orders
    if (showCouriers && activeCouriers && activeCouriers.length > 0) {
      activeCouriers.forEach(courier => {
        // Skip if courier already has a marker (is assigned to an order)
        if (markersRef.current[`courier-${courier.id}`]) return;
        
        if (courier.current_lat && courier.current_lng &&
            !isNaN(courier.current_lat) && !isNaN(courier.current_lng)) {
          
          const courierEl = document.createElement('div');
          courierEl.innerHTML = `
            <div style="
              width: 45px;
              height: 45px;
              background: linear-gradient(135deg, #10b981, #059669);
              border: 3px solid white;
              border-radius: 50%;
              cursor: pointer;
              box-shadow: 0 6px 16px rgba(16, 185, 129, 0.4);
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 22px;
              animation: float 3s ease-in-out infinite;
              position: relative;
            ">
              🚗
              <div style="
                position: absolute;
                top: -2px;
                right: -2px;
                width: 10px;
                height: 10px;
                background: #10b981;
                border: 2px solid white;
                border-radius: 50%;
                animation: pulse 2s infinite;
              "></div>
            </div>
          `;

          const courierPopup = `
            <div style="padding: 12px;">
              <div style="font-weight: bold; font-size: 16px; margin-bottom: 8px; color: #10b981;">
                🚗 ${courier.full_name}
              </div>
              <div style="font-size: 12px; color: #666; margin-bottom: 4px;">
                Status: <span style="color: #10b981; font-weight: 600;">AVAILABLE</span>
              </div>
              <div style="font-size: 12px; color: #666; margin-bottom: 4px;">
                Vehicle: ${courier.vehicle_type || 'N/A'}
              </div>
              <div style="font-size: 12px; color: #666;">
                Rating: ⭐ ${courier.rating?.toFixed(1) || '5.0'}
              </div>
            </div>
          `;

          const courierMarker = new mapboxgl.Marker(courierEl)
            .setLngLat([courier.current_lng, courier.current_lat])
            .setPopup(new mapboxgl.Popup({ offset: 28 }).setHTML(courierPopup))
            .addTo(map.current!);

          markersRef.current[`courier-${courier.id}`] = courierMarker;
          bounds.extend([courier.current_lng, courier.current_lat]);
          hasValidCoordinates = true;
        }
      });
    }

    // Add route lines
    if (showRoutes && routeFeatures.length > 0) {
      map.current.addSource('routes', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: routeFeatures
        }
      });

      map.current.addLayer({
        id: 'routes',
        type: 'line',
        source: 'routes',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 3,
          'line-opacity': 0.7,
          'line-dasharray': [2, 2]
        }
      });
    }

    // Add heatmap
    if (showHeatmap && heatmapPoints.length > 0) {
      map.current.addSource('heatmap', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: heatmapPoints
        }
      });

      map.current.addLayer({
        id: 'heatmap',
        type: 'heatmap',
        source: 'heatmap',
        paint: {
          'heatmap-weight': 1,
          'heatmap-intensity': 1,
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0, 'rgba(0, 0, 255, 0)',
            0.2, 'rgb(0, 255, 255)',
            0.4, 'rgb(0, 255, 0)',
            0.6, 'rgb(255, 255, 0)',
            0.8, 'rgb(255, 128, 0)',
            1, 'rgb(255, 0, 0)'
          ],
          'heatmap-radius': 30,
          'heatmap-opacity': 0.6
        }
      });
    }

    // Fit map to show all markers
    if (hasValidCoordinates && !bounds.isEmpty()) {
      map.current.fitBounds(bounds, {
        padding: 80,
        maxZoom: 14,
        duration: 1000
      });
    } else {
      map.current.flyTo({
        center: [-73.935242, 40.730610],
        zoom: 11,
        duration: 1000
      });
    }
  }, [orders, mapLoaded, selectedOrderId, onOrderSelect, showRoutes, showHeatmap, showCouriers, activeCouriers]);

  if (!MAPBOX_TOKEN) {
    return (
      <Card className="overflow-hidden">
        <div className="p-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Mapbox token not configured. Please add VITE_MAPBOX_TOKEN to your environment variables.
              <br />
              <a 
                href="https://mapbox.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="underline hover:text-destructive-foreground mt-2 inline-block"
              >
                Get your Mapbox token here →
              </a>
            </AlertDescription>
          </Alert>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.1); }
        }
        @keyframes ripple {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-5px); }
        }
      `}</style>
      <div className="p-4 border-b bg-muted/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-lg">Live Order Map</h3>
            <Badge variant="outline" className="bg-blue-500/10">
              <span className="w-2 h-2 rounded-full bg-blue-500 mr-2 animate-pulse"></span>
              {orders.length} Active
            </Badge>
          </div>
          <div className="flex gap-2">
            <Button
              variant={showRoutes ? "default" : "outline"}
              size="sm"
              onClick={() => setShowRoutes(!showRoutes)}
            >
              <Route className="h-4 w-4 mr-2" />
              Routes
            </Button>
            <Button
              variant={showCouriers ? "default" : "outline"}
              size="sm"
              onClick={() => setShowCouriers(!showCouriers)}
            >
              <Navigation className="h-4 w-4 mr-2" />
              Couriers
            </Button>
            <Button
              variant={showHeatmap ? "default" : "outline"}
              size="sm"
              onClick={() => setShowHeatmap(!showHeatmap)}
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              Heatmap
            </Button>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant={mapStyle === 'streets' ? "default" : "outline"}
            size="sm"
            onClick={() => setMapStyle('streets')}
          >
            Streets
          </Button>
          <Button
            variant={mapStyle === 'satellite' ? "default" : "outline"}
            size="sm"
            onClick={() => setMapStyle('satellite')}
          >
            Satellite
          </Button>
          <Button
            variant={mapStyle === 'dark' ? "default" : "outline"}
            size="sm"
            onClick={() => setMapStyle('dark')}
          >
            Dark
          </Button>
        </div>
        <div className="flex gap-2 mt-3 flex-wrap">
          <Badge variant="outline" className="bg-gray-500/10">
            <span className="w-2 h-2 rounded-full bg-gray-500 mr-2"></span>
            Pending
          </Badge>
          <Badge variant="outline" className="bg-purple-500/10">
            <span className="w-2 h-2 rounded-full bg-purple-500 mr-2"></span>
            Confirmed
          </Badge>
          <Badge variant="outline" className="bg-yellow-500/10">
            <span className="w-2 h-2 rounded-full bg-yellow-500 mr-2"></span>
            Preparing
          </Badge>
          <Badge variant="outline" className="bg-blue-500/10">
            <span className="w-2 h-2 rounded-full bg-blue-500 mr-2 animate-pulse"></span>
            En Route
          </Badge>
          <Badge variant="outline" className="bg-green-500/10">
            <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
            Delivered
          </Badge>
        </div>
      </div>
      <div ref={mapContainer} className="h-[600px] w-full" />
    </Card>
  );
};
