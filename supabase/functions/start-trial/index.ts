import { serve, createClient, corsHeaders } from "../_shared/deps.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { validateStartTrial } from './validation.ts';

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

    const rawBody = await req.json();
    const { tenant_id, plan_id } = validateStartTrial(rawBody);

    // Get tenant
    const { data: tenant, error: tenantError } = await supabaseClient
      .from("tenants")
      .select("*")
      .eq("id", tenant_id)
      .maybeSingle();

    if (tenantError || !tenant) {
      return new Response(
        JSON.stringify({ error: "Tenant not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get plan details
    const { data: plan } = await supabaseClient
      .from("subscription_plans")
      .select("*")
      .eq("id", plan_id)
      .maybeSingle();

    if (!plan || !plan.stripe_price_id) {
      return new Response(
        JSON.stringify({ error: "Plan not found or missing Stripe Price ID" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "";

    // Validate that we have a secret key, not a publishable key
    if (!stripeKey.startsWith('sk_')) {
      return new Response(
        JSON.stringify({ error: "Invalid Stripe configuration. Please use a secret key (starts with 'sk_'), not a publishable key." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2025-08-27.basil",
    });

    // Get or create Stripe customer
    let customerId = tenant.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: tenant.owner_email,
        name: tenant.business_name,
        metadata: { tenant_id: tenant.id },
      });
      customerId = customer.id;

      await supabaseClient
        .from("tenants")
        .update({ stripe_customer_id: customerId })
        .eq("id", tenant_id);
    }

    // Create checkout session WITH 14-DAY TRIAL
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price: plan.stripe_price_id,
          quantity: 1,
        },
      ],
      mode: "subscription",
      payment_method_collection: "always", // REQUIRE card during trial
      subscription_data: {
        trial_period_days: 14,
        trial_settings: {
          end_behavior: {
            missing_payment_method: "cancel", // Cancel if no card on file
          },
        },
        metadata: {
          tenant_id: tenant.id,
          plan_id: plan.id,
        },
      },
      success_url: `${req.headers.get("origin")}/${tenant.slug}/admin/billing?success=true&trial=true`,
      cancel_url: `${req.headers.get("origin")}/${tenant.slug}/admin/billing?canceled=true`,
      metadata: {
        tenant_id: tenant.id,
        plan_id: plan.id,
      },
    });

    // Log trial start event
    await supabaseClient.from("trial_events").insert({
      tenant_id: tenant.id,
      event_type: "trial_checkout_initiated",
      event_data: {
        plan_id: plan.id,
        plan_name: plan.name,
        stripe_session_id: session.id,
      },
    });

    return new Response(
      JSON.stringify({ url: session.url }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : 'Start trial failed';
    console.error('[START-TRIAL] Error:', errorMessage, error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
