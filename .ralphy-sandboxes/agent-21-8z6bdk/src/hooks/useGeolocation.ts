import { useState, useEffect, useRef } from 'react';

interface GeolocationOptions {
    enableHighAccuracy?: boolean;
    timeout?: number;
    maximumAge?: number;
    watch?: boolean;
}

interface GeolocationState {
    latitude: number | null;
    longitude: number | null;
    accuracy: number | null;
    timestamp: number | null;
    error: string | null;
    loading: boolean;
}

export function useGeolocation(options: GeolocationOptions = {}) {
    const [state, setState] = useState<GeolocationState>({
        latitude: null,
        longitude: null,
        accuracy: null,
        timestamp: null,
        error: null,
        loading: true,
    });

    const watchId = useRef<number | null>(null);

    useEffect(() => {
        if (!navigator.geolocation) {
            setState(prev => ({ ...prev, error: 'Geolocation is not supported', loading: false }));
            return;
        }

        const successHandler = (position: GeolocationPosition) => {
            setState({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                timestamp: position.timestamp,
                error: null,
                loading: false,
            });
        };

        const errorHandler = (error: GeolocationPositionError) => {
            setState(prev => ({ ...prev, error: error.message, loading: false }));
        };

        const geoOptions = {
            enableHighAccuracy: options.enableHighAccuracy ?? false, // Default to low power
            timeout: options.timeout ?? 10000,
            maximumAge: options.maximumAge ?? 30000, // Cache for 30s by default
        };

        if (options.watch) {
            watchId.current = navigator.geolocation.watchPosition(
                successHandler,
                errorHandler,
                geoOptions
            );
        } else {
            navigator.geolocation.getCurrentPosition(
                successHandler,
                errorHandler,
                geoOptions
            );
        }

        return () => {
            if (watchId.current !== null) {
                navigator.geolocation.clearWatch(watchId.current);
            }
        };
    }, [options.enableHighAccuracy, options.timeout, options.maximumAge, options.watch]);

    return state;
}
