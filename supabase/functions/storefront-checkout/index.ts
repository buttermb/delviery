/**
 * Storefront Checkout Edge Function
 *
 * Complete checkout endpoint for guest storefront orders.
 * Routes through a pipeline: validate cart -> calculate totals -> create order -> process payment.
 *
 * POST /storefront-checkout
 * Receives: { storeSlug, items, customerInfo, fulfillmentMethod, paymentMethod, ... }
 * Returns:  { orderId, orderNumber } on success
 * Returns:  { error: string } with appropriate HTTP status on failure
 */

import { serve, createClient, corsHeaders, z } from "../_shared/deps.ts";
import { secureHeadersMiddleware } from '../_shared/secure-headers.ts';
import { createLogger } from '../_shared/logger.ts';

import { CheckoutRequestSchema } from "./schemas.ts";
import { jsonResponse, getClientIp } from "./utils.ts";
import { validateCart } from "./handlers/validate-cart.ts";
import { calculateTotals } from "./handlers/calculate-totals.ts";
import { createOrder } from "./handlers/create-order.ts";
import { processPaymentAndRespond } from "./handlers/process-payment.ts";

const logger = createLogger('storefront-checkout');

serve(secureHeadersMiddleware(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    // Parse & validate request body
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON in request body" }, 400);
    }

    const parseResult = CheckoutRequestSchema.safeParse(rawBody);

    if (!parseResult.success) {
      const errorResult = parseResult as z.SafeParseError<unknown>;
      return jsonResponse(
        { error: "Validation failed", details: errorResult.error.flatten().fieldErrors },
        400,
      );
    }

    const body = parseResult.data;
    const clientIp = getClientIp(req);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Pipeline: validate -> calculate -> create -> pay
    const cartResult = await validateCart(supabase, body, clientIp);
    if (cartResult instanceof Response) return cartResult;

    const totalsResult = await calculateTotals(
      supabase, body, cartResult.store, cartResult.productMap,
      cartResult.subtotal, cartResult.tenantAccount?.id ?? null,
    );
    if (totalsResult instanceof Response) return totalsResult;

    const orderResult = await createOrder(
      supabase, req, body, cartResult.store, cartResult.orderItems,
      cartResult.subtotal, totalsResult.tax, totalsResult.deliveryFee,
      totalsResult.total, cartResult.tenantAccount?.id ?? null,
    );
    if (orderResult instanceof Response) return orderResult;

    return await processPaymentAndRespond(
      supabase, req, body, cartResult.store, cartResult.productMap,
      cartResult.orderItems, cartResult.subtotal, totalsResult, orderResult,
      cartResult.tenantAccount?.id ?? null,
    );
  } catch (err: unknown) {
    logger.error("Unhandled checkout error", {
      error: err instanceof Error ? err.message : String(err),
    });
    return jsonResponse({ error: "Internal server error" }, 500);
  }
}));
