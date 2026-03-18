import { logger } from '@/lib/logger';
import { useEffect, useRef, useState, useMemo } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWholesaleDeliveries } from "@/hooks/useWholesaleData";
import {
  Navigation, Package, AlertCircle,
  Truck, MapPin, ChevronRight, RefreshCw,
  Timer, User
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { calculateETA } from "@/lib/utils/eta-calculation";
import { formatSmartDate } from '@/lib/formatters';
import { useMapboxToken } from "@/hooks/useMapboxToken";
import { showErrorToast } from "@/utils/toastHelpers";
import { cn } from "@/lib/utils";
import { escapeHtml } from '@/lib/utils/sanitize';
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";

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
  const { tenant } = useTenantAdminAuth();
  const { token: MAPBOX_TOKEN } = useMapboxToken();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<Map<string, { runner: mapboxgl.Marker; destination: mapboxgl.Marker }>>(new Map());
  const [mapLoaded, setMapLoaded] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<string | null>(null);
  const { data: deliveries = [], refetch } = useWholesaleDeliveries();
  const etasRef = useRef<Map<string, { formatted: string; eta: Date }>>(new Map());

  // Set up global call driver function
  useEffect(() => {
    window.callDriver = (driverId: string) => {
      const delivery = deliveries.find(d => d.runner_id === driverId);
      if (delivery?.runner?.phone) {
        window.location.href = `tel:${delivery.runner.phone}`;
      } else {
        showErrorToast("Driver phone number not available");
      }
    };

    return () => {
      delete window.callDriver;
    };
  }, [deliveries]);

  // Filter deliveries based on props - include all active statuses
  const activeDeliveries = useMemo(() => 
    deliveries.filter(d =>
      ['in_transit', 'picked_up', 'assigned'].includes(d.status) && (showAll || d.id === deliveryId)
    ),
    [deliveries, showAll, deliveryId]
  );

  // Stats
  const stats = useMemo(() => ({
    total: activeDeliveries.length,
    inTransit: activeDeliveries.filter(d => d.status === 'in_transit').length,
    pickedUp: activeDeliveries.filter(d => d.status === 'picked_up').length,
    assigned: activeDeliveries.filter(d => d.status === 'assigned').length,
  }), [activeDeliveries]);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;
    if (!MAPBOX_TOKEN || MAPBOX_TOKEN === '') return;

    try {
      mapboxgl.accessToken = MAPBOX_TOKEN;

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [-73.9808, 40.7648],
        zoom: 11,
        pitch: 45,
        bearing: -17.6,
        antialias: true,
      });

      map.current.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "top-right");

      map.current.on("load", () => {
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
                'fill-extrusion-color': '#1a1a2e',
                'fill-extrusion-height': ['get', 'height'],
                'fill-extrusion-base': ['get', 'min_height'],
                'fill-extrusion-opacity': 0.6,
              },
            },
            labelLayerId
          );

          // Add atmosphere
          map.current.setFog({
            color: 'rgb(20, 20, 30)',
            'high-color': 'rgb(36, 36, 50)',
            'horizon-blend': 0.02,
            'space-color': 'rgb(11, 11, 25)',
            'star-intensity': 0.6
          });
        }
      });

      return () => {
        map.current?.remove();
      };
    } catch (error) {
      logger.error("Mapbox error", error as Error, { component: 'LiveDeliveryMap' });
    }
  }, [MAPBOX_TOKEN]);

  // Setup real-time updates for deliveries
  useEffect(() => {
    if (!tenant?.id) return;

    const channel = supabase
      .channel(`delivery-updates-${tenant.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'wholesale_deliveries',
          filter: `tenant_id=eq.${tenant.id}`,
        },
        (payload) => {
          logger.debug('Delivery updated', { payload, component: 'LiveDeliveryMap' });
          refetch();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.debug('Successfully subscribed to delivery updates', { component: 'LiveDeliveryMap' });
        } else if (status === 'CHANNEL_ERROR') {
          logger.error('Channel error - failed to subscribe to delivery updates', { component: 'LiveDeliveryMap' });
        } else if (status === 'TIMED_OUT') {
          logger.error('Subscription timed out - retrying delivery updates', { component: 'LiveDeliveryMap' });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenant?.id, refetch]);

  // Focus on delivery
  const focusOnDelivery = (deliveryId: string) => {
    setSelectedDelivery(deliveryId);
    const delivery = activeDeliveries.find(d => d.id === deliveryId);
    if (!delivery || !map.current) return;

    let runnerLocation = delivery.current_location as { lat: number; lng: number } | undefined;
    if (!runnerLocation || typeof runnerLocation.lat !== 'number') {
      runnerLocation = { lat: 40.7648, lng: -73.9808 };
    }

    map.current.flyTo({
      center: [runnerLocation.lng, runnerLocation.lat],
      zoom: 15,
      pitch: 60,
      bearing: Math.random() * 360,
      duration: 2000,
      essential: true
    });

    const markerPair = markers.current.get(deliveryId);
    if (markerPair) {
      markerPair.runner.togglePopup();
    }
  };

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

      activeDeliveries.forEach((delivery, deliveryIndex) => {
        // Get runner location - use mock data if not available
        let runnerLocation = delivery.current_location as { lat: number; lng: number } | undefined;

        // If no location, use deterministic fallback based on delivery index (no random values)
        if (!runnerLocation || typeof runnerLocation.lat !== 'number') {
          // Deterministic offset based on delivery index for consistent positioning
          const baseOffset = 0.01 * (deliveryIndex + 1);
          runnerLocation = {
            lat: 40.7648 + baseOffset,
            lng: -73.9808 + (baseOffset * 1.2)
          };
        }

        const runnerName = delivery.runner?.full_name || 'Runner';
        const clientName = ((delivery as unknown as Record<string, unknown>).delivery_address as string | undefined)?.split(',')[0] || ((delivery.order as unknown as Record<string, unknown> | null)?.delivery_address as string | undefined)?.split(',')[0] || 'Client';
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
          // Create new runner marker with enhanced styling
          const runnerEl = document.createElement("div");
          runnerEl.className = "runner-marker";
          runnerEl.innerHTML = `
            <div class="relative">
              <div class="absolute inset-0 bg-blue-500/30 rounded-full animate-ping"></div>
              <div class="absolute inset-0 bg-blue-500/20 rounded-full animate-pulse scale-150"></div>
              <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #3b82f6, #1d4ed8); border: 3px solid white; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(59, 130, 246, 0.5); cursor: pointer; transition: transform 0.2s;">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white">
                  <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
                </svg>
              </div>
            </div>
          `;

          // Calculate ETA for this delivery
          if (runnerLocation && typeof runnerLocation.lat === 'number') {
            calculateETA(
              [runnerLocation.lng, runnerLocation.lat],
              [destLng, destLat]
            ).then(result => {
              if (result) {
                etasRef.current.set(delivery.id, result);
                // Update popup with real ETA
                const updatedPopup = new mapboxgl.Popup({
                  offset: 25,
                  closeButton: false,
                  className: 'delivery-popup'
                }).setHTML(`
                  <div style="padding: 16px; min-width: 220px;">
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                      <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #3b82f6, #1d4ed8); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">
                        ${escapeHtml(runnerName.charAt(0).toUpperCase())}
                      </div>
                      <div>
                        <div style="font-weight: 600; font-size: 14px;">${escapeHtml(runnerName)}</div>
                        <div style="font-size: 12px; color: #6b7280;">Order #${escapeHtml(orderNumber)}</div>
                      </div>
                    </div>
                    <div style="background: #f0fdf4; border-radius: 8px; padding: 8px 12px; margin-bottom: 12px;">
                      <div style="font-size: 11px; color: #6b7280; text-transform: uppercase;">Estimated Arrival</div>
                      <div style="font-size: 18px; font-weight: 700; color: #059669;">${result.formatted}</div>
                      <div style="font-size: 11px; color: #6b7280;">at ${formatSmartDate(result.eta, { includeTime: true })}</div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                      <button
                        onclick="window.callDriver && window.callDriver('${escapeHtml(delivery.runner_id ?? '')}')"
                        style="flex: 1; padding: 8px 12px; background: #3b82f6; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: 500; display: flex; align-items: center; justify-content: center; gap: 6px;"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
                        Call
                      </button>
                    </div>
                  </div>
                `);
                runnerMarker.setPopup(updatedPopup);
              }
            });
          }

          const runnerPopup = new mapboxgl.Popup({
            offset: 25,
            closeButton: false,
            className: 'delivery-popup'
          }).setHTML(`
            <div style="padding: 16px; min-width: 220px;">
              <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #3b82f6, #1d4ed8); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">
                  ${escapeHtml(runnerName.charAt(0).toUpperCase())}
                </div>
                <div>
                  <div style="font-weight: 600; font-size: 14px;">${escapeHtml(runnerName)}</div>
                  <div style="font-size: 12px; color: #6b7280;">Order #${escapeHtml(orderNumber)}</div>
                </div>
              </div>
              <div style="background: #fef3c7; border-radius: 8px; padding: 8px 12px; margin-bottom: 12px;">
                <div style="font-size: 11px; color: #6b7280; text-transform: uppercase;">Status</div>
                <div style="font-size: 14px; font-weight: 600; color: #d97706;">Calculating ETA...</div>
              </div>
            </div>
          `);

          const runnerMarker = new mapboxgl.Marker(runnerEl)
            .setLngLat([runnerLocation.lng, runnerLocation.lat])
            .setPopup(runnerPopup)
            .addTo(map.current!);

          // Create destination marker with enhanced styling
          const destEl = document.createElement("div");
          destEl.className = "destination-marker";
          destEl.innerHTML = `
            <div class="relative">
              <div class="absolute inset-0 bg-emerald-500/20 rounded-full animate-pulse scale-150"></div>
              <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #10b981, #059669); border: 3px solid white; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.5); cursor: pointer;">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="white">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                </svg>
              </div>
            </div>
          `;

          const destPopup = new mapboxgl.Popup({
            offset: 25,
            closeButton: false,
            className: 'delivery-popup'
          }).setHTML(`
            <div style="padding: 16px; min-width: 200px;">
              <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                <div style="width: 36px; height: 36px; background: linear-gradient(135deg, #10b981, #059669); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/></svg>
                </div>
                <div>
                  <div style="font-weight: 600; font-size: 14px;">Destination</div>
                  <div style="font-size: 12px; color: #6b7280;">${escapeHtml(clientName)}</div>
                </div>
              </div>
              <div style="font-size: 12px; color: #6b7280; padding-top: 8px; border-top: 1px solid #e5e7eb;">
                ${escapeHtml((delivery as unknown as Record<string, unknown>).delivery_address as string | undefined || (delivery.order as unknown as Record<string, unknown> | null)?.delivery_address as string | undefined || 'Address pending')}
              </div>
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
              'line-width': 4,
              'line-dasharray': [0.5, 1.5],
              'line-opacity': 0.8
            }
          });
        }

        // Add to bounds
        bounds.extend([runnerLocation.lng, runnerLocation.lat]);
        bounds.extend([destLng, destLat]);
        hasValidLocation = true;
      });

      // Fit bounds if we have locations
      if (hasValidLocation && !bounds.isEmpty() && !selectedDelivery) {
        map.current!.fitBounds(bounds, { padding: 100, maxZoom: 14 });
      }
    };

    updateMarkers();
  }, [mapLoaded, activeDeliveries, selectedDelivery]);

  if (!MAPBOX_TOKEN || MAPBOX_TOKEN === '') {
    return (
      <Card data-dark-panel className="overflow-hidden bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700">
        <CardContent className="p-8">
          <div className="flex items-center gap-4 text-amber-400">
            <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Map Configuration Required</h3>
              <p className="text-sm text-gray-400">
                The Mapbox token needs to be configured. Please contact support.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-0 shadow-xl">
      {/* Header */}
      <CardHeader className="p-4 border-b bg-gradient-to-r from-blue-600 to-indigo-600">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <Navigation className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-white text-lg">Live Delivery Tracking</CardTitle>
              <p className="text-primary-foreground/80 text-sm">Real-time fleet monitoring</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-white/20 text-white border-0 gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              {stats.total} Active
            </Badge>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-white hover:bg-white/20 gap-2"
              onClick={() => refetch()}
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>

      {/* Stats Bar */}
      {activeDeliveries.length > 0 && (
        <div className="p-3 bg-muted/50 border-b grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-info/10">
            <Truck className="h-4 w-4 text-info" />
            <div>
              <div className="text-lg font-bold text-info">{stats.inTransit}</div>
              <div className="text-xs text-muted-foreground">In Transit</div>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-warning/10">
            <Package className="h-4 w-4 text-warning" />
            <div>
              <div className="text-lg font-bold text-warning">{stats.pickedUp}</div>
              <div className="text-xs text-muted-foreground">Picked Up</div>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10">
            <User className="h-4 w-4 text-primary" />
            <div>
              <div className="text-lg font-bold text-primary">{stats.assigned}</div>
              <div className="text-xs text-muted-foreground">Assigned</div>
            </div>
          </div>
        </div>
      )}

      {/* Active Deliveries List */}
      {activeDeliveries.length > 0 && (
        <div className="max-h-48 overflow-y-auto border-b">
        {activeDeliveries.map((delivery) => {
            const runnerName = delivery.runner?.full_name || 'Runner';
            const clientName = ((delivery as unknown as Record<string, unknown>).delivery_address as string | undefined)?.split(',')[0] || ((delivery.order as unknown as Record<string, unknown> | null)?.delivery_address as string | undefined)?.split(',')[0] || 'Client';
            const orderNumber = delivery.order?.order_number || 'N/A';
            const eta = etasRef.current.get(delivery.id);

            return (
              <div 
                key={delivery.id} 
                className={cn(
                  "flex items-center justify-between p-3 border-b last:border-0 cursor-pointer transition-colors hover:bg-muted/50",
                  selectedDelivery === delivery.id && "bg-info/10"
                )}
                onClick={() => focusOnDelivery(delivery.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-sm">
                    {runnerName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {runnerName}
                      <Badge variant="outline" className="text-xs">
                        {delivery.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <MapPin className="h-3 w-3" />
                      {clientName}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2 text-sm font-medium text-info">
                    <Package className="h-4 w-4" />
                    #{orderNumber}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Timer className="h-3 w-3" />
                    {eta ? eta.formatted : '~15 mins'}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground ml-2" />
              </div>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {activeDeliveries.length === 0 && (
        <div className="p-8 text-center border-b">
          <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
            <Truck className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold mb-1">No Active Deliveries</h3>
          <p className="text-sm text-muted-foreground">
            Deliveries will appear here when runners are on the move
          </p>
        </div>
      )}

      {/* Map */}
      <div
        ref={mapContainer}
        className="w-full h-[450px]"
        style={{ minHeight: "450px" }}
      />

      <style>{`
        .runner-marker, .destination-marker {
          cursor: pointer;
          transition: transform 0.2s;
        }
        
        .runner-marker:hover, .destination-marker:hover {
          transform: scale(1.1);
        }
        
        .delivery-popup .mapboxgl-popup-content {
          padding: 0;
          border-radius: 12px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.2);
          border: 1px solid rgba(0,0,0,0.1);
          overflow: hidden;
        }
        
        .delivery-popup .mapboxgl-popup-tip {
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
          background: rgba(255, 255, 255, 0.95) !important;
          backdrop-filter: blur(8px);
          border-radius: 8px !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
        }
      `}</style>
    </Card>
  );
}
