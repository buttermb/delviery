import { logger } from '@/lib/logger';
import { useEffect, useRef, useState } from 'react';
import { useCourier } from '@/contexts/CourierContext';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number | null;
  heading: number | null;
}

export function useLocationTracking(enabled: boolean = true) {
  const { updateLocation, isOnline, role } = useCourier();
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || !isOnline || !navigator.geolocation) {
      return;
    }

    logger.debug('🎯 Starting location tracking for role:', role);

    const handleSuccess = (position: GeolocationPosition) => {
      const locationData: LocationData = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        speed: position.coords.speed,
        heading: position.coords.heading,
      };

      setCurrentLocation(locationData);
      setError(null);

      // Update location in backend
      updateLocation(locationData.latitude, locationData.longitude);
      
      logger.debug('📍 Location tracked:', {
        lat: locationData.latitude.toFixed(6),
        lng: locationData.longitude.toFixed(6),
        accuracy: `${locationData.accuracy.toFixed(0)}m`,
        speed: locationData.speed ? `${locationData.speed.toFixed(1)} m/s` : 'N/A',
      });
    };

    const handleError = (err: GeolocationPositionError) => {
      let errorMessage = 'Unknown location error';
      
      switch (err.code) {
        case err.PERMISSION_DENIED:
          errorMessage = 'Location permission denied. Please enable location access.';
          break;
        case err.POSITION_UNAVAILABLE:
          errorMessage = 'Location unavailable. Check your GPS settings.';
          break;
        case err.TIMEOUT:
          errorMessage = 'Location request timed out.';
          break;
      }

      logger.error('Location error:', errorMessage, { 
        code: err.code,
        message: err.message 
      });
      setError(errorMessage);
    };

    // Watch position with high accuracy
    watchIdRef.current = navigator.geolocation.watchPosition(
      handleSuccess,
      handleError,
      {
        enableHighAccuracy: true,
        maximumAge: 5000, // Cache for 5 seconds
        timeout: 10000, // 10 second timeout
      }
    );

    // Cleanup
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        logger.debug('🛑 Stopped location tracking');
      }
    };
  }, [enabled, isOnline, role, updateLocation]);

  return { currentLocation, error };
}
