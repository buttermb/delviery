/**
 * Stripe Checkout session creation.
 *
 * Builds line items from server-side product data, applies delivery fee,
 * tax, and discount coupon, then creates a Stripe Checkout session.
 */

import type { SupabaseClient } from "../../_shared/deps.ts";
import { Stripe, STRIPE_API_VERSION } from '../../_shared/stripe.ts';
import type { CheckoutRequest } from "../schemas.ts";
import type { StoreRecord, ProductRecord, CalculatedTotals, CreatedOrder } from "../types.ts";
import { jsonResponse } from "../utils.ts";

/** Create a Stripe Checkout session for card payments.
 *  Returns a Response on failure, or the checkout URL string. */
export async function createStripeSession(
  supabase: SupabaseClient,
  req: Request,
  body: CheckoutRequest,
  store: StoreRecord,
  productMap: Map<string, ProductRecord>,
  totals: CalculatedTotals,
  order: CreatedOrder,
  tenantAccountId: string,
): Promise<Response | string> {
  const { data: settings } = await supabase
    .from("account_settings")
    .select("integration_settings")
    .eq("account_id", tenantAccountId)
    .maybeSingle();

  const integrationSettings = settings?.integration_settings as Record<string, unknown> | null;
  const stripeSecretKey = integrationSettings?.stripe_secret_key as string | undefined;

  if (!stripeSecretKey) {
    return jsonResponse(
      { error: "Payment not configured. This store has not set up online payments." },
      400,
    );
  }

  const customerEmail = body.customerInfo.email || "";

  try {
    const stripe = new Stripe(stripeSecretKey, { apiVersion: STRIPE_API_VERSION });

    // Build Stripe line items from server-side product data
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = body.items.map((item) => {
      const product = productMap.get(item.product_id)!;
      return {
        price_data: {
          currency: "usd",
          product_data: {
            name: product.name,
            ...(product.image_url ? { images: [product.image_url] } : {}),
          },
          unit_amount: Math.round(Number(product.price) * 100),
        },
        quantity: item.quantity,
      };
    });

    if (totals.deliveryFee > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: { name: "Delivery Fee" },
          unit_amount: Math.round(totals.deliveryFee * 100),
        },
        quantity: 1,
      });
    }

    if (totals.tax > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: { name: "Tax" },
          unit_amount: Math.round(totals.tax * 100),
        },
        quantity: 1,
      });
    }

    // Handle discount coupon if applicable
    let discounts: Stripe.Checkout.SessionCreateParams.Discount[] | undefined;
    if (totals.discountAmount > 0) {
      const coupon = await stripe.coupons.create({
        amount_off: Math.round(totals.discountAmount * 100),
        currency: "usd",
        name: "Order Discount",
        duration: "once",
      });
      discounts = [{ coupon: coupon.id }];
    }

    // Append order info to success URL so confirmation page can look up the order
    const baseSuccessUrl =
      body.successUrl ??
      `${req.headers.get("origin")}/order-confirmation?session_id={CHECKOUT_SESSION_ID}`;
    const successUrlSeparator = baseSuccessUrl.includes("?") ? "&" : "?";
    const successUrlWithOrder = `${baseSuccessUrl}${successUrlSeparator}order=${order.orderId}&token=${order.trackingToken ?? ""}`;

    const session = await stripe.checkout.sessions.create({
      ...(customerEmail ? { customer_email: customerEmail } : {}),
      line_items: lineItems,
      mode: "payment",
      success_url: successUrlWithOrder,
      cancel_url:
        body.cancelUrl ?? `${req.headers.get("origin")}/checkout`,
      ...(discounts ? { discounts } : {}),
      metadata: {
        store_id: store.id,
        order_id: order.orderId,
        customer_name: `${body.customerInfo.firstName} ${body.customerInfo.lastName}`,
        tenant_id: store.tenant_id,
      },
      payment_intent_data: {
        metadata: {
          store_id: store.id,
          order_id: order.orderId,
          tenant_id: store.tenant_id,
        },
      },
    });

    // Persist Stripe session reference on the order
    await supabase
      .from("marketplace_orders")
      .update({
        stripe_session_id: session.id,
        payment_status: "awaiting_payment",
      })
      .eq("id", order.orderId);

    return session.url!;
  } catch (stripeErr: unknown) {
    const stripeMessage =
      stripeErr instanceof Error ? stripeErr.message : "Payment processing failed";
    return jsonResponse(
      { error: stripeMessage, details: { orderId: order.orderId, orderNumber: order.orderNumber } },
      402,
    );
  }
}
