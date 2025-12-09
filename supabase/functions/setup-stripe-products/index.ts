// @ts-nocheck
/**
 * Setup Stripe Products Edge Function
 * 
 * Creates subscription products and prices in Stripe, then updates the
 * subscription_plans table with the resulting price IDs.
 * 
 * This is a one-time setup function that can be run safely multiple times
 * (idempotent - checks for existing products before creating).
 */

import { serve, createClient, corsHeaders } from "../_shared/deps.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";

interface PlanConfig {
  name: string;
  slug: string;
  description: string;
  price_monthly: number;
  price_yearly: number; // ~17% discount (2 months free)
  features: string[];
}

const PLANS: PlanConfig[] = [
  {
    name: "Starter",
    slug: "starter",
    description: "Perfect for small operations - Up to 50 customers, 3 menus, 100 products",
    price_monthly: 79,
    price_yearly: 790, // $65.83/mo effective (17% discount)
    features: [
      "Up to 50 customers",
      "3 disposable menus",
      "100 products",
      "2 team members",
      "Email support",
      "Basic analytics",
    ],
  },
  {
    name: "Professional",
    slug: "professional",
    description: "For growing businesses - Up to 500 customers, unlimited menus, API access",
    price_monthly: 150,
    price_yearly: 1500, // $125/mo effective (17% discount)
    features: [
      "Up to 500 customers",
      "Unlimited disposable menus",
      "500 products",
      "10 team members",
      "Priority support",
      "Advanced analytics",
      "API access",
      "Custom branding",
    ],
  },
  {
    name: "Enterprise",
    slug: "enterprise",
    description: "Unlimited power for your operation - White label, dedicated support, SLA",
    price_monthly: 499,
    price_yearly: 4990, // $415.83/mo effective (17% discount)
    features: [
      "Unlimited customers",
      "Unlimited disposable menus",
      "Unlimited products",
      "Unlimited team members",
      "24/7 dedicated support",
      "Full API access",
      "White label",
      "Custom integrations",
      "SLA guarantee",
    ],
  },
];

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate Stripe key
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey || !stripeKey.startsWith("sk_")) {
      return new Response(
        JSON.stringify({ 
          error: "Invalid Stripe configuration",
          details: "STRIPE_SECRET_KEY must be set and start with 'sk_'"
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Stripe
    const stripe = new Stripe(stripeKey, {
      apiVersion: "2023-10-16",
    });

    // Initialize Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("[SETUP-STRIPE] Starting product setup...");

    const results: Array<{
      plan: string;
      product_id: string;
      price_id_monthly: string;
      price_id_yearly: string;
      status: string;
    }> = [];

    for (const plan of PLANS) {
      console.log(`[SETUP-STRIPE] Processing plan: ${plan.name}`);

      // Check if product already exists by searching for metadata
      const existingProducts = await stripe.products.search({
        query: `metadata['plan_slug']:'${plan.slug}'`,
      });

      let product: Stripe.Product;
      let monthlyPrice: Stripe.Price;
      let yearlyPrice: Stripe.Price;

      if (existingProducts.data.length > 0) {
        // Product exists, get it and its prices
        product = existingProducts.data[0];
        console.log(`[SETUP-STRIPE] Found existing product: ${product.id}`);

        // Get all active prices for this product
        const prices = await stripe.prices.list({
          product: product.id,
          active: true,
          type: "recurring",
          limit: 10,
        });

        // Find monthly and yearly prices
        const existingMonthly = prices.data.find(p => p.recurring?.interval === "month");
        const existingYearly = prices.data.find(p => p.recurring?.interval === "year");

        // Create or use monthly price
        if (existingMonthly) {
          monthlyPrice = existingMonthly;
          console.log(`[SETUP-STRIPE] Found existing monthly price: ${monthlyPrice.id}`);
        } else {
          monthlyPrice = await stripe.prices.create({
            product: product.id,
            unit_amount: plan.price_monthly * 100,
            currency: "usd",
            recurring: { interval: "month" },
            metadata: { plan_slug: plan.slug, billing_cycle: "monthly" },
          });
          console.log(`[SETUP-STRIPE] Created monthly price: ${monthlyPrice.id}`);
        }

        // Create or use yearly price
        if (existingYearly) {
          yearlyPrice = existingYearly;
          console.log(`[SETUP-STRIPE] Found existing yearly price: ${yearlyPrice.id}`);
        } else {
          yearlyPrice = await stripe.prices.create({
            product: product.id,
            unit_amount: plan.price_yearly * 100,
            currency: "usd",
            recurring: { interval: "year" },
            metadata: { plan_slug: plan.slug, billing_cycle: "yearly" },
          });
          console.log(`[SETUP-STRIPE] Created yearly price: ${yearlyPrice.id}`);
        }

        results.push({
          plan: plan.name,
          product_id: product.id,
          price_id_monthly: monthlyPrice.id,
          price_id_yearly: yearlyPrice.id,
          status: "existing",
        });
      } else {
        // Create new product
        product = await stripe.products.create({
          name: `FloraIQ ${plan.name}`,
          description: plan.description,
          metadata: {
            plan_slug: plan.slug,
            features: plan.features.join(", "),
          },
        });
        console.log(`[SETUP-STRIPE] Created product: ${product.id}`);

        // Create monthly price
        monthlyPrice = await stripe.prices.create({
          product: product.id,
          unit_amount: plan.price_monthly * 100,
          currency: "usd",
          recurring: { interval: "month" },
          metadata: { plan_slug: plan.slug, billing_cycle: "monthly" },
        });
        console.log(`[SETUP-STRIPE] Created monthly price: ${monthlyPrice.id}`);

        // Create yearly price (17% discount)
        yearlyPrice = await stripe.prices.create({
          product: product.id,
          unit_amount: plan.price_yearly * 100,
          currency: "usd",
          recurring: { interval: "year" },
          metadata: { plan_slug: plan.slug, billing_cycle: "yearly" },
        });
        console.log(`[SETUP-STRIPE] Created yearly price: ${yearlyPrice.id}`);

        results.push({
          plan: plan.name,
          product_id: product.id,
          price_id_monthly: monthlyPrice.id,
          price_id_yearly: yearlyPrice.id,
          status: "created",
        });
      }

      // Update subscription_plans table with BOTH price IDs
      const { error: updateError } = await supabase
        .from("subscription_plans")
        .update({
          stripe_price_id: monthlyPrice.id,
          stripe_price_id_yearly: yearlyPrice.id,
          stripe_product_id: product.id,
          price_yearly: plan.price_yearly,
          updated_at: new Date().toISOString(),
        })
        .eq("slug", plan.slug);

      if (updateError) {
        console.error(`[SETUP-STRIPE] Failed to update plan ${plan.slug}:`, updateError);
      } else {
        console.log(`[SETUP-STRIPE] Updated subscription_plans for ${plan.slug} with monthly and yearly prices`);
      }
    }

    console.log("[SETUP-STRIPE] Setup complete!");

    return new Response(
      JSON.stringify({
        success: true,
        message: "Stripe products and prices configured successfully",
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[SETUP-STRIPE] Error:", errorMessage, error);
    
    return new Response(
      JSON.stringify({ 
        error: "Failed to setup Stripe products",
        details: errorMessage,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

