/**
 * Storefront Stripe Webhook Handler
 * Handles payment confirmation from Stripe and updates order status
 *
 * Events handled:
 * - checkout.session.completed: Update order payment_status to 'paid', set paid_at
 * - payment_intent.payment_failed: Update order payment_status to 'failed'
 */

import { serve, createClient, corsHeaders } from "../_shared/deps.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";

const jsonResponse = (body: Record<string, unknown>, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

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
    const webhookSecret = Deno.env.get("STRIPE_STOREFRONT_WEBHOOK_SECRET");

    // Parse the webhook event with optional signature verification
    let event: Stripe.Event;

    if (signature && webhookSecret) {
      // Production: Verify signature using Stripe's constructEvent
      try {
        const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
          apiVersion: "2024-06-20",
        });
        event = await stripe.webhooks.constructEventAsync(
          body,
          signature,
          webhookSecret
        );
      } catch (_verifyError: unknown) {
        return jsonResponse({ error: "Webhook signature verification failed" }, 401);
      }
    } else if (Deno.env.get("ALLOW_UNVERIFIED_WEBHOOKS") === "true") {
      // Development/testing ONLY: Allow unverified webhooks
      try {
        event = JSON.parse(body) as Stripe.Event;
      } catch (_parseError: unknown) {
        return jsonResponse({ error: "Invalid JSON body" }, 400);
      }
    } else {
      // Production without proper configuration
      return jsonResponse({ error: "Webhook security not configured" }, 500);
    }

    // Handle checkout.session.completed
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.order_id;

      if (!orderId) {
        return jsonResponse({ error: "Missing order_id in metadata" }, 400);
      }

      // Update order payment status and set paid_at timestamp
      // Use marketplace_orders (the actual table) instead of storefront_orders (a view)
      const { error: updateError } = await supabaseClient
        .from("marketplace_orders")
        .update({
          payment_status: "paid",
          stripe_payment_intent_id: session.payment_intent as string,
          paid_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      if (updateError) {
        return jsonResponse(
          { error: "Failed to update order", details: updateError.message },
          500
        );
      }

      // Fetch order details for loyalty points and confirmation email
      const { data: order } = await supabaseClient
        .from("marketplace_orders")
        .select("*, marketplace_stores!marketplace_orders_store_id_fkey(store_name)")
        .eq("id", orderId)
        .maybeSingle();

      if (order && order.customer_email) {
        // Award loyalty points for completed payment
        let loyaltyPointsEarned = 0;
        try {
          const { data: pointsData, error: pointsError } = await supabaseClient.rpc(
            "add_marketplace_loyalty_points",
            {
              p_store_id: order.store_id,
              p_customer_email: order.customer_email,
              p_order_total: order.total_amount || 0,
            }
          );

          if (!pointsError && pointsData) {
            loyaltyPointsEarned = pointsData || 0;

            // Update order with points earned
            await supabaseClient
              .from("marketplace_orders")
              .update({ loyalty_points_earned: loyaltyPointsEarned })
              .eq("id", orderId);
          }
        } catch (_loyaltyError: unknown) {
          // Don't fail the webhook for loyalty errors
        }

        // Trigger order confirmation email (fire-and-forget)
        try {
          const emailPayload = {
            order_id: order.id,
            customer_email: order.customer_email,
            customer_name: order.customer_name || "Valued Customer",
            order_number: order.order_number || order.id.slice(0, 8).toUpperCase(),
            items: order.items || [],
            subtotal: order.subtotal || 0,
            delivery_fee: order.shipping_cost || 0,
            total: order.total_amount || 0,
            store_name: order.marketplace_stores?.store_name || "Store",
            tracking_url: `${Deno.env.get("SUPABASE_URL")?.replace(".supabase.co", ".lovableproject.com")}/order/${orderId}`,
            loyalty_points_earned: loyaltyPointsEarned,
          };

          fetch(
            `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-order-confirmation`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
              },
              body: JSON.stringify(emailPayload),
            }
          ).catch(() => {
            // Swallow email errors — don't fail the webhook
          });
        } catch (_emailError: unknown) {
          // Don't fail the webhook for email errors
        }
      }

      return jsonResponse({ received: true, order_id: orderId, status: "paid" }, 200);
    }

    // Handle payment_intent.payment_failed
    if (event.type === "payment_intent.payment_failed") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const orderId = paymentIntent.metadata?.order_id;

      if (orderId) {
        await supabaseClient
          .from("marketplace_orders")
          .update({ payment_status: "failed" })
          .eq("id", orderId);
      }

      return jsonResponse({ received: true, status: "payment_failed" }, 200);
    }

    // For other events, just acknowledge receipt
    return jsonResponse({ received: true, event_type: event.type }, 200);
  } catch (_error: unknown) {
    // Never leak internal error details to the client
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
