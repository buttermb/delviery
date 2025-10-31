import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Calculate distance between two coordinates using Haversine formula
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY");
    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(supabaseUrl!, supabaseKey!, {
      global: { headers: { Authorization: authHeader! } }
    });

    const { 
      orderId, 
      driverLat, 
      driverLng, 
      action,
      accuracy,
      speed,
      isMockLocation 
    } = await req.json();

    if (!orderId || !driverLat || !driverLng) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get order details
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*, courier:couriers(*)")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ error: "Order not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!order.dropoff_lat || !order.dropoff_lng) {
      return new Response(
        JSON.stringify({ error: "Customer location not available" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate distance
    const distance = calculateDistance(
      driverLat,
      driverLng,
      order.dropoff_lat,
      order.dropoff_lng
    );

    const GEOFENCE_RADIUS = 0.5; // 0.5 miles
    const withinGeofence = distance <= GEOFENCE_RADIUS;
    const actionAllowed = withinGeofence || action !== "complete_delivery";

    // Log geofence check
    const { error: logError } = await supabase.from("geofence_checks").insert({
      order_id: orderId,
      driver_id: order.courier_id,
      driver_lat: driverLat,
      driver_lng: driverLng,
      customer_lat: order.dropoff_lat,
      customer_lng: order.dropoff_lng,
      distance_miles: distance,
      within_geofence: withinGeofence,
      action_attempted: action,
      action_allowed: actionAllowed
    });

    if (logError) {
      console.error("Error logging geofence check:", logError);
    }

    // GPS Validation & Anomaly Detection
    const gpsAnomalies = [];
    
    // Check for mock location
    if (isMockLocation === true) {
      gpsAnomalies.push({
        courier_id: order.courier_id,
        order_id: orderId,
        anomaly_type: "mock_location",
        lat: driverLat,
        lng: driverLng,
        accuracy_meters: accuracy,
        admin_notified: false
      });
    }
    
    // Check for low accuracy (> 100 meters)
    if (accuracy && accuracy > 100) {
      gpsAnomalies.push({
        courier_id: order.courier_id,
        order_id: orderId,
        anomaly_type: "low_accuracy",
        lat: driverLat,
        lng: driverLng,
        accuracy_meters: accuracy,
        admin_notified: false
      });
    }
    
    // Check for impossible speed (> 100 mph)
    if (speed && speed > 100) {
      gpsAnomalies.push({
        courier_id: order.courier_id,
        order_id: orderId,
        anomaly_type: "impossible_speed",
        lat: driverLat,
        lng: driverLng,
        speed_mph: speed,
        admin_notified: false
      });
    }
    
    // Log GPS anomalies
    if (gpsAnomalies.length > 0) {
      await supabase.from("gps_anomalies").insert(gpsAnomalies);
      console.warn("GPS anomalies detected:", gpsAnomalies);
    }

    // Update courier location
    await supabase.from("couriers").update({
      current_lat: driverLat,
      current_lng: driverLng,
      last_location_update: new Date().toISOString()
    }).eq("id", order.courier_id);

    // Insert location history
    await supabase.from("courier_location_history").insert({
      courier_id: order.courier_id,
      order_id: orderId,
      lat: driverLat,
      lng: driverLng,
      accuracy: accuracy || 50,
      speed: speed || null,
      is_mock_location: isMockLocation || false
    });

    return new Response(
      JSON.stringify({
        success: true,
        withinGeofence,
        distance: parseFloat(distance.toFixed(2)),
        geofenceRadius: GEOFENCE_RADIUS,
        actionAllowed,
        message: withinGeofence 
          ? "You can complete delivery" 
          : `You're ${distance.toFixed(2)} miles from customer. Get within ${GEOFENCE_RADIUS} miles.`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Geofence check error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});