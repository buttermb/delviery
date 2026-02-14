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
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { orderId, userId, orderTotal } = await req.json();

    if (!userId || !orderTotal) {
      throw new Error("User ID and order total are required");
    }

    // Get user profile
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (!profile) {
      throw new Error("User profile not found");
    }

    const flags: any[] = [];
    let shouldBlock = false;

    // Check account status
    if (profile.account_status !== "active") {
      flags.push({
        type: "account_status",
        severity: "critical",
        message: `Account status is ${profile.account_status}`,
      });
      shouldBlock = true;
    }

    // Check daily limit
    const today = new Date().toISOString().split("T")[0];
    const { data: todayOrders } = await supabaseClient
      .from("orders")
      .select("total_amount")
      .eq("user_id", userId)
      .gte("created_at", `${today}T00:00:00`);

    const todaySpent = todayOrders?.reduce((sum: number, o: any) => sum + (o.total_amount || 0), 0) || 0;

    if (todaySpent + orderTotal > profile.daily_limit) {
      flags.push({
        type: "daily_limit",
        severity: "high",
        message: `Order would exceed daily limit ($${profile.daily_limit})`,
      });
      shouldBlock = true;
    }

    // Check order frequency
    const hourAgo = new Date(Date.now() - 3600000).toISOString();
    const { data: recentOrders } = await supabaseClient
      .from("orders")
      .select("id")
      .eq("user_id", userId)
      .gte("created_at", hourAgo);

    if (recentOrders && recentOrders.length >= profile.order_limit) {
      flags.push({
        type: "velocity",
        severity: "high",
        message: `Too many orders: ${recentOrders.length} orders in last hour`,
      });
      shouldBlock = true;
    }

    // Check risk score
    if (profile.risk_score < 40) {
      flags.push({
        type: "low_trust",
        severity: "high",
        message: `Low trust score: ${profile.risk_score}`,
      });
      
      // Call fraud detection
      const { data: fraudCheck } = await supabaseClient.functions.invoke("detect-fraud", {
        body: { userId, orderId, checkType: "order" },
      });

      if (fraudCheck?.flags) {
        flags.push(...fraudCheck.flags);
      }

      if (fraudCheck?.riskLevel === "critical") {
        shouldBlock = true;
      }
    }

    // Create fraud flags if any
    for (const flag of flags) {
      await supabaseClient.from("fraud_flags").insert({
        user_id: userId,
        flag_type: flag.type,
        severity: flag.severity,
        description: flag.message,
      });
    }

    // Log the check
    await supabaseClient.from("account_logs").insert({
      user_id: userId,
      action_type: "fraud_check",
      description: `Order fraud check: ${flags.length} flags found`,
      metadata: { orderId, flags, shouldBlock },
    });

    return new Response(
      JSON.stringify({
        success: true,
        allowed: !shouldBlock,
        flags,
        message: shouldBlock
          ? "Order blocked due to fraud risk"
          : flags.length > 0
          ? "Order flagged for review"
          : "Order approved",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Fraud check error:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});