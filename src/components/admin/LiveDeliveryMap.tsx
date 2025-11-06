import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWholesaleDeliveries } from "@/hooks/useWholesaleData";
import { Navigation, Clock, Package, AlertCircle, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { calculateETA } from "@/lib/utils/eta-calculation";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || "";

interface LiveDeliveryMapProps {
  deliveryId?: string;
  showAll?: boolean;
}

// Global function for calling drivers (accessed from popup buttons)
declare global {
  interface Window {
    callDriver?: (driverId: string) => void;
  }
}

export function LiveDeliveryMap({ deliveryId, showAll = false }: LiveDeliveryMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<Map<string, { runner: mapboxgl.Marker; destination: mapboxgl.Marker }>>(new Map());
  const [mapLoaded, setMapLoaded] = useState(false);
  const { data: deliveries = [], refetch } = useWholesaleDeliveries();
  const etasRef = useRef<Map<string, { formatted: string; eta: Date }>>(new Map());
  
  // Set up global call driver function
  useEffect(() => {
    window.callDriver = (driverId: string) => {
      const delivery = deliveries.find(d => d.runner_id === driverId);
      if (delivery?.runner?.phone) {
        window.location.href = `tel:${delivery.runner.phone}`;
      } else {
        alert('Driver phone number not available');
      }
    };
    
    return () => {
      delete window.callDriver;
    };
  }, [deliveries]);

  // Filter deliveries based on props - include all active statuses
  const activeDeliveries = deliveries.filter(d => 
    ['in_transit', 'picked_up', 'assigned'].includes(d.status) && (showAll || d.id === deliveryId)
  );

  useEffect(() => {
    if (!mapContainer.current || map.current) return;
    if (!MAPBOX_TOKEN || MAPBOX_TOKEN === '') return;

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

  // Setup real-time updates for deliveries
  useEffect(() => {
    const channel = supabase
      .channel('delivery-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'wholesale_deliveries'
        },
        (payload) => {
          console.log('Delivery updated:', payload);
          refetch();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to delivery updates');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Channel error - failed to subscribe to delivery updates');
        } else if (status === 'TIMED_OUT') {
          console.error('Subscription timed out - retrying delivery updates');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  // Update markers when deliveries change
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const updateMarkers = () => {
      // Remove markers for deliveries that are no longer active
      const activeIds = new Set(activeDeliveries.map(d => d.id));
      markers.current.forEach((markerPair, id) => {
        if (!activeIds.has(id)) {
          markerPair.runner.remove();
          markerPair.destination.remove();
          markers.current.delete(id);
          
          // Remove route layer
          if (map.current!.getLayer('route-' + id)) {
            map.current!.removeLayer('route-' + id);
          }
          if (map.current!.getSource('route-' + id)) {
            map.current!.removeSource('route-' + id);
          }
        }
      });

      const bounds = new mapboxgl.LngLatBounds();
      let hasValidLocation = false;

      activeDeliveries.forEach((delivery) => {
        // Get runner location - use mock data if not available
        let runnerLocation = delivery.current_location as { lat: number; lng: number } | undefined;
        
        // If no location, use default NYC coordinates with small random offset
        if (!runnerLocation || typeof runnerLocation.lat !== 'number') {
          const baseOffset = Math.random() * 0.05;
          runnerLocation = {
            lat: 40.7648 + baseOffset,
            lng: -73.9808 + (baseOffset * 1.5)
          };
        }

        const runnerName = delivery.runner?.full_name || 'Runner';
        const clientName = 'Client'; // Will use actual address data when available
        const orderNumber = delivery.order?.order_number || 'N/A';

        // Destination (offset for demo)
        const destLng = runnerLocation.lng + 0.02;
        const destLat = runnerLocation.lat + 0.01;

        // Check if markers already exist
        const existingMarkers = markers.current.get(delivery.id);
        
        if (existingMarkers) {
          // Update existing markers
          existingMarkers.runner.setLngLat([runnerLocation.lng, runnerLocation.lat]);
          existingMarkers.destination.setLngLat([destLng, destLat]);
        } else {
          // Create new runner marker
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
          runnerEl.style.cursor = "pointer";
          runnerEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>`;

          // Calculate ETA for this delivery
          let etaDisplay = 'Calculating...';
          let etaResult = null;
          
          if (runnerLocation && typeof runnerLocation.lat === 'number') {
            calculateETA(
              [runnerLocation.lng, runnerLocation.lat],
              [destLng, destLat]
            ).then(result => {
              if (result) {
                etaResult = result;
                // Update popup with real ETA
                const updatedPopup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
                  <div style="padding: 8px;">
                    <h3 style="font-weight: 600; margin-bottom: 4px;">🚗 ${runnerName}</h3>
                    <p style="font-size: 12px; color: #666; margin-bottom: 4px;">Order #${orderNumber}</p>
                    ${etaResult ? `
                      <div style="font-size: 12px; margin-bottom: 4px;">
                        <span style="color: #666;">ETA:</span>
                        <span style="font-weight: 600; color: #10b981; margin-left: 4px;">${etaResult.formatted}</span>
                      </div>
                    ` : ''}
                    <div style="font-size: 12px; color: #3b82f6; font-weight: 500;">In Transit</div>
                    <button 
                      onclick="window.callDriver && window.callDriver('${delivery.runner_id || ''}')" 
                      style="margin-top: 6px; padding: 4px 8px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; width: 100%;"
                    >
                      📞 Call Driver
                    </button>
                  </div>
                `);
                runnerMarker.setPopup(updatedPopup);
              }
            });
          }

          const runnerPopup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
            <div style="padding: 8px;">
              <h3 style="font-weight: 600; margin-bottom: 4px;">🚗 ${runnerName}</h3>
              <p style="font-size: 12px; color: #666; margin-bottom: 4px;">Order #${orderNumber}</p>
              <div style="font-size: 12px; margin-bottom: 4px;">
                <span style="color: #666;">ETA:</span>
                <span style="font-weight: 600; color: #10b981; margin-left: 4px;">${etaDisplay}</span>
              </div>
              <div style="font-size: 12px; color: #3b82f6; font-weight: 500;">In Transit</div>
            </div>
          `);

          const runnerMarker = new mapboxgl.Marker(runnerEl)
            .setLngLat([runnerLocation.lng, runnerLocation.lat])
            .setPopup(runnerPopup)
            .addTo(map.current!);

          // Create destination marker
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
          destEl.style.cursor = "pointer";
          destEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/></svg>`;

          // Use calculated ETA if available, otherwise show calculating
          const destETADisplay = etaResult ? etaResult.formatted : 'Calculating...';
          
          const destPopup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
            <div style="padding: 8px;">
              <h3 style="font-weight: 600; margin-bottom: 4px;">📍 Destination</h3>
              <p style="font-size: 12px; color: #666; margin-bottom: 4px;">${clientName}</p>
              <div style="font-size: 12px;">
                <span style="color: #666;">ETA:</span>
                <span style="font-weight: 600; color: #10b981; margin-left: 4px;">${destETADisplay}</span>
              </div>
              ${etaResult ? `
                <div style="font-size: 11px; color: #999; margin-top: 4px;">
                  Arriving at ${etaResult.eta.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              ` : ''}
            </div>
          `);

          const destMarker = new mapboxgl.Marker(destEl)
            .setLngLat([destLng, destLat])
            .setPopup(destPopup)
            .addTo(map.current!);

          markers.current.set(delivery.id, { runner: runnerMarker, destination: destMarker });
        }

        // Update route line
        if (map.current!.getSource('route-' + delivery.id)) {
          (map.current!.getSource('route-' + delivery.id) as mapboxgl.GeoJSONSource).setData({
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: [
                [runnerLocation.lng, runnerLocation.lat],
                [destLng, destLat]
              ]
            }
          });
        } else {
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
        }

        // Add to bounds
        bounds.extend([runnerLocation.lng, runnerLocation.lat]);
        bounds.extend([destLng, destLat]);
        hasValidLocation = true;
      });

      // Fit bounds if we have locations
      if (hasValidLocation && !bounds.isEmpty()) {
        map.current!.fitBounds(bounds, { padding: 100, maxZoom: 14 });
      }
    };

    updateMarkers();
  }, [mapLoaded, activeDeliveries]);

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
            const clientName = 'Client'; // Will use actual address data when available
            const orderNumber = delivery.order?.order_number || 'N/A';
            
            return (
              <div key={delivery.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold">
                    🚗
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
