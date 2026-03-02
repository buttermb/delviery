/**
 * Forward Order to Telegram Edge Function
 *
 * Sends order notification to a tenant's configured Telegram chat.
 * Called fire-and-forget from storefront-checkout — failures here
 * never block the order response.
 *
 * POST /forward-order-telegram
 * Accepts either:
 *   1. Full data: { orderId, tenantId, customerName, orderTotal, items, ... }
 *   2. Minimal:   { orderId, tenantId } — fetches order data from DB
 * Returns: { sent: true } or { sent: false, reason: string }
 */

import { serve, createClient, corsHeaders, z } from "../_shared/deps.ts";
import { secureHeadersMiddleware } from "../_shared/secure-headers.ts";

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

const OrderItemSchema = z.object({
  productName: z.string(),
  quantity: z.number(),
  price: z.number(),
});

const RequestSchema = z.object({
  orderId: z.string().uuid(),
  tenantId: z.string().uuid(),
  // Optional — if omitted, function fetches from DB
  orderNumber: z.string().nullable().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().nullable().optional(),
  orderTotal: z.number().optional(),
  items: z.array(OrderItemSchema).min(1).optional(),
  storeName: z.string().optional(),
  fulfillmentMethod: z.string().nullable().optional(),
  preferredContactMethod: z.string().nullable().optional(),
});

/** Resolved order data after validation + optional DB fetch */
interface OrderData {
  orderId: string;
  tenantId: string;
  orderNumber: string | null;
  customerName: string;
  customerPhone: string | null;
  orderTotal: number;
  items: Array<{ productName: string; quantity: number; price: number }>;
  storeName: string;
  fulfillmentMethod: string | null;
  preferredContactMethod: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const jsonResponse = (body: Record<string, unknown>, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function formatOrderMessage(data: OrderData): string {
  const lines: string[] = [];

  lines.push(`\u{1F4E6} *New Order #${data.orderNumber ?? data.orderId.slice(0, 8)}*`);
  lines.push("");
  lines.push(`*Store:* ${escapeMarkdown(data.storeName)}`);
  lines.push(`*Customer:* ${escapeMarkdown(data.customerName)}`);

  if (data.customerPhone) {
    lines.push(`*Phone:* ${escapeMarkdown(data.customerPhone)}`);
  }

  if (data.fulfillmentMethod) {
    const method = data.fulfillmentMethod === "delivery" ? "\u{1F69A} Delivery" : "\u{1F3EA} Pickup";
    lines.push(`*Fulfillment:* ${escapeMarkdown(method)}`);
  }

  if (data.preferredContactMethod) {
    lines.push(`*Contact Preference:* ${escapeMarkdown(data.preferredContactMethod)}`);
  }

  lines.push("");
  lines.push("*Items:*");
  for (const item of data.items) {
    lines.push(`  \\- ${escapeMarkdown(item.productName)} x${item.quantity} — $${item.price.toFixed(2)}`);
  }

  lines.push("");
  lines.push(`*Total:* $${data.orderTotal.toFixed(2)}`);

  return lines.join("\n");
}

/** Escape special Markdown V2 characters for Telegram */
function escapeMarkdown(text: string): string {
  return text.replace(/([_[\]()~`>#+\-=|{}.!])/g, "\\$1");
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

serve(secureHeadersMiddleware(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ sent: false, reason: "Method not allowed" }, 405);
  }

  try {
    const rawBody = await req.json();
    const parseResult = RequestSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return jsonResponse(
        { sent: false, reason: "Validation failed", details: (parseResult as { success: false; error: { flatten: () => { fieldErrors: Record<string, string[]> } } }).error.flatten().fieldErrors },
        400,
      );
    }

    const input = parseResult.data;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // ------------------------------------------------------------------
    // 1. Resolve order data — use provided data or fetch from DB
    // ------------------------------------------------------------------
    let orderData: OrderData;

    const hasFullData = input.customerName && input.orderTotal !== undefined && input.items && input.items.length > 0;

    if (hasFullData) {
      orderData = {
        orderId: input.orderId,
        tenantId: input.tenantId,
        orderNumber: input.orderNumber ?? null,
        customerName: input.customerName!,
        customerPhone: input.customerPhone ?? null,
        orderTotal: input.orderTotal!,
        items: input.items!,
        storeName: input.storeName ?? "Store",
        fulfillmentMethod: input.fulfillmentMethod ?? null,
        preferredContactMethod: input.preferredContactMethod ?? null,
      };
    } else {
      // Fetch order + items from DB
      const { data: order } = await supabase
        .from("unified_orders")
        .select("id, order_number, customer_name, customer_phone, total_amount, fulfillment_method, preferred_contact_method")
        .eq("id", input.orderId)
        .eq("tenant_id", input.tenantId)
        .maybeSingle();

      if (!order) {
        return jsonResponse({ sent: false, reason: "Order not found" }, 200);
      }

      const { data: orderItems } = await supabase
        .from("order_items")
        .select("product_name, quantity, unit_price")
        .eq("order_id", input.orderId);

      const { data: store } = await supabase
        .from("marketplace_stores")
        .select("store_name")
        .eq("tenant_id", input.tenantId)
        .maybeSingle();

      orderData = {
        orderId: input.orderId,
        tenantId: input.tenantId,
        orderNumber: order.order_number ?? null,
        customerName: order.customer_name ?? "Unknown Customer",
        customerPhone: order.customer_phone ?? null,
        orderTotal: Number(order.total_amount) || 0,
        items: (orderItems ?? []).map((item: Record<string, unknown>) => ({
          productName: (item.product_name as string) ?? "Unknown",
          quantity: Number(item.quantity) || 1,
          price: (Number(item.unit_price) || 0) * (Number(item.quantity) || 1),
        })),
        storeName: store?.store_name ?? input.storeName ?? "Store",
        fulfillmentMethod: order.fulfillment_method ?? null,
        preferredContactMethod: order.preferred_contact_method ?? null,
      };

      if (orderData.items.length === 0) {
        return jsonResponse({ sent: false, reason: "Order has no items" }, 200);
      }
    }

    // ------------------------------------------------------------------
    // 2. Resolve account_id for this tenant
    // ------------------------------------------------------------------
    const { data: account } = await supabase
      .from("accounts")
      .select("id")
      .eq("tenant_id", input.tenantId)
      .maybeSingle();

    if (!account) {
      return jsonResponse({ sent: false, reason: "Tenant account not found" }, 200);
    }

    // ------------------------------------------------------------------
    // 3. Fetch notification_settings from account_settings
    // ------------------------------------------------------------------
    const { data: settings } = await supabase
      .from("account_settings")
      .select("notification_settings")
      .eq("account_id", account.id)
      .maybeSingle();

    const notificationSettings = settings?.notification_settings as Record<string, unknown> | null;

    if (!notificationSettings) {
      return jsonResponse({ sent: false, reason: "No notification settings configured" }, 200);
    }

    const autoForward = notificationSettings.telegram_auto_forward as boolean | undefined;
    const botToken = notificationSettings.telegram_bot_token as string | undefined;
    const chatId = notificationSettings.telegram_chat_id as string | undefined;

    if (!autoForward) {
      return jsonResponse({ sent: false, reason: "Telegram auto-forward not enabled" }, 200);
    }

    if (!botToken || !chatId) {
      return jsonResponse({ sent: false, reason: "Telegram bot_token or chat_id not configured" }, 200);
    }

    // ------------------------------------------------------------------
    // 4. Send message via Telegram Bot API
    // ------------------------------------------------------------------
    const message = formatOrderMessage(orderData);

    const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const telegramResponse = await fetch(telegramUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "MarkdownV2",
      }),
    });

    if (!telegramResponse.ok) {
      const errorBody = await telegramResponse.text();
      return jsonResponse(
        { sent: false, reason: `Telegram API error: ${telegramResponse.status}`, detail: errorBody },
        200,
      );
    }

    return jsonResponse({ sent: true }, 200);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return jsonResponse({ sent: false, reason: message }, 200);
  }
}));
