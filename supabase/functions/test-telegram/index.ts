/**
 * Test Telegram Bot Configuration
 *
 * Sends a test message to verify bot token and chat ID are valid.
 * Called from the admin Notification Settings page.
 *
 * The bot_token and chat_id are fetched server-side from the database
 * to avoid transmitting sensitive tokens through the client.
 *
 * POST /test-telegram
 * Receives: { accountId } — reads credentials from account_settings
 * Returns:  { sent: true } or { sent: false, reason: string }
 */

import { serve, createClient, corsHeaders, z } from "../_shared/deps.ts";
import { secureHeadersMiddleware } from "../_shared/secure-headers.ts";

const RequestSchema = z.object({
  accountId: z.string().uuid("Valid account ID is required"),
});

const jsonResponse = (body: Record<string, unknown>, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

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

    const { accountId } = parseResult.data;

    // Fetch bot_token and chat_id from account_settings server-side
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: settings } = await supabase
      .from("account_settings")
      .select("notification_settings")
      .eq("account_id", accountId)
      .maybeSingle();

    const notifSettings = settings?.notification_settings as Record<string, unknown> | null;
    const botToken = notifSettings?.telegram_bot_token as string | undefined;
    const chatId = notifSettings?.telegram_chat_id as string | undefined;

    if (!botToken || !chatId) {
      return jsonResponse(
        { sent: false, reason: "Save your Telegram settings first, then test." },
        200,
      );
    }

    const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const telegramResponse = await fetch(telegramUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "\u2705 *FloraIQ Test Message*\n\nYour Telegram notifications are configured correctly\\. Orders will be forwarded to this chat\\.",
        parse_mode: "MarkdownV2",
      }),
    });

    if (!telegramResponse.ok) {
      let reason = `Telegram API error (${telegramResponse.status})`;

      if (telegramResponse.status === 401) {
        reason = "Invalid bot token. Check the token from @BotFather.";
      } else if (telegramResponse.status === 400) {
        reason = "Invalid chat ID. Make sure the bot is added to the chat.";
      }

      return jsonResponse({ sent: false, reason }, 200);
    }

    return jsonResponse({ sent: true }, 200);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return jsonResponse({ sent: false, reason: message }, 200);
  }
}));
