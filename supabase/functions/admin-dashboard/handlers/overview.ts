/**
 * Dashboard overview, realtime stats, and test/debug handlers.
 */
import { type HandlerContext, logAdminAction, jsonResponse } from './_shared.ts';

export async function handleOverview(ctx: HandlerContext): Promise<Response> {
  const { supabase, adminUser, tenantId, req } = ctx;

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

  return jsonResponse({
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
  });
}

export async function handleRealtimeStats(ctx: HandlerContext): Promise<Response> {
  const { supabase, tenantId } = ctx;

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

  return jsonResponse({
    ordersLastHour: ordersLastHour || 0,
    revenueLastHour,
    activeCouriers: activeCouriers || 0,
    avgDeliveryTime,
    activeUsers: 0,
    timestamp: now,
  });
}

export async function handleTest(ctx: HandlerContext): Promise<Response> {
  const { supabase, adminUser, tenantId } = ctx;

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

  return jsonResponse({
    message: "Admin dashboard is working",
    adminUser: { id: adminUser.id, role: adminUser.role },
    databaseCounts: {
      orders: ordersCount,
      deliveries: deliveriesCount,
      couriers: couriersCount
    }
  });
}
