/**
 * Courier management handlers: list, details, status update, commission, payment.
 */
import { type HandlerContext, logAdminAction, jsonResponse, errorResponse } from './_shared.ts';
import type { AdminDashboardInput } from '../validation.ts';

export async function handleCouriers(ctx: HandlerContext): Promise<Response> {
  const { supabase, tenantId, url } = ctx;

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

  return jsonResponse({
    couriers: couriersWithEarnings,
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit)
    }
  });
}

export async function handleCourierDetails(ctx: HandlerContext): Promise<Response> {
  const { supabase, tenantId, url } = ctx;

  const courierId = url.searchParams.get("courierId");
  if (!courierId) {
    return errorResponse("Courier ID required", 400);
  }

  // C3: Verify courier belongs to admin's tenant
  const { data: courier } = await supabase
    .from("couriers")
    .select("*")
    .eq("id", courierId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!courier) {
    return errorResponse("Courier not found", 404);
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

  return jsonResponse({
    courier,
    stats: {
      total_deliveries: totalDeliveries,
      total_earnings: totalEarnings,
      avg_per_delivery: totalDeliveries > 0 ? totalEarnings / totalDeliveries : 0
    },
    recent_shifts: recentShifts
  });
}

export async function handleUpdateCourierStatus(ctx: HandlerContext): Promise<Response> {
  const { supabase, adminUser, tenantId, validatedBody, req } = ctx;

  if (!validatedBody) {
    return errorResponse("Request body required", 400);
  }
  const { courier_id, is_active } = validatedBody as AdminDashboardInput & { courier_id: string; is_active: boolean };

  if (!courier_id) {
    return errorResponse("courier_id is required", 400);
  }

  // C3: Verify courier belongs to admin's tenant before write
  const { data: existingCourier } = await supabase
    .from("couriers")
    .select("id")
    .eq("id", courier_id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!existingCourier) {
    return errorResponse("Courier not found or not authorized", 404);
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
    return errorResponse("Failed to update courier status", 500);
  }

  await logAdminAction(supabase, adminUser.id, "UPDATE_COURIER_STATUS", tenantId, "courier", courier_id, { is_active }, req);

  return jsonResponse({ success: true, courier });
}

export async function handleUpdateCommissionRate(ctx: HandlerContext): Promise<Response> {
  const { supabase, adminUser, tenantId, validatedBody, req } = ctx;

  if (!validatedBody) {
    return errorResponse("Request body required", 400);
  }
  const { courier_id, commission_rate } = validatedBody as AdminDashboardInput & { courier_id: string; commission_rate: number };

  if (!courier_id) {
    return errorResponse("courier_id is required", 400);
  }

  // C3: Verify courier belongs to admin's tenant before write
  const { data: existingCourier } = await supabase
    .from("couriers")
    .select("id")
    .eq("id", courier_id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!existingCourier) {
    return errorResponse("Courier not found or not authorized", 404);
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
    return errorResponse("Failed to update commission rate", 500);
  }

  await logAdminAction(supabase, adminUser.id, "UPDATE_COMMISSION_RATE", tenantId, "courier", courier_id, { commission_rate }, req);

  return jsonResponse({ success: true, courier });
}

export async function handlePayCourier(ctx: HandlerContext): Promise<Response> {
  const { supabase, adminUser, tenantId, validatedBody, req } = ctx;

  if (!validatedBody) {
    return errorResponse("Request body required", 400);
  }
  const { earnings_ids, payment_method } = validatedBody as AdminDashboardInput & { earnings_ids: string[]; payment_method: string };

  if (!earnings_ids || !Array.isArray(earnings_ids) || earnings_ids.length === 0) {
    return errorResponse("earnings_ids array is required", 400);
  }

  // C3: Verify all earnings belong to couriers in admin's tenant
  // Fetch the earnings to get courier_ids, then verify those couriers belong to this tenant
  const { data: earningsToVerify } = await supabase
    .from("courier_earnings")
    .select("id, courier_id")
    .in("id", earnings_ids);

  if (!earningsToVerify || earningsToVerify.length !== earnings_ids.length) {
    return errorResponse("One or more earnings records not found", 404);
  }

  const earningCourierIds = [...new Set(earningsToVerify.map((e: Record<string, unknown>) => e.courier_id))];
  const { data: tenantCouriers } = await supabase
    .from("couriers")
    .select("id")
    .eq("tenant_id", tenantId)
    .in("id", earningCourierIds);

  if (!tenantCouriers || tenantCouriers.length !== earningCourierIds.length) {
    return errorResponse("Unauthorized: earnings belong to couriers outside your tenant", 403);
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
    return errorResponse("Failed to process payment", 500);
  }

  await logAdminAction(supabase, adminUser.id, "PAY_COURIER", tenantId, "earnings", earnings_ids.join(","), { payment_method, count: earnings_ids.length }, req);

  return jsonResponse({ success: true, count: earnings_ids.length });
}
