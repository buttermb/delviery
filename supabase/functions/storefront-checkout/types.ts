/**
 * Shared types for checkout pipeline stages.
 * Each handler receives context from prior stages and adds its own data.
 */

import type { SupabaseClient } from "../_shared/deps.ts";
import type { CheckoutRequest } from "./schemas.ts";

/** Store record returned from marketplace_stores lookup. */
export interface StoreRecord {
  id: string;
  store_name: string;
  tenant_id: string;
  is_active: boolean;
  default_delivery_fee: number | null;
  free_delivery_threshold: number | null;
  checkout_settings: Record<string, unknown> | null;
  payment_methods: Record<string, boolean> | null;
  // Cached account_settings for later use (mutated in calculate-totals)
  _acctSettings?: Record<string, unknown> | null;
}

/** Product record from DB. */
export interface ProductRecord {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  stock_quantity: number | null;
}

/** Validated cart context produced by validate-cart handler. */
export interface ValidatedCart {
  store: StoreRecord;
  productMap: Map<string, ProductRecord>;
  orderItems: Array<Record<string, unknown>>;
  subtotal: number;
  tenantAccount: { id: string } | null;
}

/** Totals context produced by calculate-totals handler. */
export interface CalculatedTotals {
  deliveryFee: number;
  tax: number;
  taxRate: number;
  discountAmount: number;
  total: number;
  priceDiscrepancy: { clientTotal: number; serverTotal: number } | null;
  itemPriceAdjustments: Array<{
    productId: string;
    clientPrice: number;
    serverPrice: number;
  }>;
}

/** Order context produced by create-order handler. */
export interface CreatedOrder {
  orderId: string;
  orderNumber: string | null;
  trackingToken: string | null;
  upsertedCustomerId: string | null;
  accountToken: string | null;
  accountCustomer: Record<string, unknown> | null;
  accountTenant: Record<string, unknown> | null;
}

/** Full checkout context passed between pipeline stages. */
export interface CheckoutContext {
  readonly req: Request;
  readonly body: CheckoutRequest;
  readonly supabase: SupabaseClient;
  readonly clientIp: string;
}
