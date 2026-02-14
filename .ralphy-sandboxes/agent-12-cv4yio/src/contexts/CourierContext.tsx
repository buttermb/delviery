import { logger } from '@/lib/logger';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CourierData {
  id: string;
  email: string;
  phone: string;
  full_name: string;
  vehicle_type: string;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_plate?: string;
  license_number?: string;
  is_online: boolean;
  current_lat: number | null;
  current_lng: number | null;
  commission_rate: number;
  rating?: number;
  total_deliveries?: number;
  on_time_rate?: number;
  role: 'courier' | 'runner'; // Added role field
  tenant_id?: string;
}

interface CourierContextType {
  courier: CourierData | null;
  loading: boolean;
  isOnline: boolean;
  role: 'courier' | 'runner' | null;
  toggleOnlineStatus: () => Promise<void>;
  updateLocation: (lat: number, lng: number) => Promise<void>;
  refreshCourier: () => Promise<void>;
}

const CourierContext = createContext<CourierContextType | undefined>(undefined);

export function CourierProvider({ children }: { children: React.ReactNode }) {
  const [courier, setCourier] = useState<CourierData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadCourierData();
  }, []);

  // Track location when online - continuous updates
  useEffect(() => {
    if (!isOnline || !courier) return;

    let lastLat: number | null = null;
    let lastLng: number | null = null;
    let hasLoggedGeoError = false;

    // Watch position with high accuracy and frequent updates
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        lastLat = latitude;
        lastLng = longitude;
        logger.debug('Location update', { latitude, longitude, accuracy: position.coords.accuracy, component: 'CourierContext' });
        updateLocation(latitude, longitude);
      },
      (error) => {
        logger.error('Location error', error, { component: 'CourierContext' });
        toast({
          title: "Location Error",
          description: "Unable to track your location. Please enable GPS.",
          variant: "destructive"
        });
      },
      { 
        enableHighAccuracy: true, 
        maximumAge: 5000, // Cache for only 5 seconds
        timeout: 10000 // 10 second timeout
      }
    );

    // Force location update every 10 seconds even if position hasn't changed much
    const forceUpdateInterval = setInterval(() => {
      if (lastLat !== null && lastLng !== null) {
        logger.debug('Forcing location update', { lastLat, lastLng, component: 'CourierContext' });
        updateLocation(lastLat, lastLng);
      } else {
        // Try to get current position if we don't have one
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            lastLat = latitude;
            lastLng = longitude;
            logger.debug('Got current position', { latitude, longitude, component: 'CourierContext' });
            updateLocation(latitude, longitude);
          },
          (error) => {
            // Only log geolocation errors once to avoid console spam
            if (!hasLoggedGeoError) {
              logger.warn('Geolocation unavailable. Location tracking disabled', { message: error.message, component: 'CourierContext' });
              hasLoggedGeoError = true;
            }
          },
          { enableHighAccuracy: true, timeout: 5000 }
        );
      }
    }, 10000); // Every 10 seconds

    return () => {
      navigator.geolocation.clearWatch(watchId);
      clearInterval(forceUpdateInterval);
    };
  }, [isOnline, courier]);

  const loadCourierData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }

      // Try to fetch as courier first
      const { data: courierData } = await supabase
        .from('couriers')
        .select('id, email, full_name, phone, vehicle_type, vehicle_make, vehicle_model, vehicle_plate, is_online, commission_rate, current_lat, current_lng, rating, total_deliveries, tenant_id')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (courierData) {
        setCourier({
          id: courierData.id,
          email: courierData.email,
          full_name: courierData.full_name,
          phone: courierData.phone,
          vehicle_type: courierData.vehicle_type,
          vehicle_make: courierData.vehicle_make || undefined,
          vehicle_model: courierData.vehicle_model || undefined,
          vehicle_plate: courierData.vehicle_plate || undefined,
          is_online: courierData.is_online,
          commission_rate: courierData.commission_rate || 30,
          current_lat: courierData.current_lat,
          current_lng: courierData.current_lng,
          rating: courierData.rating || undefined,
          total_deliveries: courierData.total_deliveries || undefined,
          role: 'courier',
          tenant_id: courierData.tenant_id || undefined
        });
        setIsOnline(courierData.is_online);
        setLoading(false);
        return;
      }

      // Try to fetch as wholesale runner
      const { data: runnerData } = await supabase
        .from('wholesale_runners')
        .select('id, email, full_name, phone, vehicle_type, vehicle_plate, status, current_lat, current_lng, rating, total_deliveries, tenant_id')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (runnerData) {
        setCourier({
          id: runnerData.id,
          email: runnerData.email || session.user.email || '',
          full_name: runnerData.full_name,
          phone: runnerData.phone,
          vehicle_type: runnerData.vehicle_type,
          vehicle_plate: runnerData.vehicle_plate || undefined,
          is_online: runnerData.status === 'active',
          commission_rate: 5,
          current_lat: runnerData.current_lat,
          current_lng: runnerData.current_lng,
          rating: runnerData.rating || undefined,
          total_deliveries: runnerData.total_deliveries || undefined,
          role: 'runner',
          tenant_id: runnerData.tenant_id || undefined
        });
        setIsOnline(runnerData.status === 'active');
        setLoading(false);
        return;
      }

      // Not a courier or runner
      setLoading(false);
    } catch {
      logger.debug('Not a courier/runner user', { component: 'CourierContext' });
      setLoading(false);
    }
  };

  const toggleOnlineStatus = async () => {
    if (!courier) return;

    try {
      const newStatus = !isOnline;
      
      // Check if user is still authenticated before making the call
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        logger.debug('No active session, skipping status update', { component: 'CourierContext' });
        return;
      }

      const { data, error } = await supabase.functions.invoke('courier-app', {
        body: { 
          endpoint: 'toggle-online',
          is_online: newStatus
        }
      });

      if (error) throw error;

      // Check for error in response body (some edge functions return 200 with error)
      if (data && typeof data === 'object' && 'error' in data && data.error) {
        const errorMessage = typeof data.error === 'string' ? data.error : 'Failed to update status';
        throw new Error(errorMessage);
      }

      setIsOnline(newStatus);
      setCourier(data.courier);
      
      toast({
        title: newStatus ? "You're now online" : "You're now offline",
        description: newStatus ? "You can now receive orders" : "You won't receive new orders"
      });
    } catch (error) {
      logger.error('Failed to toggle status', error as Error, { component: 'CourierContext' });
      // Only show error if user is still authenticated
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        toast({
          title: "Error",
          description: "Failed to update status",
          variant: "destructive"
        });
      }
    }
  };

  const updateLocation = async (lat: number, lng: number) => {
    if (!courier) return;

    try {
      logger.debug('Sending location update to backend', { lat, lng, role: courier.role, component: 'CourierContext' });

      if (courier.role === 'courier') {
        // Update courier location via edge function
        const { data, error } = await supabase.functions.invoke('courier-app', {
          body: {
            endpoint: 'update-location',
            lat,
            lng
          }
        });

        if (error) {
          logger.error('Courier location update error', error as Error, { component: 'CourierContext' });
          throw error;
        }

        // Check for error in response body (some edge functions return 200 with error)
        if (data && typeof data === 'object' && 'error' in data && data.error) {
          const errorMessage = typeof data.error === 'string' ? data.error : 'Failed to update location';
          logger.error('Courier location update returned error in response', { error: errorMessage, component: 'CourierContext' });
          throw new Error(errorMessage);
        }

        logger.debug('Courier location updated successfully', { component: 'CourierContext' });
      } else if (courier.role === 'runner') {
        // Update runner location via edge function (includes history logging)
        const { data, error } = await supabase.functions.invoke('runner-location-update', {
          body: {
            runner_id: courier.id,
            latitude: lat,
            longitude: lng,
            speed: 0, // Can be enhanced with actual speed from navigator
            heading: 0, // Can be enhanced with actual heading
          }
        });

        if (error) {
          logger.error('Runner location update error', error as Error, { component: 'CourierContext' });
          throw error;
        }

        // Check for error in response body (some edge functions return 200 with error)
        if (data && typeof data === 'object' && 'error' in data && data.error) {
          const errorMessage = typeof data.error === 'string' ? data.error : 'Failed to update runner location';
          logger.error('Runner location update returned error in response', { error: errorMessage, component: 'CourierContext' });
          throw new Error(errorMessage);
        } else {
          logger.debug('Runner location updated successfully', { component: 'CourierContext' });
        }
      }
    } catch (error) {
      logger.error('Failed to update location', error as Error, { component: 'CourierContext' });
    }
  };

  const refreshCourier = async () => {
    await loadCourierData();
  };

  return (
    <CourierContext.Provider value={{
      courier,
      loading,
      isOnline,
      role: courier?.role || null,
      toggleOnlineStatus,
      updateLocation,
      refreshCourier
    }}>
      {children}
    </CourierContext.Provider>
  );
}

export function useCourier() {
  const context = useContext(CourierContext);
  if (context === undefined) {
    throw new Error('useCourier must be used within CourierProvider');
  }
  return context;
}
