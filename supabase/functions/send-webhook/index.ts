/**
 * Send Webhook Edge Function
 * Fetches webhook config from DB, POSTs payload to the registered URL,
 * and logs delivery results to webhook_logs.
 */

import { serve, createClient, corsHeaders } from "../_shared/deps.ts";
import { createLogger } from "../_shared/logger.ts";
import { validateSendWebhook } from "./validation.ts";

const logger = createLogger("send-webhook");

const jsonResponse = (body: Record<string, unknown>, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function computeHmacSignature(
  secret: string,
  payload: string
): Promise<string> {
  const encoder = new TextEncoder();
  return crypto.subtle
    .importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    )
    .then((key) => crypto.subtle.sign("HMAC", key, encoder.encode(payload)))
    .then((sig) =>
      Array.from(new Uint8Array(sig))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
    );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  let webhookId: string | undefined;
  let tenantId: string | undefined;

  try {
    const rawBody = await req.json();
    const { webhook_id, payload } = validateSendWebhook(rawBody);
    webhookId = webhook_id;

    // Fetch webhook config from DB
    const { data: webhook, error: fetchError } = await supabaseClient
      .from("webhooks")
      .select("id, url, secret, is_active, tenant_id, events, headers")
      .eq("id", webhook_id)
      .maybeSingle();

    if (fetchError) {
      logger.error("Failed to fetch webhook config", { error: fetchError.message });
      return jsonResponse({ error: "Failed to fetch webhook configuration" }, 500);
    }

    if (!webhook) {
      return jsonResponse({ error: "Webhook not found" }, 404);
    }

    if (!webhook.is_active) {
      return jsonResponse({ error: "Webhook is inactive" }, 400);
    }

    tenantId = webhook.tenant_id;
    const payloadString = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000).toString();

    // Build request headers
    const requestHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "FloraIQ-Webhook/1.0",
      "X-Webhook-Timestamp": timestamp,
      ...(webhook.headers as Record<string, string> | null ?? {}),
    };

    // Sign payload with HMAC-SHA256 if secret exists
    if (webhook.secret) {
      const signatureInput = `${timestamp}.${payloadString}`;
      const signature = await computeHmacSignature(webhook.secret, signatureInput);
      requestHeaders["X-Webhook-Signature"] = `sha256=${signature}`;
    }

    // Create a pending log entry
    const { data: logEntry } = await supabaseClient
      .from("webhook_logs")
      .insert({
        tenant_id: tenantId,
        webhook_id: webhook.id,
        event_type: (payload as Record<string, unknown>).event_type as string ?? "manual",
        payload,
        status: "pending",
      })
      .select("id")
      .maybeSingle();

    // POST to the webhook URL with a 10-second timeout
    const startTime = Date.now();
    let responseStatus: number | undefined;
    let responseBody: string | undefined;
    let errorMessage: string | undefined;
    let deliveryStatus: "success" | "failed" = "failed";

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000);

      const response = await fetch(webhook.url, {
        method: "POST",
        headers: requestHeaders,
        body: payloadString,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      responseStatus = response.status;
      responseBody = await response.text().catch(() => "");

      // Truncate response body to 4KB to avoid bloating logs
      if (responseBody && responseBody.length > 4096) {
        responseBody = responseBody.slice(0, 4096) + "...[truncated]";
      }

      deliveryStatus = response.ok ? "success" : "failed";

      if (!response.ok) {
        errorMessage = `HTTP ${response.status}: ${responseBody.slice(0, 200)}`;
      }
    } catch (fetchErr: unknown) {
      errorMessage =
        fetchErr instanceof Error ? fetchErr.message : "Network error";
      if (fetchErr instanceof DOMException && fetchErr.name === "AbortError") {
        errorMessage = "Request timed out after 10 seconds";
      }
    }

    const durationMs = Date.now() - startTime;

    // Update log entry with delivery result
    if (logEntry?.id) {
      await supabaseClient
        .from("webhook_logs")
        .update({
          status: deliveryStatus,
          response_status: responseStatus ?? null,
          response_body: responseBody ?? null,
          error_message: errorMessage ?? null,
          duration_ms: durationMs,
          completed_at: new Date().toISOString(),
        })
        .eq("id", logEntry.id);
    }

    // Update last_triggered_at on the webhook
    await supabaseClient
      .from("webhooks")
      .update({
        last_triggered_at: new Date().toISOString(),
        failure_count: deliveryStatus === "failed"
          ? (webhook as Record<string, unknown>).failure_count
            ? Number((webhook as Record<string, unknown>).failure_count) + 1
            : 1
          : 0,
      })
      .eq("id", webhook.id);

    logger.info("Webhook delivered", {
      webhookId: webhook.id,
      tenantId,
      status: deliveryStatus,
      durationMs: String(durationMs),
      responseStatus: String(responseStatus ?? "N/A"),
    });

    return jsonResponse(
      {
        success: deliveryStatus === "success",
        status: deliveryStatus,
        response_status: responseStatus ?? null,
        duration_ms: durationMs,
        log_id: logEntry?.id ?? null,
      },
      deliveryStatus === "success" ? 200 : 502
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to send webhook";
    logger.error("Send webhook error", {
      webhookId,
      tenantId,
      error: message,
    });
    return jsonResponse({ error: message }, 400);
  }
});
