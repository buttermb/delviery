import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateAdminDashboard, type AdminDashboardInput } from './validation.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// deno-lint-ignore no-explicit-any
async function logAdminAction(
  supabase: any,
  adminId: string,
  action: string,
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
    details,
    ip_address: req?.headers.get("x-forwarded-for") || "unknown",
    user_agent: req?.headers.get("user-agent") || "unknown",
  });
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
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: adminUser } = await supabase
      .from("admin_users")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (!adminUser) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
    
    // Default to "overview" if no endpoint specified
    if (!endpoint) {
      endpoint = "overview";
    }
    
    console.log("Admin dashboard request:", { endpoint, adminUser: adminUser.email });

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
        supabase.from("orders").select("*", { count: "exact", head: true }),
        supabase.from("orders").select("*", { count: "exact", head: true }).gte("created_at", today.toISOString()),
        supabase.from("orders").select("*", { count: "exact", head: true }).in("status", ["pending", "confirmed", "preparing", "out_for_delivery"]),
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("merchants").select("*", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("couriers").select("*", { count: "exact", head: true }).eq("is_online", true),
        supabase.from("profiles").select("*", { count: "exact", head: true }).eq("age_verified", false),
        supabase.from("orders").select("*", { count: "exact", head: true }).not("flagged_reason", "is", null),
      ]);

      // Calculate today's revenue
      const { data: todayRevenue } = await supabase
        .from("orders")
        .select("total_amount")
        .gte("created_at", today.toISOString())
        .not("status", "eq", "cancelled");

      const revenue = todayRevenue?.reduce((sum, order) => sum + parseFloat(order.total_amount), 0) || 0;

      await logAdminAction(supabase, adminUser.id, "VIEW_DASHBOARD_OVERVIEW", undefined, undefined, undefined, req);

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
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==================== LIVE DELIVERIES ====================
    if (endpoint === "live-deliveries") {
      console.log("Fetching live deliveries...");
      
      try {
        // Fetch all active orders (accepted, confirmed, preparing, out_for_delivery)
        const { data: orders, error: ordersError } = await supabase
          .from("orders")
          .select("*")
          .in("status", ["accepted", "confirmed", "preparing", "out_for_delivery"])
          .order("created_at", { ascending: false });

        if (ordersError) {
          console.error("Error fetching orders:", ordersError);
          return new Response(
            JSON.stringify({ error: ordersError.message, deliveries: [], count: 0 }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        console.log(`Found ${orders?.length || 0} active orders`);

        // Fetch related deliveries
        const orderIds = orders?.map(o => o.id) || [];
        const { data: deliveries } = orderIds.length > 0 
          ? await supabase
              .from("deliveries")
              .select("*")
              .in("order_id", orderIds)
          : { data: [] };

        // Fetch user profiles
        const userIds = [...new Set(orders?.map(o => o.user_id).filter(Boolean) || [])];
        const { data: profiles } = userIds.length > 0
          ? await supabase.from("profiles").select("*").in("user_id", userIds)
          : { data: [] };

        // Fetch addresses and couriers referenced by orders
        const addressIds = [...new Set(orders?.map(o => o.address_id).filter(Boolean) || [])];
        const courierIds = [...new Set(orders?.map(o => o.courier_id).filter(Boolean) || [])];

        const { data: addresses } = addressIds.length > 0
          ? await supabase.from("addresses").select("*").in("id", addressIds)
          : { data: [] };

        const { data: couriers } = courierIds.length > 0
          ? await supabase.from("couriers").select("*").in("id", courierIds)
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
        const enrichedDeliveries = orders?.map(order => {
          const delivery = deliveries?.find(d => d.order_id === order.id);
          const address = addresses?.find(a => a.id === order.address_id) || null;
          const courier = couriers?.find(c => c.id === order.courier_id) || null;
          return {
            id: delivery?.id || order.id,
            order_id: order.id,
            courier_id: order.courier_id,
            pickup_lat: delivery?.pickup_lat || 40.7589, // NYC default
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
              user: profiles?.find(p => p.user_id === order.user_id) || null,
              items: orderItems?.filter(item => item.order_id === order.id) || [],
              order_number: order.order_number || `ORD-${order.id.substring(0, 8).toUpperCase()}`,
            }
          };
        }) || [];

        console.log(`Returning ${enrichedDeliveries.length} deliveries for map`);
        await logAdminAction(supabase, adminUser.id, "VIEW_LIVE_DELIVERIES", undefined, undefined, { count: enrichedDeliveries.length }, req);

        return new Response(
          JSON.stringify({ 
            deliveries: enrichedDeliveries, 
            count: enrichedDeliveries.length,
            success: true 
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (error) {
        console.error("Live deliveries error:", error);
        return new Response(
          JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error', deliveries: [], count: 0 }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ==================== ORDERS LIST ====================
    if (endpoint === "orders") {
      console.log("Fetching orders list...");
      const status = url.searchParams.get("status");
      const merchantId = url.searchParams.get("merchantId");
      const courierId = url.searchParams.get("courierId");
      const flagged = url.searchParams.get("flagged");
      const page = parseInt(url.searchParams.get("page") || "1");
      const limit = parseInt(url.searchParams.get("limit") || "50");

      try {
        // Fetch orders first WITHOUT joins
        let query = supabase
          .from("orders")
          .select("*", { count: "exact" })
          .order("created_at", { ascending: false })
          .range((page - 1) * limit, page * limit - 1);

        if (status) {
          // Support comma-separated statuses
          const statuses = status.split(',').map(s => s.trim());
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
          console.error("Orders query error:", error);
          return new Response(
            JSON.stringify({ error: error.message, orders: [], pagination: { page, limit, total: 0, totalPages: 0 } }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (!orders || orders.length === 0) {
          return new Response(
            JSON.stringify({
              orders: [],
              pagination: { page, limit, total: 0, totalPages: 0 }
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Fetch all related data separately
        const userIds = [...new Set(orders.map(o => o.user_id).filter(Boolean))];
        const merchantIds = [...new Set(orders.map(o => o.merchant_id).filter(Boolean))];
        const courierIds = [...new Set(orders.map(o => o.courier_id).filter(Boolean))];
        const addressIds = [...new Set(orders.map(o => o.address_id).filter(Boolean))];
        const orderIds = orders.map(o => o.id);

        const [profilesRes, merchantsRes, couriersRes, addressesRes, itemsRes, deliveriesRes] = await Promise.all([
          userIds.length > 0 ? supabase.from("profiles").select("*").in("user_id", userIds) : { data: [] },
          merchantIds.length > 0 ? supabase.from("merchants").select("*").in("id", merchantIds) : { data: [] },
          courierIds.length > 0 ? supabase.from("couriers").select("*").in("id", courierIds) : { data: [] },
          addressIds.length > 0 ? supabase.from("addresses").select("*").in("id", addressIds) : { data: [] },
          supabase.from("order_items").select("*, products(*)").in("order_id", orderIds),
          supabase.from("deliveries").select("*").in("order_id", orderIds)
        ]);

        // Combine data
        const enrichedOrders = orders.map(order => ({
          ...order,
          user: profilesRes.data?.find(p => p.user_id === order.user_id) || null,
          merchant: merchantsRes.data?.find(m => m.id === order.merchant_id) || null,
          courier: couriersRes.data?.find(c => c.id === order.courier_id) || null,
          address: addressesRes.data?.find(a => a.id === order.address_id) || null,
          items: itemsRes.data?.filter(item => item.order_id === order.id) || [],
          delivery: deliveriesRes.data?.find(d => d.order_id === order.id) || null
        }));

        console.log(`Successfully fetched ${enrichedOrders.length} orders`);

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
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (error) {
        console.error("Orders endpoint error:", error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return new Response(
          JSON.stringify({ 
            error: errorMessage, 
            orders: [], 
            pagination: { page, limit, total: 0, totalPages: 0 } 
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ==================== ORDER DETAILS ====================
    if (endpoint === "order-details") {
      const orderId = url.searchParams.get("orderId");
      if (!orderId) {
        return new Response(
          JSON.stringify({ error: "Order ID required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
        .single();

      if (!order) {
        return new Response(
          JSON.stringify({ error: "Order not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get age verifications
      const { data: verifications } = await supabase
        .from("age_verifications")
        .select("*")
        .eq("user_id", order.user_id)
        .order("created_at", { ascending: false });

      await logAdminAction(supabase, adminUser.id, "VIEW_ORDER_DETAILS", "order", orderId, undefined, req);

      return new Response(
        JSON.stringify({ order, verifications: verifications || [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
        supabase.from("profiles").select("*", { count: "exact", head: true }).eq("age_verified", false).lt("created_at", yesterday.toISOString()),
        supabase.from("age_verifications").select("*", { count: "exact", head: true }).gte("created_at", today.toISOString()),
        supabase.from("age_verifications").select("*", { count: "exact", head: true }).eq("verified", false),
        supabase.from("orders").select("*", { count: "exact", head: true }).not("flagged_reason", "is", null),
      ]);

      return new Response(
        JSON.stringify({
          unverifiedUsers: unverifiedUsers || 0,
          todayVerifications: todayVerifications || 0,
          failedVerifications: failedVerifications || 0,
          flaggedOrders: flaggedOrders || 0,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
        supabase.from("orders").select("*", { count: "exact", head: true }).gte("created_at", hourAgo.toISOString()),
        supabase.from("orders").select("total_amount").gte("created_at", hourAgo.toISOString()).neq("status", "cancelled"),
        supabase.from("couriers").select("*", { count: "exact", head: true }).eq("is_online", true),
      ]);

      const revenueLastHour = revenueData?.reduce((sum, order) => sum + parseFloat(order.total_amount), 0) || 0;

      // Calculate average delivery time (using actual pickup to actual dropoff)
      const { data: recentDeliveries } = await supabase
        .from("deliveries")
        .select("actual_pickup_time, actual_dropoff_time, created_at")
        .not("actual_dropoff_time", "is", null)
        .not("created_at", "is", null)
        .gte("actual_dropoff_time", hourAgo.toISOString());

      let avgDeliveryTime = 0;
      if (recentDeliveries && recentDeliveries.length > 0) {
        const validDeliveries = recentDeliveries
          .map(del => {
            // Use actual_pickup_time if available, otherwise use created_at as fallback
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
          .filter((time): time is number => time !== null);
        
        if (validDeliveries.length > 0) {
          const totalMinutes = validDeliveries.reduce((sum, minutes) => sum + minutes, 0);
          avgDeliveryTime = Math.round(totalMinutes / validDeliveries.length);
        }
      }

      return new Response(
        JSON.stringify({
          ordersLastHour: ordersLastHour || 0,
          revenueLastHour,
          activeCouriers: activeCouriers || 0,
          avgDeliveryTime,
          activeUsers: 0, // Would need Redis or session tracking
          timestamp: now,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
          .gte("created_at", startDate.toISOString())
          .eq("status", "delivered")
          .not("address_id", "is", null);

        heatmapData = orders?.filter(o => o.address && Array.isArray(o.address) && o.address.length > 0).map(order => {
          const addr = Array.isArray(order.address) ? order.address[0] : order.address;
          return {
            lat: parseFloat(addr.lat),
            lng: parseFloat(addr.lng),
            intensity: parseFloat(order.total_amount),
          };
        }) || [];
      } else if (type === "users") {
        const { data: addresses } = await supabase
          .from("addresses")
          .select("lat, lng, user_id")
          .eq("is_default", true);

        heatmapData = addresses?.map(addr => ({
          lat: parseFloat(addr.lat),
          lng: parseFloat(addr.lng),
          intensity: 1,
        })) || [];
      }
      
      return new Response(
        JSON.stringify({
          heatmapData,
          count: heatmapData.length,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==================== TEST/DEBUG ENDPOINT ====================
    if (endpoint === "test") {
      const { count: ordersCount } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true });
        
      const { count: deliveriesCount } = await supabase
        .from("deliveries")
        .select("*", { count: "exact", head: true });
        
      const { count: couriersCount } = await supabase
        .from("couriers")
        .select("*", { count: "exact", head: true });

      return new Response(
        JSON.stringify({
          message: "Admin dashboard is working",
          adminUser: { email: adminUser.email, role: adminUser.role },
          databaseCounts: {
            orders: ordersCount,
            deliveries: deliveriesCount,
            couriers: couriersCount
          }
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
        .gte("created_at", startDate.toISOString())
        .neq("status", "cancelled");

      // Group by day
      const salesByDay: Record<string, { date: string; revenue: number; orders: number }> = {};

      orders?.forEach((order) => {
        const date = order.created_at.split("T")[0];
        if (!salesByDay[date]) {
          salesByDay[date] = { date, revenue: 0, orders: 0 };
        }
        salesByDay[date].revenue += parseFloat(order.total_amount);
        salesByDay[date].orders += 1;
      });

      const chartData = Object.values(salesByDay).sort((a, b) => a.date.localeCompare(b.date));

      return new Response(
        JSON.stringify({ chartData }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
        .order("created_at", { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      if (status === "online") query = query.eq("is_online", true);
      if (status === "offline") query = query.eq("is_online", false);

      const { data: couriers, count } = await query;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { data: todayEarnings } = await supabase
        .from("courier_earnings")
        .select("courier_id, total_earned")
        .gte("created_at", today.toISOString());

      const couriersWithEarnings = couriers?.map(courier => ({
        ...courier,
        today_earnings: todayEarnings
          ?.filter(e => e.courier_id === courier.id)
          .reduce((sum, e) => sum + parseFloat(e.total_earned), 0) || 0
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
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==================== COURIER DETAILS ====================
    if (endpoint === "courier-details") {
      const courierId = url.searchParams.get("courierId");
      
      const { data: courier } = await supabase
        .from("couriers")
        .select("*")
        .eq("id", courierId)
        .single();

      if (!courier) {
        return new Response(
          JSON.stringify({ error: "Courier not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const [
        { data: allOrders },
        { data: allEarnings },
        { data: recentShifts }
      ] = await Promise.all([
        supabase.from("orders").select("*").eq("courier_id", courierId),
        supabase.from("courier_earnings").select("*").eq("courier_id", courierId),
        supabase.from("courier_shifts").select("*").eq("courier_id", courierId).order("started_at", { ascending: false }).limit(10)
      ]);

      const totalEarnings = allEarnings?.reduce((sum, e) => sum + parseFloat(e.total_earned), 0) || 0;
      const totalDeliveries = allOrders?.filter(o => o.status === "delivered").length || 0;

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
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==================== UPDATE COURIER STATUS ====================
    if (endpoint === "update-courier-status") {
      const body = await req.json();
      const { courier_id, is_active } = body;

      const { data: courier } = await supabase
        .from("couriers")
        .update({ is_active })
        .eq("id", courier_id)
        .select()
        .single();

      await logAdminAction(supabase, adminUser.id, "UPDATE_COURIER_STATUS", "courier", courier_id, { is_active }, req);

      return new Response(
        JSON.stringify({ success: true, courier }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==================== UPDATE COMMISSION RATE ====================
    if (endpoint === "update-commission-rate") {
      const body = await req.json();
      const { courier_id, commission_rate } = body;

      const { data: courier } = await supabase
        .from("couriers")
        .update({ commission_rate })
        .eq("id", courier_id)
        .select()
        .single();

      await logAdminAction(supabase, adminUser.id, "UPDATE_COMMISSION_RATE", "courier", courier_id, { commission_rate }, req);

      return new Response(
        JSON.stringify({ success: true, courier }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==================== PAY COURIER ====================
    if (endpoint === "pay-courier") {
      const body = await req.json();
      const { earnings_ids, payment_method } = body;

      await supabase
        .from("courier_earnings")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
          payment_method
        })
        .in("id", earnings_ids);

      await logAdminAction(supabase, adminUser.id, "PAY_COURIER", "earnings", earnings_ids.join(","), { payment_method }, req);

      return new Response(
        JSON.stringify({ success: true, count: earnings_ids.length }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid endpoint" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Admin dashboard error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Dashboard request failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
