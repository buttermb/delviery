import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Authenticate user
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabaseClient.auth.getUser(token);
    
    if (!user) {
      throw new Error("User not authenticated");
    }

    const { line_items, success_url, cancel_url } = await req.json();

    if (!line_items || !Array.isArray(line_items)) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid line_items" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get tenant_id from tenant_users
    const { data: tenantUser } = await supabaseClient
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!tenantUser) {
      throw new Error("Tenant not found for user");
    }

    // Get account_id from accounts
    const { data: account } = await supabaseClient
      .from("accounts")
      .select("id")
      .eq("tenant_id", tenantUser.tenant_id)
      .maybeSingle();

    if (!account) {
      throw new Error("Account not found");
    }

    // Get tenant Stripe credentials from account_settings
    const { data: settings } = await supabaseClient
      .from("account_settings")
      .select("integration_settings")
      .eq("account_id", account.id)
      .maybeSingle();

    const integrationSettings = settings?.integration_settings as Record<string, unknown> | null;
    const tenantStripeSecretKey = integrationSettings?.stripe_secret_key;

    if (!tenantStripeSecretKey) {
      return new Response(
        JSON.stringify({ 
          error: "Stripe not configured",
          message: "Please configure your Stripe credentials in Settings → Integrations"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Stripe with TENANT's credentials
    const stripe = new Stripe(tenantStripeSecretKey, {
      apiVersion: "2025-08-27.basil",
    });

    // Get or create customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    } else {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { tenant_id: tenantUser.tenant_id },
      });
      customerId = customer.id;
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items,
      mode: "payment",
      success_url: success_url || `${req.headers.get("origin")}/payment-success`,
      cancel_url: cancel_url || `${req.headers.get("origin")}/payment-canceled`,
      metadata: {
        tenant_id: tenantUser.tenant_id,
      },
    });

    return new Response(
      JSON.stringify({ 
        url: session.url,
        session_id: session.id 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});