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
}

interface CourierContextType {
  courier: CourierData | null;
  loading: boolean;
  isOnline: boolean;
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
        console.log('📍 Location update:', { latitude, longitude, accuracy: position.coords.accuracy });
        updateLocation(latitude, longitude);
      },
      (error) => {
        console.error('Location error:', error);
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
        console.log('🔄 Forcing location update:', { lastLat, lastLng });
        updateLocation(lastLat, lastLng);
      } else {
        // Try to get current position if we don't have one
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            lastLat = latitude;
            lastLng = longitude;
            console.log('📍 Got current position:', { latitude, longitude });
            updateLocation(latitude, longitude);
          },
          (error) => {
            // Only log geolocation errors once to avoid console spam
            if (!hasLoggedGeoError) {
              console.warn('Geolocation unavailable. Location tracking disabled.', error.message);
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

      // Query couriers table directly instead of using edge function
      const { data: courierData, error } = await supabase
        .from('couriers')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (error || !courierData) {
        // Silently fail if user is not a courier (e.g., admin accessing other pages)
        setLoading(false);
        return;
      }

      setCourier({
        id: courierData.id,
        email: courierData.email,
        full_name: courierData.full_name,
        phone: courierData.phone,
        vehicle_type: courierData.vehicle_type,
        is_online: courierData.is_online,
        commission_rate: 30, // Default commission rate
        current_lat: courierData.current_lat || undefined,
        current_lng: courierData.current_lng || undefined
      });
      setIsOnline(courierData.is_online);
    } catch (error) {
      // Silently fail - user might not be a courier
      console.log('Not a courier user');
    } finally {
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
        console.log('No active session, skipping status update');
        return;
      }

      const { data, error } = await supabase.functions.invoke('courier-app', {
        body: { 
          endpoint: 'toggle-online',
          is_online: newStatus
        }
      });

      if (error) throw error;

      setIsOnline(newStatus);
      setCourier(data.courier);
      
      toast({
        title: newStatus ? "You're now online" : "You're now offline",
        description: newStatus ? "You can now receive orders" : "You won't receive new orders"
      });
    } catch (error) {
      console.error('Failed to toggle status:', error);
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
      console.log('📤 Sending location update to backend:', { lat, lng });
      const { data, error } = await supabase.functions.invoke('courier-app', {
        body: {
          endpoint: 'update-location',
          lat,
          lng
        }
      });

      if (error) {
        console.error('Location update error:', error);
      } else {
        console.log('✅ Location updated successfully');
      }
    } catch (error) {
      console.error('Failed to update location:', error);
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
