import { useEffect, useState, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';

interface LocationUpdateOptions {
  onLocationUpdate?: (lat: number, lng: number) => void;
  onError?: (error: GeolocationPositionError) => void;
  updateInterval?: number;
  enableHighAccuracy?: boolean;
}

export const useOptimizedLocation = ({
  onLocationUpdate,
  onError,
  updateInterval = 10000,
  enableHighAccuracy = true
}: LocationUpdateOptions) => {
  const [currentLocation, setCurrentLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLocationUpdate = useCallback((position: GeolocationPosition) => {
    const { latitude, longitude } = position.coords;
    setCurrentLocation({ lat: latitude, lng: longitude });
    onLocationUpdate?.(latitude, longitude);
    setError(null);
  }, [onLocationUpdate]);

  const handleLocationError = useCallback((err: GeolocationPositionError) => {
    let errorMessage = 'Location access denied';
    
    switch (err.code) {
      case err.PERMISSION_DENIED:
        errorMessage = 'Please enable location in your browser settings';
        break;
      case err.POSITION_UNAVAILABLE:
        errorMessage = 'Location information unavailable';
        break;
      case err.TIMEOUT:
        errorMessage = 'Location request timed out';
        break;
    }
    
    setError(errorMessage);
    onError?.(err);
    
    toast({
      variant: 'destructive',
      title: 'Location Error',
      description: errorMessage,
    });
  }, [onError]);

  useEffect(() => {
    if (!isTracking || !('geolocation' in navigator)) return;

    let watchId: number;
    let lastLat: number | null = null;
    let lastLng: number | null = null;

    // Watch position with high accuracy
    watchId = navigator.geolocation.watchPosition(
      handleLocationUpdate,
      handleLocationError,
      {
        enableHighAccuracy,
        maximumAge: 5000,
        timeout: 10000
      }
    );

    // Force updates at regular intervals
    const forceUpdateInterval = setInterval(() => {
      if (lastLat !== null && lastLng !== null) {
        onLocationUpdate?.(lastLat, lastLng);
      } else {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            lastLat = position.coords.latitude;
            lastLng = position.coords.longitude;
            handleLocationUpdate(position);
          },
          handleLocationError,
          { enableHighAccuracy, timeout: 5000 }
        );
      }
    }, updateInterval);

    return () => {
      if (watchId !== undefined) {
        navigator.geolocation.clearWatch(watchId);
      }
      clearInterval(forceUpdateInterval);
    };
  }, [isTracking, enableHighAccuracy, updateInterval, handleLocationUpdate, handleLocationError, onLocationUpdate]);

  const startTracking = useCallback(() => {
    setIsTracking(true);
  }, []);

  const stopTracking = useCallback(() => {
    setIsTracking(false);
  }, []);

  return {
    currentLocation,
    isTracking,
    error,
    startTracking,
    stopTracking
  };
};
