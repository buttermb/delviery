import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWholesaleDeliveries } from "@/hooks/useWholesaleData";
import { Navigation, Clock, Package, AlertCircle } from "lucide-react";

const MAPBOX_TOKEN = "pk.eyJ1IjoibG92YWJsZSIsImEiOiJjbTZ4eXB4MHAwMmY1MmtzOHp1bGtnYTZrIn0.example";

interface LiveDeliveryMapProps {
  deliveryId?: string;
  showAll?: boolean;
}

export function LiveDeliveryMap({ deliveryId, showAll = false }: LiveDeliveryMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const { data: deliveries = [] } = useWholesaleDeliveries();

  // Filter deliveries based on props
  const activeDeliveries = deliveries.filter(d => 
    d.status === 'in_transit' && (showAll || d.id === deliveryId)
  );

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    try {
      mapboxgl.accessToken = MAPBOX_TOKEN;

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [-73.9808, 40.7648],
        zoom: 11,
      });

      map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

      map.current.on("load", () => {
        setMapLoaded(true);
      });

      return () => {
        map.current?.remove();
      };
    } catch (error) {
      console.error("Mapbox error:", error);
    }
  }, []);

  // Update runner positions every 30 seconds
  useEffect(() => {
    if (!map.current || !mapLoaded || activeDeliveries.length === 0) return;

    const updateMarkers = () => {
      // Clear existing markers
      const existingMarkers = document.querySelectorAll('.runner-marker, .destination-marker');
      existingMarkers.forEach(marker => marker.remove());

      activeDeliveries.forEach((delivery) => {
        // Get runner location from current_location field
        const runnerLocation = delivery.current_location as { lat: number; lng: number } | undefined;
        const runnerName = delivery.runner?.full_name || 'Runner';
        const clientName = 'Client'; // TODO: Add client name to query
        const orderNumber = delivery.order?.order_number || 'N/A';

        // Add runner marker (current position)
        if (runnerLocation && typeof runnerLocation.lat === 'number') {
          const runnerEl = document.createElement("div");
          runnerEl.className = "runner-marker";
          runnerEl.style.width = "40px";
          runnerEl.style.height = "40px";
          runnerEl.style.backgroundColor = "#3b82f6";
          runnerEl.style.border = "3px solid white";
          runnerEl.style.borderRadius = "50%";
          runnerEl.style.boxShadow = "0 2px 8px rgba(0,0,0,0.4)";
          runnerEl.style.display = "flex";
          runnerEl.style.alignItems = "center";
          runnerEl.style.justifyContent = "center";
          runnerEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z"/></svg>`;

          const runnerPopup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
            <div style="padding: 8px;">
              <h3 style="font-weight: 600; margin-bottom: 4px;">🚗 ${runnerName}</h3>
              <p style="font-size: 12px; color: #666; margin-bottom: 4px;">Order #${orderNumber}</p>
              <div style="font-size: 12px; color: #3b82f6; font-weight: 500;">In Transit</div>
            </div>
          `);

          new mapboxgl.Marker(runnerEl)
            .setLngLat([runnerLocation.lng, runnerLocation.lat])
            .setPopup(runnerPopup)
            .addTo(map.current!);

          // For demo, add a destination point offset from current location
          const destLng = runnerLocation.lng + 0.02;
          const destLat = runnerLocation.lat + 0.01;

          const destEl = document.createElement("div");
          destEl.className = "destination-marker";
          destEl.style.width = "36px";
          destEl.style.height = "36px";
          destEl.style.backgroundColor = "#10b981";
          destEl.style.border = "3px solid white";
          destEl.style.borderRadius = "50%";
          destEl.style.boxShadow = "0 2px 8px rgba(0,0,0,0.4)";
          destEl.style.display = "flex";
          destEl.style.alignItems = "center";
          destEl.style.justifyContent = "center";
          destEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/></svg>`;

          const destPopup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
            <div style="padding: 8px;">
              <h3 style="font-weight: 600; margin-bottom: 4px;">📍 Destination</h3>
              <p style="font-size: 12px; color: #666; margin-bottom: 4px;">${clientName}</p>
              <div style="font-size: 12px;">
                <span style="color: #666;">ETA:</span>
                <span style="font-weight: 500; margin-left: 4px;">~15 mins</span>
              </div>
            </div>
          `);

          new mapboxgl.Marker(destEl)
            .setLngLat([destLng, destLat])
            .setPopup(destPopup)
            .addTo(map.current!);

          // Draw route line
          if (map.current!.getSource('route-' + delivery.id)) {
            map.current!.removeLayer('route-' + delivery.id);
            map.current!.removeSource('route-' + delivery.id);
          }

          map.current!.addSource('route-' + delivery.id, {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: [
                  [runnerLocation.lng, runnerLocation.lat],
                  [destLng, destLat]
                ]
              }
            }
          });

          map.current!.addLayer({
            id: 'route-' + delivery.id,
            type: 'line',
            source: 'route-' + delivery.id,
            layout: {
              'line-join': 'round',
              'line-cap': 'round'
            },
            paint: {
              'line-color': '#3b82f6',
              'line-width': 3,
              'line-dasharray': [2, 2]
            }
          });

          // Fit bounds
          const bounds = new mapboxgl.LngLatBounds();
          bounds.extend([runnerLocation.lng, runnerLocation.lat]);
          bounds.extend([destLng, destLat]);
          map.current!.fitBounds(bounds, { padding: 100 });
        }
      });
    };

    updateMarkers();

    // Update every 30 seconds
    const interval = setInterval(updateMarkers, 30000);

    return () => clearInterval(interval);
  }, [mapLoaded, activeDeliveries]);

  if (!MAPBOX_TOKEN || MAPBOX_TOKEN.includes('example')) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 text-amber-600">
          <AlertCircle className="h-5 w-5" />
          <div>
            <h3 className="font-semibold">Mapbox Token Required</h3>
            <p className="text-sm text-muted-foreground">
              Add your Mapbox public token to enable live tracking.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="p-4 border-b bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Navigation className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Live Tracking</h3>
            <Badge variant="outline" className="gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              {activeDeliveries.length} Active
            </Badge>
          </div>
          <Button variant="ghost" size="sm" className="gap-2">
            <Clock className="h-4 w-4" />
            Auto-refresh: 30s
          </Button>
        </div>
      </div>

      {activeDeliveries.length > 0 && (
        <div className="p-4 border-b bg-background space-y-2">
          {activeDeliveries.map((delivery) => {
            const runnerName = delivery.runner?.full_name || 'Runner';
            const clientName = 'Client'; // TODO: Add client name to query
            const orderNumber = delivery.order?.order_number || 'N/A';
            
            return (
              <div key={delivery.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold">
                    {runnerName[0]}
                  </div>
                  <div>
                    <div className="font-medium">{runnerName}</div>
                    <div className="text-sm text-muted-foreground">
                      To: {clientName}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2 text-sm font-medium text-primary">
                    <Package className="h-4 w-4" />
                    #{orderNumber}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    ETA: ~15 mins
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div 
        ref={mapContainer} 
        className="w-full h-[500px]"
        style={{ minHeight: "500px" }}
      />
    </Card>
  );
}
