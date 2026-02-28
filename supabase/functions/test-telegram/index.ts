/**
 * Test Telegram Bot Configuration
 *
 * Sends a test message to verify bot token and chat ID are valid.
 * Called from the admin Notification Settings page.
 *
 * POST /test-telegram
 * Receives: { bot_token, chat_id }
 * Returns:  { sent: true } or { sent: false, reason: string }
 */

import { serve, corsHeaders, z } from "../_shared/deps.ts";
import { secureHeadersMiddleware } from "../_shared/secure-headers.ts";

const RequestSchema = z.object({
  bot_token: z.string().min(1, "Bot token is required"),
  chat_id: z.string().min(1, "Chat ID is required"),
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
        { sent: false, reason: "Validation failed", details: parseResult.error.flatten().fieldErrors },
        400,
      );
    }

    const { bot_token, chat_id } = parseResult.data;

    const telegramUrl = `https://api.telegram.org/bot${bot_token}/sendMessage`;
    const telegramResponse = await fetch(telegramUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id,
        text: "\u2705 *FloraIQ Test Message*\n\nYour Telegram notifications are configured correctly\\. Orders will be forwarded to this chat\\.",
        parse_mode: "MarkdownV2",
      }),
    });

    if (!telegramResponse.ok) {
      const errorBody = await telegramResponse.text();
      let reason = `Telegram API error (${telegramResponse.status})`;

      if (telegramResponse.status === 401) {
        reason = "Invalid bot token. Check the token from @BotFather.";
      } else if (telegramResponse.status === 400) {
        reason = "Invalid chat ID. Make sure the bot is added to the chat.";
      }

      return jsonResponse({ sent: false, reason, detail: errorBody }, 200);
    }

    return jsonResponse({ sent: true }, 200);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return jsonResponse({ sent: false, reason: message }, 200);
  }
}));
