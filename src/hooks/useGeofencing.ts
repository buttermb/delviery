import { logger } from '@/lib/logger';
import { useState, useEffect } from 'react';
import { getUserLocation, validateGeofenceAccess, type GeofenceRule, type Coordinates } from '@/utils/geofencing';

interface UseGeofencingOptions {
  geofences: GeofenceRule[];
  enabled: boolean;
  onViolation?: (details: any) => void;
}

export const useGeofencing = ({ geofences, enabled, onViolation }: UseGeofencingOptions) => {
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [accessGranted, setAccessGranted] = useState<boolean | null>(null);
  const [violation, setViolation] = useState<any>(null);

  useEffect(() => {
    if (!enabled || !geofences || geofences.length === 0) {
      setAccessGranted(true);
      return;
    }

    const checkLocation = async () => {
      setIsChecking(true);
      
      try {
        const location = await getUserLocation();
        setUserLocation(location);
        
        const result = validateGeofenceAccess(location, geofences);
        setAccessGranted(result.allowed);
        
        if (!result.allowed) {
          const violationData = {
            reason: result.reason,
            distance: result.nearest_distance,
            location,
            timestamp: new Date().toISOString()
          };
          setViolation(violationData);
          onViolation?.(violationData);
        }
      } catch (error) {
        logger.error('Geolocation error:', error);
        // On error, deny access for security
        setAccessGranted(false);
        setViolation({
          reason: 'Unable to verify location',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      } finally {
        setIsChecking(false);
      }
    };

    checkLocation();
  }, [enabled, geofences, onViolation]);

  return {
    userLocation,
    isChecking,
    accessGranted,
    violation
  };
};
