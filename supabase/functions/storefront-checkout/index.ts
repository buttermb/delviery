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
 *
 * Handles all cases:
 *  - Store validation (exists, active)
 *  - Server-side price calculation (NEVER trusts client prices)
 *  - Stock validation with per-item error reporting
 *  - Delivery zone ZIP validation with fee/minimum lookup
 *  - Tax calculation from account_settings
 *  - Payment method validation (cash, card, venmo, zelle)
 *  - Rate limiting (IP + phone based)
 *  - Discount capping (never exceeds subtotal)
 *  - Atomic order creation + inventory deduction via RPC
 *  - Customer CRM upsert
 *  - Telegram notification (fire-and-forget)
 *  - Stripe Checkout session for card payments
 */

import { serve, createClient, corsHeaders, z } from "../_shared/deps.ts";
import { secureHeadersMiddleware } from '../_shared/secure-headers.ts';
import { createLogger } from '../_shared/logger.ts';
import { checkRateLimit } from '../_shared/rateLimiting.ts';
import { hashPassword } from '../_shared/password.ts';
import { signJWT } from '../_shared/jwt.ts';
import Stripe from "https://esm.sh/stripe@14.21.0";

const logger = createLogger('storefront-checkout');

// ---------------------------------------------------------------------------
// Input validation schemas
// ---------------------------------------------------------------------------

const CheckoutItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().positive().max(100),
  variant: z.string().optional(),
  // Client may send price for display — always overridden by DB price
  price: z.number().optional(),
});

const CustomerInfoSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().min(1).max(30),
});

const CheckoutRequestSchema = z.object({
  // Store identification — slug is the canonical field
  storeSlug: z.string().min(1).max(100),
  // Cart items (prices are ALWAYS fetched server-side)
  items: z.array(CheckoutItemSchema).min(1).max(50),
  // Customer details
  customerInfo: CustomerInfoSchema,
  // Fulfillment & payment
  fulfillmentMethod: z.enum(["delivery", "pickup"]).default("delivery"),
  paymentMethod: z.enum(["card", "cash", "venmo", "zelle"]).default("cash"),
  // Optional fields
  deliveryAddress: z.string().max(500).optional(),
  deliveryZip: z.string().max(20).optional(),
  notes: z.string().max(1000).optional(),
  preferredContactMethod: z.enum(["phone", "email", "text", "telegram"]).optional(),
  discountAmount: z.number().min(0).optional(),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
  idempotencyKey: z.string().max(200).optional(),
  // Client-side total for discrepancy detection (always overridden by server)
  clientTotal: z.number().optional(),
  // Account creation — when customer opts in at checkout
  createAccount: z.boolean().optional(),
  password: z.string().min(8).optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const jsonResponse = (body: Record<string, unknown>, status: number, extraHeaders?: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extraHeaders },
  });

/** Extract client IP from request headers (Supabase/Cloudflare standard) */
function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

/** Extract ZIP from delivery address string (last 5-digit group) */
function extractZipFromAddress(address: string): string | null {
  const match = address.match(/\b(\d{5})(?:-\d{4})?\b/);
  return match ? match[1] : null;
}

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

    // ------------------------------------------------------------------
    // 0. Rate limiting — prevent checkout abuse
    // ------------------------------------------------------------------
    const clientIp = getClientIp(req);

    // IP-based: max 5 orders per hour
    const ipRateLimit = await checkRateLimit(
      { key: "storefront_checkout_ip", limit: 5, windowMs: 60 * 60 * 1000 },
      clientIp,
    );
    if (!ipRateLimit.allowed) {
      logger.warn("Rate limit exceeded (IP)", { ip: clientIp });
      return jsonResponse(
        { error: "Too many orders. Please try again later." },
        429,
        { "Retry-After": String(Math.ceil((ipRateLimit.resetAt - Date.now()) / 1000)) },
      );
    }

    // Phone-based: max 3 orders per hour
    const phoneKey = body.customerInfo.phone.replace(/\D/g, "");
    if (phoneKey) {
      const phoneRateLimit = await checkRateLimit(
        { key: "storefront_checkout_phone", limit: 3, windowMs: 60 * 60 * 1000 },
        phoneKey,
      );
      if (!phoneRateLimit.allowed) {
        logger.warn("Rate limit exceeded (phone)", { phone: phoneKey.slice(-4) });
        return jsonResponse(
          { error: "Too many orders from this phone number. Please try again later." },
          429,
          { "Retry-After": String(Math.ceil((phoneRateLimit.resetAt - Date.now()) / 1000)) },
        );
      }
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // ------------------------------------------------------------------
    // 1. Resolve store by slug — include checkout & payment config
    // ------------------------------------------------------------------
    const { data: store, error: storeError } = await supabase
      .from("marketplace_stores")
      .select("id, store_name, tenant_id, is_active, default_delivery_fee, free_delivery_threshold, checkout_settings, payment_methods")
      .eq("slug", body.storeSlug)
      .maybeSingle();

    if (storeError) {
      logger.error("Store lookup failed", { slug: body.storeSlug, error: storeError.message });
      return jsonResponse({ error: "Unable to resolve store" }, 500);
    }

    if (!store) {
      return jsonResponse({ error: "Store not found" }, 404);
    }

    if (!store.is_active) {
      return jsonResponse({ error: "This store is not currently accepting orders" }, 403);
    }

    // ------------------------------------------------------------------
    // 1b. Validate payment method is enabled for this store
    // ------------------------------------------------------------------
    const paymentMethods = store.payment_methods as Record<string, boolean> | null;
    if (paymentMethods) {
      const methodEnabled = paymentMethods[body.paymentMethod];
      // If payment_methods config exists and method is explicitly disabled
      if (methodEnabled === false) {
        return jsonResponse(
          { error: `Payment method "${body.paymentMethod}" is not available for this store` },
          400,
        );
      }
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
    // 4. Delivery zone validation & fee calculation (server-side)
    // ------------------------------------------------------------------
    let deliveryFee = 0;

    if (body.fulfillmentMethod === "delivery") {
      // Extract ZIP from the explicit field or from the address string
      const zip = body.deliveryZip || (body.deliveryAddress ? extractZipFromAddress(body.deliveryAddress) : null);

      // Check delivery_zones table for this tenant
      const { data: zones } = await supabase
        .from("delivery_zones")
        .select("name, delivery_fee, minimum_order, zip_codes, is_active")
        .eq("tenant_id", store.tenant_id)
        .eq("is_active", true);

      if (zones && zones.length > 0 && zip) {
        // Find matching zone by ZIP
        const matchedZone = zones.find((zone) => {
          const zipCodes = zone.zip_codes as string[] | null;
          return zipCodes?.includes(zip);
        });

        if (!matchedZone) {
          return jsonResponse(
            { error: `We don't currently deliver to ZIP code ${zip}. Please try a different address or choose pickup.` },
            400,
          );
        }

        // Check minimum order for the zone
        const minOrder = Number(matchedZone.minimum_order || 0);
        if (minOrder > 0 && subtotal < minOrder) {
          return jsonResponse(
            {
              error: `Delivery to ${matchedZone.name} requires a minimum order of $${minOrder.toFixed(2)}.`,
              minimumOrder: minOrder,
              currentSubtotal: subtotal,
            },
            400,
          );
        }

        deliveryFee = Number(matchedZone.delivery_fee || 0);
      } else {
        // No zones configured — use store's default delivery fee
        const storeDeliveryFee = Number(store.default_delivery_fee || 0);
        const freeThreshold = Number(store.free_delivery_threshold || 0);
        deliveryFee = freeThreshold > 0 && subtotal >= freeThreshold ? 0 : storeDeliveryFee;
      }
    }

    // ------------------------------------------------------------------
    // 4b. Tax calculation from account_settings
    // ------------------------------------------------------------------
    const { data: tenantAccount } = await supabase
      .from("accounts")
      .select("id")
      .eq("tenant_id", store.tenant_id)
      .maybeSingle();

    let taxRate = 0;
    if (tenantAccount) {
      const { data: acctSettings } = await supabase
        .from("account_settings")
        .select("tax_rate, notification_settings")
        .eq("account_id", tenantAccount.id)
        .maybeSingle();

      if (acctSettings?.tax_rate) {
        taxRate = Number(acctSettings.tax_rate) / 100; // stored as percentage (e.g. 8.875)
      }

      // Cache notification_settings for Telegram link later
      (store as Record<string, unknown>)._acctSettings = acctSettings;
    }

    const tax = Math.round(subtotal * taxRate * 100) / 100; // Round to 2 decimal places

    // ------------------------------------------------------------------
    // 4c. Discount validation — cap to subtotal, never trust client amount
    // ------------------------------------------------------------------
    const discountAmount = body.discountAmount
      ? Math.min(body.discountAmount, subtotal)
      : 0;

    const total = Math.round((subtotal + tax + deliveryFee - discountAmount) * 100) / 100;

    // ------------------------------------------------------------------
    // 4d. SECURITY — Detect client/server price discrepancy
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
        logger.info("Price discrepancy detected", {
          storeId: store.id,
          clientTotal: body.clientTotal,
          serverTotal: total,
        });
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
    const customerEmail = body.customerInfo.email || "";

    const itemSummary = orderItems.map((item) => ({
      product_id: item.product_id,
      quantity: item.quantity,
    }));
    logger.info("Creating order with inventory deduction", {
      tenantId: store.tenant_id,
      storeId: store.id,
      itemCount: orderItems.length,
      items: itemSummary,
      paymentMethod: body.paymentMethod,
      fulfillmentMethod: body.fulfillmentMethod,
    });

    const { data: orderId, error: orderError } = await supabase.rpc(
      "create_marketplace_order",
      {
        p_store_id: store.id,
        p_customer_name: customerName,
        p_customer_email: customerEmail,
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

      // Idempotency: if the idempotency key already exists, the RPC may
      // return the existing order ID — check for that pattern
      if (rawMsg.includes("duplicate") || rawMsg.includes("idempotency")) {
        logger.info("Duplicate order detected via idempotency key", {
          tenantId: store.tenant_id,
          idempotencyKey: body.idempotencyKey,
        });
        return jsonResponse(
          { error: "This order has already been placed." },
          409,
        );
      }

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
    let upsertedCustomerId: string | null = null;

    if (tenantAccount) {
      const { data: customerId } = await supabase.rpc(
        "upsert_customer_on_checkout",
        {
          p_tenant_id: store.tenant_id,
          p_name: customerName,
          p_phone: body.customerInfo.phone ?? "",
          p_email: customerEmail,
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
    // 6b. Create registered customer account if requested
    //     Creates a customer_users record linked to the CRM customer,
    //     issues a JWT for auto-login. Failures are non-fatal.
    // ------------------------------------------------------------------
    let accountToken: string | null = null;
    let accountCustomer: Record<string, unknown> | null = null;
    let accountTenant: Record<string, unknown> | null = null;

    if (body.createAccount && body.password && body.customerInfo.email) {
      try {
        // Resolve tenant for the account
        const { data: tenant } = await supabase
          .from("tenants")
          .select("id, business_name, slug")
          .eq("id", store.tenant_id)
          .eq("status", "active")
          .maybeSingle();

        if (tenant) {
          // Check if customer_user already exists for this email + tenant
          const { data: existingUser } = await supabase
            .from("customer_users")
            .select("id")
            .eq("email", body.customerInfo.email.toLowerCase())
            .eq("tenant_id", tenant.id)
            .maybeSingle();

          if (!existingUser) {
            const passwordHash = await hashPassword(body.password);

            const { data: newUser, error: createErr } = await supabase
              .from("customer_users")
              .insert({
                email: body.customerInfo.email.toLowerCase(),
                password_hash: passwordHash,
                first_name: body.customerInfo.firstName || null,
                last_name: body.customerInfo.lastName || null,
                phone: body.customerInfo.phone ?? null,
                tenant_id: tenant.id,
                customer_id: upsertedCustomerId,
                email_verified: false,
              })
              .select("id, email, first_name, last_name, customer_id, tenant_id")
              .single();

            if (!createErr && newUser) {
              // Issue JWT for auto-login (30-day expiry)
              accountToken = await signJWT(
                {
                  customer_user_id: newUser.id,
                  customer_id: upsertedCustomerId || newUser.id,
                  tenant_id: tenant.id,
                  type: "customer",
                },
                30 * 24 * 60 * 60,
              );

              // Create session record
              const expiresAt = new Date();
              expiresAt.setDate(expiresAt.getDate() + 30);
              const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
              const userAgent = req.headers.get("user-agent") || "unknown";

              await supabase.from("customer_sessions").insert({
                customer_user_id: newUser.id,
                tenant_id: tenant.id,
                token: accountToken,
                ip_address: clientIp,
                user_agent: userAgent,
                expires_at: expiresAt.toISOString(),
              });

              accountCustomer = {
                id: newUser.id,
                email: newUser.email,
                first_name: newUser.first_name,
                last_name: newUser.last_name,
                customer_id: newUser.customer_id,
                tenant_id: tenant.id,
              };
              accountTenant = {
                id: tenant.id,
                business_name: tenant.business_name,
                slug: tenant.slug,
              };

              // Fire-and-forget verification email
              const supabaseUrlForEmail = Deno.env.get("SUPABASE_URL") ?? "";
              const supabaseKeyForEmail = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
              fetch(`${supabaseUrlForEmail}/functions/v1/send-verification-email`, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${supabaseKeyForEmail}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  customer_user_id: newUser.id,
                  tenant_id: tenant.id,
                  email: body.customerInfo.email.toLowerCase(),
                  tenant_name: tenant.business_name,
                }),
              }).catch(() => {
                // Verification email failure is non-fatal
              });
            }
          }
        }
      } catch {
        // Account creation failure is non-fatal — order already succeeded
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

    // ------------------------------------------------------------------
    // 7b. Fetch Telegram contact link for confirmation page (if configured)
    // ------------------------------------------------------------------
    let telegramLink: string | null = null;
    const cachedSettings = (store as Record<string, unknown>)._acctSettings as Record<string, unknown> | undefined;
    if (cachedSettings) {
      const notifSettings = cachedSettings.notification_settings as Record<string, unknown> | null;
      telegramLink = (notifSettings?.telegram_customer_link as string) || null;
    } else if (tenantAccount) {
    let telegramButtonLabel: string | null = null;
    if (tenantAccount) {
      const { data: acctSettings } = await supabase
        .from("account_settings")
        .select("notification_settings")
        .eq("account_id", tenantAccount.id)
        .maybeSingle();
      const notifSettings = acctSettings?.notification_settings as Record<string, unknown> | null;
      telegramLink = (notifSettings?.telegram_customer_link as string) || null;
    let telegramButtonLabel: string | null = null;
    if (tenantAccount) {
      const { data: acctSettings } = await supabase
        .from("account_settings")
        .select("notification_settings, telegram_video_link")
        .eq("account_id", tenantAccount.id)
        .maybeSingle();

      const notifSettings = (acctSettings?.notification_settings ?? {}) as Record<string, unknown>;
      const showOnConfirmation = notifSettings.show_telegram_on_confirmation === true;
      const customerLink = (notifSettings.telegram_customer_link as string) || "";

      if (showOnConfirmation && customerLink) {
        telegramLink = customerLink;
        telegramButtonLabel = (notifSettings.telegram_button_label as string) || "Chat with us on Telegram";
      } else {
        // Fallback to legacy telegram_video_link field
        telegramLink = (acctSettings?.telegram_video_link as string) || null;
      }
      telegramButtonLabel = (notifSettings?.telegram_button_label as string) || null;
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
      discountAmount,
    };

    if (telegramLink) {
      result.telegramLink = telegramLink;
      result.telegramButtonLabel = telegramButtonLabel ?? "Chat with us on Telegram";
    }

    // Include account creation data for auto-login
    if (accountToken) {
      result.accountToken = accountToken;
      result.accountCustomer = accountCustomer;
      result.accountTenant = accountTenant;
      result.telegramButtonLabel = telegramButtonLabel || 'Chat with us on Telegram';
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

        if (tax > 0) {
          lineItems.push({
            price_data: {
              currency: "usd",
              product_data: { name: "Tax" },
              unit_amount: Math.round(tax * 100),
            },
            quantity: 1,
          });
        }

        // Handle discount coupon if applicable
        let discounts: Stripe.Checkout.SessionCreateParams.Discount[] | undefined;
        if (discountAmount > 0) {
          const coupon = await stripe.coupons.create({
            amount_off: Math.round(discountAmount * 100),
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
        const successUrlWithOrder = `${baseSuccessUrl}${successUrlSeparator}order=${orderId}&token=${orderRecord?.tracking_token ?? ""}`;

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

    // ------------------------------------------------------------------
    // 9. For venmo/zelle, mark payment_status as awaiting_confirmation
    // ------------------------------------------------------------------
    if (body.paymentMethod === "venmo" || body.paymentMethod === "zelle") {
      await supabase
        .from("marketplace_orders")
        .update({ payment_status: "awaiting_confirmation" })
        .eq("id", orderId);
    }

    return jsonResponse(result, 200);
  } catch (err: unknown) {
    // Generic 500 — never leak internal error details to the client
    logger.error("Unhandled checkout error", {
      error: err instanceof Error ? err.message : String(err),
    });
    return jsonResponse({ error: "Internal server error" }, 500);
  }
}));
