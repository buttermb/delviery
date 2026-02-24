import { logger } from '@/lib/logger';
import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useWholesaleClients } from "@/hooks/useWholesaleData";
import { MapPin, AlertCircle } from "lucide-react";
import { themeColors } from "@/lib/utils/colorConversion";
import { formatCurrency } from '@/lib/formatters';
import { escapeHtml } from '@/lib/utils/sanitize';

// Mapbox token
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || "";

export function TerritoryMapView() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const { data: clients = [] } = useWholesaleClients();

  useEffect(() => {
    if (!mapContainer.current || map.current) return;
    if (!MAPBOX_TOKEN || MAPBOX_TOKEN === '') return;

    try {
      mapboxgl.accessToken = MAPBOX_TOKEN;

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [-73.9808, 40.7648], // NYC center
        zoom: 10,
        pitch: 45,
      });

      map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

      map.current.on("load", () => {
        setMapLoaded(true);
      });

      // Cleanup
      return () => {
        map.current?.remove();
      };
    } catch (error) {
      logger.error("Mapbox initialization error", error as Error, { component: 'TerritoryMapView' });
    }
  }, []);

  // Add client markers when map loads
  useEffect(() => {
    if (!map.current || !mapLoaded || clients.length === 0) return;

    // Remove existing markers
    const existingMarkers = document.querySelectorAll('.client-marker');
    existingMarkers.forEach(marker => marker.remove());

    // Add markers for each client with coordinates
    (clients as unknown as Record<string, unknown>[]).forEach((client) => {
      const coords = client.coordinates as { lat: number; lng: number } | undefined;
      if (!coords || typeof coords.lat !== 'number' || typeof coords.lng !== 'number') return;

      const { lat, lng } = coords;

      // Color code by credit status
      let markerColor = themeColors.success(); // green - good
      if (Number(client.outstanding_balance) > 10000) {
        markerColor = themeColors.destructive(); // red - overdue
      } else if (Number(client.outstanding_balance) > 0) {
        markerColor = themeColors.warning(); // orange - has balance
      }

      // Create custom marker element
      const el = document.createElement("div");
      el.className = "client-marker";
      el.style.width = "32px";
      el.style.height = "32px";
      el.style.borderRadius = "50%";
      el.style.backgroundColor = markerColor;
      el.style.border = "3px solid white";
      el.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)";
      el.style.cursor = "pointer";
      el.style.display = "flex";
      el.style.alignItems = "center";
      el.style.justifyContent = "center";
      el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/></svg>`;

      // Create popup with optional fields
      const monthlyVolume = client.monthly_volume ?? 'N/A';
      const reliabilityScore = client.reliability_score ?? 'N/A';
      
      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
        <div style="padding: 8px; min-width: 200px;">
          <h3 style="font-weight: 600; margin-bottom: 4px;">${escapeHtml(String(client.business_name || ''))}</h3>
          <p style="font-size: 12px; color: #666; margin-bottom: 8px;">${escapeHtml(String(client.contact_name || ''))}</p>
          <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 4px;">
            <span style="font-size: 12px; font-weight: 500;">Balance:</span>
            <span style="font-size: 14px; font-weight: 600; color: ${markerColor};">
              ${formatCurrency(Number(client.outstanding_balance) || 0)}
            </span>
          </div>
          <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 4px;">
            <span style="font-size: 12px; font-weight: 500;">Monthly:</span>
            <span style="font-size: 12px;">${monthlyVolume} lbs</span>
          </div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <span style="font-size: 12px; font-weight: 500;">Rating:</span>
            <span style="font-size: 12px;">${reliabilityScore}%</span>
          </div>
        </div>
      `);

      // Add marker to map
      new mapboxgl.Marker(el)
        .setLngLat([lng, lat])
        .setPopup(popup)
        .addTo(map.current!);
    });
  }, [mapLoaded, clients]);

  // Add warehouse markers
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const warehouses = [
      { name: "Warehouse A", location: [-73.9442, 40.6782], address: "Brooklyn" },
      { name: "Warehouse B", location: [-73.8648, 40.8448], address: "Queens" },
    ];

    warehouses.forEach((warehouse) => {
      const el = document.createElement("div");
      el.className = "warehouse-marker";
      el.style.width = "40px";
      el.style.height = "40px";
      el.style.backgroundColor = themeColors.marketingSecondary();
      el.style.border = "3px solid white";
      el.style.borderRadius = "8px";
      el.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)";
      el.style.cursor = "pointer";
      el.style.display = "flex";
      el.style.alignItems = "center";
      el.style.justifyContent = "center";
      el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M3 7v10h18V7L12 2 3 7zm15 8H6V9h12v6z"/></svg>`;

      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
        <div style="padding: 8px;">
          <h3 style="font-weight: 600; margin-bottom: 4px;">${warehouse.name}</h3>
          <p style="font-size: 12px; color: #666;">${warehouse.address}</p>
        </div>
      `);

      new mapboxgl.Marker(el)
        .setLngLat(warehouse.location as [number, number])
        .setPopup(popup)
        .addTo(map.current!);
    });
  }, [mapLoaded]);

  if (!MAPBOX_TOKEN || MAPBOX_TOKEN === '') {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 text-warning">
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
            <MapPin className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Territory Map</h3>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline" className="gap-1">
              <span className="h-2 w-2 rounded-full bg-success" />
              Good Standing
            </Badge>
            <Badge variant="outline" className="gap-1">
              <span className="h-2 w-2 rounded-full bg-warning" />
              Has Balance
            </Badge>
            <Badge variant="outline" className="gap-1">
              <span className="h-2 w-2 rounded-full bg-destructive" />
              Overdue
            </Badge>
          </div>
        </div>
      </div>
      <div 
        ref={mapContainer} 
        className="w-full h-[500px]"
        style={{ minHeight: "500px" }}
      />
    </Card>
  );
}
