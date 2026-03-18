import { serve, createClient, corsHeaders } from "../_shared/deps.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabaseClient.auth.getUser(token);
    
    if (!user) {
      throw new Error("User not authenticated");
    }

    const { tenant_id } = await req.json();

    // Get tenant
    const { data: tenant } = await supabaseClient
      .from("tenants")
      .select("*")
      .eq("id", tenant_id)
      .single();

    if (!tenant || !tenant.stripe_subscription_id) {
      throw new Error("Tenant or subscription not found");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // Cancel Stripe subscription immediately
    await stripe.subscriptions.cancel(tenant.stripe_subscription_id);

    // Update tenant status
    await supabaseClient
      .from("tenants")
      .update({
        subscription_status: "cancelled",
        trial_cancelled_at: new Date().toISOString(),
      })
      .eq("id", tenant_id);

    // Log cancellation
    await supabaseClient.from("trial_events").insert({
      tenant_id: tenant.id,
      event_type: "trial_cancelled",
      event_data: {
        cancelled_by_user_id: user.id,
        stripe_subscription_id: tenant.stripe_subscription_id,
      },
    });

    return new Response(
      JSON.stringify({ success: true, message: "Trial cancelled successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error cancelling trial:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
