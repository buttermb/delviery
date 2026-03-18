import { serve, createClient, corsHeaders, z } from "../_shared/deps.ts";
import { withZenProtection } from "../_shared/zen-firewall.ts";

// Request validation schema
const CheckGeofenceSchema = z.object({
  orderId: z.string().uuid(),
  driverLat: z.number().min(-90).max(90),
  driverLng: z.number().min(-180).max(180),
  action: z.string().optional().default("location_update"),
  accuracy: z.number().positive().optional(),
  speed: z.number().nonnegative().optional(),
  isMockLocation: z.boolean().optional().default(false),
});

// Calculate distance between two coordinates using Haversine formula
function calculateDistance(
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

const GEOFENCE_RADIUS_MILES = 0.5;

serve(
  withZenProtection(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    try {
      // Validate auth header
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: "Missing authorization" }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Validate request body
      const rawBody = await req.json();
      const parseResult = CheckGeofenceSchema.safeParse(rawBody);
      if (!parseResult.success) {
        return new Response(
          JSON.stringify({
            error: "Validation failed",
            details: parseResult.error.issues.map((i) => i.message),
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { orderId, driverLat, driverLng, action, accuracy, speed, isMockLocation } =
        parseResult.data;

      // Create Supabase client with service role for write access
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (!supabaseUrl || !supabaseKey) {
        throw new Error("Missing Supabase configuration");
      }

      const supabase = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: authHeader } },
      });

      // Verify user from JWT
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Get order details
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .select("id, courier_id, dropoff_lat, dropoff_lng")
        .eq("id", orderId)
        .maybeSingle();

      if (orderError || !order) {
        return new Response(
          JSON.stringify({ error: "Order not found" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (!order.dropoff_lat || !order.dropoff_lng) {
        return new Response(
          JSON.stringify({ error: "Customer location not available" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Calculate distance
      const distance = calculateDistance(
        driverLat,
        driverLng,
        order.dropoff_lat,
        order.dropoff_lng
      );

      const withinGeofence = distance <= GEOFENCE_RADIUS_MILES;
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
        action_allowed: actionAllowed,
      });

      if (logError) {
        console.error("Error logging geofence check:", logError);
      }

      // GPS Validation & Anomaly Detection
      const gpsAnomalies: Record<string, unknown>[] = [];

      if (isMockLocation) {
        gpsAnomalies.push({
          courier_id: order.courier_id,
          order_id: orderId,
          anomaly_type: "mock_location",
          lat: driverLat,
          lng: driverLng,
          accuracy_meters: accuracy,
          admin_notified: false,
        });
      }

      if (accuracy && accuracy > 100) {
        gpsAnomalies.push({
          courier_id: order.courier_id,
          order_id: orderId,
          anomaly_type: "low_accuracy",
          lat: driverLat,
          lng: driverLng,
          accuracy_meters: accuracy,
          admin_notified: false,
        });
      }

      if (speed && speed > 100) {
        gpsAnomalies.push({
          courier_id: order.courier_id,
          order_id: orderId,
          anomaly_type: "impossible_speed",
          lat: driverLat,
          lng: driverLng,
          speed_mph: speed,
          admin_notified: false,
        });
      }

      if (gpsAnomalies.length > 0) {
        const { error: anomalyError } = await supabase
          .from("gps_anomalies")
          .insert(gpsAnomalies);
        if (anomalyError) {
          console.error("Error logging GPS anomalies:", anomalyError);
        }
      }

      // Update courier location
      if (order.courier_id) {
        await supabase
          .from("couriers")
          .update({
            current_lat: driverLat,
            current_lng: driverLng,
            last_location_update: new Date().toISOString(),
          })
          .eq("id", order.courier_id);

        // Insert location history
        await supabase.from("courier_location_history").insert({
          courier_id: order.courier_id,
          order_id: orderId,
          lat: driverLat,
          lng: driverLng,
          accuracy: accuracy ?? 50,
          speed: speed ?? null,
          is_mock_location: isMockLocation,
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          withinGeofence,
          distance: parseFloat(distance.toFixed(2)),
          geofenceRadius: GEOFENCE_RADIUS_MILES,
          actionAllowed,
          message: withinGeofence
            ? "You can complete delivery"
            : `You're ${distance.toFixed(2)} miles from customer. Get within ${GEOFENCE_RADIUS_MILES} miles.`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (error: unknown) {
      console.error("Geofence check error:", error);
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : "Internal server error",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  })
);
