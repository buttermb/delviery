import { serve, createClient, corsHeaders as sharedCorsHeaders } from '../_shared/deps.ts';
import { validateAdminDashboard, type AdminDashboardInput } from './validation.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const JSON_HEADERS = { ...corsHeaders, "Content-Type": "application/json" };

async function logAdminAction(
  supabase: any,
  adminId: string,
  action: string,
  tenantId: string,
  entityType?: string,
  entityId?: string,
  details?: Record<string, unknown>,
  req?: Request
) {
  await supabase.from("admin_audit_logs").insert({
    admin_id: adminId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    details: { ...details, tenant_id: tenantId },
    ip_address: req?.headers.get("x-forwarded-for") || "unknown",
    user_agent: req?.headers.get("user-agent") || "unknown",
  });
}

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - missing authorization header" }),
        { status: 401, headers: JSON_HEADERS }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: JSON_HEADERS }
      );
    }

    const { data: adminUser } = await supabase
      .from("admin_users")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (!adminUser) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: JSON_HEADERS }
      );
    }

    // C1: Resolve tenant_id for the authenticated admin
    const tenantId = await resolveTenantId(supabase, user.id, user.email);
    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: "Tenant not found or user not authorized" }),
        { status: 403, headers: JSON_HEADERS }
      );
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

    // ==================== DASHBOARD OVERVIEW ====================
    if (endpoint === "overview") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [
        { count: totalOrders },
        { count: todayOrders },
        { count: activeOrders },
        { count: totalUsers },
        { count: totalMerchants },
        { count: activeCouriers },
        { count: pendingVerifications },
        { count: flaggedOrders },
      ] = await Promise.all([
        supabase.from("orders").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId),
        supabase.from("orders").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId).gte("created_at", today.toISOString()),
        supabase.from("orders").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId).in("status", ["pending", "confirmed", "preparing", "out_for_delivery"]),
        supabase.from("profiles").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId),
        supabase.from("merchants").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("is_active", true),
        supabase.from("couriers").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("is_online", true),
        supabase.from("profiles").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("age_verified", false),
        supabase.from("orders").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId).not("flagged_reason", "is", null),
      ]);

      // Calculate today's revenue
      const { data: todayRevenue } = await supabase
        .from("orders")
        .select("total_amount")
        .eq("tenant_id", tenantId)
        .gte("created_at", today.toISOString())
        .not("status", "eq", "cancelled");

      const revenue = todayRevenue?.reduce((sum: number, order: { total_amount: string }) => sum + parseFloat(order.total_amount), 0) || 0;

      await logAdminAction(supabase, adminUser.id, "VIEW_DASHBOARD_OVERVIEW", tenantId, undefined, undefined, undefined, req);

      return new Response(
        JSON.stringify({
          metrics: {
            totalOrders: totalOrders || 0,
            todayOrders: todayOrders || 0,
            activeOrders: activeOrders || 0,
            totalUsers: totalUsers || 0,
            totalMerchants: totalMerchants || 0,
            activeCouriers: activeCouriers || 0,
            pendingVerifications: pendingVerifications || 0,
            flaggedOrders: flaggedOrders || 0,
            todayRevenue: revenue,
          },
        }),
        { status: 200, headers: JSON_HEADERS }
      );
    }

    // ==================== LIVE DELIVERIES ====================
    if (endpoint === "live-deliveries") {
      try {
        // Fetch all active orders filtered by tenant_id
        const { data: orders, error: ordersError } = await supabase
          .from("orders")
          .select("*")
          .eq("tenant_id", tenantId)
          .in("status", ["accepted", "confirmed", "preparing", "out_for_delivery"])
          .order("created_at", { ascending: false });

        if (ordersError) {
          console.error("[admin-dashboard] Error fetching orders:", ordersError.message);
          return new Response(
            JSON.stringify({ error: "Failed to fetch live deliveries" }),
            { status: 500, headers: JSON_HEADERS }
          );
        }

        // Fetch related deliveries
        const orderIds = orders?.map((o: { id: string }) => o.id) || [];
        const { data: deliveries } = orderIds.length > 0
          ? await supabase
              .from("deliveries")
              .select("*")
              .eq("tenant_id", tenantId)
              .in("order_id", orderIds)
          : { data: [] };

        // Fetch user profiles
        const userIds = [...new Set(orders?.map((o: { user_id: string }) => o.user_id).filter(Boolean) || [])];
        const { data: profiles } = userIds.length > 0
          ? await supabase.from("profiles").select("*").eq("tenant_id", tenantId).in("user_id", userIds)
          : { data: [] };

        // Fetch addresses and couriers referenced by orders
        const addressIds = [...new Set(orders?.map((o: { address_id: string }) => o.address_id).filter(Boolean) || [])];
        const courierIds = [...new Set(orders?.map((o: { courier_id: string }) => o.courier_id).filter(Boolean) || [])];

        const { data: addresses } = addressIds.length > 0
          ? await supabase.from("addresses").select("*").in("id", addressIds)
          : { data: [] };

        const { data: couriers } = courierIds.length > 0
          ? await supabase.from("couriers").select("*").eq("tenant_id", tenantId).in("id", courierIds)
          : { data: [] };

        // Fetch order items
        const { data: orderItems } = orderIds.length > 0
          ? await supabase
              .from("order_items")
              .select(`
                *,
                products (name, category, price)
              `)
              .in("order_id", orderIds)
          : { data: [] };

        // Transform orders into delivery format for the map
        const enrichedDeliveries = orders?.map((order: Record<string, unknown>) => {
          const delivery = deliveries?.find((d: Record<string, unknown>) => d.order_id === order.id);
          const address = addresses?.find((a: Record<string, unknown>) => a.id === order.address_id) || null;
          const courier = couriers?.find((c: Record<string, unknown>) => c.id === order.courier_id) || null;
          return {
            id: delivery?.id || order.id,
            order_id: order.id,
            courier_id: order.courier_id,
            pickup_lat: delivery?.pickup_lat || 40.7589,
            pickup_lng: delivery?.pickup_lng || -73.9851,
            dropoff_lat: (typeof address?.latitude === 'number' ? address.latitude : undefined) || delivery?.dropoff_lat || order.dropoff_lat || 40.7589,
            dropoff_lng: (typeof address?.longitude === 'number' ? address.longitude : undefined) || delivery?.dropoff_lng || order.dropoff_lng || -73.9851,
            estimated_pickup_time: delivery?.estimated_pickup_time,
            estimated_dropoff_time: delivery?.estimated_dropoff_time || order.estimated_delivery,
            actual_pickup_time: delivery?.actual_pickup_time,
            created_at: delivery?.created_at || order.created_at,
            courier: courier,
            order: {
              ...order,
              user: profiles?.find((p: Record<string, unknown>) => p.user_id === order.user_id) || null,
              items: orderItems?.filter((item: Record<string, unknown>) => item.order_id === order.id) || [],
              order_number: order.order_number || `ORD-${(order.id as string).substring(0, 8).toUpperCase()}`,
            }
          };
        }) || [];

        await logAdminAction(supabase, adminUser.id, "VIEW_LIVE_DELIVERIES", tenantId, undefined, undefined, { count: enrichedDeliveries.length }, req);

        return new Response(
          JSON.stringify({
            deliveries: enrichedDeliveries,
            count: enrichedDeliveries.length,
            success: true
          }),
          { status: 200, headers: JSON_HEADERS }
        );
      } catch (error) {
        console.error("[admin-dashboard] Live deliveries error:", error instanceof Error ? error.message : "Unknown error");
        return new Response(
          JSON.stringify({ error: "Failed to fetch live deliveries" }),
          { status: 500, headers: JSON_HEADERS }
        );
      }
    }

    // ==================== ORDERS LIST ====================
    if (endpoint === "orders") {
      const status = url.searchParams.get("status");
      const merchantId = url.searchParams.get("merchantId");
      const courierId = url.searchParams.get("courierId");
      const flagged = url.searchParams.get("flagged");
      const page = parseInt(url.searchParams.get("page") || "1");
      const limit = parseInt(url.searchParams.get("limit") || "50");

      try {
        let query = supabase
          .from("orders")
          .select("*", { count: "exact" })
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .range((page - 1) * limit, page * limit - 1);

        if (status) {
          const statuses = status.split(',').map((s: string) => s.trim());
          if (statuses.length > 1) {
            query = query.in("status", statuses);
          } else {
            query = query.eq("status", status);
          }
        }
        if (merchantId) query = query.eq("merchant_id", merchantId);
        if (courierId) query = query.eq("courier_id", courierId);
        if (flagged === "true") query = query.not("flagged_reason", "is", null);

        const { data: orders, count, error } = await query;

        if (error) {
          console.error("[admin-dashboard] Orders query error:", error.message);
          return new Response(
            JSON.stringify({ error: "Failed to fetch orders" }),
            { status: 500, headers: JSON_HEADERS }
          );
        }

        if (!orders || orders.length === 0) {
          return new Response(
            JSON.stringify({
              orders: [],
              pagination: { page, limit, total: 0, totalPages: 0 }
            }),
            { status: 200, headers: JSON_HEADERS }
          );
        }

        // Fetch all related data separately, scoped by tenant_id where applicable
        const userIds = [...new Set(orders.map((o: { user_id: string }) => o.user_id).filter(Boolean))];
        const merchantIds = [...new Set(orders.map((o: { merchant_id: string }) => o.merchant_id).filter(Boolean))];
        const courierIds = [...new Set(orders.map((o: { courier_id: string }) => o.courier_id).filter(Boolean))];
        const addressIds = [...new Set(orders.map((o: { address_id: string }) => o.address_id).filter(Boolean))];
        const orderIds = orders.map((o: { id: string }) => o.id);

        const [profilesRes, merchantsRes, couriersRes, addressesRes, itemsRes, deliveriesRes] = await Promise.all([
          userIds.length > 0 ? supabase.from("profiles").select("*").eq("tenant_id", tenantId).in("user_id", userIds) : { data: [] },
          merchantIds.length > 0 ? supabase.from("merchants").select("*").eq("tenant_id", tenantId).in("id", merchantIds) : { data: [] },
          courierIds.length > 0 ? supabase.from("couriers").select("*").eq("tenant_id", tenantId).in("id", courierIds) : { data: [] },
          addressIds.length > 0 ? supabase.from("addresses").select("*").in("id", addressIds) : { data: [] },
          supabase.from("order_items").select("*, products(*)").in("order_id", orderIds),
          supabase.from("deliveries").select("*").eq("tenant_id", tenantId).in("order_id", orderIds)
        ]);

        // Combine data
        const enrichedOrders = orders.map((order: Record<string, unknown>) => ({
          ...order,
          user: profilesRes.data?.find((p: Record<string, unknown>) => p.user_id === order.user_id) || null,
          merchant: merchantsRes.data?.find((m: Record<string, unknown>) => m.id === order.merchant_id) || null,
          courier: couriersRes.data?.find((c: Record<string, unknown>) => c.id === order.courier_id) || null,
          address: addressesRes.data?.find((a: Record<string, unknown>) => a.id === order.address_id) || null,
          items: itemsRes.data?.filter((item: Record<string, unknown>) => item.order_id === order.id) || [],
          delivery: deliveriesRes.data?.find((d: Record<string, unknown>) => d.order_id === order.id) || null
        }));

        return new Response(
          JSON.stringify({
            orders: enrichedOrders,
            pagination: {
              page,
              limit,
              total: count || 0,
              totalPages: Math.ceil((count || 0) / limit),
            },
          }),
          { status: 200, headers: JSON_HEADERS }
        );
      } catch (error) {
        console.error("[admin-dashboard] Orders endpoint error:", error instanceof Error ? error.message : "Unknown error");
        return new Response(
          JSON.stringify({ error: "Failed to fetch orders" }),
          { status: 500, headers: JSON_HEADERS }
        );
      }
    }

    // ==================== ORDER DETAILS ====================
    if (endpoint === "order-details") {
      const orderId = url.searchParams.get("orderId");
      if (!orderId) {
        return new Response(
          JSON.stringify({ error: "Order ID required" }),
          { status: 400, headers: JSON_HEADERS }
        );
      }

      const { data: order } = await supabase
        .from("orders")
        .select(`
          *,
          user:profiles!orders_user_id_fkey (*),
          merchant:merchants (*),
          courier:couriers (*),
          address:addresses (*),
          items:order_items (
            *,
            product:products (*)
          ),
          tracking:order_tracking (*)
        `)
        .eq("id", orderId)
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (!order) {
        return new Response(
          JSON.stringify({ error: "Order not found" }),
          { status: 404, headers: JSON_HEADERS }
        );
      }

      // Get age verifications for the order's user
      const { data: verifications } = await supabase
        .from("age_verifications")
        .select("*")
        .eq("user_id", order.user_id)
        .order("created_at", { ascending: false });

      await logAdminAction(supabase, adminUser.id, "VIEW_ORDER_DETAILS", tenantId, "order", orderId, undefined, req);

      return new Response(
        JSON.stringify({ order, verifications: verifications || [] }),
        { status: 200, headers: JSON_HEADERS }
      );
    }

    // ==================== COMPLIANCE DASHBOARD ====================
    if (endpoint === "compliance") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const [
        { count: unverifiedUsers },
        { count: todayVerifications },
        { count: failedVerifications },
        { count: flaggedOrders },
      ] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("age_verified", false).lt("created_at", yesterday.toISOString()),
        supabase.from("age_verifications").select("*", { count: "exact", head: true }).gte("created_at", today.toISOString()),
        supabase.from("age_verifications").select("*", { count: "exact", head: true }).eq("verified", false),
        supabase.from("orders").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId).not("flagged_reason", "is", null),
      ]);

      return new Response(
        JSON.stringify({
          unverifiedUsers: unverifiedUsers || 0,
          todayVerifications: todayVerifications || 0,
          failedVerifications: failedVerifications || 0,
          flaggedOrders: flaggedOrders || 0,
        }),
        { status: 200, headers: JSON_HEADERS }
      );
    }

    // ==================== REALTIME STATS ====================
    if (endpoint === "realtime-stats") {
      const now = new Date();
      const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const [
        { count: ordersLastHour },
        { data: revenueData },
        { count: activeCouriers },
      ] = await Promise.all([
        supabase.from("orders").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId).gte("created_at", hourAgo.toISOString()),
        supabase.from("orders").select("total_amount").eq("tenant_id", tenantId).gte("created_at", hourAgo.toISOString()).neq("status", "cancelled"),
        supabase.from("couriers").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("is_online", true),
      ]);

      const revenueLastHour = revenueData?.reduce((sum: number, order: { total_amount: string }) => sum + parseFloat(order.total_amount), 0) || 0;

      // Calculate average delivery time (using actual pickup to actual dropoff)
      const { data: recentDeliveries } = await supabase
        .from("deliveries")
        .select("actual_pickup_time, actual_dropoff_time, created_at")
        .eq("tenant_id", tenantId)
        .not("actual_dropoff_time", "is", null)
        .not("created_at", "is", null)
        .gte("actual_dropoff_time", hourAgo.toISOString());

      let avgDeliveryTime = 0;
      if (recentDeliveries && recentDeliveries.length > 0) {
        const validDeliveries = recentDeliveries
          .map((del: { actual_pickup_time: string | null; actual_dropoff_time: string | null; created_at: string | null }) => {
            const startTime = del.actual_pickup_time || del.created_at;
            const endTime = del.actual_dropoff_time;

            if (!startTime || !endTime) return null;

            const startMs = new Date(startTime).getTime();
            const endMs = new Date(endTime).getTime();
            const diffMinutes = (endMs - startMs) / 1000 / 60;

            // Only accept delivery times between 5 minutes and 4 hours (240 minutes)
            if (diffMinutes > 5 && diffMinutes < 240) {
              return diffMinutes;
            }
            return null;
          })
          .filter((time: number | null): time is number => time !== null);

        if (validDeliveries.length > 0) {
          const totalMinutes = validDeliveries.reduce((sum: number, minutes: number) => sum + minutes, 0);
          avgDeliveryTime = Math.round(totalMinutes / validDeliveries.length);
        }
      }

      return new Response(
        JSON.stringify({
          ordersLastHour: ordersLastHour || 0,
          revenueLastHour,
          activeCouriers: activeCouriers || 0,
          avgDeliveryTime,
          activeUsers: 0,
          timestamp: now,
        }),
        { status: 200, headers: JSON_HEADERS }
      );
    }

    // ==================== HEATMAP DATA ====================
    if (endpoint === "heatmap") {
      const days = parseInt(url.searchParams.get("days") || "30");
      const type = url.searchParams.get("type") || "orders";

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      let heatmapData: Array<{ lat: number; lng: number; intensity: number }> = [];

      if (type === "orders") {
        const { data: orders } = await supabase
          .from("orders")
          .select(`
            total_amount,
            address:addresses!orders_address_id_fkey (lat, lng)
          `)
          .eq("tenant_id", tenantId)
          .gte("created_at", startDate.toISOString())
          .eq("status", "delivered")
          .not("address_id", "is", null);

        heatmapData = orders?.filter((o: Record<string, unknown>) => o.address && Array.isArray(o.address) && (o.address as unknown[]).length > 0).map((order: Record<string, unknown>) => {
          const addr = Array.isArray(order.address) ? order.address[0] : order.address;
          return {
            lat: parseFloat(addr.lat as string),
            lng: parseFloat(addr.lng as string),
            intensity: parseFloat(order.total_amount as string),
          };
        }) || [];
      } else if (type === "users") {
        // Get addresses for users belonging to this tenant
        const { data: tenantProfiles } = await supabase
          .from("profiles")
          .select("user_id")
          .eq("tenant_id", tenantId);

        const tenantUserIds = tenantProfiles?.map((p: { user_id: string }) => p.user_id) || [];

        const { data: addresses } = tenantUserIds.length > 0
          ? await supabase
              .from("addresses")
              .select("lat, lng, user_id")
              .eq("is_default", true)
              .in("user_id", tenantUserIds)
          : { data: [] };

        heatmapData = addresses?.map((addr: Record<string, unknown>) => ({
          lat: parseFloat(addr.lat as string),
          lng: parseFloat(addr.lng as string),
          intensity: 1,
        })) || [];
      }

      return new Response(
        JSON.stringify({
          heatmapData,
          count: heatmapData.length,
        }),
        { status: 200, headers: JSON_HEADERS }
      );
    }

    // ==================== TEST/DEBUG ENDPOINT ====================
    if (endpoint === "test") {
      const { count: ordersCount } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId);

      const { count: deliveriesCount } = await supabase
        .from("deliveries")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId);

      const { count: couriersCount } = await supabase
        .from("couriers")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId);

      return new Response(
        JSON.stringify({
          message: "Admin dashboard is working",
          adminUser: { id: adminUser.id, role: adminUser.role },
          databaseCounts: {
            orders: ordersCount,
            deliveries: deliveriesCount,
            couriers: couriersCount
          }
        }),
        { status: 200, headers: JSON_HEADERS }
      );
    }

    // ==================== SALES ANALYTICS ====================
    if (endpoint === "sales-analytics") {
      const days = parseInt(url.searchParams.get("days") || "30");
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);

      const { data: orders } = await supabase
        .from("orders")
        .select("created_at, total_amount, status")
        .eq("tenant_id", tenantId)
        .gte("created_at", startDate.toISOString())
        .neq("status", "cancelled");

      // Group by day
      const salesByDay: Record<string, { date: string; revenue: number; orders: number }> = {};

      orders?.forEach((order: Record<string, unknown>) => {
        const date = (order.created_at as string).split("T")[0];
        if (!salesByDay[date]) {
          salesByDay[date] = { date, revenue: 0, orders: 0 };
        }
        salesByDay[date].revenue += parseFloat(order.total_amount as string);
        salesByDay[date].orders += 1;
      });

      const chartData = Object.values(salesByDay).sort((a, b) => a.date.localeCompare(b.date));

      return new Response(
        JSON.stringify({ chartData }),
        { status: 200, headers: JSON_HEADERS }
      );
    }

    // ==================== COURIER MANAGEMENT ====================
    if (endpoint === "couriers") {
      const status = url.searchParams.get("status");
      const page = parseInt(url.searchParams.get("page") || "1");
      const limit = parseInt(url.searchParams.get("limit") || "50");

      let query = supabase
        .from("couriers")
        .select("*", { count: "exact" })
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      if (status === "online") query = query.eq("is_online", true);
      if (status === "offline") query = query.eq("is_online", false);

      const { data: couriers, count } = await query;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get courier IDs for this tenant to filter earnings
      const tenantCourierIds = couriers?.map((c: { id: string }) => c.id) || [];

      const { data: todayEarnings } = tenantCourierIds.length > 0
        ? await supabase
            .from("courier_earnings")
            .select("courier_id, total_earned")
            .in("courier_id", tenantCourierIds)
            .gte("created_at", today.toISOString())
        : { data: [] };

      const couriersWithEarnings = couriers?.map((courier: Record<string, unknown>) => ({
        ...courier,
        today_earnings: todayEarnings
          ?.filter((e: Record<string, unknown>) => e.courier_id === courier.id)
          .reduce((sum: number, e: Record<string, unknown>) => sum + parseFloat(String(e.total_earned)), 0) || 0
      }));

      return new Response(
        JSON.stringify({
          couriers: couriersWithEarnings,
          pagination: {
            page,
            limit,
            total: count || 0,
            totalPages: Math.ceil((count || 0) / limit)
          }
        }),
        { status: 200, headers: JSON_HEADERS }
      );
    }

    // ==================== COURIER DETAILS ====================
    if (endpoint === "courier-details") {
      const courierId = url.searchParams.get("courierId");
      if (!courierId) {
        return new Response(
          JSON.stringify({ error: "Courier ID required" }),
          { status: 400, headers: JSON_HEADERS }
        );
      }

      // C3: Verify courier belongs to admin's tenant
      const { data: courier } = await supabase
        .from("couriers")
        .select("*")
        .eq("id", courierId)
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (!courier) {
        return new Response(
          JSON.stringify({ error: "Courier not found" }),
          { status: 404, headers: JSON_HEADERS }
        );
      }

      const [
        { data: allOrders },
        { data: allEarnings },
        { data: recentShifts }
      ] = await Promise.all([
        supabase.from("orders").select("*").eq("tenant_id", tenantId).eq("courier_id", courierId),
        supabase.from("courier_earnings").select("*").eq("courier_id", courierId),
        supabase.from("courier_shifts").select("*").eq("courier_id", courierId).order("started_at", { ascending: false }).limit(10)
      ]);

      const totalEarnings = allEarnings?.reduce((sum: number, e: Record<string, unknown>) => sum + parseFloat(String(e.total_earned)), 0) || 0;
      const totalDeliveries = allOrders?.filter((o: Record<string, unknown>) => o.status === "delivered").length || 0;

      return new Response(
        JSON.stringify({
          courier,
          stats: {
            total_deliveries: totalDeliveries,
            total_earnings: totalEarnings,
            avg_per_delivery: totalDeliveries > 0 ? totalEarnings / totalDeliveries : 0
          },
          recent_shifts: recentShifts
        }),
        { status: 200, headers: JSON_HEADERS }
      );
    }

    // ==================== UPDATE COURIER STATUS ====================
    if (endpoint === "update-courier-status") {
      if (!validatedBody) {
        return new Response(
          JSON.stringify({ error: "Request body required" }),
          { status: 400, headers: JSON_HEADERS }
        );
      }
      const { courier_id, is_active } = validatedBody as AdminDashboardInput & { courier_id: string; is_active: boolean };

      if (!courier_id) {
        return new Response(
          JSON.stringify({ error: "courier_id is required" }),
          { status: 400, headers: JSON_HEADERS }
        );
      }

      // C3: Verify courier belongs to admin's tenant before write
      const { data: existingCourier } = await supabase
        .from("couriers")
        .select("id")
        .eq("id", courier_id)
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (!existingCourier) {
        return new Response(
          JSON.stringify({ error: "Courier not found or not authorized" }),
          { status: 404, headers: JSON_HEADERS }
        );
      }

      const { data: courier, error: updateError } = await supabase
        .from("couriers")
        .update({ is_active })
        .eq("id", courier_id)
        .eq("tenant_id", tenantId)
        .select()
        .maybeSingle();

      if (updateError) {
        console.error("[admin-dashboard] Update courier status error:", updateError.message);
        return new Response(
          JSON.stringify({ error: "Failed to update courier status" }),
          { status: 500, headers: JSON_HEADERS }
        );
      }

      await logAdminAction(supabase, adminUser.id, "UPDATE_COURIER_STATUS", tenantId, "courier", courier_id, { is_active }, req);

      return new Response(
        JSON.stringify({ success: true, courier }),
        { status: 200, headers: JSON_HEADERS }
      );
    }

    // ==================== UPDATE COMMISSION RATE ====================
    if (endpoint === "update-commission-rate") {
      if (!validatedBody) {
        return new Response(
          JSON.stringify({ error: "Request body required" }),
          { status: 400, headers: JSON_HEADERS }
        );
      }
      const { courier_id, commission_rate } = validatedBody as AdminDashboardInput & { courier_id: string; commission_rate: number };

      if (!courier_id) {
        return new Response(
          JSON.stringify({ error: "courier_id is required" }),
          { status: 400, headers: JSON_HEADERS }
        );
      }

      // C3: Verify courier belongs to admin's tenant before write
      const { data: existingCourier } = await supabase
        .from("couriers")
        .select("id")
        .eq("id", courier_id)
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (!existingCourier) {
        return new Response(
          JSON.stringify({ error: "Courier not found or not authorized" }),
          { status: 404, headers: JSON_HEADERS }
        );
      }

      const { data: courier, error: updateError } = await supabase
        .from("couriers")
        .update({ commission_rate })
        .eq("id", courier_id)
        .eq("tenant_id", tenantId)
        .select()
        .maybeSingle();

      if (updateError) {
        console.error("[admin-dashboard] Update commission rate error:", updateError.message);
        return new Response(
          JSON.stringify({ error: "Failed to update commission rate" }),
          { status: 500, headers: JSON_HEADERS }
        );
      }

      await logAdminAction(supabase, adminUser.id, "UPDATE_COMMISSION_RATE", tenantId, "courier", courier_id, { commission_rate }, req);

      return new Response(
        JSON.stringify({ success: true, courier }),
        { status: 200, headers: JSON_HEADERS }
      );
    }

    // ==================== PAY COURIER ====================
    if (endpoint === "pay-courier") {
      if (!validatedBody) {
        return new Response(
          JSON.stringify({ error: "Request body required" }),
          { status: 400, headers: JSON_HEADERS }
        );
      }
      const { earnings_ids, payment_method } = validatedBody as AdminDashboardInput & { earnings_ids: string[]; payment_method: string };

      if (!earnings_ids || !Array.isArray(earnings_ids) || earnings_ids.length === 0) {
        return new Response(
          JSON.stringify({ error: "earnings_ids array is required" }),
          { status: 400, headers: JSON_HEADERS }
        );
      }

      // C3: Verify all earnings belong to couriers in admin's tenant
      // Fetch the earnings to get courier_ids, then verify those couriers belong to this tenant
      const { data: earningsToVerify } = await supabase
        .from("courier_earnings")
        .select("id, courier_id")
        .in("id", earnings_ids);

      if (!earningsToVerify || earningsToVerify.length !== earnings_ids.length) {
        return new Response(
          JSON.stringify({ error: "One or more earnings records not found" }),
          { status: 404, headers: JSON_HEADERS }
        );
      }

      const earningCourierIds = [...new Set(earningsToVerify.map((e: Record<string, unknown>) => e.courier_id))];
      const { data: tenantCouriers } = await supabase
        .from("couriers")
        .select("id")
        .eq("tenant_id", tenantId)
        .in("id", earningCourierIds);

      if (!tenantCouriers || tenantCouriers.length !== earningCourierIds.length) {
        return new Response(
          JSON.stringify({ error: "Unauthorized: earnings belong to couriers outside your tenant" }),
          { status: 403, headers: JSON_HEADERS }
        );
      }

      const { error: payError } = await supabase
        .from("courier_earnings")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
          payment_method
        })
        .in("id", earnings_ids);

      if (payError) {
        console.error("[admin-dashboard] Pay courier error:", payError.message);
        return new Response(
          JSON.stringify({ error: "Failed to process payment" }),
          { status: 500, headers: JSON_HEADERS }
        );
      }

      await logAdminAction(supabase, adminUser.id, "PAY_COURIER", tenantId, "earnings", earnings_ids.join(","), { payment_method, count: earnings_ids.length }, req);

      return new Response(
        JSON.stringify({ success: true, count: earnings_ids.length }),
        { status: 200, headers: JSON_HEADERS }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid endpoint" }),
      { status: 400, headers: JSON_HEADERS }
    );
  } catch (error) {
    console.error("[admin-dashboard] Unhandled error:", error instanceof Error ? error.message : "Unknown error");
    return new Response(
      JSON.stringify({ error: "Dashboard request failed" }),
      { status: 500, headers: JSON_HEADERS }
    );
  }
});
