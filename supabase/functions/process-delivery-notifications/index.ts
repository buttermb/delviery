import { serve, createClient, corsHeaders, type SupabaseClient } from "../_shared/deps.ts";

// Stages that include tracking links use tracking_send_link (15 credits)
// Other stages are plain SMS notifications using send_sms (25 credits)
const TRACKING_LINK_STAGES = new Set([1, 2, 3, 8]);

/**
 * Returns the credit action_key based on notification stage.
 * Stages with tracking links → tracking_send_link (15 credits)
 * Stages without tracking links → send_sms (25 credits)
 */
function getNotificationActionKey(stage: number): string {
  return TRACKING_LINK_STAGES.has(stage) ? 'tracking_send_link' : 'send_sms';
}

/**
 * Attempt to deduct credits for a notification. Fail-open: if credit deduction
 * fails, log the error but allow the notification to proceed. System-triggered
 * notifications should not be blocked by credit issues.
 */
async function tryDeductCredits(
  supabase: SupabaseClient,
  tenantId: string,
  actionKey: string,
  orderId: string,
  stage: number,
): Promise<{ deducted: boolean; creditsCost: number; newBalance: number }> {
  try {
    const { data, error } = await supabase.rpc('consume_credits', {
      p_tenant_id: tenantId,
      p_action_key: actionKey,
      p_reference_id: orderId,
      p_reference_type: 'delivery_notification',
      p_description: `Delivery notification stage ${stage}`,
    });

    if (error) {
      console.error(`Credit deduction failed for order ${orderId} stage ${stage}:`, error.message);
      return { deducted: false, creditsCost: 0, newBalance: 0 };
    }

    const result = data?.[0];
    if (!result?.success) {
      console.warn(
        `Insufficient credits for tenant ${tenantId}, order ${orderId} stage ${stage}. ` +
        `Proceeding with notification (fail-open).`
      );
      return { deducted: false, creditsCost: result?.credits_cost ?? 0, newBalance: result?.new_balance ?? 0 };
    }

    return {
      deducted: true,
      creditsCost: result.credits_cost,
      newBalance: result.new_balance,
    };
  } catch (err) {
    console.error(`Credit deduction error for order ${orderId} stage ${stage}:`, err);
    return { deducted: false, creditsCost: 0, newBalance: 0 };
  }
}

// Calculate distance between two coordinates using Haversine formula
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Send SMS notification via Twilio
async function sendSMS(to: string, message: string, orderId: string, stage: number, supabase: SupabaseClient) {
  const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER");

  if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
    console.error("Twilio not configured, skipping SMS");
    await supabase.from("notifications_log").insert({
      order_id: orderId,
      notification_stage: stage,
      notification_type: "sms",
      recipient_phone: to,
      message_content: message,
      status: "skipped",
      error_message: "Twilio not configured"
    });
    return { success: false, error: "Twilio not configured" };
  }

  try {
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
    const auth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

    const formData = new URLSearchParams();
    formData.append("To", to);
    formData.append("From", twilioPhoneNumber);
    formData.append("Body", message);

    const response = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Twilio error:", errorText);

      await supabase.from("notifications_log").insert({
        order_id: orderId,
        notification_stage: stage,
        notification_type: "sms",
        recipient_phone: to,
        message_content: message,
        status: "failed",
        error_message: errorText
      });

      return { success: false, error: errorText };
    }

    const result = await response.json();

    await supabase.from("notifications_log").insert({
      order_id: orderId,
      notification_stage: stage,
      notification_type: "sms",
      recipient_phone: to,
      message_content: message,
      status: "sent",
      delivered_at: new Date().toISOString()
    });

    return { success: true, messageId: result.sid };
  } catch (error) {
    console.error("SMS error:", error);

    await supabase.from("notifications_log").insert({
      order_id: orderId,
      notification_stage: stage,
      notification_type: "sms",
      recipient_phone: to,
      message_content: message,
      status: "failed",
      error_message: error instanceof Error ? error.message : String(error)
    });

    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Send a notification for a given stage, with credit deduction.
 * Returns notification record if sent, or null if skipped.
 */
async function sendStageNotification(
  supabase: SupabaseClient,
  order: Record<string, unknown>,
  stage: number,
  message: string,
  orderNumber: string,
  extra?: Record<string, string>,
): Promise<Record<string, unknown> | null> {
  const customerPhone = order.customer_phone as string | undefined;
  const tenantId = order.tenant_id as string | undefined;
  const orderId = order.id as string;

  if (!customerPhone) return null;

  // Deduct credits if tenant_id is available
  if (tenantId) {
    const actionKey = getNotificationActionKey(stage);
    await tryDeductCredits(supabase, tenantId, actionKey, orderId, stage);
  }

  await sendSMS(customerPhone, message, orderId, stage, supabase);

  const stageField = `notification_sent_stage_${stage}`;
  await supabase.from("orders").update({
    [stageField]: true,
    last_notification_sent_at: new Date().toISOString()
  }).eq("id", orderId);

  return { order: orderNumber, stage, ...extra };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(supabaseUrl!, supabaseKey!);

    // Get all active orders (include tenant_id for credit deduction)
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select(`
        *,
        courier:couriers(*),
        customer:profiles(*)
      `)
      .in("status", ["accepted", "confirmed", "preparing", "out_for_delivery"])
      .order("created_at", { ascending: false });

    if (ordersError) throw ordersError;

    const notifications: Record<string, unknown>[] = [];
    const trackingUrl = "https://newyorkminute.com/track";

    for (const order of orders || []) {
      const orderNumber = order.order_number || `NYM-${order.id.substring(0, 6)}`;

      // Stage 1: Order Confirmed (tracking link → tracking_send_link, 15 credits)
      if (!order.notification_sent_stage_1 && order.status === "pending") {
        const message = `✓ Order confirmed! #${orderNumber}\nWe're finding you a driver.\nTrack: ${trackingUrl}/${order.tracking_code}`;
        const result = await sendStageNotification(supabase, order, 1, message, orderNumber);
        if (result) notifications.push(result);
      }

      // Stage 2: Driver Assigned (tracking link → tracking_send_link, 15 credits)
      if (!order.notification_sent_stage_2 && order.courier_id && order.status === "accepted") {
        const courierName = order.courier?.full_name || "Your driver";
        const rating = order.courier?.rating || 5.0;
        const message = `🚗 Driver assigned!\n${courierName} (${rating}⭐) is picking up your order.\nTrack: ${trackingUrl}/${order.tracking_code}`;
        const result = await sendStageNotification(supabase, order, 2, message, orderNumber);
        if (result) notifications.push(result);
      }

      // Stage 3: Order Picked Up (tracking link → tracking_send_link, 15 credits)
      if (!order.notification_sent_stage_3 && order.status === "out_for_delivery") {
        const courierName = order.courier?.full_name || "Your driver";
        const eta = order.eta_minutes ? `${order.eta_minutes} min` : "30 min";
        const message = `📦 ${courierName} picked up your order!\nEstimated arrival: ${eta}\nTrack live: ${trackingUrl}/${order.tracking_code}`;
        const result = await sendStageNotification(supabase, order, 3, message, orderNumber);
        if (result) notifications.push(result);
      }

      // Stages 4-7: Distance-based notifications (no tracking link → send_sms, 25 credits)
      if (order.courier && order.courier.current_lat && order.courier.current_lng &&
          order.dropoff_lat && order.dropoff_lng && order.status === "out_for_delivery") {

        const distance = calculateDistance(
          order.courier.current_lat,
          order.courier.current_lng,
          order.dropoff_lat,
          order.dropoff_lng
        );

        const courierName = order.courier?.full_name || "Your driver";

        // Stage 4: 20 Minutes Away
        if (!order.notification_sent_stage_4 && distance <= 5 && distance > 2) {
          const message = `⏰ 20 minutes away!\n${courierName} will arrive soon.\nPrepare your ID for age verification.`;
          const result = await sendStageNotification(supabase, order, 4, message, orderNumber, { distance: distance.toFixed(2) });
          if (result) notifications.push(result);
        }

        // Stage 5: 10 Minutes Away
        if (!order.notification_sent_stage_5 && distance <= 2 && distance > 0.8) {
          const message = `⏰ 10 minutes away!\n${courierName} will arrive soon at:\n${order.delivery_address}\n\nMake sure you're available.`;
          const result = await sendStageNotification(supabase, order, 5, message, orderNumber, { distance: distance.toFixed(2) });
          if (result) notifications.push(result);
        }

        // Stage 6: 5 Minutes Away
        if (!order.notification_sent_stage_6 && distance <= 0.8 && distance > 0.5) {
          const vehicle = order.courier.vehicle_make && order.courier.vehicle_model
            ? `${order.courier.vehicle_make} ${order.courier.vehicle_model}`
            : order.courier.vehicle_type || "vehicle";
          const message = `🔔 5 minutes away!\n${courierName} will arrive very soon.\nLook out for ${vehicle}`;
          const result = await sendStageNotification(supabase, order, 6, message, orderNumber, { distance: distance.toFixed(2) });
          if (result) notifications.push(result);
        }

        // Stage 7: Driver Arrived
        if (!order.notification_sent_stage_7 && distance <= 0.1) {
          const message = `📍 ${courierName} has arrived!\nThey're outside at ${order.delivery_address}.\nPlease bring your ID (21+).`;
          const result = await sendStageNotification(supabase, order, 7, message, orderNumber, { distance: distance.toFixed(2) });
          if (result) notifications.push(result);
        }
      }

      // Stage 8: Delivery Complete (tracking link → tracking_send_link, 15 credits)
      if (!order.notification_sent_stage_8 && order.status === "delivered") {
        const message = `✅ Delivered!\nThanks for ordering with NYM.\nEnjoy your THCA!\n\nRate your experience: ${trackingUrl}/${order.tracking_code}`;
        const result = await sendStageNotification(supabase, order, 8, message, orderNumber);
        if (result) notifications.push(result);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: orders?.length || 0,
        notifications_sent: notifications.length,
        notifications
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Notification processing error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
