/**
 * Create Checkout Edge Function
 *
 * Creates a Stripe checkout session with support for:
 * - Monthly or yearly billing cycles
 * - Optional 14-day trial or immediate purchase
 * - Idempotency to prevent duplicate sessions
 *
 * Security: verifies tenant ownership via tenant_users table
 */

import { serve, createClient, corsHeaders } from "../_shared/deps.ts";
import { secureHeadersMiddleware } from "../_shared/secure-headers.ts";
import { createLogger } from "../_shared/logger.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { validateCreateCheckout } from "./validation.ts";

const logger = createLogger("create-checkout");

// Plan configuration — single source of truth matching frontend PLAN_CONFIG
const PLAN_CONFIG: Record<
  string,
  {
    name: string;
    priceMonthly: number;
    priceYearly: number;
    stripePriceId: string;
    stripePriceIdYearly: string;
  }
> = {
  starter: {
    name: "Starter",
    priceMonthly: 79,
    priceYearly: 790,
    stripePriceId: "price_1Sb3ioFWN1Z6rLwAPfzp99zP",
    stripePriceIdYearly: "price_1Sb3ioFWN1Z6rLwAPfzp99zP",
  },
  professional: {
    name: "Professional",
    priceMonthly: 150,
    priceYearly: 1500,
    stripePriceId: "price_1Sb3ioFWN1Z6rLwAbjlE24yI",
    stripePriceIdYearly: "price_1Sb3ioFWN1Z6rLwAbjlE24yI",
  },
  enterprise: {
    name: "Enterprise",
    priceMonthly: 499,
    priceYearly: 4990,
    stripePriceId: "price_1Sb3ipFWN1Z6rLwAKn1v6P5E",
    stripePriceIdYearly: "price_1Sb3ipFWN1Z6rLwAKn1v6P5E",
  },
};

serve(
  secureHeadersMiddleware(async (req) => {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      // Authenticate user
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: "Missing authorization header" }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const token = authHeader.replace("Bearer ", "");
      const {
        data: { user },
      } = await supabaseClient.auth.getUser(token);

      if (!user) {
        return new Response(
          JSON.stringify({ error: "User not authenticated" }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Parse and validate request body
      const rawBody = await req.json();
      const {
        tenant_id: clientTenantId,
        plan_id,
        billing_cycle,
        skip_trial,
        idempotency_key,
      } = validateCreateCheckout(rawBody);

      // Resolve caller's tenant_id from tenant_users — never trust client-supplied value
      const { data: tenantUser, error: tenantUserError } = await supabaseClient
        .from("tenant_users")
        .select("tenant_id, role")
        .eq("user_id", user.id)
        .maybeSingle();

      const resolvedTenantId = tenantUser?.tenant_id;

      if (tenantUserError || !resolvedTenantId) {
        return new Response(
          JSON.stringify({ error: "No tenant associated with user" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (resolvedTenantId !== clientTenantId) {
        logger.error("Tenant ID mismatch: caller does not own requested tenant", {
          userId: user.id,
          tenantId: clientTenantId,
        });
        return new Response(
          JSON.stringify({ error: "Not authorized for this tenant" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const tenant_id = resolvedTenantId;

      logger.info("Checkout request", {
        tenantId: tenant_id,
        plan_id,
        billing_cycle,
        skip_trial,
        hasIdempotencyKey: !!idempotency_key,
      });

      // Get tenant
      const { data: tenant, error: tenantError } = await supabaseClient
        .from("tenants")
        .select("*")
        .eq("id", tenant_id)
        .maybeSingle();

      if (tenantError || !tenant) {
        return new Response(
          JSON.stringify({ error: "Tenant not found" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Get plan details from config
      const plan = PLAN_CONFIG[plan_id];

      if (!plan) {
        return new Response(
          JSON.stringify({ error: `Unknown plan: ${plan_id}` }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Get the appropriate Stripe price ID based on billing cycle
      const stripePriceId =
        billing_cycle === "yearly"
          ? plan.stripePriceIdYearly
          : plan.stripePriceId;

      if (!stripePriceId) {
        return new Response(
          JSON.stringify({
            error: `Missing Stripe Price ID for ${billing_cycle} billing`,
          }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      logger.info("Using Stripe price", {
        tenantId: tenant_id,
        billing_cycle,
        stripePriceId,
        planName: plan.name,
      });

      // Initialize Stripe
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
      if (!stripeKey.startsWith("sk_")) {
        return new Response(
          JSON.stringify({ error: "Invalid Stripe configuration" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
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

        logger.info("Created Stripe customer", {
          tenantId: tenant_id,
          customerId,
        });
      }

      // Build URLs
      const origin =
        req.headers.get("origin") || "https://app.floraiq.com";
      const successParams = skip_trial
        ? "success=true"
        : "success=true&trial=true&welcome=true";
      const successUrl = `${origin}/${tenant.slug}/admin/dashboard?${successParams}`;
      const cancelUrl = `${origin}/select-plan?tenant_id=${tenant.id}&canceled=true`;

      // Build checkout session options
      const sessionOptions: Record<string, unknown> = {
        customer: customerId,
        line_items: [{ price: stripePriceId, quantity: 1 }],
        mode: "subscription",
        payment_method_collection: "always",
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          tenant_id: tenant.id,
          plan_id,
          billing_cycle,
          skip_trial: skip_trial.toString(),
        },
        subscription_data: {
          metadata: {
            tenant_id: tenant.id,
            plan_id,
            billing_cycle,
          },
        },
      };

      // Add trial period if not skipping trial
      if (!skip_trial) {
        (sessionOptions.subscription_data as Record<string, unknown>).trial_period_days = 14;
        (sessionOptions.subscription_data as Record<string, unknown>).trial_settings = {
          end_behavior: { missing_payment_method: "cancel" },
        };
      }

      // Create checkout session (with optional idempotency)
      const session = await stripe.checkout.sessions.create(
        sessionOptions,
        idempotency_key ? { idempotencyKey: idempotency_key } : undefined
      );

      logger.info("Created checkout session", {
        tenantId: tenant_id,
        sessionId: session.id,
        hasTrial: !skip_trial,
        billing_cycle,
      });

      // Log the event
      await supabaseClient.from("trial_events").insert({
        tenant_id: tenant.id,
        event_type: skip_trial
          ? "purchase_checkout_initiated"
          : "trial_checkout_initiated",
        event_data: {
          plan_id,
          plan_name: plan.name,
          billing_cycle,
          skip_trial,
          stripe_session_id: session.id,
        },
      });

      return new Response(
        JSON.stringify({
          url: session.url,
          billing_cycle,
          has_trial: !skip_trial,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Create checkout failed";
      logger.error("Checkout error", { error: errorMessage });
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  })
);
