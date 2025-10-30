import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Calculate distance between two coordinates using Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user is admin or courier
    const { data: userRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "courier"])
      .single();

    if (!userRole) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - admin or courier role required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { orderId, courierId } = await req.json();

    // Get order details
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ error: "Order not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Auto-assign logic: if no courierId provided, find nearest available courier
    let selectedCourierId = courierId;

    if (!selectedCourierId) {
      const { data: availableCouriers } = await supabase
        .from("couriers")
        .select("*")
        .eq("is_active", true)
        .eq("is_online", true)
        .eq("age_verified", true);

      if (!availableCouriers || availableCouriers.length === 0) {
        return new Response(
          JSON.stringify({ error: "No available couriers found" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Find nearest courier based on current location
      let nearestCourier = null;
      let minDistance = Infinity;

      for (const courier of availableCouriers) {
        if (courier.current_lat && courier.current_lng && order.delivery_lat && order.delivery_lng) {
          const distance = calculateDistance(
            parseFloat(courier.current_lat),
            parseFloat(courier.current_lng),
            parseFloat(order.delivery_lat),
            parseFloat(order.delivery_lng)
          );

          if (distance < minDistance) {
            minDistance = distance;
            nearestCourier = courier;
          }
        }
      }

      if (!nearestCourier) {
        // Fallback to first available courier if no location data
        nearestCourier = availableCouriers[0];
      }

      selectedCourierId = nearestCourier.id;
    }

    // Verify courier exists and is available
    const { data: courier, error: courierError } = await supabase
      .from("couriers")
      .select("*")
      .eq("id", selectedCourierId)
      .single();

    if (courierError || !courier) {
      return new Response(
        JSON.stringify({ error: "Courier not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!courier.is_active || !courier.age_verified) {
      return new Response(
        JSON.stringify({ error: "Courier not available" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Assign courier to order
    const { error: updateError } = await supabase
      .from("orders")
      .update({ 
        courier_id: selectedCourierId,
        status: "preparing"
      })
      .eq("id", orderId);

    if (updateError) {
      console.error("Failed to assign courier:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to assign courier" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create delivery record
    const estimatedPickupTime = new Date();
    estimatedPickupTime.setMinutes(estimatedPickupTime.getMinutes() + 15);
    const estimatedDropoffTime = new Date(estimatedPickupTime);
    estimatedDropoffTime.setMinutes(estimatedDropoffTime.getMinutes() + 30);

    if (!order.delivery_lat || !order.delivery_lng) {
      return new Response(
        JSON.stringify({ error: "Order missing delivery location" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await supabase.from("deliveries").insert({
      order_id: orderId,
      courier_id: selectedCourierId,
      pickup_lat: 40.7128, // Merchant location (simplified)
      pickup_lng: -74.0060,
      dropoff_lat: order.delivery_lat,
      dropoff_lng: order.delivery_lng,
      estimated_pickup_time: estimatedPickupTime.toISOString(),
      estimated_dropoff_time: estimatedDropoffTime.toISOString(),
    });

    // Add tracking update
    await supabase.from("order_tracking").insert({
      order_id: orderId,
      status: "preparing",
      message: `Courier ${courier.full_name} assigned to your order`,
    });

    // Log courier assignment
    await supabase.from("audit_logs").insert({
      entity_type: "order",
      entity_id: orderId,
      action: "COURIER_ASSIGNED",
      user_id: user.id,
      details: { 
        courierId: selectedCourierId,
        courierName: courier.full_name,
        autoAssigned: !courierId
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        courier: {
          id: courier.id,
          name: courier.full_name,
          phone: courier.phone,
        },
        estimatedPickup: estimatedPickupTime,
        estimatedDelivery: estimatedDropoffTime,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Assign courier error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to assign courier" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
