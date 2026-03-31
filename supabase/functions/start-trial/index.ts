import { serve, createClient, corsHeaders } from "../_shared/deps.ts";
import { getOrCreateStripeCustomer } from '../_shared/stripe-customer.ts';
import { Stripe, STRIPE_API_VERSION } from '../_shared/stripe.ts';
import { validateStartTrial } from './validation.ts';
import { validateStripeSecretKey } from '../_shared/validation.ts';

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
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabaseClient.auth.getUser(token);

    if (!user) {
      throw new Error("User not authenticated");
    }

    const rawBody = await req.json();
    const { tenant_id: clientTenantId, plan_id, billing_cycle, skip_trial, idempotency_key } = validateStartTrial(rawBody);

    // Resolve caller's tenant_id from tenant_users — never trust client-supplied value
    const { data: tenantUser, error: tenantUserError } = await supabaseClient
      .from("tenant_users")
      .select("tenant_id, role")
      .eq("tenant_id", clientTenantId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (tenantUserError || !tenantUser) {
      return new Response(
        JSON.stringify({ error: "No tenant associated with user" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tenant_id = clientTenantId;

    console.error('[START-TRIAL] Request:', { tenant_id, plan_id, billing_cycle, skip_trial, hasIdempotencyKey: !!idempotency_key });

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

    if (!tenant.slug) {
      console.error('[START-TRIAL] Tenant missing slug:', { tenant_id: tenant.id });
      return new Response(
        JSON.stringify({ error: "Tenant configuration incomplete — missing slug" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Look up plan from subscription_plans table by slug (single source of truth)
    const { data: plan, error: planError } = await supabaseClient
      .from("subscription_plans")
      .select("id, name, slug, stripe_price_id, stripe_price_id_yearly, price, price_yearly")
      .eq("slug", plan_id)
      .maybeSingle();

    if (planError || !plan) {
      return new Response(
        JSON.stringify({ error: `Unknown plan: ${plan_id}` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the appropriate Stripe price ID based on billing cycle
    const stripePriceId = billing_cycle === 'yearly'
      ? plan.stripe_price_id_yearly
      : plan.stripe_price_id;

    if (!stripePriceId) {
      return new Response(
        JSON.stringify({ error: `Missing Stripe Price ID for ${billing_cycle} billing on plan ${plan.name}` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Guard: yearly price ID must differ from monthly to prevent billing errors
    if (billing_cycle === 'yearly' && plan.stripe_price_id && plan.stripe_price_id_yearly === plan.stripe_price_id) {
      console.error('[START-TRIAL] ERROR: Yearly price ID is identical to monthly — aborting to prevent wrong billing');
      return new Response(
        JSON.stringify({ error: 'Yearly billing is not yet configured for this plan. Please contact support.' }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.error('[START-TRIAL] Using price:', { billing_cycle, stripePriceId, planName: plan.name });

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "";

    const keyValidation = validateStripeSecretKey(stripeKey);
    if (!keyValidation.valid) {
      return new Response(
        JSON.stringify({ error: keyValidation.error }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: STRIPE_API_VERSION,
    });

    // Get or create Stripe customer (idempotent)
    const customerId = await getOrCreateStripeCustomer({
      stripe,
      supabase: supabaseClient,
      tenant,
    });

    // Build checkout session options
    const origin = req.headers.get("origin") || 'https://app.floraiq.com';
    const successParams = skip_trial ? 'success=true' : 'success=true&trial=true';
    const successUrl = `${origin}/${tenant.slug}/admin/dashboard?${successParams}`;
    const cancelUrl = `${origin}/${tenant.slug}/admin/select-plan?canceled=true`;

    const sessionOptions: Record<string, unknown> = {
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
        plan_id: plan_id,
        billing_cycle: billing_cycle,
        skip_trial: skip_trial.toString(),
      },
      subscription_data: {
        metadata: {
          tenant_id: tenant.id,
          plan_id: plan_id,
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

    console.error('[START-TRIAL] Created session:', {
      sessionId: session.id,
      hasTrial: !skip_trial,
      billing_cycle
    });

    // Log the event
    await supabaseClient.from("trial_events").insert({
      tenant_id: tenant.id,
      event_type: skip_trial ? "purchase_checkout_initiated" : "trial_checkout_initiated",
      event_data: {
        plan_id: plan_id,
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

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Start trial failed';
    console.error('[START-TRIAL] Error:', errorMessage, error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
