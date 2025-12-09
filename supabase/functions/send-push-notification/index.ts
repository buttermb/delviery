import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(supabaseUrl!, supabaseKey!);

    const { userId, title, body, data } = await req.json();

    if (!userId || !title || !body) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: userId, title, body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check user's notification preferences
    const { data: prefs } = await supabase
      .from("notification_preferences")
      .select("push_enabled, push_all_updates, push_critical_only")
      .eq("user_id", userId)
      .single();

    // Default to enabled if no preferences set
    const pushEnabled = prefs?.push_enabled !== false;
    const isCritical = data?.critical === true;
    const allowPush = pushEnabled && (prefs?.push_all_updates || (prefs?.push_critical_only && isCritical));

    if (!allowPush) {
      console.log("Push notifications disabled for user:", userId);
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "User preferences" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // In a real implementation, you would:
    // 1. Get the user's FCM token from your database
    // 2. Use Firebase Admin SDK to send the push notification

    // Get FCM tokens for the user from push_tokens table
    const { data: tokens, error: tokenError } = await supabase
      .from("push_tokens")
      .select("token, platform")
      .eq("user_id", userId)
      .eq("is_active", true);

    if (tokenError) {
      console.error("Error fetching push tokens:", tokenError);
    }

    let sentCount = 0;
    let failedCount = 0;

    if (tokens && tokens.length > 0) {
      const fcmServerKey = Deno.env.get("FCM_SERVER_KEY");

      if (fcmServerKey) {
        // Send to each registered device
        for (const tokenRecord of tokens) {
          try {
            const fcmPayload = {
              to: tokenRecord.token,
              notification: {
                title,
                body,
                click_action: "OPEN_APP",
              },
              data: {
                ...data,
                route: data?.route || "/",
              },
            };

            const response = await fetch("https://fcm.googleapis.com/fcm/send", {
              method: "POST",
              headers: {
                "Authorization": `key=${fcmServerKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(fcmPayload),
            });

            if (response.ok) {
              sentCount++;
              console.log(`Push sent to ${tokenRecord.platform} device`);
            } else {
              failedCount++;
              const errorText = await response.text();
              console.error(`FCM error for token: ${errorText}`);

              // Mark token as inactive if it's invalid
              if (errorText.includes("NotRegistered") || errorText.includes("InvalidRegistration")) {
                await supabase
                  .from("push_tokens")
                  .update({ is_active: false })
                  .eq("token", tokenRecord.token);
              }
            }
          } catch (sendError) {
            failedCount++;
            console.error("Error sending to device:", sendError);
          }
        }
      } else {
        console.warn("FCM_SERVER_KEY not configured, skipping push send");
      }
    } else {
      console.log("No active push tokens found for user:", userId);
    }

    // Log the notification
    await supabase.from("notifications_log").insert({
      notification_type: "push",
      order_id: data?.orderId,
      notification_stage: data?.stage || 0,
      message_content: `${title}: ${body}`,
      status: sentCount > 0 ? "sent" : (tokens?.length ? "failed" : "no_tokens"),
      sent_at: new Date().toISOString()
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: sentCount > 0 ? "Push notification sent" : "No tokens to send to",
        userId,
        title,
        sentCount,
        failedCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Push notification error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
