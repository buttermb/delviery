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
    const { tenant_id, plan_id, billing_cycle, skip_trial, idempotency_key } = validateStartTrial(rawBody);

    console.log('[START-TRIAL] Request:', { tenant_id, plan_id, billing_cycle, skip_trial, hasIdempotencyKey: !!idempotency_key });

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

    // Get the appropriate Stripe price ID based on billing cycle
    const stripePriceId = billing_cycle === 'yearly'
      ? plan?.stripe_price_id_yearly
      : plan?.stripe_price_id;

    if (!plan || !stripePriceId) {
      return new Response(
        JSON.stringify({ error: `Plan not found or missing Stripe Price ID for ${billing_cycle} billing` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log('[START-TRIAL] Using price:', { billing_cycle, stripePriceId, planName: plan.name });

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "";

    // Validate that we have a secret key, not a publishable key
    if (!stripeKey.startsWith('sk_')) {
      return new Response(
        JSON.stringify({ error: "Invalid Stripe configuration. Please use a secret key (starts with 'sk_'), not a publishable key." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2023-10-16",
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

    // Build checkout session options
    const origin = req.headers.get("origin") || 'https://app.floraiq.com';
    const successParams = skip_trial ? 'success=true' : 'success=true&trial=true&welcome=true';
    const successUrl = `${origin}/${tenant.slug}/admin/dashboard?${successParams}`;
    const cancelUrl = `${origin}/select-plan?tenant_id=${tenant.id}&canceled=true`;

    const sessionOptions: any = {
      customer: customerId,
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      payment_method_collection: "always",
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        tenant_id: tenant.id,
        plan_id: plan.id,
        billing_cycle: billing_cycle,
        skip_trial: skip_trial.toString(),
      },
      subscription_data: {
        metadata: {
          tenant_id: tenant.id,
          plan_id: plan.id,
          billing_cycle: billing_cycle,
        },
      },
    };

    // Add trial period if not skipping trial
    if (!skip_trial) {
      sessionOptions.subscription_data.trial_period_days = 14;
      sessionOptions.subscription_data.trial_settings = {
        end_behavior: {
          missing_payment_method: "cancel",
        },
      };
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create(sessionOptions, idempotency_key ? {
      idempotencyKey: idempotency_key
    } : undefined);

    console.log('[START-TRIAL] Created session:', {
      sessionId: session.id,
      hasTrial: !skip_trial,
      billing_cycle
    });

    // Log the event
    await supabaseClient.from("trial_events").insert({
      tenant_id: tenant.id,
      event_type: skip_trial ? "purchase_checkout_initiated" : "trial_checkout_initiated",
      event_data: {
        plan_id: plan.id,
        plan_name: plan.name,
        billing_cycle: billing_cycle,
        skip_trial: skip_trial,
        stripe_session_id: session.id,
      },
    });

    return new Response(
      JSON.stringify({
        url: session.url,
        billing_cycle: billing_cycle,
        has_trial: !skip_trial,
      }),
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
