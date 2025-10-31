import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MapPin, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CustomerLocationSharingProps {
  orderId: string;
  onLocationShared?: (enabled: boolean) => void;
}

export const CustomerLocationSharing = ({ orderId, onLocationShared }: CustomerLocationSharingProps) => {
  const [sharing, setSharing] = useState(false);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const { toast } = useToast();

  const startLocationSharing = async () => {
    try {
      // Request location permission
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });

      const { latitude, longitude, accuracy } = position.coords;

      // Update order with customer location
      const { error } = await supabase
        .from("orders")
        .update({
          customer_location_enabled: true,
          customer_lat: latitude,
          customer_lng: longitude,
          customer_location_accuracy: Math.round(accuracy),
          customer_location_updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      if (error) throw error;

      setLocationEnabled(true);
      setSharing(true);
      onLocationShared?.(true);

      toast({
        title: "✓ Location Sharing Active",
        description: "Your driver can see your live location to find you faster",
      });

      // Start periodic location updates (every 30 seconds)
      const updateInterval = setInterval(async () => {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            await supabase
              .from("orders")
              .update({
                customer_lat: pos.coords.latitude,
                customer_lng: pos.coords.longitude,
                customer_location_accuracy: Math.round(pos.coords.accuracy),
                customer_location_updated_at: new Date().toISOString(),
              })
              .eq("id", orderId);
          },
          (error) => {
            console.error("Location update failed:", error);
          },
          {
            enableHighAccuracy: true,
            maximumAge: 0,
          }
        );
      }, 30000);

      // Store interval ID to clear later
      (window as any).__locationUpdateInterval = updateInterval;
    } catch (error: any) {
      console.error("Failed to share location:", error);
      toast({
        variant: "destructive",
        title: "Location Access Denied",
        description: error.message === "User denied Geolocation"
          ? "Please enable location access in your browser settings to share your location"
          : "Unable to access your location. Please check your browser settings.",
      });
    }
  };

  const stopLocationSharing = async () => {
    try {
      // Clear interval
      if ((window as any).__locationUpdateInterval) {
        clearInterval((window as any).__locationUpdateInterval);
        delete (window as any).__locationUpdateInterval;
      }

      // Disable location sharing in database
      const { error } = await supabase
        .from("orders")
        .update({
          customer_location_enabled: false,
          customer_lat: null,
          customer_lng: null,
          customer_location_accuracy: null,
        })
        .eq("id", orderId);

      if (error) throw error;

      setLocationEnabled(false);
      setSharing(false);
      onLocationShared?.(false);

      toast({
        title: "Location Sharing Stopped",
        description: "Your location is no longer being shared",
      });
    } catch (error) {
      console.error("Failed to stop location sharing:", error);
    }
  };

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if ((window as any).__locationUpdateInterval) {
        clearInterval((window as any).__locationUpdateInterval);
        delete (window as any).__locationUpdateInterval;
      }
    };
  }, []);

  if (!locationEnabled) {
    return (
      <Card className="p-4 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <div className="flex items-start gap-3">
          <MapPin className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-blue-900 dark:text-blue-100">
              📍 Share Your Location?
            </h3>
            <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
              Help your driver find you faster! We'll share your live location while your order is being delivered.
            </p>
            <ul className="text-sm text-blue-600 dark:text-blue-400 mt-2 space-y-1">
              <li>• Finding exact entrance</li>
              <li>• Large apartment buildings</li>
              <li>• Outdoor locations</li>
            </ul>
            <div className="flex gap-2 mt-3">
              <Button onClick={startLocationSharing} size="sm" className="flex-1">
                Share Location
              </Button>
              <Button variant="outline" size="sm" className="flex-1">
                No Thanks
              </Button>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <MapPin className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
          <div>
            <h3 className="font-semibold text-green-900 dark:text-green-100">
              ✓ Location Sharing Active
            </h3>
            <p className="text-sm text-green-700 dark:text-green-300 mt-1">
              Your driver can see your live location
            </p>
          </div>
        </div>
        <Button
          onClick={stopLocationSharing}
          variant="ghost"
          size="sm"
          className="text-green-600 hover:text-green-700"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
};