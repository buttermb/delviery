/**
 * Storefront Checkout Edge Function
 * Creates Stripe Checkout session for guest storefront orders
 * 
 * Unlike tenant-stripe-checkout, this does NOT require authenticated users.
 * It uses the store's tenant's Stripe credentials to process payments.
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CheckoutItem {
    product_id: string;  // REQUIRED: Product ID for DB lookup
    name: string;
    price?: number;      // IGNORED: Will be fetched from DB
    quantity: number;
    image_url?: string;
}

interface CheckoutRequest {
    store_id: string;
    order_id: string;
    items: CheckoutItem[];
    customer_email: string;
    customer_name: string;
    subtotal?: number;    // IGNORED: Will be recalculated
    delivery_fee?: number; // IGNORED: Will be fetched from store settings
    success_url: string;
    cancel_url: string;
}

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        const body: CheckoutRequest = await req.json();
        const {
            store_id,
            order_id,
            items,
            customer_email,
            customer_name,
            subtotal,
            delivery_fee,
            success_url,
            cancel_url
        } = body;

        // Validate required fields
        if (!store_id || !items || !Array.isArray(items) || items.length === 0) {
            return new Response(
                JSON.stringify({ error: "Missing required fields: store_id, items" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        if (!order_id) {
            return new Response(
                JSON.stringify({ error: "Missing order_id - create order first" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Get store and its tenant
        const { data: store, error: storeError } = await supabaseClient
            .from("marketplace_stores")
            .select("id, store_name, tenant_id")
            .eq("id", store_id)
            .single();

        if (storeError || !store) {
            return new Response(
                JSON.stringify({ error: "Store not found" }),
                { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Get tenant's account
        const { data: account } = await supabaseClient
            .from("accounts")
            .select("id")
            .eq("tenant_id", store.tenant_id)
            .single();

        if (!account) {
            return new Response(
                JSON.stringify({ error: "Store account not configured" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Get tenant's Stripe credentials
        const { data: settings } = await supabaseClient
            .from("account_settings")
            .select("integration_settings")
            .eq("account_id", account.id)
            .single();

        const integrationSettings = settings?.integration_settings as Record<string, any> | null;
        const stripeSecretKey = integrationSettings?.stripe_secret_key;

        if (!stripeSecretKey) {
            return new Response(
                JSON.stringify({
                    error: "Payment not configured",
                    message: "This store has not configured online payments yet."
                }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Initialize Stripe with tenant's credentials
        const stripe = new Stripe(stripeSecretKey, {
            apiVersion: "2023-10-16",
        });

        // SECURITY: Fetch actual prices from database - NEVER trust client prices
        const productIds = items.map(item => item.product_id).filter(Boolean);
        if (productIds.length !== items.length) {
            return new Response(
                JSON.stringify({ error: "All items must have a product_id" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Get products with prices from database
        const { data: products, error: productsError } = await supabaseClient
            .from("products")
            .select("id, name, price, image_url")
            .in("id", productIds)
            .eq("tenant_id", store.tenant_id);

        if (productsError || !products || products.length === 0) {
            return new Response(
                JSON.stringify({ error: "Products not found" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Create a price lookup map
        const productPriceMap = new Map(products.map(p => [p.id, p]));

        // Build line items with SERVER-SIDE prices
        let calculatedSubtotal = 0;
        const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

        for (const item of items) {
            const product = productPriceMap.get(item.product_id);
            if (!product) {
                return new Response(
                    JSON.stringify({ error: `Product ${item.product_id} not found or not available in this store` }),
                    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            // Use DATABASE price, not client price
            const serverPrice = Number(product.price);
            calculatedSubtotal += serverPrice * item.quantity;

            line_items.push({
                price_data: {
                    currency: "usd",
                    product_data: {
                        name: product.name,
                        images: product.image_url ? [product.image_url] : [],
                    },
                    unit_amount: Math.round(serverPrice * 100), // Convert to cents
                },
                quantity: item.quantity,
            });
        }

        // Get delivery fee from store settings (don't trust client)
        const { data: storeSettings } = await supabaseClient
            .from("marketplace_stores")
            .select("default_delivery_fee, free_delivery_threshold")
            .eq("id", store_id)
            .single();

        const storeDeliveryFee = storeSettings?.default_delivery_fee || 0;
        const freeThreshold = storeSettings?.free_delivery_threshold || 0;
        const actualDeliveryFee = calculatedSubtotal >= freeThreshold ? 0 : storeDeliveryFee;

        // Add delivery fee as a line item if applicable
        if (actualDeliveryFee > 0) {
            line_items.push({
                price_data: {
                    currency: "usd",
                    product_data: {
                        name: "Delivery Fee",
                    },
                    unit_amount: Math.round(actualDeliveryFee * 100),
                },
                quantity: 1,
            });
        }

        // Create Stripe Checkout session
        const session = await stripe.checkout.sessions.create({
            customer_email,
            line_items,
            mode: "payment",
            success_url: success_url || `${req.headers.get("origin")}/order-confirmation/${order_id}`,
            cancel_url: cancel_url || `${req.headers.get("origin")}/checkout`,
            metadata: {
                store_id,
                order_id,
                customer_name,
                tenant_id: store.tenant_id,
            },
            payment_intent_data: {
                metadata: {
                    store_id,
                    order_id,
                    tenant_id: store.tenant_id,
                },
            },
        });

        // Update order with Stripe session info
        await supabaseClient
            .from("storefront_orders")
            .update({
                stripe_session_id: session.id,
                payment_status: "pending",
            })
            .eq("id", order_id);

        return new Response(
            JSON.stringify({
                url: session.url,
                session_id: session.id
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error: any) {
        console.error("Storefront checkout error:", error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
