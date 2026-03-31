/**
 * Live deliveries handler.
 */
import { type HandlerContext, logAdminAction, jsonResponse, errorResponse } from './_shared.ts';

export async function handleLiveDeliveries(ctx: HandlerContext): Promise<Response> {
  const { supabase, adminUser, tenantId, req } = ctx;

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
      return errorResponse("Failed to fetch live deliveries", 500);
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

    return jsonResponse({
      deliveries: enrichedDeliveries,
      count: enrichedDeliveries.length,
      success: true
    });
  } catch (error) {
    console.error("[admin-dashboard] Live deliveries error:", error instanceof Error ? error.message : "Unknown error");
    return errorResponse("Failed to fetch live deliveries", 500);
  }
}
