/**
 * Forward Order to Telegram Edge Function
 *
 * Sends order notification to a tenant's configured Telegram chat.
 * Called fire-and-forget from storefront-checkout — failures here
 * never block the order response.
 *
 * POST /forward-order-telegram
 * Receives: { orderId, tenantId, orderNumber, customerName, orderTotal, items, storeName }
 * Returns:  { sent: true } or { sent: false, reason: string }
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
  orderNumber: z.string().nullable().optional(),
  customerName: z.string(),
  customerPhone: z.string().nullable().optional(),
  orderTotal: z.number(),
  items: z.array(OrderItemSchema).min(1),
  storeName: z.string().optional(),
  fulfillmentMethod: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const jsonResponse = (body: Record<string, unknown>, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function formatOrderMessage(data: z.infer<typeof RequestSchema>, storeName: string): string {
  const lines: string[] = [];

  lines.push(`\u{1F4E6} *New Order #${data.orderNumber ?? data.orderId.slice(0, 8)}*`);
  lines.push("");
  lines.push(`*Store:* ${escapeMarkdown(storeName)}`);
  lines.push(`*Customer:* ${escapeMarkdown(data.customerName)}`);

  if (data.customerPhone) {
    lines.push(`*Phone:* ${escapeMarkdown(data.customerPhone)}`);
  }

  if (data.fulfillmentMethod) {
    const method = data.fulfillmentMethod === "delivery" ? "Delivery" : "Pickup";
    lines.push(`*Fulfillment:* ${method}`);
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
        { sent: false, reason: "Validation failed", details: parseResult.error.flatten().fieldErrors },
        400,
      );
    }

    const data = parseResult.data;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // ------------------------------------------------------------------
    // 1. Resolve account_id for this tenant
    // ------------------------------------------------------------------
    const { data: account } = await supabase
      .from("accounts")
      .select("id")
      .eq("tenant_id", data.tenantId)
      .maybeSingle();

    if (!account) {
      return jsonResponse({ sent: false, reason: "Tenant account not found" }, 200);
    }

    // ------------------------------------------------------------------
    // 2. Fetch notification_settings from account_settings
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
    // 3. Send message via Telegram Bot API
    // ------------------------------------------------------------------
    const message = formatOrderMessage(data, data.storeName ?? "Store");

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
