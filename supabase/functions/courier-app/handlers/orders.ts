import type { SupabaseClient } from '../../_shared/deps.ts';
import {
  jsonResponse,
  enrichOrderWithCustomerInfo,
  type CourierRecord,
} from '../utils.ts';

// ── my-orders ───────────────────────────────────────────────────────────

export async function handleMyOrders(
  supabase: SupabaseClient,
  courier: CourierRecord,
  body: Record<string, unknown>,
): Promise<Response> {
  const status = (body.status as string) || "all";

  let query = supabase
    .from("orders")
    .select(`
      *,
      merchants (*),
      addresses (*),
      order_items (
        *,
        products (*)
      )
    `)
    .eq("courier_id", courier.id)
    .order("created_at", { ascending: false });

  // Add tenant filter for multi-tenant isolation
  if (courier.tenant_id) {
    query = query.eq("tenant_id", courier.tenant_id);
  }

  if (status === "active") {
    // Active orders are preparing or out for delivery
    query = query.in("status", ["preparing", "out_for_delivery"]);
  } else if (status !== "all") {
    query = query.eq("status", status);
  }

  const { data: orders, error } = await query;

  if (error) {
    console.error("Orders query error:", error);
    return jsonResponse({ error: error.message, orders: [] });
  }

  const ordersWithCustomerInfo = await Promise.all(
    (orders || []).map(async (order) => {
      const enriched = await enrichOrderWithCustomerInfo(supabase, order);
      const commission =
        (parseFloat(String(order.subtotal || order.total_amount)) *
          courier.commission_rate) /
        100;
      return {
        ...enriched,
        courier_commission: commission.toFixed(2),
      };
    }),
  );

  return jsonResponse({
    orders: ordersWithCustomerInfo,
    count: ordersWithCustomerInfo.length,
  });
}

// ── available-orders ────────────────────────────────────────────────────

export async function handleAvailableOrders(
  supabase: SupabaseClient,
  courier: CourierRecord,
): Promise<Response> {
  // Filter orders by courier's tenant_id for multi-tenant isolation
  let query = supabase
    .from("orders")
    .select(`
      *,
      merchants (*),
      addresses (*)
    `)
    .eq("status", "pending")
    .is("courier_id", null)
    .order("created_at", { ascending: true })
    .limit(20);

  // Add tenant filter if courier has a tenant_id
  if (courier.tenant_id) {
    query = query.eq("tenant_id", courier.tenant_id);
  }

  const { data: orders } = await query;

  const ordersWithCustomerInfo = await Promise.all(
    (orders || []).map((order) =>
      enrichOrderWithCustomerInfo(supabase, order),
    ),
  );

  return jsonResponse({ orders: ordersWithCustomerInfo });
}

// ── accept-order ────────────────────────────────────────────────────────

export async function handleAcceptOrder(
  supabase: SupabaseClient,
  courier: CourierRecord,
  body: Record<string, unknown>,
): Promise<Response> {
  const orderId = body.order_id as string;
  console.error('Accept order request for:', orderId);

  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .is("courier_id", null)
    .maybeSingle();

  if (!order) {
    console.error('Order not available or already assigned');
    return jsonResponse({ error: "Order no longer available" }, 400);
  }

  console.error('Updating order and fetching full details...');
  const { data: updatedOrder, error: updateError } = await supabase
    .from("orders")
    .update({
      courier_id: courier.id,
      courier_assigned_at: new Date().toISOString(),
      courier_accepted_at: new Date().toISOString(),
      status: "preparing",
    })
    .eq("id", orderId)
    .select(`
      *,
      merchants (
        id,
        business_name,
        address,
        phone,
        latitude,
        longitude
      ),
      addresses (
        street,
        apartment,
        city,
        state,
        zip_code,
        borough,
        latitude,
        longitude
      ),
      order_items (
        id,
        quantity,
        price,
        product_name,
        products (
          id,
          name,
          image_url,
          description
        )
      )
    `)
    .single();

  if (updateError) {
    console.error('Error updating order:', updateError);
    return jsonResponse({ error: updateError.message }, 500);
  }

  console.error('Order updated successfully:', updatedOrder);

  // Fetch customer info from profiles
  const enriched = await enrichOrderWithCustomerInfo(supabase, updatedOrder);

  // Get customer order count
  const { count } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', updatedOrder.user_id)
    .eq('status', 'delivered');

  const orderWithCustomerInfo = {
    ...enriched,
    customer_order_count: count || 0,
  };

  await supabase
    .from("order_tracking")
    .insert({
      order_id: orderId,
      status: "preparing",
      message: `Courier ${courier.full_name} accepted the order`,
    });

  console.error('Returning response with full order data');
  return jsonResponse({
    success: true,
    order: orderWithCustomerInfo,
  });
}

// ── update-order-status ─────────────────────────────────────────────────

export async function handleUpdateOrderStatus(
  supabase: SupabaseClient,
  courier: CourierRecord,
  body: Record<string, unknown>,
): Promise<Response> {
  const { order_id, status, notes } = body as {
    order_id: string;
    status: string;
    notes?: string;
  };

  const { data: updatedOrder } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", order_id)
    .eq("courier_id", courier.id)
    .select()
    .single();

  await supabase
    .from("order_tracking")
    .insert({
      order_id,
      status,
      message: notes || `Status updated to ${status}`,
    });

  return jsonResponse({ success: true, order: updatedOrder });
}
