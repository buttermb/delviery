/**
 * CustomerDeliveryMap Component
 *
 * Shows a map with customer addresses and delivery zone coverage.
 * - Displays all customer addresses with labels
 * - Shows nearest hub/warehouse location
 * - Calculates delivery route and estimated time
 * - Shows previous delivery history routes
 */

import { useEffect, useRef, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  MapPin,
  Navigation,
  Clock,
  Truck,
  Building2,
  RefreshCw,
  Home,
  ExternalLink,
  Route,
} from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useLocations } from '@/hooks/useLocations';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import { formatSmartDate } from '@/lib/formatters';

interface CustomerDeliveryMapProps {
  customerId: string;
  customerName?: string;
}

interface DeliveryAddress {
  id: string;
  label: string;
  street_address: string;
  apartment: string | null;
  city: string;
  state: string;
  zip_code: string;
  latitude: number | null;
  longitude: number | null;
  is_primary: boolean;
  delivery_instructions: string | null;
}

interface DeliveryHistory {
  id: string;
  delivery_date: string;
  status: string;
  delivery_address: string;
  hub_name: string;
  hub_lat: number;
  hub_lng: number;
  dest_lat: number;
  dest_lng: number;
}

interface HubLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  distance: number;
  address: string;
}

// Create custom icons for markers
const createMarkerIcon = (color: string, size: number = 24) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      background-color: ${color};
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

const customerIcon = createMarkerIcon('#ef4444', 28); // Red for customer
const customerPrimaryIcon = createMarkerIcon('#3b82f6', 32); // Blue for primary
const hubIcon = createMarkerIcon('#10b981', 26); // Green for hub

// Calculate distance using Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Estimate delivery time based on distance (avg 30 km/h in city)
function estimateDeliveryTime(distanceKm: number): string {
  const speedKmH = 30;
  const timeHours = distanceKm / speedKmH;
  const timeMinutes = Math.round(timeHours * 60);

  if (timeMinutes < 60) {
    return `~${timeMinutes} mins`;
  }
  const hours = Math.floor(timeMinutes / 60);
  const mins = timeMinutes % 60;
  return mins > 0 ? `~${hours}h ${mins}m` : `~${hours}h`;
}

export function CustomerDeliveryMap({ customerId, customerName }: CustomerDeliveryMapProps) {
  const { tenant } = useTenantAdminAuth();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<DeliveryAddress | null>(null);
  const [showDeliveryHistory, setShowDeliveryHistory] = useState(false);

  // Fetch locations (hubs/warehouses)
  const { locations, isLoading: locationsLoading } = useLocations({ status: 'active' });

  // Fetch customer delivery addresses
  const { data: addresses = [], isLoading: addressesLoading } = useQuery({
    queryKey: queryKeys.customerDetail.deliveryAddresses(customerId, tenant?.id),
    queryFn: async () => {
      if (!tenant?.id) return [];

      const { data, error } = await supabase
        .from('customer_delivery_addresses')
        .select('*')
        .eq('customer_id', customerId)
        .eq('tenant_id', tenant.id)
        .order('is_primary', { ascending: false });

      if (error) {
        logger.error('Failed to fetch customer addresses', error, {
          component: 'CustomerDeliveryMap',
          customerId,
        });
        throw error;
      }

      return (data ?? []) as unknown as DeliveryAddress[];
    },
    enabled: !!customerId && !!tenant?.id,
  });

  // Fetch delivery history for this customer
  const { data: deliveryHistory = [], isLoading: historyLoading } = useQuery({
    queryKey: queryKeys.customerDetail.deliveryHistory(customerId, tenant?.id),
    queryFn: async () => {
      if (!tenant?.id) return [];

      // Try to get delivery history from orders with delivery info
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          created_at,
          status,
          delivery_address
        `)
        .eq('customer_id', customerId)
        .eq('tenant_id', tenant.id)
        .not('delivery_address', 'is', null)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        logger.error('Failed to fetch delivery history', error, {
          component: 'CustomerDeliveryMap',
          customerId,
        });
        return [];
      }

      return (data ?? []).map((order: { id: string; created_at: string; status: string; delivery_address?: string }) => ({
        id: order.id,
        delivery_date: order.created_at,
        status: order.status,
        delivery_address: order.delivery_address ?? '',
        hub_name: 'Main Hub',
        hub_lat: 0,
        hub_lng: 0,
        dest_lat: 0,
        dest_lng: 0,
      })) as DeliveryHistory[];
    },
    enabled: !!customerId && !!tenant?.id && showDeliveryHistory,
  });

  // Get hubs with coordinates
  const hubsWithCoords = useMemo<HubLocation[]>(() => {
    return locations
      .filter((loc) => {
        const coords = loc.coordinates as { lat?: number; lng?: number } | null;
        return coords && typeof coords.lat === 'number' && typeof coords.lng === 'number';
      })
      .map((loc) => {
        const coords = loc.coordinates as { lat: number; lng: number };
        return {
          id: loc.id,
          name: loc.name,
          lat: coords.lat,
          lng: coords.lng,
          distance: 0,
          address: `${loc.address ?? ''}${loc.city ? `, ${loc.city}` : ''}${loc.state ? `, ${loc.state}` : ''}`,
        };
      });
  }, [locations]);

  // Find the closest hub to the selected/primary address
  const closestHub = useMemo(() => {
    const targetAddress = selectedAddress || addresses.find((a) => a.is_primary) || addresses[0];
    if (!targetAddress?.latitude || !targetAddress?.longitude || hubsWithCoords.length === 0) {
      return null;
    }

    let closest: HubLocation | null = null;
    let minDistance = Infinity;

    for (const hub of hubsWithCoords) {
      const distance = calculateDistance(
        targetAddress.latitude,
        targetAddress.longitude,
        hub.lat,
        hub.lng
      );
      if (distance < minDistance) {
        minDistance = distance;
        closest = { ...hub, distance };
      }
    }

    return closest;
  }, [selectedAddress, addresses, hubsWithCoords]);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const defaultCenter: [number, number] = [40.7128, -74.006]; // NYC default

    const map = L.map(mapRef.current).setView(defaultCenter, 12);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update markers and routes when data changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // Clear existing layers except tile layer
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker || layer instanceof L.Polyline) {
        map.removeLayer(layer);
      }
    });

    const bounds = L.latLngBounds([]);
    let hasValidMarkers = false;

    // Add customer address markers
    addresses.forEach((address) => {
      if (address.latitude && address.longitude) {
        const icon = address.is_primary ? customerPrimaryIcon : customerIcon;
        const marker = L.marker([address.latitude, address.longitude], { icon }).addTo(map);

        const fullAddress = `${address.street_address}${address.apartment ? `, Apt ${address.apartment}` : ''}, ${address.city}, ${address.state} ${address.zip_code}`;

        marker.bindPopup(`
          <div style="min-width: 200px; padding: 8px;">
            <div style="font-weight: 600; margin-bottom: 4px; display: flex; align-items: center; gap: 8px;">
              ${address.label}
              ${address.is_primary ? '<span style="background: #3b82f6; color: white; font-size: 10px; padding: 2px 6px; border-radius: 4px;">Primary</span>' : ''}
            </div>
            <div style="font-size: 12px; color: #555; margin-bottom: 8px;">${fullAddress}</div>
            ${address.delivery_instructions ? `<div style="font-size: 11px; color: #888; font-style: italic;">Note: ${address.delivery_instructions}</div>` : ''}
          </div>
        `);

        marker.on('click', () => {
          setSelectedAddress(address);
        });

        bounds.extend([address.latitude, address.longitude]);
        hasValidMarkers = true;
      }
    });

    // Add hub markers
    hubsWithCoords.forEach((hub) => {
      const marker = L.marker([hub.lat, hub.lng], { icon: hubIcon }).addTo(map);

      marker.bindPopup(`
        <div style="min-width: 180px; padding: 8px;">
          <div style="font-weight: 600; margin-bottom: 4px; display: flex; align-items: center; gap: 8px;">
            <span style="background: #10b981; color: white; font-size: 10px; padding: 2px 6px; border-radius: 4px;">Hub</span>
            ${hub.name}
          </div>
          <div style="font-size: 12px; color: #555;">${hub.address}</div>
        </div>
      `);

      bounds.extend([hub.lat, hub.lng]);
      hasValidMarkers = true;
    });

    // Draw route from closest hub to selected/primary address
    const targetAddress = selectedAddress || addresses.find((a) => a.is_primary) || addresses[0];
    if (closestHub && targetAddress?.latitude && targetAddress?.longitude) {
      const routeLine = L.polyline(
        [
          [closestHub.lat, closestHub.lng],
          [targetAddress.latitude, targetAddress.longitude],
        ],
        {
          color: '#3b82f6',
          weight: 4,
          opacity: 0.7,
          dashArray: '8, 8',
        }
      ).addTo(map);

      routeLayerRef.current = routeLine;

      // Add distance label at midpoint
      const midLat = (closestHub.lat + targetAddress.latitude) / 2;
      const midLng = (closestHub.lng + targetAddress.longitude) / 2;

      const distanceLabel = L.divIcon({
        className: 'distance-label',
        html: `<div style="
          background: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          white-space: nowrap;
        ">${closestHub.distance.toFixed(1)} km</div>`,
        iconSize: [80, 24],
        iconAnchor: [40, 12],
      });

      L.marker([midLat, midLng], { icon: distanceLabel }).addTo(map);
    }

    // Fit bounds if we have valid markers
    if (hasValidMarkers && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }, [addresses, hubsWithCoords, closestHub, selectedAddress]);

  const isLoading = addressesLoading || locationsLoading;

  // Get addresses with coordinates for display
  const _geocodedAddresses = addresses.filter((a) => a.latitude && a.longitude);
  const ungeocodedAddresses = addresses.filter((a) => !a.latitude || !a.longitude);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Delivery Map
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="w-full h-[400px] rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Delivery Map
            {customerName && (
              <span className="text-sm font-normal text-muted-foreground">— {customerName}</span>
            )}
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeliveryHistory(!showDeliveryHistory)}
            >
              <Route className="h-4 w-4 mr-2" />
              {showDeliveryHistory ? 'Hide History' : 'Show History'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (mapInstanceRef.current && addresses.length > 0) {
                  const bounds = L.latLngBounds([]);
                  addresses.forEach((a) => {
                    if (a.latitude && a.longitude) {
                      bounds.extend([a.latitude, a.longitude]);
                    }
                  });
                  if (bounds.isValid()) {
                    mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40] });
                  }
                }
              }}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset View
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Map Legend */}
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow-sm" />
            <span>Primary Address</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-red-500 border-2 border-white shadow-sm" />
            <span>Other Addresses</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-emerald-500 border-2 border-white shadow-sm" />
            <span>Hub/Warehouse</span>
          </div>
        </div>

        {/* Map Container */}
        <div
          ref={mapRef}
          className="w-full h-[400px] rounded-lg border overflow-hidden"
          style={{ minHeight: '400px' }}
        />

        {/* Delivery Info Panel */}
        {closestHub && (
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold flex items-center gap-2">
                <Navigation className="h-4 w-4 text-primary" />
                Delivery Route
              </h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const targetAddress =
                    selectedAddress || addresses.find((a) => a.is_primary) || addresses[0];
                  if (targetAddress?.latitude && targetAddress?.longitude) {
                    window.open(
                      `https://www.google.com/maps/dir/${closestHub.lat},${closestHub.lng}/${targetAddress.latitude},${targetAddress.longitude}`,
                      '_blank',
                      'noopener,noreferrer'
                    );
                  }
                }}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open in Google Maps
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-3 p-3 bg-background rounded-lg border">
                <Building2 className="h-5 w-5 text-emerald-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Closest Hub</p>
                  <p className="font-medium">{closestHub.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-background rounded-lg border">
                <Truck className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Distance</p>
                  <p className="font-medium">{closestHub.distance.toFixed(1)} km</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-background rounded-lg border">
                <Clock className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Est. Delivery Time</p>
                  <p className="font-medium">{estimateDeliveryTime(closestHub.distance)}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Address Selector */}
        {addresses.length > 1 && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm text-muted-foreground">Select Address for Route</h4>
            <div className="flex flex-wrap gap-2">
              {addresses.map((address) => (
                <Button
                  key={address.id}
                  variant={selectedAddress?.id === address.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedAddress(address)}
                  className="gap-2"
                >
                  {address.is_primary ? <Home className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
                  {address.label}
                  {address.is_primary && (
                    <Badge variant="secondary" className="text-xs ml-1">
                      Primary
                    </Badge>
                  )}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Warnings for ungeocoded addresses */}
        {ungeocodedAddresses.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-sm text-amber-800">
              <strong>{ungeocodedAddresses.length}</strong> address
              {ungeocodedAddresses.length > 1 ? 'es are' : ' is'} not geocoded and cannot be shown on
              the map. Edit the address to add coordinates.
            </p>
            <div className="flex flex-wrap gap-1 mt-2">
              {ungeocodedAddresses.map((a) => (
                <Badge key={a.id} variant="outline" className="text-amber-700">
                  {a.label}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* No addresses state */}
        {addresses.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <MapPin className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No delivery addresses saved for this customer.</p>
            <p className="text-sm">Add addresses in the Addresses tab to see them on the map.</p>
          </div>
        )}

        {/* Delivery History */}
        {showDeliveryHistory && (
          <div className="space-y-3">
            <h4 className="font-semibold flex items-center gap-2">
              <Route className="h-4 w-4" />
              Previous Deliveries
            </h4>
            {historyLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : deliveryHistory.length > 0 ? (
              <div className="space-y-2">
                {deliveryHistory.slice(0, 5).map((delivery) => (
                  <div
                    key={delivery.id}
                    className="flex items-center justify-between p-3 border rounded-lg text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{delivery.hub_name}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-xs">
                          {delivery.delivery_address}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge
                        variant={delivery.status === 'delivered' ? 'default' : 'secondary'}
                        className="mb-1"
                      >
                        {delivery.status}
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        {formatSmartDate(delivery.delivery_date)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No delivery history found for this customer.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
