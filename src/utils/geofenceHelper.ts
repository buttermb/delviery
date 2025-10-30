import { supabase } from "@/integrations/supabase/client";

// Calculate distance between two coordinates using Haversine formula
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3958.8; // Earth's radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export const GEOFENCE_RADIUS_MILES = 0.5;

export async function checkGeofence(
  orderId: string,
  driverLat: number,
  driverLng: number,
  action: string = "location_update"
) {
  try {
    const { data, error } = await supabase.functions.invoke("check-geofence", {
      body: {
        orderId,
        driverLat,
        driverLng,
        action,
      },
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Geofence check error:", error);
    return {
      success: false,
      error: error.message,
      withinGeofence: false,
      distance: null,
    };
  }
}

export function formatDistance(miles: number): string {
  if (miles < 0.1) {
    const feet = Math.round(miles * 5280);
    return `${feet} ft`;
  }
  return `${miles.toFixed(2)} mi`;
}

export function getGeofenceStatus(distance: number | null): {
  canComplete: boolean;
  statusColor: string;
  statusText: string;
  statusIcon: string;
} {
  if (distance === null) {
    return {
      canComplete: false,
      statusColor: "text-gray-500",
      statusText: "Location unavailable",
      statusIcon: "📍",
    };
  }

  if (distance <= GEOFENCE_RADIUS_MILES) {
    return {
      canComplete: true,
      statusColor: "text-green-600",
      statusText: "In delivery range",
      statusIcon: "✓",
    };
  }

  if (distance <= 2) {
    return {
      canComplete: false,
      statusColor: "text-yellow-600",
      statusText: "Getting close",
      statusIcon: "⏰",
    };
  }

  return {
    canComplete: false,
    statusColor: "text-red-600",
    statusText: "Not in delivery range",
    statusIcon: "⚠️",
  };
}