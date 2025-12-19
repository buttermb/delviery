/**
 * Storefront Stripe Webhook Handler
 * Handles payment confirmation from Stripe and updates order status
 * 
 * Events handled:
 * - checkout.session.completed: Update order payment_status to 'paid'
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

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

        const signature = req.headers.get("stripe-signature");
        const body = await req.text();

        if (!signature) {
            console.log("No Stripe signature - processing without verification (testing mode)");
        }

        // Parse the webhook event
        let event: Stripe.Event;
        
        try {
            event = JSON.parse(body) as Stripe.Event;
        } catch (parseError) {
            console.error("Failed to parse webhook body:", parseError);
            return new Response(
                JSON.stringify({ error: "Invalid JSON body" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        console.log(`Received webhook event: ${event.type}`);

        // Handle checkout.session.completed
        if (event.type === "checkout.session.completed") {
            const session = event.data.object as Stripe.Checkout.Session;
            const orderId = session.metadata?.order_id;
            const storeId = session.metadata?.store_id;
            const tenantId = session.metadata?.tenant_id;

            console.log(`Processing completed checkout for order: ${orderId}`);

            if (!orderId) {
                console.error("No order_id in session metadata");
                return new Response(
                    JSON.stringify({ error: "Missing order_id in metadata" }),
                    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            // Update order payment status
            const { error: updateError } = await supabaseClient
                .from("storefront_orders")
                .update({
                    payment_status: "paid",
                    stripe_payment_intent_id: session.payment_intent as string,
                    paid_at: new Date().toISOString(),
                })
                .eq("id", orderId);

            if (updateError) {
                console.error("Failed to update order:", updateError);
                return new Response(
                    JSON.stringify({ error: "Failed to update order", details: updateError.message }),
                    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            console.log(`Order ${orderId} payment_status updated to 'paid'`);

            // Fetch order details for confirmation email
            const { data: order } = await supabaseClient
                .from("storefront_orders")
                .select("*, marketplace_stores(store_name)")
                .eq("id", orderId)
                .single();

            if (order && order.customer_email) {
                // Trigger order confirmation email
                try {
                    const emailPayload = {
                        order_id: order.id,
                        customer_email: order.customer_email,
                        customer_name: order.customer_name || "Valued Customer",
                        order_number: order.order_number || order.id.slice(0, 8).toUpperCase(),
                        items: order.items || [],
                        subtotal: order.subtotal || 0,
                        delivery_fee: order.delivery_fee || 0,
                        total: order.total || 0,
                        store_name: order.marketplace_stores?.store_name || "Store",
                        tracking_url: `${Deno.env.get("SUPABASE_URL")?.replace('.supabase.co', '.lovableproject.com')}/order/${orderId}`,
                    };

                    // Call send-order-confirmation function
                    const emailResponse = await fetch(
                        `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-order-confirmation`,
                        {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
                            },
                            body: JSON.stringify(emailPayload),
                        }
                    );

                    if (emailResponse.ok) {
                        console.log("Order confirmation email sent successfully");
                    } else {
                        console.error("Failed to send confirmation email:", await emailResponse.text());
                    }
                } catch (emailError) {
                    console.error("Error sending confirmation email:", emailError);
                    // Don't fail the webhook for email errors
                }
            }

            return new Response(
                JSON.stringify({ received: true, order_id: orderId, status: "paid" }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Handle payment_intent.payment_failed
        if (event.type === "payment_intent.payment_failed") {
            const paymentIntent = event.data.object as Stripe.PaymentIntent;
            const orderId = paymentIntent.metadata?.order_id;

            if (orderId) {
                await supabaseClient
                    .from("storefront_orders")
                    .update({ payment_status: "failed" })
                    .eq("id", orderId);

                console.log(`Order ${orderId} payment_status updated to 'failed'`);
            }

            return new Response(
                JSON.stringify({ received: true, status: "payment_failed" }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // For other events, just acknowledge receipt
        console.log(`Unhandled event type: ${event.type}`);
        return new Response(
            JSON.stringify({ received: true, event_type: event.type }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error: any) {
        console.error("Storefront webhook error:", error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
