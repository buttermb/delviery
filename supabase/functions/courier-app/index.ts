import { serve, createClient, corsHeaders } from '../_shared/deps.ts';
import { jsonResponse } from './utils.ts';
import type { CourierRecord } from './utils.ts';

// ── Handlers ────────────────────────────────────────────────────────────
import { handleLogin } from './handlers/login.ts';
import { handleToggleOnline } from './handlers/toggle-online.ts';
import { handleUpdateLocation } from './handlers/update-location.ts';
import {
  handleMyOrders,
  handleAvailableOrders,
  handleAcceptOrder,
  handleUpdateOrderStatus,
} from './handlers/orders.ts';
import { handleMarkPickedUp, handleMarkDelivered } from './handlers/delivery.ts';
import { handleEarnings, handleTodayStats } from './handlers/earnings.ts';

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Missing authorization header" }, 401);
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const { data: courier } = await supabase
      .from("couriers")
      .select("*, tenant_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!courier || !courier.is_active) {
      return jsonResponse({ error: "Courier account not found or inactive" }, 403);
    }

    // Log tenant_id for debugging
    console.error("Courier tenant_id:", courier.tenant_id);

    // Parse request body to get endpoint
    const body = await req.json();
    const endpoint = body.endpoint;

    console.error("Courier app request:", { endpoint, courier: courier.email });

    const typedCourier = courier as CourierRecord;

    // ── Route to handler ──────────────────────────────────────────────
    switch (endpoint) {
      case "login":
        return handleLogin(supabase, typedCourier);
      case "toggle-online":
        return handleToggleOnline(supabase, typedCourier, body);
      case "update-location":
        return handleUpdateLocation(supabase, typedCourier, body);
      case "my-orders":
        return handleMyOrders(supabase, typedCourier, body);
      case "available-orders":
        return handleAvailableOrders(supabase, typedCourier);
      case "accept-order":
        return handleAcceptOrder(supabase, typedCourier, body);
      case "update-order-status":
        return handleUpdateOrderStatus(supabase, typedCourier, body);
      case "mark-picked-up":
        return handleMarkPickedUp(supabase, typedCourier, body);
      case "mark-delivered":
        return handleMarkDelivered(supabase, typedCourier, body);
      case "earnings":
        return handleEarnings(supabase, typedCourier, body);
      case "today-stats":
        return handleTodayStats(supabase, typedCourier);
      default:
        return jsonResponse({ error: "Invalid endpoint" }, 400);
    }
  } catch (error) {
    console.error("Courier app error:", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Request failed" },
      500,
    );
  }
});
