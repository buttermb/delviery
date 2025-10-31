import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RiskFactors {
  nameRisk: number;
  addressRisk: number;
  behaviorRisk: number;
  paymentRisk: number;
  deviceRisk: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { userId } = await req.json();

    if (!userId) {
      throw new Error("User ID is required");
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (profileError) throw profileError;

    // Get user's primary address
    const { data: address } = await supabaseClient
      .from("addresses")
      .select("*")
      .eq("user_id", userId)
      .eq("is_default", true)
      .single();

    // Get user's orders
    const { data: orders } = await supabaseClient
      .from("orders")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    // Get fraud flags
    const { data: fraudFlags } = await supabaseClient
      .from("fraud_flags")
      .select("*")
      .eq("user_id", userId)
      .is("resolved_at", null);

    // Get device fingerprints
    const { data: devices } = await supabaseClient
      .from("device_fingerprints")
      .select("*")
      .eq("user_id", userId);

    // Calculate risk factors
    const factors: RiskFactors = {
      nameRisk: assessNameRisk(profile),
      addressRisk: await assessAddressRisk(address, supabaseClient),
      behaviorRisk: assessBehaviorRisk(profile, orders || []),
      paymentRisk: assessPaymentRisk(profile),
      deviceRisk: assessDeviceRisk(devices || []),
    };

    // Calculate weighted risk score
    const riskScore = Math.round(
      100 - (
        (factors.nameRisk * 0.15) +
        (factors.addressRisk * 0.25) +
        (factors.behaviorRisk * 0.30) +
        (factors.paymentRisk * 0.20) +
        (factors.deviceRisk * 0.10)
      )
    );

    // Determine trust level
    let trustLevel = "new";
    if (riskScore >= 80) trustLevel = "vip";
    else if (riskScore >= 60) trustLevel = "regular";
    else if (riskScore >= 40) trustLevel = "new";
    else trustLevel = "flagged";

    // Update profile with new risk score
    await supabaseClient
      .from("profiles")
      .update({
        risk_score: riskScore,
        trust_level: trustLevel,
      })
      .eq("user_id", userId);

    return new Response(
      JSON.stringify({
        success: true,
        riskScore,
        trustLevel,
        factors,
        fraudFlags: fraudFlags || [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Risk assessment error:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function assessNameRisk(profile: any): number {
  let risk = 0;

  const suspiciousPatterns = [
    /test/i, /fake/i, /temp/i, /xxx/i,
    /^[a-z]{20,}$/i, // Random long strings
    /^[0-9]+$/,       // Numbers only
    /(.)\1{3,}/       // Repeated characters
  ];

  const fullName = `${profile.first_name || ''} ${profile.last_name || ''}`;

  // Check suspicious patterns
  if (suspiciousPatterns.some(p => p.test(fullName))) {
    risk += 30;
  }

  // Check name changes frequency
  if (profile.name_change_count > 2) {
    risk += 20;
  }

  // Empty or very short names
  if (fullName.trim().length < 3) {
    risk += 25;
  }

  return Math.min(risk, 100);
}

async function assessAddressRisk(address: any, supabase: any): Promise<number> {
  if (!address) return 50;

  let risk = 0;

  // Check neighborhood risk level
  if (address.neighborhood) {
    const { data: riskFactor } = await supabase
      .from("risk_factors")
      .select("risk_level")
      .eq("neighborhood", address.neighborhood)
      .single();

    if (riskFactor) {
      risk += riskFactor.risk_level * 4; // Scale 1-10 to 4-40
    }
  }

  // Check risk zone
  if (address.risk_zone === "red") {
    risk += 40;
  } else if (address.risk_zone === "yellow") {
    risk += 20;
  }

  // Check for suspicious addresses
  const suspiciousAddresses = /p\.?o\.?\s?box|hotel|motel|shelter/i;
  if (suspiciousAddresses.test(address.street)) {
    risk += 30;
  }

  // Delivery issues at address
  if (address.issue_count > 2) {
    risk += 25;
  }

  return Math.min(risk, 100);
}

function assessBehaviorRisk(profile: any, orders: any[]): number {
  let risk = 0;

  // New user
  if (profile.total_orders === 0) {
    risk += 25;
  }

  // High cancellation rate
  if (profile.total_orders > 0) {
    const cancellationRate = profile.cancelled_orders / profile.total_orders;
    if (cancellationRate > 0.3) {
      risk += 30;
    }
  }

  // Velocity check - too many recent orders
  const recentOrders = orders.filter(o => {
    const orderDate = new Date(o.created_at);
    const hourAgo = new Date(Date.now() - 3600000);
    return orderDate > hourAgo;
  });

  if (recentOrders.length > 3) {
    risk += 35;
  }

  // High number of reported issues
  if (profile.reported_issues > 5) {
    risk += 20;
  }

  return Math.min(risk, 100);
}

function assessPaymentRisk(profile: any): number {
  let risk = 0;

  // Chargebacks
  if (profile.chargebacks > 0) {
    risk += profile.chargebacks * 25;
  }

  // Failed payments
  if (profile.failed_payments > 3) {
    risk += 20;
  }

  return Math.min(risk, 100);
}

function assessDeviceRisk(devices: any[]): number {
  let risk = 0;

  // Multiple accounts on same device
  const multipleAccounts = devices.some(d => d.multiple_accounts);
  if (multipleAccounts) {
    risk += 40;
  }

  // Too many different devices
  if (devices.length > 5) {
    risk += 20;
  }

  return Math.min(risk, 100);
}