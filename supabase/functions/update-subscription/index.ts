/**
 * Update Subscription Edge Function
 * Creates a Stripe Checkout session for subscription upgrades/downgrades
 */

import { serve, corsHeaders } from '../_shared/deps.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { Stripe, STRIPE_API_VERSION } from '../_shared/stripe.ts';

// Helper logging function
const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.error(`[UPDATE-SUBSCRIPTION] ${step}${detailsStr}`);
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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      logStep('ERROR: Missing authorization header');
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    logStep('Authenticating user');
    
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      logStep('ERROR: Authentication failed', { error: authError?.message });
      return new Response(
        JSON.stringify({ error: "User not authenticated" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep('User authenticated', { userId: user.id, email: user.email });

    const { tenant_id: clientTenantId, plan_id } = await req.json();

    if (!clientTenantId || !plan_id) {
      logStep('ERROR: Missing required parameters', { tenant_id: clientTenantId, plan_id });
      return new Response(
        JSON.stringify({ error: "Missing tenant_id or plan_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve caller's tenant_id from tenant_users — never trust client-supplied value
    const { data: tenantUser, error: tenantUserError } = await supabaseClient
      .from("tenant_users")
      .select("tenant_id, role")
      .eq("user_id", user.id)
      .maybeSingle();

    const resolvedTenantId = tenantUser?.tenant_id;

    if (tenantUserError || !resolvedTenantId) {
      logStep('ERROR: No tenant associated with user');
      return new Response(
        JSON.stringify({ error: "No tenant associated with user" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (resolvedTenantId !== clientTenantId) {
      logStep('ERROR: Tenant ID mismatch — caller does not own requested tenant');
      return new Response(
        JSON.stringify({ error: "Not authorized for this tenant" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tenant_id = resolvedTenantId;

    logStep('Fetching tenant', { tenantId: tenant_id });

    // Get tenant
    const { data: tenant, error: tenantError } = await supabaseClient
      .from("tenants")
      .select("*")
      .eq("id", tenant_id)
      .maybeSingle();

    if (tenantError || !tenant) {
      logStep('ERROR: Tenant not found', { error: tenantError?.message });
      return new Response(
        JSON.stringify({ error: "Tenant not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep('Tenant found', { slug: tenant.slug, currentPlan: tenant.subscription_plan });

    // Get plan details
    logStep('Fetching plan details', { planId: plan_id });
    const { data: plan, error: planError } = await supabaseClient
      .from("subscription_plans")
      .select("*")
      .eq("id", plan_id)
      .single();

    if (planError || !plan) {
      logStep('ERROR: Plan not found', { error: planError?.message });
      return new Response(
        JSON.stringify({ error: "Plan not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep('Plan found', { planName: plan.name, stripePriceId: plan.stripe_price_id });

    const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
    
    if (!STRIPE_SECRET_KEY) {
      logStep('ERROR: Stripe not configured');
      return new Response(
        JSON.stringify({ error: "Stripe not configured. Please set STRIPE_SECRET_KEY." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Require a real Stripe secret key (must start with sk_)
    if (!STRIPE_SECRET_KEY.startsWith('sk_')) {
      logStep('ERROR: Invalid Stripe key prefix', { prefix: STRIPE_SECRET_KEY.substring(0, 4) });
      return new Response(
        JSON.stringify({ error: "Invalid STRIPE_SECRET_KEY configured. A Stripe secret key starting with 'sk_' is required." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep('Initializing Stripe client');

    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: STRIPE_API_VERSION,
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Get or create Stripe customer
    let customerId = tenant.stripe_customer_id;
    
    if (!customerId) {
      logStep('Creating new Stripe customer');
      const customer = await stripe.customers.create({
        email: tenant.owner_email,
        name: tenant.business_name,
        metadata: { tenant_id: tenant.id },
      });
      customerId = customer.id;
      logStep('Stripe customer created', { customerId });

      await supabaseClient
        .from("tenants")
        .update({ stripe_customer_id: customerId })
        .eq("id", tenant_id);
      
      logStep('Tenant updated with Stripe customer ID');
    } else {
      logStep('Using existing Stripe customer', { customerId });
    }

    // Create checkout session
    logStep('Creating checkout session', { priceId: plan.stripe_price_id });
    
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price: plan.stripe_price_id,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${req.headers.get("origin")}/${tenant.slug}/admin/billing?success=true`,
      cancel_url: `${req.headers.get("origin")}/${tenant.slug}/admin/billing?canceled=true`,
      metadata: {
        tenant_id: tenant.id,
        plan_id: plan.id,
      },
    });

    logStep('Checkout session created', { sessionId: session.id, url: session.url });

    return new Response(
      JSON.stringify({ url: session.url }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error('[UPDATE-SUBSCRIPTION] CRITICAL ERROR', { message: error instanceof Error ? error.message : 'Unknown error', stack: error instanceof Error ? error.stack : undefined });
    console.error('[UPDATE-SUBSCRIPTION] Error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
