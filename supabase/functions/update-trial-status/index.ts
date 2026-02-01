/**
 * Update Trial Status Edge Function
 * Updates tenant trial status after Stripe checkout completion
 */

import { serve, createClient, corsHeaders } from "../_shared/deps.ts";

// Helper logging function
const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[UPDATE-TRIAL-STATUS] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep('Function started');

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabaseClient.auth.getUser(token);

    if (!user) {
      logStep('ERROR: User not authenticated');
      throw new Error("User not authenticated");
    }

    logStep('User authenticated', { userId: user.id });

    const { tenant_id, payment_method_added } = await req.json();

    if (!tenant_id) {
      logStep('ERROR: Missing tenant_id');
      return new Response(
        JSON.stringify({ error: "Missing tenant_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep('Updating tenant trial status', { tenantId: tenant_id, paymentMethodAdded: payment_method_added });

    // Update tenant with payment method status
    const { error: updateError } = await supabaseClient
      .from("tenants")
      .update({
        payment_method_added: payment_method_added ?? true,
        updated_at: new Date().toISOString()
      })
      .eq("id", tenant_id);

    if (updateError) {
      logStep('ERROR: Failed to update tenant', { error: updateError.message });
      throw updateError;
    }

    logStep('Tenant updated successfully');

    // Log trial event
    await supabaseClient.from("trial_events").insert({
      tenant_id: tenant_id,
      event_type: "payment_method_added",
      event_data: {
        user_id: user.id,
        timestamp: new Date().toISOString()
      },
    });

    logStep('Trial event logged');

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    logStep('CRITICAL ERROR', { message: error.message });
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
