import { logger } from '@/lib/logger';
/**
 * Driver Location Sharing Component
 * Allows drivers to share their real-time location
 */

import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import MapPin from "lucide-react/dist/esm/icons/map-pin";
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";
import { cn } from '@/lib/utils';

interface LocationSharingProps {
  driverId?: string;
  className?: string;
}

export function DriverLocationSharing({ driverId, className }: LocationSharingProps) {
  const { tenant } = useTenantAdminAuth();
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const driverIdRef = useRef<string | undefined>(driverId);

  useEffect(() => {
    driverIdRef.current = driverId;
  }, [driverId]);

  useEffect(() => {
    if (!isSharing) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      setIsSharing(false);
      return;
    }

    const options: PositionOptions = {
      enableHighAccuracy: true,
      maximumAge: 10000, // Accept cached position up to 10 seconds old
      timeout: 5000,
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const currentDriverId = driverIdRef.current;

        if (!currentDriverId || !tenant?.id) {
          setError('Driver ID or tenant ID missing');
          return;
        }

        try {
          // Update driver location in database
          const { error: updateError } = await supabase
            .from('wholesale_runners')
            .update({
              current_lat: latitude,
              current_lng: longitude,
              last_location_update: new Date().toISOString(),
            })
            .eq('id', currentDriverId)
            .eq('tenant_id', tenant.id);

          if (updateError) {
            // Handle missing table gracefully
            if (updateError.code === '42P01') {
              logger.warn('wholesale_runners table does not exist');
              return;
            }
            throw updateError;
          }

          setError(null);
          setLastUpdate(new Date());
        } catch (err: unknown) {
          logger.error('Error updating location:', err);
          setError(err instanceof Error ? err.message : 'Failed to update location');
        }
      },
      (err) => {
        logger.error('Geolocation error:', err);
        let errorMessage = 'Failed to get location';
        
        switch (err.code) {
          case err.PERMISSION_DENIED:
            errorMessage = 'Location permission denied. Please enable location access.';
            break;
          case err.POSITION_UNAVAILABLE:
            errorMessage = 'Location information unavailable.';
            break;
          case err.TIMEOUT:
            errorMessage = 'Location request timeout.';
            break;
        }
        
        setError(errorMessage);
        setIsSharing(false);
      },
      options
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [isSharing, tenant?.id]);

  return (
    <Card className={cn("p-4", className)}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <MapPin className="h-5 w-5 text-muted-foreground" />
          <div>
            <div className="font-medium text-sm">Location Sharing</div>
            <div className="text-xs text-muted-foreground">
              {isSharing ? 'Sharing location' : 'Location off'}
            </div>
          </div>
        </div>
        <Switch
          checked={isSharing}
          onCheckedChange={setIsSharing}
          disabled={!navigator.geolocation}
        />
      </div>

      {isSharing && (
        <div className="flex items-center gap-2 mt-2">
          <div
            className={cn(
              "w-2 h-2 rounded-full",
              lastUpdate && Date.now() - lastUpdate.getTime() < 30000
                ? "bg-green-500 animate-pulse"
                : "bg-gray-300"
            )}
          />
          <span className="text-xs text-muted-foreground">
            {lastUpdate
              ? `Updated ${Math.floor((Date.now() - lastUpdate.getTime()) / 1000)}s ago`
              : 'Waiting for location...'}
          </span>
        </div>
      )}

      {error && (
        <Alert variant="destructive" className="mt-3">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      )}

      {!navigator.geolocation && (
        <Alert className="mt-3">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Your browser does not support location services
          </AlertDescription>
        </Alert>
      )}
    </Card>
  );
}

