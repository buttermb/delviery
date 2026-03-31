/**
 * Sales analytics and heatmap handlers.
 */
import { type HandlerContext, jsonResponse } from './_shared.ts';

export async function handleSalesAnalytics(ctx: HandlerContext): Promise<Response> {
  const { supabase, tenantId, url } = ctx;

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

  return jsonResponse({ chartData });
}

export async function handleHeatmap(ctx: HandlerContext): Promise<Response> {
  const { supabase, tenantId, url } = ctx;

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

  return jsonResponse({
    heatmapData,
    count: heatmapData.length,
  });
}
