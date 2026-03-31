import type { SupabaseClient } from '../../_shared/deps.ts';
import { jsonResponse, type CourierRecord } from '../utils.ts';

// ── earnings ────────────────────────────────────────────────────────────

export async function handleEarnings(
  supabase: SupabaseClient,
  courier: CourierRecord,
  body: Record<string, unknown>,
): Promise<Response> {
  const period = (body.period as string) || "week";

  let query = supabase
    .from("courier_earnings")
    .select("*")
    .eq("courier_id", courier.id)
    .order("created_at", { ascending: false });

  if (period === "week") {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    query = query.gte("created_at", weekStart.toISOString());
  } else if (period === "month") {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    query = query.gte("created_at", monthStart.toISOString());
  }

  const { data: earnings } = await query;

  const totalEarned =
    earnings?.reduce((sum, e) => sum + parseFloat(e.total_earned), 0) || 0;
  const totalDeliveries = earnings?.length || 0;
  const avgPerDelivery =
    totalDeliveries > 0 ? totalEarned / totalDeliveries : 0;

  return jsonResponse({
    earnings: earnings || [],
    summary: {
      total_earned: totalEarned.toFixed(2),
      total_deliveries: totalDeliveries,
      avg_per_delivery: avgPerDelivery.toFixed(2),
    },
  });
}

// ── today-stats ─────────────────────────────────────────────────────────

export async function handleTodayStats(
  supabase: SupabaseClient,
  courier: CourierRecord,
): Promise<Response> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    { data: todayOrders },
    { data: todayEarnings },
    { data: activeShift },
  ] = await Promise.all([
    supabase
      .from("orders")
      .select("*")
      .eq("courier_id", courier.id)
      .gte("created_at", today.toISOString()),
    supabase
      .from("courier_earnings")
      .select("total_earned")
      .eq("courier_id", courier.id)
      .gte("created_at", today.toISOString()),
    supabase
      .from("courier_shifts")
      .select("*")
      .eq("courier_id", courier.id)
      .eq("status", "active")
      .maybeSingle(),
  ]);

  const deliveries =
    todayOrders?.filter((o) => o.status === "delivered").length || 0;
  const totalEarnings =
    todayEarnings?.reduce((sum, e) => sum + parseFloat(e.total_earned), 0) || 0;

  let hoursOnline = 0;
  if (activeShift) {
    const now = new Date();
    const start = new Date(activeShift.started_at);
    hoursOnline = (now.getTime() - start.getTime()) / (1000 * 60 * 60);
  }

  return jsonResponse({
    deliveries_completed: deliveries,
    total_earned: totalEarnings.toFixed(2),
    hours_online: hoursOnline.toFixed(1),
    active_orders:
      todayOrders?.filter((o) =>
        ["preparing", "out_for_delivery"].includes(o.status),
      ).length || 0,
  });
}
