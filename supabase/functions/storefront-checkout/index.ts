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
    name: string;
    price: number;
    quantity: number;
    image_url?: string;
}

interface CheckoutRequest {
    store_id: string;
    order_id: string;
    items: CheckoutItem[];
    customer_email: string;
    customer_name: string;
    subtotal: number;
    delivery_fee: number;
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

        // Build line items for Stripe
        const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = items.map((item) => ({
            price_data: {
                currency: "usd",
                product_data: {
                    name: item.name,
                    images: item.image_url ? [item.image_url] : [],
                },
                unit_amount: Math.round(item.price * 100), // Convert to cents
            },
            quantity: item.quantity,
        }));

        // Add delivery fee as a line item if applicable
        if (delivery_fee > 0) {
            line_items.push({
                price_data: {
                    currency: "usd",
                    product_data: {
                        name: "Delivery Fee",
                    },
                    unit_amount: Math.round(delivery_fee * 100),
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
