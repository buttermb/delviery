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
import { createLogger } from '../_shared/logger.ts';
import Stripe from "https://esm.sh/stripe@14.21.0";

const logger = createLogger('storefront-checkout');

// ---------------------------------------------------------------------------
// Input validation schemas
// ---------------------------------------------------------------------------

const CheckoutItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().positive(),
  variant: z.string().optional(),
  // Client may send price for display — always overridden by DB price
  price: z.number().optional(),
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
  preferredContactMethod: z.enum(["phone", "email", "text", "telegram"]).optional(),
  discountAmount: z.number().min(0).optional(),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
  idempotencyKey: z.string().optional(),
  // Client-side total for discrepancy detection (always overridden by server)
  clientTotal: z.number().optional(),
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
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON in request body" }, 400);
    }

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
      .select("id, store_name, tenant_id, is_active, default_delivery_fee, free_delivery_threshold")
      .eq("slug", body.storeSlug)
      .maybeSingle();

    if (storeError) {
      return jsonResponse({ error: "Unable to resolve store" }, 500);
    }

    if (!store) {
      return jsonResponse({ error: "Store not found" }, 404);
    }

    if (!store.is_active) {
      return jsonResponse({ error: "This store is not currently accepting orders" }, 403);
    }

    // ------------------------------------------------------------------
    // 2. SECURITY — Fetch product prices from database, NEVER trust client
    // ------------------------------------------------------------------
    const productIds = body.items.map((item) => item.product_id);
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, name, price, image_url, stock_quantity")
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
        name: product.name,
        quantity: item.quantity,
        price,
        variant: item.variant ?? null,
        image_url: product.image_url ?? null,
      });
    }

    // ------------------------------------------------------------------
    // 3. Stock validation — all or nothing
    // ------------------------------------------------------------------
    const outOfStockItems: Array<{
      productId: string;
      productName: string;
      requested: number;
      available: number;
    }> = [];

    for (const item of body.items) {
      const product = productMap.get(item.product_id);
      if (product) {
        const available = product.stock_quantity ?? 0;
        if (available < item.quantity) {
          outOfStockItems.push({
            productId: item.product_id,
            productName: product.name,
            requested: item.quantity,
            available,
          });
        }
      }
    }

    if (outOfStockItems.length > 0) {
      logger.warn("Pre-check: insufficient stock", {
        tenantId: store.tenant_id,
        storeId: store.id,
        outOfStockItems,
      });
      return jsonResponse(
        {
          error: "Insufficient stock",
          unavailableProducts: outOfStockItems,
        },
        400,
      );
    }

    // ------------------------------------------------------------------
    // 4. Calculate delivery fee from store settings (server-side)
    // ------------------------------------------------------------------
    const storeDeliveryFee = Number(store.default_delivery_fee || 0);
    const freeThreshold = Number(store.free_delivery_threshold || 0);
    const deliveryFee =
      body.fulfillmentMethod === "pickup"
        ? 0
        : freeThreshold > 0 && subtotal >= freeThreshold
          ? 0
          : storeDeliveryFee;
    const tax = 0; // Tax placeholder — extend when tax rules are configured
    const total = subtotal + tax + deliveryFee;

    // ------------------------------------------------------------------
    // 4b. SECURITY — Detect client/server price discrepancy
    // ------------------------------------------------------------------
    let priceDiscrepancy: { clientTotal: number; serverTotal: number } | null = null;
    if (body.clientTotal !== undefined) {
      const diff = Math.abs(body.clientTotal - total);
      // Tolerate rounding differences up to 1 cent
      if (diff > 0.01) {
        priceDiscrepancy = {
          clientTotal: body.clientTotal,
          serverTotal: total,
        };
      }
    }

    // Log total-level discrepancy for security audit
    if (priceDiscrepancy) {
      logger.warn("Price discrepancy detected — using server-side total", {
        tenantId: store.tenant_id,
        storeId: store.id,
        clientTotal: priceDiscrepancy.clientTotal,
        serverTotal: priceDiscrepancy.serverTotal,
        difference: Math.abs(priceDiscrepancy.clientTotal - priceDiscrepancy.serverTotal),
      });
    }

    // Also check per-item price discrepancies
    const itemPriceAdjustments: Array<{
      productId: string;
      clientPrice: number;
      serverPrice: number;
    }> = [];
    for (const item of body.items) {
      if (item.price !== undefined) {
        const product = productMap.get(item.product_id);
        if (product) {
          const serverPrice = Number(product.price);
          if (Math.abs(item.price - serverPrice) > 0.01) {
            itemPriceAdjustments.push({
              productId: item.product_id,
              clientPrice: item.price,
              serverPrice,
            });
          }
        }
      }
    }

    // Log per-item discrepancies for security audit
    if (itemPriceAdjustments.length > 0) {
      logger.warn("Per-item price discrepancies detected — using server prices", {
        tenantId: store.tenant_id,
        storeId: store.id,
        adjustments: itemPriceAdjustments,
      });
    }

    // ------------------------------------------------------------------
    // 5. Create order + deduct inventory via RPC (atomic transaction)
    // ------------------------------------------------------------------
    // The create_marketplace_order RPC performs these steps atomically:
    //   a) Validates stock with FOR UPDATE row locks (prevents concurrent depletion)
    //   b) Creates the order in marketplace_orders
    //   c) Deducts stock: UPDATE products SET stock_quantity = stock_quantity - qty
    //      WHERE stock_quantity >= qty (checked pattern — never goes negative)
    //   d) Checks affected rows — if 0, a race condition occurred and the
    //      entire transaction (order + prior decrements) is rolled back
    // ------------------------------------------------------------------
    const customerName = `${body.customerInfo.firstName} ${body.customerInfo.lastName}`;

    const itemSummary = orderItems.map((item) => ({
      product_id: item.product_id,
      quantity: item.quantity,
    }));
    logger.info("Creating order with inventory deduction", {
      tenantId: store.tenant_id,
      storeId: store.id,
      itemCount: orderItems.length,
      items: itemSummary,
    });

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
        p_tax: tax,
        p_delivery_fee: deliveryFee,
        p_total: total,
        p_payment_method: body.paymentMethod,
        p_idempotency_key: body.idempotencyKey ?? null,
        p_preferred_contact_method: body.preferredContactMethod ?? null,
        p_fulfillment_method: body.fulfillmentMethod ?? "delivery",
      },
    );

    if (orderError || !orderId) {
      const rawMsg = orderError?.message ?? "";

      // Stock-related RPC errors: the RPC raises exceptions for insufficient
      // stock (pre-validation) and for race-condition deduction failures.
      if (rawMsg.includes("Insufficient stock") || rawMsg.includes("Inventory deduction failed")) {
        logger.warn("Inventory deduction failed — order not created", {
          tenantId: store.tenant_id,
          storeId: store.id,
          reason: rawMsg,
        });
        return jsonResponse(
          { error: "Insufficient stock for one or more items. Please refresh and try again." },
          409,
        );
      }

      // All other DB errors get a generic message — never leak internals
      logger.error("Order creation failed", {
        tenantId: store.tenant_id,
        storeId: store.id,
        errorMessage: rawMsg,
      });
      return jsonResponse({ error: "Failed to create order. Please try again later." }, 500);
    }

    logger.info("Order created with inventory deducted", {
      tenantId: store.tenant_id,
      orderId,
      itemCount: orderItems.length,
    });

    // Fetch the generated order number and tracking token
    const { data: orderRecord } = await supabase
      .from("marketplace_orders")
      .select("order_number, tracking_token")
      .eq("id", orderId)
      .maybeSingle();

    // ------------------------------------------------------------------
    // 6. Customer upsert — sync to CRM customers table
    //    Uses upsert_customer_on_checkout RPC which handles:
    //    - Phone + tenant_id lookup (fallback to email)
    //    - total_orders increment
    //    - total_spent accumulation
    //    - address & preferred_contact updates
    // ------------------------------------------------------------------
    const { data: tenantAccount } = await supabase
      .from("accounts")
      .select("id")
      .eq("tenant_id", store.tenant_id)
      .maybeSingle();

    let upsertedCustomerId: string | null = null;

    if (tenantAccount) {
      const { data: customerId } = await supabase.rpc(
        "upsert_customer_on_checkout",
        {
          p_tenant_id: store.tenant_id,
          p_name: customerName,
          p_phone: body.customerInfo.phone ?? "",
          p_email: body.customerInfo.email,
          p_preferred_contact: body.preferredContactMethod ?? null,
          p_address: body.deliveryAddress ?? null,
          p_order_total: total,
        },
      );
      upsertedCustomerId = customerId ?? null;

      // Link CRM customer to the order
      if (upsertedCustomerId) {
        await supabase
          .from("marketplace_orders")
          .update({ crm_customer_id: upsertedCustomerId })
          .eq("id", orderId);
      }
    }

    // ------------------------------------------------------------------
    // 7. Fire-and-forget Telegram notification (non-blocking)
    // ------------------------------------------------------------------
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    fetch(`${supabaseUrl}/functions/v1/forward-order-telegram`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${supabaseServiceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        orderId,
        tenantId: store.tenant_id,
        orderNumber: orderRecord?.order_number ?? null,
        customerName,
        customerPhone: body.customerInfo.phone ?? null,
        orderTotal: total,
        items: orderItems.map((item) => {
          const product = productMap.get(item.product_id as string);
          return {
            productName: product?.name ?? "Unknown",
            quantity: item.quantity,
            price: (item.price as number) * (item.quantity as number),
          };
        }),
        storeName: store.store_name,
        fulfillmentMethod: body.fulfillmentMethod,
        preferredContactMethod: body.preferredContactMethod ?? null,
      }),
    }).catch(() => {
      // Intentionally swallowed — Telegram failures must never block checkout
    });

    // ------------------------------------------------------------------
    // 7b. Fetch Telegram contact link for confirmation page (if configured)
    // ------------------------------------------------------------------
    let telegramLink: string | null = null;
    if (tenantAccount) {
      const { data: acctSettings } = await supabase
        .from("account_settings")
        .select("notification_settings")
        .eq("account_id", tenantAccount.id)
        .maybeSingle();
      const notifSettings = acctSettings?.notification_settings as Record<string, unknown> | null;
      telegramLink = (notifSettings?.telegram_customer_link as string) || null;
    }

    const result: Record<string, unknown> = {
      orderId,
      orderNumber: orderRecord?.order_number ?? null,
      trackingToken: orderRecord?.tracking_token ?? null,
      customerId: upsertedCustomerId,
      serverTotal: total,
      subtotal,
      tax,
      deliveryFee,
    };

    if (telegramLink) {
      result.telegramLink = telegramLink;
    }

    // Include discrepancy info so clients can reconcile
    if (priceDiscrepancy) {
      result.priceAdjusted = true;
      result.priceDiscrepancy = priceDiscrepancy;
    }
    if (itemPriceAdjustments.length > 0) {
      result.itemPriceAdjustments = itemPriceAdjustments;
    }

    // ------------------------------------------------------------------
    // 8. If card payment, create Stripe Checkout session
    // ------------------------------------------------------------------
    if (body.paymentMethod === "card") {
      if (!tenantAccount) {
        return jsonResponse({ error: "Store account not configured for payments" }, 400);
      }

      const { data: settings } = await supabase
        .from("account_settings")
        .select("integration_settings")
        .eq("account_id", tenantAccount.id)
        .maybeSingle();

      const integrationSettings = settings?.integration_settings as Record<string, unknown> | null;
      const stripeSecretKey = integrationSettings?.stripe_secret_key as string | undefined;

      if (!stripeSecretKey) {
        return jsonResponse(
          { error: "Payment not configured. This store has not set up online payments." },
          400,
        );
      }

      try {
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
      } catch (stripeErr: unknown) {
        // Return 402 Payment Required with the Stripe error message
        const stripeMessage =
          stripeErr instanceof Error ? stripeErr.message : "Payment processing failed";
        return jsonResponse(
          { error: stripeMessage, details: { orderId, orderNumber: orderRecord?.order_number ?? null } },
          402,
        );
      }
    }

    return jsonResponse(result, 200);
  } catch (_err: unknown) {
    // Generic 500 — never leak internal error details to the client
    return jsonResponse({ error: "Internal server error" }, 500);
  }
}));
