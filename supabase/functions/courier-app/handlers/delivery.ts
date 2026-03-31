import type { SupabaseClient } from '../../_shared/deps.ts';
import { jsonResponse, type CourierRecord } from '../utils.ts';

// ── mark-picked-up ──────────────────────────────────────────────────────

export async function handleMarkPickedUp(
  supabase: SupabaseClient,
  courier: CourierRecord,
  body: Record<string, unknown>,
): Promise<Response> {
  const { order_id, pickup_photo_url } = body as {
    order_id: string;
    pickup_photo_url?: string;
  };

  await supabase
    .from("orders")
    .update({ status: "out_for_delivery" })
    .eq("id", order_id)
    .eq("courier_id", courier.id);

  await supabase
    .from("deliveries")
    .update({
      actual_pickup_time: new Date().toISOString(),
      pickup_photo_url,
    })
    .eq("order_id", order_id);

  await supabase
    .from("order_tracking")
    .insert({
      order_id,
      status: "out_for_delivery",
      message: "Order picked up and out for delivery",
    });

  return jsonResponse({ success: true });
}

// ── mark-delivered ──────────────────────────────────────────────────────

export async function handleMarkDelivered(
  supabase: SupabaseClient,
  courier: CourierRecord,
  body: Record<string, unknown>,
): Promise<Response> {
  const {
    order_id,
    delivery_photo_url,
    signature_url,
    id_verification_photo_url,
    customer_present,
  } = body as {
    order_id: string;
    delivery_photo_url?: string;
    signature_url?: string;
    id_verification_photo_url?: string;
    customer_present?: boolean;
  };

  const now = new Date().toISOString();

  // 1. Mark order delivered and fetch order details for earnings calc
  const { data: deliveredOrder } = await supabase
    .from("orders")
    .update({
      status: "delivered",
      delivered_at: now,
    })
    .eq("id", order_id)
    .eq("courier_id", courier.id)
    .select(
      "id, order_number, subtotal, total_amount, delivery_fee, tip_amount, tenant_id, customer_name",
    )
    .single();

  // 2. Update delivery record
  await supabase
    .from("deliveries")
    .update({
      actual_dropoff_time: now,
      delivery_photo_url,
      signature_url,
      id_verification_url: id_verification_photo_url,
      delivery_notes: customer_present ? "Delivered to customer" : "Left at door",
    })
    .eq("order_id", order_id);

  // 3. Insert tracking event
  await supabase
    .from("order_tracking")
    .insert({
      order_id,
      status: "delivered",
      message: "Order delivered successfully",
    });

  // 4. Create earnings record
  if (deliveredOrder) {
    await createEarningsRecord(supabase, courier, deliveredOrder);
  }

  return jsonResponse({ success: true });
}

// ── private helpers ─────────────────────────────────────────────────────

async function createEarningsRecord(
  supabase: SupabaseClient,
  courier: CourierRecord,
  deliveredOrder: Record<string, unknown>,
): Promise<void> {
  const orderTotal =
    parseFloat(String(deliveredOrder.subtotal || deliveredOrder.total_amount)) || 0;
  const commissionRate = courier.commission_rate || 30;
  const commissionAmount = (orderTotal * commissionRate) / 100;
  const tipAmount = parseFloat(String(deliveredOrder.tip_amount)) || 0;
  const totalEarned = commissionAmount + tipAmount;

  // Compute week_start_date (Monday of current week)
  const today = new Date();
  const dayOfWeek = today.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);
  const weekStartDate = monday.toISOString().split("T")[0];

  await supabase
    .from("courier_earnings")
    .insert({
      courier_id: courier.id,
      order_id: deliveredOrder.id,
      order_total: orderTotal,
      commission_rate: commissionRate,
      commission_amount: commissionAmount,
      tip_amount: tipAmount,
      total_earned: totalEarned,
      week_start_date: weekStartDate,
      status: "pending",
    });

  // 5. Log delivery_completed to driver_activity_log
  if (courier.tenant_id) {
    const { data: orderAddresses } = await supabase
      .from("orders")
      .select(
        "delivery_address, pickup_lat, pickup_lng, merchants(business_name, address)",
      )
      .eq("id", deliveredOrder.id)
      .maybeSingle();

    const pickupAddress =
      orderAddresses?.merchants?.address ||
      orderAddresses?.merchants?.business_name ||
      null;

    await supabase
      .from("driver_activity_log")
      .insert({
        tenant_id: courier.tenant_id,
        driver_id: courier.id,
        event_type: "delivery_completed",
        event_data: {
          order_id: deliveredOrder.id,
          order_number: deliveredOrder.order_number,
          total_earned: totalEarned,
          customer_name: deliveredOrder.customer_name,
          tip: tipAmount > 0 ? tipAmount.toFixed(2) : null,
          pickup: pickupAddress,
          dropoff: orderAddresses?.delivery_address || null,
        },
      });
  }
}
