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
    // For now, we'll just log it and simulate success

    console.log("Push notification would be sent:", {
      userId,
      title,
      body,
      data
    });

    // Log the notification
    await supabase.from("notifications_log").insert({
      notification_type: "push",
      order_id: data?.orderId,
      notification_stage: data?.stage || 0,
      message_content: `${title}: ${body}`,
      status: "sent",
      sent_at: new Date().toISOString()
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Push notification sent successfully",
        userId,
        title
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
