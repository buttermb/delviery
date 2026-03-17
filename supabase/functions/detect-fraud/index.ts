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

    const { orderId, userId, checkType = "order" } = await req.json();

    if (!userId) {
      throw new Error("User ID is required");
    }

    const flags: Record<string, unknown>[] = [];

    // Run fraud checks
    const velocityCheck = await checkVelocity(userId, supabaseClient);
    if (velocityCheck.flagged) flags.push(velocityCheck);

    const addressCheck = await checkAddress(userId, supabaseClient);
    if (addressCheck.flagged) flags.push(addressCheck);

    const deviceCheck = await checkDeviceFingerprint(userId, supabaseClient);
    if (deviceCheck.flagged) flags.push(deviceCheck);

    const behaviorCheck = await checkBehavior(userId, supabaseClient);
    if (behaviorCheck.flagged) flags.push(behaviorCheck);

    const binCheck = await checkBinRisk(orderId, userId, supabaseClient);
    if (binCheck.flagged) flags.push(binCheck);

    // Calculate risk level
    const riskLevel = calculateRiskLevel(flags);

    // Create fraud flags in database
    for (const flag of flags) {
      await supabaseClient.from("fraud_flags").insert({
        user_id: userId,
        flag_type: flag.type,
        severity: flag.severity,
        description: flag.message,
        metadata: flag.metadata ?? null,
      });
    }

    // Determine action
    let action = "allow";
    if (riskLevel === "critical") {
      action = "block";
      // Auto-suspend account
      await supabaseClient
        .from("profiles")
        .update({ account_status: "suspended" })
        .eq("user_id", userId);
    } else if (riskLevel === "high") {
      action = "review";
    }

    return new Response(
      JSON.stringify({
        success: true,
        flags,
        riskLevel,
        action,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Fraud detection error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function checkVelocity(userId: string, supabase: any) {
  const hourAgo = new Date(Date.now() - 3600000).toISOString();
  
  const { data: recentOrders, error } = await supabase
    .from("orders")
    .select("id")
    .eq("user_id", userId)
    .gte("created_at", hourAgo);

  if (error) throw error;

  if (recentOrders && recentOrders.length > 3) {
    return {
      flagged: true,
      type: "velocity",
      severity: "high",
      message: `Too many orders in short time: ${recentOrders.length} orders in last hour`,
    };
  }

  return { flagged: false };
}

async function checkAddress(userId: string, supabase: any) {
  const { data: addresses } = await supabase
    .from("addresses")
    .select("*, risk_zone")
    .eq("user_id", userId);

  if (!addresses || addresses.length === 0) {
    return {
      flagged: true,
      type: "address",
      severity: "medium",
      message: "No verified address on file",
    };
  }

  // Check for too many addresses
  if (addresses.length > 5) {
    return {
      flagged: true,
      type: "address",
      severity: "medium",
      message: `Suspicious: ${addresses.length} different addresses`,
    };
  }

  // Check for high-risk zones
  const highRiskAddresses = addresses.filter((a: Record<string, unknown>) => a.risk_zone === "red");
  if (highRiskAddresses.length > 0) {
    return {
      flagged: true,
      type: "address",
      severity: "high",
      message: "Delivery to high-risk area",
    };
  }

  return { flagged: false };
}

async function checkDeviceFingerprint(userId: string, supabase: any) {
  const { data: devices } = await supabase
    .from("device_fingerprints")
    .select("*")
    .eq("user_id", userId);

  if (!devices || devices.length === 0) {
    return { flagged: false };
  }

  // Check for multiple accounts on same device
  const multipleAccounts = devices.some((d: Record<string, unknown>) => d.multiple_accounts);
  if (multipleAccounts) {
    return {
      flagged: true,
      type: "device",
      severity: "critical",
      message: "Multiple accounts detected on same device",
    };
  }

  // Check for too many different devices
  if (devices.length > 5) {
    return {
      flagged: true,
      type: "device",
      severity: "medium",
      message: `Account accessed from ${devices.length} different devices`,
    };
  }

  return { flagged: false };
}

async function checkBinRisk(
  orderId: string | undefined,
  userId: string,
  supabase: any
): Promise<Record<string, unknown>> {
  if (!orderId) return { flagged: false };

  // Get order payment details
  const { data: order } = await supabase
    .from('orders')
    .select('payment_method_last4, delivery_address')
    .eq('id', orderId)
    .maybeSingle();

  if (!order || !order.payment_method_last4) return { flagged: false };

  // BIN data would be passed from the frontend during checkout as bin_prefix
  // For now, check if BIN data was cached during checkout
  const { data: cachedBin } = await supabase
    .from('api_cache')
    .select('response')
    .like('cache_key', 'binlist:%')
    .gt('expires_at', new Date().toISOString())
    .limit(1);

  if (!cachedBin || cachedBin.length === 0) return { flagged: false };

  const binData = cachedBin[0].response as Record<string, unknown>;
  if (!binData?.found) return { flagged: false };

  const card = binData.card as Record<string, unknown> | undefined;
  if (!card) return { flagged: false };

  const flags: Record<string, unknown>[] = [];

  // Flag prepaid cards
  if (card.type === 'prepaid' || card.prepaid === true) {
    flags.push({
      flagged: true,
      type: 'prepaid_card',
      severity: 'medium',
      message: 'Payment made with a prepaid card',
      metadata: { card_type: card.type, scheme: card.scheme },
    });
  }

  if (flags.length > 0) return flags[0];
  return { flagged: false };
}

async function checkBehavior(userId: string, supabase: ReturnType<typeof createClient>) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!profile) {
    return { flagged: false };
  }

  // Check cancellation rate
  if (profile.total_orders > 0) {
    const cancellationRate = profile.cancelled_orders / profile.total_orders;
    if (cancellationRate > 0.5) {
      return {
        flagged: true,
        type: "behavior",
        severity: "high",
        message: `High cancellation rate: ${Math.round(cancellationRate * 100)}%`,
      };
    }
  }

  // Check chargebacks
  if (profile.chargebacks > 2) {
    return {
      flagged: true,
      type: "payment",
      severity: "critical",
      message: `Multiple chargebacks: ${profile.chargebacks}`,
    };
  }

  return { flagged: false };
}

function calculateRiskLevel(flags: Record<string, unknown>[]): string {
  if (flags.length === 0) return "low";

  const hasCritical = flags.some(f => f.severity === "critical");
  if (hasCritical) return "critical";

  const highSeverity = flags.filter(f => f.severity === "high").length;
  if (highSeverity >= 2) return "critical";
  if (highSeverity >= 1) return "high";

  const mediumSeverity = flags.filter(f => f.severity === "medium").length;
  if (mediumSeverity >= 3) return "high";
  if (mediumSeverity >= 2) return "medium";

  return "low";
}