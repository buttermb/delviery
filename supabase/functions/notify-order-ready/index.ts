import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withCreditGate, CREDIT_ACTIONS } from "../_shared/creditGate.ts";
import { errorResponse } from "../_shared/error-response.ts";
import { corsHeaders } from "../_shared/deps.ts";

/**
 * Order Ready SMS Notification Edge Function
 * Sends SMS/Email to customer when their order is ready for pickup
 *
 * Credit cost: 25 credits (action_key: send_sms)
 */

interface NotificationRequest {
    order_id: string;
    phone: string;
    email?: string;
    store_name?: string;
    order_number?: string;
}

Deno.serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    // Parse and validate body BEFORE credit gate so callers get 400 for bad input
    let body: NotificationRequest;
    try {
        body = await req.json();
    } catch {
        return errorResponse(400, "Invalid JSON body");
    }

    const { order_id, phone } = body;
    if (!order_id || !phone) {
        return errorResponse(400, "Missing required fields: order_id and phone are required");
    }

    return withCreditGate(req, CREDIT_ACTIONS.SEND_SMS, async (_tenantId, supabase) => {
        const { email, store_name, order_number } = body;

        // Build notification message
        const message = store_name && order_number
            ? `Your order #${order_number} from ${store_name} is ready for pickup! 🎉`
            : `Your order is ready for pickup! 🎉`;

        // Log the notification attempt (for debugging)
        console.error(`Sending notification to ${phone}:`, message);

        // ========================================
        // SMS INTEGRATION (Choose one provider)
        // ========================================

        // Option 1: Twilio (uncomment and add TWILIO_* env vars)
        /*
        const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
        const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
        const twilioFromNumber = Deno.env.get("TWILIO_FROM_NUMBER");

        if (twilioAccountSid && twilioAuthToken && twilioFromNumber) {
          const twilioResponse = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
            {
              method: "POST",
              headers: {
                Authorization: `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: new URLSearchParams({
                To: phone,
                From: twilioFromNumber,
                Body: message,
              }),
            }
          );

          if (!twilioResponse.ok) {
            const errorText = await twilioResponse.text();
            console.error("Twilio error:", errorText);
            throw new Error("Failed to send SMS via Twilio");
          }
        }
        */

        // Option 2: Just log for demo (remove in production)
        console.error(`[DEMO MODE] SMS to ${phone}: ${message}`);

        // Mark order as notified in database
        const { error: updateError } = await supabase
            .from("marketplace_orders")
            .update({
                notification_sent: true,
                notification_sent_at: new Date().toISOString(),
            })
            .eq("id", order_id);

        if (updateError) {
            console.error("Failed to update order notification status:", updateError);
        }

        // Optionally send email notification too
        if (email) {
            console.error(`[DEMO MODE] Email to ${email}: ${message}`);
            // Add email integration here (e.g., Resend, SendGrid, AWS SES)
        }

        return new Response(
            JSON.stringify({
                success: true,
                message: "Notification sent",
                demo_mode: true // Remove in production
            }),
            {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            }
        );
    }, {
        referenceId: undefined,
        referenceType: 'order_notification',
        description: 'Order ready SMS notification',
    });
});
