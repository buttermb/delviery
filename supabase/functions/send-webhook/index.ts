import { createClient, corsHeaders } from '../_shared/deps.ts';
import { validateSendWebhook } from './validation.ts';

/**
 * Computes an HMAC-SHA256 signature for webhook payload verification.
 * The receiving server can verify the payload integrity using the shared secret.
 */
async function computeHmacSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const serviceClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // Auth client scoped to the caller's JWT
  const authClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    {
      global: {
        headers: { Authorization: req.headers.get('Authorization')! },
      },
    },
  );

  try {
    const rawBody = await req.json();
    const { webhook_id, payload, event_type } = validateSendWebhook(rawBody);

    // Resolve caller identity
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Resolve tenant
    const { data: tenantUser } = await serviceClient
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!tenantUser?.tenant_id) {
      return new Response(
        JSON.stringify({ error: 'No tenant found for user' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const tenantId = tenantUser.tenant_id;

    // Fetch webhook — must belong to caller's tenant and be active
    const { data: webhook, error: webhookError } = await serviceClient
      .from('webhooks')
      .select('id, url, secret, is_active, name, tenant_id, failure_count')
      .eq('id', webhook_id)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (webhookError) {
      console.error('[SEND-WEBHOOK] DB error fetching webhook:', webhookError.message);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch webhook' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!webhook) {
      return new Response(
        JSON.stringify({ error: 'Webhook not found or not owned by tenant' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!webhook.is_active) {
      return new Response(
        JSON.stringify({ error: 'Webhook is inactive' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Create log entry in pending state
    const { data: logEntry, error: logInsertError } = await serviceClient
      .from('webhook_logs')
      .insert({
        tenant_id: tenantId,
        webhook_id: webhook.id,
        event_type: event_type ?? 'manual',
        payload,
        status: 'pending',
      })
      .select('id')
      .maybeSingle();

    if (logInsertError) {
      console.error('[SEND-WEBHOOK] Failed to create log entry:', logInsertError.message);
    }

    // Build request
    const bodyString = JSON.stringify(payload);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'FloraIQ-Webhook/1.0',
    };

    if (webhook.secret) {
      headers['X-Webhook-Signature'] = await computeHmacSignature(bodyString, webhook.secret);
    }

    // Send webhook
    const startMs = Date.now();
    let responseStatus: number | null = null;
    let responseBody: string | null = null;
    let errorMessage: string | null = null;
    let deliveryStatus: 'success' | 'failed' = 'failed';

    try {
      const resp = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body: bodyString,
        signal: AbortSignal.timeout(15_000),
      });

      responseStatus = resp.status;
      responseBody = await resp.text().catch(() => null);
      deliveryStatus = resp.ok ? 'success' : 'failed';

      if (!resp.ok) {
        errorMessage = `HTTP ${resp.status}: ${responseBody?.slice(0, 500) ?? 'no body'}`;
      }
    } catch (fetchError) {
      errorMessage = fetchError instanceof Error ? fetchError.message : 'Fetch failed';
      console.error(`[SEND-WEBHOOK] Delivery failed for ${webhook.name}:`, errorMessage);
    }

    const durationMs = Date.now() - startMs;

    // Update log entry
    if (logEntry?.id) {
      await serviceClient
        .from('webhook_logs')
        .update({
          response_status: responseStatus,
          response_body: responseBody?.slice(0, 2000) ?? null,
          error_message: errorMessage,
          duration_ms: durationMs,
          status: deliveryStatus,
          completed_at: new Date().toISOString(),
        })
        .eq('id', logEntry.id);
    }

    // Update webhook last_triggered_at
    await serviceClient
      .from('webhooks')
      .update({ last_triggered_at: new Date().toISOString() })
      .eq('id', webhook.id);

    // Update failure_count: increment on failure, reset on success
    const newFailureCount = deliveryStatus === 'failed'
      ? (webhook.failure_count ?? 0) + 1
      : 0;
    await serviceClient
      .from('webhooks')
      .update({ failure_count: newFailureCount })
      .eq('id', webhook.id);

    console.error(`[SEND-WEBHOOK] ${deliveryStatus} webhook=${webhook.name} status=${responseStatus} duration=${durationMs}ms`);

    if (deliveryStatus === 'failed') {
      return new Response(
        JSON.stringify({
          error: 'Webhook delivery failed',
          details: errorMessage,
          response_status: responseStatus,
          duration_ms: durationMs,
          log_id: logEntry?.id ?? null,
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        webhook_id: webhook.id,
        response_status: responseStatus,
        duration_ms: durationMs,
        log_id: logEntry?.id ?? null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send webhook';
    console.error('[SEND-WEBHOOK] Unhandled error:', message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
