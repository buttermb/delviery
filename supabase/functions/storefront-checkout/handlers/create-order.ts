/**
 * Order creation handler.
 *
 * Steps:
 *  5.  Create order + deduct inventory via RPC (atomic transaction)
 *  6.  Customer CRM upsert
 *  6b. Optional registered customer account creation (delegated to create-account.ts)
 */

import type { SupabaseClient } from "../../_shared/deps.ts";
import { createLogger } from '../../_shared/logger.ts';
import type { CheckoutRequest } from "../schemas.ts";
import type { StoreRecord, CreatedOrder } from "../types.ts";
import { jsonResponse } from "../utils.ts";
import { createCustomerAccount } from "./create-account.ts";

const logger = createLogger('storefront-checkout:create-order');

// ---------------------------------------------------------------------------
// Order RPC
// ---------------------------------------------------------------------------

/** Create the order via atomic RPC. Returns a Response on failure, or the orderId + record. */
async function createOrderViaRPC(
  supabase: SupabaseClient,
  body: CheckoutRequest,
  store: StoreRecord,
  orderItems: Array<Record<string, unknown>>,
  subtotal: number,
  tax: number,
  deliveryFee: number,
  total: number,
): Promise<Response | { orderId: string; orderNumber: string | null; trackingToken: string | null }> {
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

    // Idempotency: duplicate order detection
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

    // Stock-related RPC errors
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

    // Generic DB error — never leak internals
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

  return {
    orderId,
    orderNumber: orderRecord?.order_number ?? null,
    trackingToken: orderRecord?.tracking_token ?? null,
  };
}

// ---------------------------------------------------------------------------
// Customer CRM upsert
// ---------------------------------------------------------------------------

/** Upsert the customer into the CRM and link to the order. */
async function upsertCustomer(
  supabase: SupabaseClient,
  body: CheckoutRequest,
  store: StoreRecord,
  orderId: string,
  total: number,
  tenantAccountId: string | null,
): Promise<string | null> {
  if (!tenantAccountId) return null;

  const customerName = `${body.customerInfo.firstName} ${body.customerInfo.lastName}`;
  const customerEmail = body.customerInfo.email || "";

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

  const upsertedCustomerId = customerId ?? null;

  // Link CRM customer to the order
  if (upsertedCustomerId) {
    await supabase
      .from("marketplace_orders")
      .update({ crm_customer_id: upsertedCustomerId })
      .eq("id", orderId);
  }

  return upsertedCustomerId;
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

/** Create the order, upsert customer, and optionally create account. */
export async function createOrder(
  supabase: SupabaseClient,
  req: Request,
  body: CheckoutRequest,
  store: StoreRecord,
  orderItems: Array<Record<string, unknown>>,
  subtotal: number,
  tax: number,
  deliveryFee: number,
  total: number,
  tenantAccountId: string | null,
): Promise<Response | CreatedOrder> {
  // Step 5: Create order via RPC
  const orderResult = await createOrderViaRPC(
    supabase, body, store, orderItems, subtotal, tax, deliveryFee, total,
  );
  if (orderResult instanceof Response) return orderResult;

  const { orderId, orderNumber, trackingToken } = orderResult;

  // Step 6: Customer CRM upsert
  const upsertedCustomerId = await upsertCustomer(
    supabase, body, store, orderId, total, tenantAccountId,
  );

  // Step 6b: Optional account creation
  const { accountToken, accountCustomer, accountTenant } = await createCustomerAccount(
    supabase, req, body, store, upsertedCustomerId,
  );

  return {
    orderId,
    orderNumber,
    trackingToken,
    upsertedCustomerId,
    accountToken,
    accountCustomer,
    accountTenant,
  };
}
