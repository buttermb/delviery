/**
 * Order Address Card
 * Displays order delivery address with optional map preview and directions link
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import MapPin from "lucide-react/dist/esm/icons/map-pin";
import Navigation from "lucide-react/dist/esm/icons/navigation";
import ExternalLink from "lucide-react/dist/esm/icons/external-link";
import Copy from "lucide-react/dist/esm/icons/copy";
import Check from "lucide-react/dist/esm/icons/check";
import Building2 from "lucide-react/dist/esm/icons/building-2";
import Home from "lucide-react/dist/esm/icons/home";
import MapIcon from "lucide-react/dist/esm/icons/map";
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

type AddressType = 'delivery' | 'billing' | 'pickup';

interface OrderAddressCardProps {
  /** Street address line */
  address: string;
  /** Optional apartment/unit number */
  apartment?: string;
  /** City name */
  city?: string;
  /** State abbreviation */
  state?: string;
  /** ZIP code */
  zipCode?: string;
  /** Borough or neighborhood */
  borough?: string;
  /** Latitude for map preview */
  latitude?: number;
  /** Longitude for map preview */
  longitude?: number;
  /** Type of address (affects icon and label) */
  addressType?: AddressType;
  /** Customer name */
  customerName?: string;
  /** Optional delivery notes */
  deliveryNotes?: string;
  /** Show map preview (requires lat/lng and Mapbox token) */
  showMapPreview?: boolean;
  /** Map preview height in pixels */
  mapHeight?: number;
  /** Custom className */
  className?: string;
  /** Loading state */
  isLoading?: boolean;
}

/**
 * Gets the appropriate icon for the address type
 */
function getAddressIcon(type: AddressType) {
  switch (type) {
    case 'pickup':
      return Building2;
    case 'billing':
      return Home;
    case 'delivery':
    default:
      return MapPin;
  }
}

/**
 * Gets the label for the address type
 */
function getAddressLabel(type: AddressType) {
  switch (type) {
    case 'pickup':
      return 'Pickup Address';
    case 'billing':
      return 'Billing Address';
    case 'delivery':
    default:
      return 'Delivery Address';
  }
}

/**
 * Formats a full address string
 */
function formatFullAddress(
  address: string,
  apartment?: string,
  city?: string,
  state?: string,
  zipCode?: string
): string {
  const parts = [address];
  if (apartment) parts[0] += `, ${apartment}`;
  if (city) parts.push(city);
  if (state && zipCode) parts.push(`${state} ${zipCode}`);
  else if (state) parts.push(state);
  else if (zipCode) parts.push(zipCode);
  return parts.join(', ');
}

/**
 * Generates a static Mapbox map image URL
 */
function getStaticMapUrl(
  lat: number,
  lng: number,
  width: number = 400,
  height: number = 200
): string {
  if (!MAPBOX_TOKEN) return '';

  const marker = `pin-s+ef4444(${lng},${lat})`;
  return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${marker}/${lng},${lat},14,0/${width}x${height}@2x?access_token=${MAPBOX_TOKEN}`;
}

/**
 * Opens navigation to the address in the device's preferred maps app
 */
function openDirections(lat: number, lng: number, address: string) {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const encodedAddress = encodeURIComponent(address);

  const url = isIOS
    ? `maps://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`
    : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${encodedAddress}&travelmode=driving`;

  window.open(url, '_blank');
}

/**
 * Opens the address in Google Maps without directions
 */
function openInMaps(lat: number, lng: number, address: string) {
  const encodedAddress = encodeURIComponent(address);
  const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}&query_place_id=${encodedAddress}`;
  window.open(url, '_blank');
}

export function OrderAddressCard({
  address,
  apartment,
  city,
  state,
  zipCode,
  borough,
  latitude,
  longitude,
  addressType = 'delivery',
  customerName,
  deliveryNotes,
  showMapPreview = true,
  mapHeight = 150,
  className,
  isLoading = false,
}: OrderAddressCardProps) {
  const [copied, setCopied] = useState(false);
  const [mapError, setMapError] = useState(false);

  const AddressIcon = getAddressIcon(addressType);
  const addressLabel = getAddressLabel(addressType);
  const fullAddress = formatFullAddress(address, apartment, city, state, zipCode);

  const hasCoordinates = latitude !== undefined && longitude !== undefined
    && !isNaN(latitude) && !isNaN(longitude);
  const canShowMap = showMapPreview && hasCoordinates && MAPBOX_TOKEN && !mapError;

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(fullAddress);
      setCopied(true);
      toast.success('Address copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy address');
    }
  };

  const handleOpenDirections = () => {
    if (hasCoordinates) {
      openDirections(latitude, longitude, fullAddress);
    }
  };

  const handleOpenInMaps = () => {
    if (hasCoordinates) {
      openInMaps(latitude, longitude, fullAddress);
    }
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          {showMapPreview && <Skeleton className="h-[150px] w-full rounded-md" />}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <AddressIcon className="h-4 w-4 text-muted-foreground" />
            {addressLabel}
          </CardTitle>
          {borough && (
            <Badge variant="secondary" className="text-xs">
              {borough}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        {/* Customer name if provided */}
        {customerName && (
          <p className="text-sm font-medium">{customerName}</p>
        )}

        {/* Main address */}
        <div className="space-y-1">
          <p className="text-sm">
            {address}
            {apartment && <span className="text-muted-foreground">, {apartment}</span>}
          </p>
          {(city || state || zipCode) && (
            <p className="text-sm text-muted-foreground">
              {[city, state, zipCode].filter(Boolean).join(', ')}
            </p>
          )}
        </div>

        {/* Delivery notes */}
        {deliveryNotes && (
          <div className="p-2 bg-muted/50 rounded-md border-l-2 border-primary">
            <p className="text-xs text-muted-foreground font-medium mb-0.5">
              Delivery Notes
            </p>
            <p className="text-sm">{deliveryNotes}</p>
          </div>
        )}

        {/* Map preview */}
        {canShowMap && (
          <div className="relative rounded-md overflow-hidden border">
            <img
              src={getStaticMapUrl(latitude, longitude, 400, mapHeight)}
              alt="Delivery location map"
              className="w-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
              style={{ height: mapHeight }}
              onClick={handleOpenInMaps}
              onError={() => setMapError(true)}
              loading="lazy"
            />
            <div className="absolute top-2 right-2">
              <Button
                size="sm"
                variant="secondary"
                className="h-7 text-xs shadow-md"
                onClick={handleOpenInMaps}
              >
                <MapIcon className="h-3 w-3 mr-1" />
                Open Map
              </Button>
            </div>
          </div>
        )}

        {/* No map available message */}
        {showMapPreview && !canShowMap && !mapError && (
          <div className="flex items-center justify-center p-4 bg-muted/30 rounded-md border border-dashed">
            <p className="text-xs text-muted-foreground">
              {!hasCoordinates
                ? 'Map preview unavailable - no coordinates'
                : 'Map preview unavailable'}
            </p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 pt-1">
          {hasCoordinates && (
            <Button
              size="sm"
              variant="default"
              onClick={handleOpenDirections}
              className="flex-1 min-w-[120px]"
            >
              <Navigation className="h-4 w-4 mr-2" />
              Get Directions
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={handleCopyAddress}
            className={cn(
              'transition-colors',
              copied && 'border-green-500 text-green-600'
            )}
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 mr-1" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-1" />
                Copy
              </>
            )}
          </Button>

          {hasCoordinates && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleOpenInMaps}
              className="text-muted-foreground"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
