import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
async function sendSMS(to: string, message: string, orderId: string, stage: number, supabase: any) {
  const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER");

  if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
    console.log("Twilio not configured, skipping SMS");
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(supabaseUrl!, supabaseKey!);

    // Get all active orders
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

    const notifications = [];
    const trackingUrl = "https://newyorkminute.com/track";

    for (const order of orders || []) {
      const orderNumber = order.order_number || `NYM-${order.id.substring(0, 6)}`;
      
      // Stage 1: Order Confirmed
      if (!order.notification_sent_stage_1 && order.status === "pending") {
        const message = `✓ Order confirmed! #${orderNumber}\nWe're finding you a driver.\nTrack: ${trackingUrl}/${order.tracking_code}`;
        
        if (order.customer_phone) {
          await sendSMS(order.customer_phone, message, order.id, 1, supabase);
          await supabase.from("orders").update({ 
            notification_sent_stage_1: true,
            last_notification_sent_at: new Date().toISOString()
          }).eq("id", order.id);
          notifications.push({ order: orderNumber, stage: 1 });
        }
      }

      // Stage 2: Driver Assigned
      if (!order.notification_sent_stage_2 && order.courier_id && order.status === "accepted") {
        const courierName = order.courier?.full_name || "Your driver";
        const rating = order.courier?.rating || 5.0;
        const message = `🚗 Driver assigned!\n${courierName} (${rating}⭐) is picking up your order.\nTrack: ${trackingUrl}/${order.tracking_code}`;
        
        if (order.customer_phone) {
          await sendSMS(order.customer_phone, message, order.id, 2, supabase);
          await supabase.from("orders").update({ 
            notification_sent_stage_2: true,
            last_notification_sent_at: new Date().toISOString()
          }).eq("id", order.id);
          notifications.push({ order: orderNumber, stage: 2 });
        }
      }

      // Stage 3: Order Picked Up
      if (!order.notification_sent_stage_3 && order.status === "out_for_delivery") {
        const courierName = order.courier?.full_name || "Your driver";
        const eta = order.eta_minutes ? `${order.eta_minutes} min` : "30 min";
        const message = `📦 ${courierName} picked up your order!\nEstimated arrival: ${eta}\nTrack live: ${trackingUrl}/${order.tracking_code}`;
        
        if (order.customer_phone) {
          await sendSMS(order.customer_phone, message, order.id, 3, supabase);
          await supabase.from("orders").update({ 
            notification_sent_stage_3: true,
            last_notification_sent_at: new Date().toISOString()
          }).eq("id", order.id);
          notifications.push({ order: orderNumber, stage: 3 });
        }
      }

      // Stages 4-7: Distance-based notifications (if driver location available)
      if (order.courier && order.courier.current_lat && order.courier.current_lng && 
          order.dropoff_lat && order.dropoff_lng && order.status === "out_for_delivery") {
        
        const distance = calculateDistance(
          order.courier.current_lat,
          order.courier.current_lng,
          order.dropoff_lat,
          order.dropoff_lng
        );

        const courierName = order.courier?.full_name || "Your driver";

        // Stage 4: 20 Minutes Away (roughly 3-5 miles depending on traffic)
        if (!order.notification_sent_stage_4 && distance <= 5 && distance > 2) {
          const message = `⏰ 20 minutes away!\n${courierName} will arrive soon.\nPrepare your ID for age verification.`;
          
          if (order.customer_phone) {
            await sendSMS(order.customer_phone, message, order.id, 4, supabase);
            await supabase.from("orders").update({ 
              notification_sent_stage_4: true,
              last_notification_sent_at: new Date().toISOString()
            }).eq("id", order.id);
            notifications.push({ order: orderNumber, stage: 4, distance: distance.toFixed(2) });
          }
        }

        // Stage 5: 10 Minutes Away (roughly 1-2 miles)
        if (!order.notification_sent_stage_5 && distance <= 2 && distance > 0.8) {
          const message = `⏰ 10 minutes away!\n${courierName} will arrive soon at:\n${order.delivery_address}\n\nMake sure you're available.`;
          
          if (order.customer_phone) {
            await sendSMS(order.customer_phone, message, order.id, 5, supabase);
            await supabase.from("orders").update({ 
              notification_sent_stage_5: true,
              last_notification_sent_at: new Date().toISOString()
            }).eq("id", order.id);
            notifications.push({ order: orderNumber, stage: 5, distance: distance.toFixed(2) });
          }
        }

        // Stage 6: 5 Minutes Away (0.5-0.8 miles)
        if (!order.notification_sent_stage_6 && distance <= 0.8 && distance > 0.5) {
          const vehicle = order.courier.vehicle_make && order.courier.vehicle_model 
            ? `${order.courier.vehicle_make} ${order.courier.vehicle_model}`
            : order.courier.vehicle_type || "vehicle";
          const message = `🔔 5 minutes away!\n${courierName} will arrive very soon.\nLook out for ${vehicle}`;
          
          if (order.customer_phone) {
            await sendSMS(order.customer_phone, message, order.id, 6, supabase);
            await supabase.from("orders").update({ 
              notification_sent_stage_6: true,
              last_notification_sent_at: new Date().toISOString()
            }).eq("id", order.id);
            notifications.push({ order: orderNumber, stage: 6, distance: distance.toFixed(2) });
          }
        }

        // Stage 7: Driver Arrived (within 500 feet = 0.095 miles)
        if (!order.notification_sent_stage_7 && distance <= 0.1) {
          const message = `📍 ${courierName} has arrived!\nThey're outside at ${order.delivery_address}.\nPlease bring your ID (21+).`;
          
          if (order.customer_phone) {
            await sendSMS(order.customer_phone, message, order.id, 7, supabase);
            await supabase.from("orders").update({ 
              notification_sent_stage_7: true,
              last_notification_sent_at: new Date().toISOString()
            }).eq("id", order.id);
            notifications.push({ order: orderNumber, stage: 7, distance: distance.toFixed(2) });
          }
        }
      }

      // Stage 8: Delivery Complete
      if (!order.notification_sent_stage_8 && order.status === "delivered") {
        const message = `✅ Delivered!\nThanks for ordering with NYM.\nEnjoy your THCA!\n\nRate your experience: ${trackingUrl}/${order.tracking_code}`;
        
        if (order.customer_phone) {
          await sendSMS(order.customer_phone, message, order.id, 8, supabase);
          await supabase.from("orders").update({ 
            notification_sent_stage_8: true,
            last_notification_sent_at: new Date().toISOString()
          }).eq("id", order.id);
          notifications.push({ order: orderNumber, stage: 8 });
        }
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