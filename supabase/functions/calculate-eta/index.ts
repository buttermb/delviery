import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const mapboxToken = Deno.env.get("MAPBOX_ACCESS_TOKEN");

    if (!mapboxToken) {
      throw new Error("Mapbox token not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { orderId, courierLat, courierLng } = await req.json();

    // Get order details
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, merchant_id")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      throw new Error("Order not found");
    }

    // Validate coordinates
    if (!order.pickup_lat || !order.pickup_lng || !order.dropoff_lat || !order.dropoff_lng) {
      throw new Error("Order is missing required coordinates");
    }

    // Build coordinates for route
    // If courier location is available: courier → pickup → dropoff
    // Otherwise: pickup → dropoff
    let coordinates: string;
    if (courierLat && courierLng && !isNaN(courierLat) && !isNaN(courierLng)) {
      coordinates = [
        `${courierLng},${courierLat}`,
        `${order.pickup_lng},${order.pickup_lat}`,
        `${order.dropoff_lng},${order.dropoff_lat}`
      ].join(";");
    } else {
      // Fallback to pickup → dropoff route only
      coordinates = [
        `${order.pickup_lng},${order.pickup_lat}`,
        `${order.dropoff_lng},${order.dropoff_lat}`
      ].join(";");
    }

    // Call Mapbox Directions API
    const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?access_token=${mapboxToken}&geometries=geojson&overview=full`;

    const response = await fetch(directionsUrl);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Mapbox API error:", response.status, errorText);
      throw new Error(`Mapbox API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.code === "NoRoute" || !data.routes || data.routes.length === 0) {
      // Return a fallback ETA estimate if no route found
      // Use straight-line distance as fallback (rough estimate: 1 mile = ~2 minutes in city traffic)
      const latDiff = order.dropoff_lat - (courierLat || order.pickup_lat);
      const lngDiff = order.dropoff_lng - (courierLng || order.pickup_lng);
      const straightLineMiles = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 69; // rough conversion
      const fallbackEtaMinutes = Math.max(15, Math.ceil(straightLineMiles * 2));
      
      return new Response(
        JSON.stringify({
          success: true,
          eta_minutes: fallbackEtaMinutes,
          distance_miles: straightLineMiles.toFixed(2),
          route: null,
          warning: "Route calculation unavailable, using estimated ETA"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const route = data.routes[0];
    const durationSeconds = route.duration;
    const distanceMeters = route.distance;
    const etaMinutes = Math.ceil(durationSeconds / 60);

    // Update order with ETA
    await supabase
      .from("orders")
      .update({
        eta_minutes: etaMinutes,
        eta_updated_at: new Date().toISOString(),
        distance_miles: (distanceMeters * 0.000621371).toFixed(2) // meters to miles
      })
      .eq("id", orderId);

    return new Response(
      JSON.stringify({
        success: true,
        eta_minutes: etaMinutes,
        distance_miles: (distanceMeters * 0.000621371).toFixed(2),
        route: route.geometry
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error calculating ETA:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});