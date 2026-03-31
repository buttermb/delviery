import { serve, createClient } from '../_shared/deps.ts';
import { getAuthenticatedCorsHeaders } from '../_shared/cors.ts';
import { validateAdminDashboard, type AdminDashboardInput } from './validation.ts';
import { JSON_HEADERS, type HandlerContext, errorResponse } from './handlers/_shared.ts';
import { handleOverview, handleRealtimeStats, handleTest } from './handlers/overview.ts';
import { handleLiveDeliveries } from './handlers/deliveries.ts';
import { handleOrders, handleOrderDetails } from './handlers/orders.ts';
import { handleCompliance } from './handlers/compliance.ts';
import { handleSalesAnalytics, handleHeatmap } from './handlers/analytics.ts';
import {
  handleCouriers,
  handleCourierDetails,
  handleUpdateCourierStatus,
  handleUpdateCommissionRate,
  handlePayCourier,
} from './handlers/couriers.ts';

/**
 * Resolve tenant_id from an authenticated user.
 * Checks tenant_users first, then falls back to tenant owner_email.
 */
async function resolveTenantId(supabase: any, userId: string, userEmail: string | undefined): Promise<string | null> {
  const { data: tenantUser } = await supabase
    .from("tenant_users")
    .select("tenant_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (tenantUser) {
    return tenantUser.tenant_id;
  }

  // Fallback: check if user is a tenant owner
  if (userEmail) {
    const { data: tenant } = await supabase
      .from("tenants")
      .select("id")
      .eq("owner_email", userEmail)
      .maybeSingle();

    if (tenant) {
      return tenant.id;
    }
  }

  return null;
}

/** Map endpoint names to their handler functions. */
const handlers: Record<string, (ctx: HandlerContext) => Promise<Response>> = {
  "overview": handleOverview,
  "live-deliveries": handleLiveDeliveries,
  "orders": handleOrders,
  "order-details": handleOrderDetails,
  "compliance": handleCompliance,
  "realtime-stats": handleRealtimeStats,
  "heatmap": handleHeatmap,
  "test": handleTest,
  "sales-analytics": handleSalesAnalytics,
  "couriers": handleCouriers,
  "courier-details": handleCourierDetails,
  "update-courier-status": handleUpdateCourierStatus,
  "update-commission-rate": handleUpdateCommissionRate,
  "pay-courier": handlePayCourier,
};

serve(async (req) => {
  const authCors = getAuthenticatedCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: authCors });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errorResponse("Unauthorized - missing authorization header", 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return errorResponse("Unauthorized", 401);
    }

    const { data: adminUser } = await supabase
      .from("admin_users")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (!adminUser) {
      return errorResponse("Admin access required", 403);
    }

    // Resolve tenant_id for the authenticated admin
    const tenantId = await resolveTenantId(supabase, user.id, user.email);
    if (!tenantId) {
      return errorResponse("Tenant not found or user not authorized", 403);
    }

    const url = new URL(req.url);

    // Get endpoint from query params first
    let endpoint = url.searchParams.get("endpoint");
    let validatedBody: AdminDashboardInput | null = null;

    // For POST requests, parse and validate the body
    if (req.method === "POST") {
      try {
        const rawBody = await req.json();
        validatedBody = validateAdminDashboard(rawBody);
        if (!endpoint && validatedBody.endpoint) {
          endpoint = validatedBody.endpoint;
        }
      } catch (error) {
        return new Response(
          JSON.stringify({
            error: "Invalid request body",
            details: error instanceof Error ? error.message : "Validation failed"
          }),
          { status: 400, headers: JSON_HEADERS }
        );
      }
    }

    // Default to "overview" if no endpoint specified
    if (!endpoint) {
      endpoint = "overview";
    }

    console.error("[admin-dashboard] Request:", { endpoint, adminId: adminUser.id, tenantId });

    const handler = handlers[endpoint];
    if (!handler) {
      return errorResponse("Invalid endpoint", 400);
    }

    return await handler({ supabase, adminUser, tenantId, url, req, validatedBody });
  } catch (error) {
    console.error("[admin-dashboard] Unhandled error:", error instanceof Error ? error.message : "Unknown error");
    return errorResponse("Dashboard request failed", 500);
  }
});
