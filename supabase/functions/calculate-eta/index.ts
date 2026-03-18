import { serve, createClient, corsHeaders, z } from "../_shared/deps.ts";
import { withZenProtection } from "../_shared/zen-firewall.ts";

const RequestSchema = z.object({
  orderId: z.string().uuid(),
  courierLat: z.number().min(-90).max(90).optional(),
  courierLng: z.number().min(-180).max(180).optional(),
});

serve(withZenProtection(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const mapboxToken = Deno.env.get("MAPBOX_ACCESS_TOKEN");

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!mapboxToken) {
      return new Response(
        JSON.stringify({ error: "Mapbox token not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Authenticate caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve caller's tenant
    const { data: tenantUser } = await userClient
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (!tenantUser?.tenant_id) {
      return new Response(
        JSON.stringify({ error: "No tenant found for user" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tenantId = tenantUser.tenant_id;

    // Validate request body
    const body = RequestSchema.parse(await req.json());
    const { orderId, courierLat, courierLng } = body;

    // Use service role client for data operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get order details — filtered by tenant_id
    const { data: order, error: orderError } = await adminClient
      .from("orders")
      .select("pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, merchant_id")
      .eq("id", orderId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (orderError) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch order" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!order) {
      return new Response(
        JSON.stringify({ error: "Order not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!order.pickup_lat || !order.pickup_lng || !order.dropoff_lat || !order.dropoff_lng) {
      return new Response(
        JSON.stringify({ error: "Order is missing required coordinates" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build coordinates for route
    // If courier location provided: courier → pickup → dropoff
    // Otherwise: pickup → dropoff
    let coordinates: string;
    if (courierLat !== undefined && courierLng !== undefined) {
      coordinates = [
        `${courierLng},${courierLat}`,
        `${order.pickup_lng},${order.pickup_lat}`,
        `${order.dropoff_lng},${order.dropoff_lat}`,
      ].join(";");
    } else {
      coordinates = [
        `${order.pickup_lng},${order.pickup_lat}`,
        `${order.dropoff_lng},${order.dropoff_lat}`,
      ].join(";");
    }

    // Call Mapbox Directions API
    const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?access_token=${mapboxToken}&geometries=geojson&overview=full`;
    const response = await fetch(directionsUrl);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Mapbox API error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: `Mapbox API error: ${response.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();

    if (data.code === "NoRoute" || !data.routes || data.routes.length === 0) {
      // Fallback: straight-line distance estimate (~2 min per mile in city traffic)
      const latDiff = order.dropoff_lat - (courierLat ?? order.pickup_lat);
      const lngDiff = order.dropoff_lng - (courierLng ?? order.pickup_lng);
      const straightLineMiles = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 69;
      const fallbackEtaMinutes = Math.max(15, Math.ceil(straightLineMiles * 2));

      return new Response(
        JSON.stringify({
          success: true,
          eta_minutes: fallbackEtaMinutes,
          distance_miles: straightLineMiles.toFixed(2),
          route: null,
          warning: "Route calculation unavailable, using estimated ETA",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const route = data.routes[0];
    const durationSeconds = route.duration;
    const distanceMeters = route.distance;
    const etaMinutes = Math.ceil(durationSeconds / 60);
    const distanceMiles = (distanceMeters * 0.000621371).toFixed(2);

    // Update order with ETA — scoped to tenant
    await adminClient
      .from("orders")
      .update({
        eta_minutes: etaMinutes,
        eta_updated_at: new Date().toISOString(),
        distance_miles: distanceMiles,
      })
      .eq("id", orderId)
      .eq("tenant_id", tenantId);

    return new Response(
      JSON.stringify({
        success: true,
        eta_minutes: etaMinutes,
        distance_miles: distanceMiles,
        route: route.geometry,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({ error: "Invalid request", details: error.errors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.error("Error calculating ETA:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}));
