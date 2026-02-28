/**
 * Storefront Checkout Edge Function
 *
 * Complete checkout endpoint for guest storefront orders.
 * Accepts order details, creates the order via RPC, and handles payment initiation.
 * Does NOT require authenticated users — uses store's tenant Stripe credentials.
 *
 * POST /storefront-checkout
 * Receives: { storeSlug, items, customerInfo, fulfillmentMethod, paymentMethod, ... }
 * Returns:  { orderId, orderNumber } on success
 * Returns:  { error: string } with appropriate HTTP status on failure
 */

import { serve, createClient, corsHeaders, z } from "../_shared/deps.ts";
import { secureHeadersMiddleware } from '../_shared/secure-headers.ts';
import Stripe from "https://esm.sh/stripe@14.21.0";

// ---------------------------------------------------------------------------
// Input validation schemas
// ---------------------------------------------------------------------------

const CheckoutItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().positive(),
  variant: z.string().optional(),
});

const CustomerInfoSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
});

const CheckoutRequestSchema = z.object({
  // Store identification — slug is the canonical field
  storeSlug: z.string().min(1),
  // Cart items (prices are ALWAYS fetched server-side)
  items: z.array(CheckoutItemSchema).min(1),
  // Customer details
  customerInfo: CustomerInfoSchema,
  // Fulfillment & payment
  fulfillmentMethod: z.enum(["delivery", "pickup"]).default("delivery"),
  paymentMethod: z.enum(["card", "cash"]).default("cash"),
  // Optional fields
  deliveryAddress: z.string().optional(),
  notes: z.string().optional(),
  discountAmount: z.number().min(0).optional(),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
  idempotencyKey: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const jsonResponse = (body: Record<string, unknown>, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

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
    const rawBody = await req.json();
    const parseResult = CheckoutRequestSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return jsonResponse(
        { error: "Validation failed", details: parseResult.error.flatten().fieldErrors },
        400,
      );
    }

    const body = parseResult.data;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // ------------------------------------------------------------------
    // 1. Resolve store by slug
    // ------------------------------------------------------------------
    const { data: store, error: storeError } = await supabase
      .from("marketplace_stores")
      .select("id, store_name, tenant_id, default_delivery_fee, free_delivery_threshold")
      .eq("slug", body.storeSlug)
      .eq("is_active", true)
      .maybeSingle();

    if (storeError || !store) {
      return jsonResponse({ error: "Store not found" }, 404);
    }

    // ------------------------------------------------------------------
    // 2. SECURITY — Fetch product prices from database, NEVER trust client
    // ------------------------------------------------------------------
    const productIds = body.items.map((item) => item.product_id);
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, name, price, image_url")
      .in("id", productIds)
      .eq("tenant_id", store.tenant_id);

    if (productsError || !products || products.length === 0) {
      return jsonResponse({ error: "Products not found" }, 400);
    }

    const productMap = new Map(products.map((p) => [p.id, p]));

    // Validate all requested products exist and build server-side totals
    let subtotal = 0;
    const orderItems: Array<Record<string, unknown>> = [];

    for (const item of body.items) {
      const product = productMap.get(item.product_id);
      if (!product) {
        return jsonResponse(
          { error: `Product ${item.product_id} not found in this store` },
          400,
        );
      }
      const price = Number(product.price);
      subtotal += price * item.quantity;
      orderItems.push({
        product_id: item.product_id,
        quantity: item.quantity,
        price,
        variant: item.variant ?? null,
      });
    }

    // ------------------------------------------------------------------
    // 3. Calculate delivery fee from store settings (server-side)
    // ------------------------------------------------------------------
    const storeDeliveryFee = Number(store.default_delivery_fee || 0);
    const freeThreshold = Number(store.free_delivery_threshold || 0);
    const deliveryFee =
      body.fulfillmentMethod === "pickup"
        ? 0
        : freeThreshold > 0 && subtotal >= freeThreshold
          ? 0
          : storeDeliveryFee;
    const total = subtotal + deliveryFee;

    // ------------------------------------------------------------------
    // 4. Create order via existing RPC (handles inventory & idempotency)
    // ------------------------------------------------------------------
    const customerName = `${body.customerInfo.firstName} ${body.customerInfo.lastName}`;

    const { data: orderId, error: orderError } = await supabase.rpc(
      "create_marketplace_order",
      {
        p_store_id: store.id,
        p_customer_name: customerName,
        p_customer_email: body.customerInfo.email,
        p_customer_phone: body.customerInfo.phone ?? null,
        p_delivery_address: body.deliveryAddress ?? null,
        p_delivery_notes: body.notes ?? null,
        p_items: orderItems,
        p_subtotal: subtotal,
        p_tax: 0,
        p_delivery_fee: deliveryFee,
        p_total: total,
        p_payment_method: body.paymentMethod,
        p_idempotency_key: body.idempotencyKey ?? null,
      },
    );

    if (orderError || !orderId) {
      const errorMsg = orderError?.message ?? "Failed to create order";
      const status = errorMsg.includes("Insufficient stock") ? 409 : 500;
      return jsonResponse({ error: errorMsg }, status);
    }

    // Fetch the generated order number
    const { data: orderRecord } = await supabase
      .from("marketplace_orders")
      .select("order_number")
      .eq("id", orderId)
      .maybeSingle();

    const result: Record<string, unknown> = {
      orderId,
      orderNumber: orderRecord?.order_number ?? null,
    };

    // ------------------------------------------------------------------
    // 5. If card payment, create Stripe Checkout session
    // ------------------------------------------------------------------
    if (body.paymentMethod === "card") {
      const { data: account } = await supabase
        .from("accounts")
        .select("id")
        .eq("tenant_id", store.tenant_id)
        .maybeSingle();

      if (!account) {
        return jsonResponse({ error: "Store account not configured for payments" }, 400);
      }

      const { data: settings } = await supabase
        .from("account_settings")
        .select("integration_settings")
        .eq("account_id", account.id)
        .maybeSingle();

      const integrationSettings = settings?.integration_settings as Record<string, unknown> | null;
      const stripeSecretKey = integrationSettings?.stripe_secret_key as string | undefined;

      if (!stripeSecretKey) {
        return jsonResponse(
          { error: "Payment not configured. This store has not set up online payments." },
          400,
        );
      }

      const stripe = new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });

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

      if (deliveryFee > 0) {
        lineItems.push({
          price_data: {
            currency: "usd",
            product_data: { name: "Delivery Fee" },
            unit_amount: Math.round(deliveryFee * 100),
          },
          quantity: 1,
        });
      }

      // Handle discount coupon if applicable
      let discounts: Stripe.Checkout.SessionCreateParams.Discount[] | undefined;
      if (body.discountAmount && body.discountAmount > 0) {
        const cappedDiscount = Math.min(body.discountAmount, subtotal);
        const coupon = await stripe.coupons.create({
          amount_off: Math.round(cappedDiscount * 100),
          currency: "usd",
          name: "Order Discount",
          duration: "once",
        });
        discounts = [{ coupon: coupon.id }];
      }

      const session = await stripe.checkout.sessions.create({
        customer_email: body.customerInfo.email,
        line_items: lineItems,
        mode: "payment",
        success_url:
          body.successUrl ??
          `${req.headers.get("origin")}/order-confirmation/${orderId}`,
        cancel_url:
          body.cancelUrl ?? `${req.headers.get("origin")}/checkout`,
        ...(discounts ? { discounts } : {}),
        metadata: {
          store_id: store.id,
          order_id: orderId,
          customer_name: customerName,
          tenant_id: store.tenant_id,
        },
        payment_intent_data: {
          metadata: {
            store_id: store.id,
            order_id: orderId,
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
        .eq("id", orderId);

      result.checkoutUrl = session.url;
    }

    return jsonResponse(result, 200);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return jsonResponse({ error: message }, 500);
  }
}));
