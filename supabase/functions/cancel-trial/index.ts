import { serve, createClient, corsHeaders } from "../_shared/deps.ts";
import { Stripe, STRIPE_API_VERSION } from '../_shared/stripe.ts';

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "User not authenticated" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { tenant_id } = await req.json();

    // Verify caller is admin/owner of the tenant
    const { data: tenantUser } = await supabaseClient
      .from("tenant_users")
      .select("role")
      .eq("tenant_id", tenant_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!tenantUser || !["admin", "owner"].includes(tenantUser.role)) {
      return new Response(
        JSON.stringify({ error: "Insufficient permissions — admin or owner access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
      apiVersion: STRIPE_API_VERSION,
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

  } catch (error: unknown) {
    console.error("Error cancelling trial:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
