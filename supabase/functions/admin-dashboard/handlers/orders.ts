/**
 * Orders list and order details handlers.
 */
import { type HandlerContext, logAdminAction, jsonResponse, errorResponse } from './_shared.ts';

export async function handleOrders(ctx: HandlerContext): Promise<Response> {
  const { supabase, tenantId, url } = ctx;

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
      return errorResponse("Failed to fetch orders", 500);
    }

    if (!orders || orders.length === 0) {
      return jsonResponse({
        orders: [],
        pagination: { page, limit, total: 0, totalPages: 0 }
      });
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

    return jsonResponse({
      orders: enrichedOrders,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error("[admin-dashboard] Orders endpoint error:", error instanceof Error ? error.message : "Unknown error");
    return errorResponse("Failed to fetch orders", 500);
  }
}

export async function handleOrderDetails(ctx: HandlerContext): Promise<Response> {
  const { supabase, adminUser, tenantId, url, req } = ctx;

  const orderId = url.searchParams.get("orderId");
  if (!orderId) {
    return errorResponse("Order ID required", 400);
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
    return errorResponse("Order not found", 404);
  }

  // Get age verifications for the order's user
  const { data: verifications } = await supabase
    .from("age_verifications")
    .select("*")
    .eq("user_id", order.user_id)
    .order("created_at", { ascending: false });

  await logAdminAction(supabase, adminUser.id, "VIEW_ORDER_DETAILS", tenantId, "order", orderId, undefined, req);

  return jsonResponse({ order, verifications: verifications || [] });
}
