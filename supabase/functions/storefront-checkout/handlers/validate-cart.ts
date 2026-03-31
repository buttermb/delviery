/**
 * Cart validation handler.
 *
 * Steps:
 *  0. Rate limiting (IP + phone)
 *  1. Store resolution + payment method validation
 *  2. Server-side product price fetch + subtotal calculation
 *  3. Stock validation (all-or-nothing)
 */

import type { SupabaseClient } from "../../_shared/deps.ts";
import { createLogger } from '../../_shared/logger.ts';
import { checkRateLimit } from '../../_shared/rateLimiting.ts';
import type { CheckoutRequest } from "../schemas.ts";
import type { StoreRecord, ProductRecord, ValidatedCart } from "../types.ts";
import { jsonResponse } from "../utils.ts";

const logger = createLogger('storefront-checkout:validate-cart');

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

/** Enforce IP and phone rate limits. Returns a Response on rejection, null on pass. */
export async function enforceRateLimits(
  body: CheckoutRequest,
  clientIp: string,
): Promise<Response | null> {
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
  const phoneKey = body.customerInfo.phone?.replace(/\D/g, "") ?? "";
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

  return null;
}

// ---------------------------------------------------------------------------
// Store resolution
// ---------------------------------------------------------------------------

/** Resolve and validate the store by slug. Returns a Response on failure, or the store. */
export async function resolveStore(
  supabase: SupabaseClient,
  body: CheckoutRequest,
): Promise<Response | StoreRecord> {
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

  // Validate payment method is enabled for this store
  const paymentMethods = store.payment_methods as Record<string, boolean> | null;
  if (paymentMethods) {
    const methodEnabled = paymentMethods[body.paymentMethod];
    if (methodEnabled === false) {
      return jsonResponse(
        { error: `Payment method "${body.paymentMethod}" is not available for this store` },
        400,
      );
    }
  }

  return store as StoreRecord;
}

// ---------------------------------------------------------------------------
// Product & stock validation
// ---------------------------------------------------------------------------

/** Fetch products, compute subtotal, and validate stock.
 *  Returns a Response on failure, or the validated cart context. */
export async function validateProducts(
  supabase: SupabaseClient,
  body: CheckoutRequest,
  store: StoreRecord,
): Promise<Response | { productMap: Map<string, ProductRecord>; orderItems: Array<Record<string, unknown>>; subtotal: number }> {
  const productIds = body.items.map((item) => item.product_id);
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, name, price, image_url, stock_quantity")
    .in("id", productIds)
    .eq("tenant_id", store.tenant_id);

  if (productsError || !products || products.length === 0) {
    return jsonResponse({ error: "Products not found" }, 400);
  }

  const productMap = new Map<string, ProductRecord>(
    products.map((p) => [p.id, p as ProductRecord]),
  );

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

  // Stock validation — all or nothing
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

  return { productMap, orderItems, subtotal };
}

// ---------------------------------------------------------------------------
// Orchestrator: full cart validation pipeline
// ---------------------------------------------------------------------------

/** Run the full cart validation pipeline. Returns a Response on failure, or ValidatedCart. */
export async function validateCart(
  supabase: SupabaseClient,
  body: CheckoutRequest,
  clientIp: string,
): Promise<Response | ValidatedCart> {
  // Step 0: Rate limiting
  const rateLimitResult = await enforceRateLimits(body, clientIp);
  if (rateLimitResult) return rateLimitResult;

  // Step 1: Resolve store
  const storeResult = await resolveStore(supabase, body);
  if (storeResult instanceof Response) return storeResult;
  const store = storeResult;

  // Step 2 & 3: Product fetch + stock validation
  const productsResult = await validateProducts(supabase, body, store);
  if (productsResult instanceof Response) return productsResult;

  // Resolve tenant account (needed for tax and later steps)
  const { data: tenantAccount } = await supabase
    .from("accounts")
    .select("id")
    .eq("tenant_id", store.tenant_id)
    .maybeSingle();

  return {
    store,
    productMap: productsResult.productMap,
    orderItems: productsResult.orderItems,
    subtotal: productsResult.subtotal,
    tenantAccount: tenantAccount ?? null,
  };
}
