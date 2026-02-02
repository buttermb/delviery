/**
 * Leaflet Map Widget - Free OpenStreetMap Integration
 * Inspired by Leaflet repo - no API keys needed!
 */

import { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface LeafletMapWidgetProps {
  locations?: Array<{
    name: string;
    lat: number;
    lng: number;
    type: 'warehouse' | 'runner' | 'delivery';
  }>;
  center?: [number, number];
  zoom?: number;
}

// Fix for default marker icons in Leaflet
const createIcon = (color: string) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="background-color: ${color}; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
};

export function LeafletMapWidget({ 
  locations = [], 
  center = [40.7128, -74.0060], // Default to NYC
  zoom = 10 
}: LeafletMapWidgetProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Initialize map
    const map = L.map(mapRef.current).setView(center, zoom);

    // Add OpenStreetMap tiles (FREE - no API key needed!)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update markers when locations change
  useEffect(() => {
    if (!mapInstanceRef.current || locations.length === 0) return;

    const map = mapInstanceRef.current;
    
    // Clear existing markers
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        map.removeLayer(layer);
      }
    });

    // Add new markers
    locations.forEach((location) => {
      const color = 
        location.type === 'warehouse' ? '#10b981' :
        location.type === 'runner' ? '#3b82f6' :
        '#ef4444';
      
      const marker = L.marker([location.lat, location.lng], {
        icon: createIcon(color),
      }).addTo(map);

      marker.bindPopup(`
        <div style="font-weight: 600; margin-bottom: 4px;">${location.name}</div>
        <div style="font-size: 12px; color: #666;">${location.type}</div>
      `);
    });

    // Fit bounds if we have locations
    if (locations.length > 0) {
      const bounds = L.latLngBounds(locations.map(loc => [loc.lat, loc.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [20, 20] });
    }
  }, [locations]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Location Map
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div 
          ref={mapRef} 
          className="w-full h-[400px] rounded-lg border overflow-hidden"
          style={{ minHeight: '400px' }}
        />
        {locations.length === 0 && (
          <p className="text-sm text-muted-foreground mt-4 text-center">
            No locations to display
          </p>
        )}
      </CardContent>
    </Card>
  );
}

