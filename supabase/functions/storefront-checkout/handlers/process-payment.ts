/**
 * Payment processing and response building handler.
 *
 * Steps:
 *  7.  Fire-and-forget Telegram notification
 *  7b. Fetch Telegram contact link for confirmation page
 *  8.  Create Stripe Checkout session (card payments, delegated to stripe-session.ts)
 *  9.  Mark venmo/zelle as awaiting_confirmation
 *  Build final response
 */

import type { SupabaseClient } from "../../_shared/deps.ts";
import type { CheckoutRequest } from "../schemas.ts";
import type { StoreRecord, ProductRecord, CalculatedTotals, CreatedOrder } from "../types.ts";
import { jsonResponse } from "../utils.ts";
import { createStripeSession } from "./stripe-session.ts";

// ---------------------------------------------------------------------------
// Telegram notifications
// ---------------------------------------------------------------------------

/** Fire-and-forget Telegram notification. Never blocks checkout. */
function sendTelegramNotification(
  body: CheckoutRequest,
  store: StoreRecord,
  orderItems: Array<Record<string, unknown>>,
  orderId: string,
  orderNumber: string | null,
  total: number,
): void {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const customerName = `${body.customerInfo.firstName} ${body.customerInfo.lastName}`;

  fetch(`${supabaseUrl}/functions/v1/forward-order-telegram`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${supabaseServiceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      orderId,
      tenantId: store.tenant_id,
      orderNumber,
      customerName,
      customerPhone: body.customerInfo.phone ?? null,
      orderTotal: total,
      items: orderItems.map((item) => ({
        productName: item.name ?? "Unknown",
        quantity: item.quantity,
        price: (item.price as number) * (item.quantity as number),
      })),
      storeName: store.store_name,
      fulfillmentMethod: body.fulfillmentMethod,
      paymentMethod: body.paymentMethod,
      preferredContactMethod: body.preferredContactMethod ?? null,
    }),
  }).catch(() => {
    // Intentionally swallowed — Telegram failures must never block checkout
  });
}

/** Fetch Telegram contact link for the confirmation page. */
async function fetchTelegramLink(
  supabase: SupabaseClient,
  tenantAccountId: string | null,
): Promise<{ telegramLink: string | null; telegramButtonLabel: string | null }> {
  if (!tenantAccountId) return { telegramLink: null, telegramButtonLabel: null };

  const { data: acctSettings } = await supabase
    .from("account_settings")
    .select("notification_settings, telegram_video_link")
    .eq("account_id", tenantAccountId)
    .maybeSingle();

  const notifSettings = (acctSettings?.notification_settings ?? {}) as Record<string, unknown>;
  const showOnConfirmation = notifSettings.show_telegram_on_confirmation === true;
  const customerLink = (notifSettings.telegram_customer_link as string) || "";

  if (showOnConfirmation && customerLink) {
    return {
      telegramLink: customerLink,
      telegramButtonLabel: (notifSettings.telegram_button_label as string) || "Chat with us on Telegram",
    };
  }

  // Fallback to legacy telegram_video_link field
  return {
    telegramLink: (acctSettings?.telegram_video_link as string) || null,
    telegramButtonLabel: null,
  };
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

/** Process payment and build the final response. */
export async function processPaymentAndRespond(
  supabase: SupabaseClient,
  req: Request,
  body: CheckoutRequest,
  store: StoreRecord,
  productMap: Map<string, ProductRecord>,
  orderItems: Array<Record<string, unknown>>,
  subtotal: number,
  totals: CalculatedTotals,
  order: CreatedOrder,
  tenantAccountId: string | null,
): Promise<Response> {
  // Step 7: Fire-and-forget Telegram notification
  sendTelegramNotification(body, store, orderItems, order.orderId, order.orderNumber, totals.total);

  // Step 7b: Fetch Telegram contact link
  const { telegramLink, telegramButtonLabel } = await fetchTelegramLink(
    supabase, tenantAccountId,
  );

  // Build base result
  const result: Record<string, unknown> = {
    orderId: order.orderId,
    orderNumber: order.orderNumber,
    trackingToken: order.trackingToken,
    customerId: order.upsertedCustomerId,
    serverTotal: totals.total,
    subtotal,
    tax: totals.tax,
    deliveryFee: totals.deliveryFee,
    discountAmount: totals.discountAmount,
  };

  if (telegramLink) {
    result.telegramLink = telegramLink;
    result.telegramButtonLabel = telegramButtonLabel ?? "Chat with us on Telegram";
  }

  // Include account creation data for auto-login
  if (order.accountToken) {
    result.accountToken = order.accountToken;
    result.accountCustomer = order.accountCustomer;
    result.accountTenant = order.accountTenant;
    result.telegramButtonLabel = telegramButtonLabel || 'Chat with us on Telegram';
  }

  // Include discrepancy info so clients can reconcile
  if (totals.priceDiscrepancy) {
    result.priceAdjusted = true;
    result.priceDiscrepancy = totals.priceDiscrepancy;
  }
  if (totals.itemPriceAdjustments.length > 0) {
    result.itemPriceAdjustments = totals.itemPriceAdjustments;
  }

  // Step 8: Stripe Checkout session for card payments
  if (body.paymentMethod === "card") {
    if (!tenantAccountId) {
      return jsonResponse({ error: "Store account not configured for payments" }, 400);
    }

    const stripeResult = await createStripeSession(
      supabase, req, body, store, productMap, totals, order, tenantAccountId,
    );
    if (stripeResult instanceof Response) return stripeResult;
    result.checkoutUrl = stripeResult;
  }

  // Step 9: venmo/zelle — mark as awaiting_confirmation
  if (body.paymentMethod === "venmo" || body.paymentMethod === "zelle") {
    await supabase
      .from("marketplace_orders")
      .update({ payment_status: "awaiting_confirmation" })
      .eq("id", order.orderId);
  }

  return jsonResponse(result, 200);
}
