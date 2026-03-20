// Optimize Route Edge Function
// Optimizes delivery routes for runners using nearest neighbor algorithm

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Delivery {
  id: string;
  address: string;
  coordinates?: { lat: number; lng: number };
  priority?: number;
}

interface Waypoint {
  delivery_id: string;
  address: string;
  coordinates: { lat: number; lng: number };
  estimated_arrival: string;
  estimated_duration_minutes: number;
  sequence: number;
}

// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in km
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

// Optimize route using nearest neighbor algorithm
function optimizeRoute(
  deliveries: Delivery[],
  startLocation: { lat: number; lng: number }
): Waypoint[] {
  const waypoints: Waypoint[] = [];
  const remaining = [...deliveries];
  let currentLocation = startLocation;
  let currentTime = new Date();
  let sequence = 1;

  while (remaining.length > 0) {
    // Find nearest delivery
    let nearestIndex = 0;
    let nearestDistance = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const delivery = remaining[i];
      if (!delivery.coordinates) continue;

      const distance = calculateDistance(
        currentLocation.lat,
        currentLocation.lng,
        delivery.coordinates.lat,
        delivery.coordinates.lng
      );

      // Consider priority (lower priority number = higher priority)
      const priorityMultiplier = delivery.priority ? 1 / delivery.priority : 1;
      const adjustedDistance = distance * priorityMultiplier;

      if (adjustedDistance < nearestDistance) {
        nearestDistance = adjustedDistance;
        nearestIndex = i;
      }
    }

    const nearest = remaining.splice(nearestIndex, 1)[0];
    if (!nearest.coordinates) continue;

    // Estimate travel time (assuming 50 km/h average speed)
    const distance = calculateDistance(
      currentLocation.lat,
      currentLocation.lng,
      nearest.coordinates.lat,
      nearest.coordinates.lng
    );
    const travelTimeMinutes = Math.round((distance / 50) * 60); // 50 km/h = ~50 minutes per 50km

    // Update current time
    currentTime = new Date(currentTime.getTime() + travelTimeMinutes * 60 * 1000);

    waypoints.push({
      delivery_id: nearest.id,
      address: nearest.address,
      coordinates: nearest.coordinates,
      estimated_arrival: currentTime.toISOString(),
      estimated_duration_minutes: travelTimeMinutes,
      sequence,
    });

    currentLocation = nearest.coordinates;
    sequence++;
  }

  return waypoints;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { deliveries, runner_id, constraints } = await req.json();

    if (!deliveries || !Array.isArray(deliveries) || deliveries.length === 0) {
      return new Response(
        JSON.stringify({ error: "deliveries array is required" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Get runner's current location
    let startLocation = { lat: 0, lng: 0 };
    if (runner_id) {
      const { data: runner, error: runnerError } = await supabaseClient
        .from("wholesale_runners")
        .select("current_lat, current_lng")
        .eq("id", runner_id)
        .single();

      if (!runnerError && runner?.current_lat && runner?.current_lng) {
        startLocation = {
          lat: runner.current_lat,
          lng: runner.current_lng,
        };
      }
    }

    // If no runner location, use first delivery as starting point
    if (startLocation.lat === 0 && startLocation.lng === 0) {
      const firstDelivery = deliveries.find((d) => d.coordinates);
      if (firstDelivery?.coordinates) {
        startLocation = firstDelivery.coordinates;
      }
    }

    // Optimize route
    const waypoints = optimizeRoute(deliveries, startLocation);

    // Calculate total distance and estimated time
    let totalDistance = 0;
    let totalTime = 0;
    for (const waypoint of waypoints) {
      totalTime += waypoint.estimated_duration_minutes;
      if (waypoints.indexOf(waypoint) > 0) {
        const prev = waypoints[waypoints.indexOf(waypoint) - 1];
        totalDistance += calculateDistance(
          prev.coordinates.lat,
          prev.coordinates.lng,
          waypoint.coordinates.lat,
          waypoint.coordinates.lng
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        waypoints,
        summary: {
          total_deliveries: waypoints.length,
          total_distance_km: Math.round(totalDistance * 10) / 10,
          estimated_total_time_minutes: totalTime,
          estimated_completion: waypoints[waypoints.length - 1]?.estimated_arrival,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

