import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * Order Ready SMS Notification Edge Function
 * Sends SMS/Email to customer when their order is ready for pickup
 * 
 * Note: This function provides the structure for SMS sending.
 * In production, integrate with Twilio, AWS SNS, or similar service.
 */

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

    try {
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        const body: NotificationRequest = await req.json();
        const { order_id, phone, email, store_name, order_number } = body;

        if (!order_id || !phone) {
            return new Response(
                JSON.stringify({ success: false, error: "Missing required fields" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Build notification message
        const message = store_name && order_number
            ? `Your order #${order_number} from ${store_name} is ready for pickup! 🎉`
            : `Your order is ready for pickup! 🎉`;

        // Log the notification attempt (for debugging)
        console.log(`Sending notification to ${phone}:`, message);

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
        console.log(`[DEMO MODE] SMS to ${phone}: ${message}`);

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
            console.log(`[DEMO MODE] Email to ${email}: ${message}`);
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

    } catch (error) {
        console.error("Error sending notification:", error);
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            }
        );
    }
});
