/**
 * Totals calculation handler.
 *
 * Steps:
 *  4.  Delivery zone validation & fee calculation
 *  4b. Tax calculation from account_settings
 *  4c. Discount validation (capped to subtotal)
 *  4d. Client/server price discrepancy detection
 */

import type { SupabaseClient } from "../../_shared/deps.ts";
import { createLogger } from '../../_shared/logger.ts';
import type { CheckoutRequest } from "../schemas.ts";
import type { StoreRecord, ProductRecord, CalculatedTotals } from "../types.ts";
import { jsonResponse, extractZipFromAddress } from "../utils.ts";

const logger = createLogger('storefront-checkout:calculate-totals');

// ---------------------------------------------------------------------------
// Delivery fee
// ---------------------------------------------------------------------------

/** Calculate delivery fee based on zone or store defaults.
 *  Returns a Response on validation failure, or the numeric fee. */
async function calculateDeliveryFee(
  supabase: SupabaseClient,
  body: CheckoutRequest,
  store: StoreRecord,
  subtotal: number,
): Promise<Response | number> {
  if (body.fulfillmentMethod !== "delivery") return 0;

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

    return Number(matchedZone.delivery_fee || 0);
  }

  // No zones configured — use store's default delivery fee
  const storeDeliveryFee = Number(store.default_delivery_fee || 0);
  const freeThreshold = Number(store.free_delivery_threshold || 0);
  return freeThreshold > 0 && subtotal >= freeThreshold ? 0 : storeDeliveryFee;
}

// ---------------------------------------------------------------------------
// Tax
// ---------------------------------------------------------------------------

/** Fetch tax rate from account_settings and cache notification_settings on store. */
async function fetchTaxRate(
  supabase: SupabaseClient,
  store: StoreRecord,
  tenantAccountId: string | null,
): Promise<number> {
  if (!tenantAccountId) return 0;

  const { data: acctSettings } = await supabase
    .from("account_settings")
    .select("tax_rate, notification_settings")
    .eq("account_id", tenantAccountId)
    .maybeSingle();

  // Cache notification_settings for Telegram link later
  (store as Record<string, unknown>)._acctSettings = acctSettings;

  if (acctSettings?.tax_rate) {
    return Number(acctSettings.tax_rate) / 100; // stored as percentage (e.g. 8.875)
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Price discrepancy detection
// ---------------------------------------------------------------------------

/** Detect total-level discrepancy between client and server totals. */
function detectTotalDiscrepancy(
  body: CheckoutRequest,
  total: number,
  store: StoreRecord,
): { clientTotal: number; serverTotal: number } | null {
  if (body.clientTotal === undefined) return null;

  const diff = Math.abs(body.clientTotal - total);
  if (diff <= 0.01) return null; // Tolerate rounding differences up to 1 cent

  const discrepancy = { clientTotal: body.clientTotal, serverTotal: total };

  logger.info("Price discrepancy detected", {
    storeId: store.id,
    clientTotal: body.clientTotal,
    serverTotal: total,
  });

  logger.warn("Price discrepancy detected — using server-side total", {
    tenantId: store.tenant_id,
    storeId: store.id,
    clientTotal: discrepancy.clientTotal,
    serverTotal: discrepancy.serverTotal,
    difference: Math.abs(discrepancy.clientTotal - discrepancy.serverTotal),
  });

  return discrepancy;
}

/** Detect per-item price discrepancies. */
function detectItemPriceAdjustments(
  body: CheckoutRequest,
  productMap: Map<string, ProductRecord>,
  store: StoreRecord,
): Array<{ productId: string; clientPrice: number; serverPrice: number }> {
  const adjustments: Array<{
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
          adjustments.push({
            productId: item.product_id,
            clientPrice: item.price,
            serverPrice,
          });
        }
      }
    }
  }

  if (adjustments.length > 0) {
    logger.warn("Per-item price discrepancies detected — using server prices", {
      tenantId: store.tenant_id,
      storeId: store.id,
      adjustments,
    });
  }

  return adjustments;
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

/** Calculate all totals. Returns a Response on validation failure, or CalculatedTotals. */
export async function calculateTotals(
  supabase: SupabaseClient,
  body: CheckoutRequest,
  store: StoreRecord,
  productMap: Map<string, ProductRecord>,
  subtotal: number,
  tenantAccountId: string | null,
): Promise<Response | CalculatedTotals> {
  // Delivery fee
  const deliveryResult = await calculateDeliveryFee(supabase, body, store, subtotal);
  if (deliveryResult instanceof Response) return deliveryResult;
  const deliveryFee = deliveryResult;

  // Tax
  const taxRate = await fetchTaxRate(supabase, store, tenantAccountId);
  const tax = Math.round(subtotal * taxRate * 100) / 100;

  // Discount — cap to subtotal
  const discountAmount = body.discountAmount
    ? Math.min(body.discountAmount, subtotal)
    : 0;

  const total = Math.round((subtotal + tax + deliveryFee - discountAmount) * 100) / 100;

  // Price discrepancy detection
  const priceDiscrepancy = detectTotalDiscrepancy(body, total, store);
  const itemPriceAdjustments = detectItemPriceAdjustments(body, productMap, store);

  return {
    deliveryFee,
    tax,
    taxRate,
    discountAmount,
    total,
    priceDiscrepancy,
    itemPriceAdjustments,
  };
}
