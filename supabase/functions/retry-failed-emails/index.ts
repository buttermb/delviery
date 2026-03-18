/**
 * Retry Failed Emails
 *
 * Cron job that picks up failed emails from the retry queue and re-sends
 * them via the Klaviyo email provider. Uses exponential backoff
 * (5 min → 15 min → 45 min) and caps at max_retries per record.
 *
 * Auth: requires x-internal-api-key header (cron-only).
 *
 * Schedule: Every 5 minutes (*/5 * * * *)
 *
 * To deploy:
 *   supabase functions deploy retry-failed-emails --no-verify-jwt
 */

import { serve, createClient, corsHeaders } from '../_shared/deps.ts';
import { withZenProtection } from '../_shared/zen-firewall.ts';
import { createLogger } from '../_shared/logger.ts';

const logger = createLogger('retry-failed-emails');

// Extend shared CORS to allow the internal API key header
const extendedCorsHeaders = {
  ...corsHeaders,
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-internal-api-key',
};

const MAX_BATCH_SIZE = 50;

serve(withZenProtection(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: extendedCorsHeaders });
  }

  try {
    // -------------------------------------------------------
    // Auth: require INTERNAL_API_KEY for cron-only access
    // -------------------------------------------------------
    const INTERNAL_API_KEY = Deno.env.get('INTERNAL_API_KEY');
    if (!INTERNAL_API_KEY) {
      logger.error('INTERNAL_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Function not properly configured' }),
        { status: 500, headers: { ...extendedCorsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const providedKey = req.headers.get('x-internal-api-key');
    if (!providedKey || providedKey !== INTERNAL_API_KEY) {
      logger.warn('Unauthorized access attempt');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 403, headers: { ...extendedCorsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // -------------------------------------------------------
    // Setup
    // -------------------------------------------------------
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    logger.info('Starting retry job');

    // -------------------------------------------------------
    // Fetch failed emails ready for retry
    // -------------------------------------------------------
    const now = new Date().toISOString();
    const { data: failedEmails, error: fetchError } = await supabase
      .from('failed_emails')
      .select('*')
      .lt('next_retry', now)
      .lt('retry_count', 3)
      .limit(MAX_BATCH_SIZE);

    if (fetchError) {
      throw new Error(`Failed to fetch emails: ${fetchError.message}`);
    }

    if (!failedEmails || failedEmails.length === 0) {
      logger.info('No emails to retry');
      return new Response(
        JSON.stringify({ success: true, processed: 0 }),
        { headers: { ...extendedCorsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    logger.info(`Found ${failedEmails.length} emails to retry`);

    let successCount = 0;
    let failCount = 0;

    for (const record of failedEmails) {
      const attempt = record.retry_count + 1;
      try {
        logger.info(`Retrying email`, {
          tenantId: record.tenant_id,
          recipient: record.recipient,
          template: record.template,
          attempt: String(attempt),
        });

        // -------------------------------------------------------
        // Send via Klaviyo (or log in dev when not configured)
        // -------------------------------------------------------
        await sendEmail(supabaseUrl, supabaseServiceKey, record);

        // Log success
        await supabase.from('email_logs').insert({
          tenant_id: record.tenant_id,
          template: record.template,
          recipient: record.recipient,
          status: 'sent',
          metadata: { retry_attempt: attempt, ...record.email_data },
          sent_at: new Date().toISOString(),
        });

        // Remove from failed queue
        await supabase.from('failed_emails').delete().eq('id', record.id);
        successCount++;
      } catch (sendError: unknown) {
        const message = sendError instanceof Error ? sendError.message : 'Unknown error';
        logger.error(`Retry failed`, {
          tenantId: record.tenant_id,
          recipient: record.recipient,
          error: message,
        });

        if (attempt >= record.max_retries) {
          // Max retries exceeded — move to permanent failure
          await supabase.from('email_logs').insert({
            tenant_id: record.tenant_id,
            template: record.template,
            recipient: record.recipient,
            status: 'failed',
            error_message: `Permanently failed after ${attempt} attempts: ${message}`,
            metadata: { retry_attempt: attempt, ...record.email_data },
            failed_at: new Date().toISOString(),
          });

          await supabase.from('failed_emails').delete().eq('id', record.id);
          failCount++;
        } else {
          // Exponential backoff: 5 min → 15 min → 45 min
          const backoffMinutes = 5 * Math.pow(3, record.retry_count);
          const nextRetry = new Date(Date.now() + backoffMinutes * 60 * 1000);

          await supabase
            .from('failed_emails')
            .update({
              retry_count: attempt,
              next_retry: nextRetry.toISOString(),
              error_message: message,
              updated_at: new Date().toISOString(),
            })
            .eq('id', record.id);

          failCount++;
        }
      }
    }

    logger.info('Retry job completed', {
      processed: String(failedEmails.length),
      success: String(successCount),
      failed: String(failCount),
    });

    return new Response(
      JSON.stringify({
        success: true,
        processed: failedEmails.length,
        successCount,
        failCount,
      }),
      { headers: { ...extendedCorsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Retry job error', { error: message });
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...extendedCorsHeaders, 'Content-Type': 'application/json' } },
    );
  }
}));

// -------------------------------------------------------
// Email sending via Klaviyo (or dev log fallback)
// -------------------------------------------------------

interface FailedEmailRecord {
  id: string;
  tenant_id: string;
  template: string;
  recipient: string;
  email_data: Record<string, unknown>;
  retry_count: number;
  max_retries: number;
}

async function sendEmail(
  supabaseUrl: string,
  supabaseServiceKey: string,
  record: FailedEmailRecord,
): Promise<void> {
  const klaviyoApiKey = Deno.env.get('KLAVIYO_API_KEY');

  const emailData = record.email_data ?? {};
  const subject = (emailData.subject as string) || `[Retry] ${record.template}`;
  const html = (emailData.html as string) || '';
  const text = (emailData.text as string) || '';
  const fromEmail = (emailData.from_email as string) || Deno.env.get('FROM_EMAIL') || 'noreply@example.com';
  const fromName = (emailData.from_name as string) || 'FloraIQ';

  if (!klaviyoApiKey) {
    // Development fallback: log instead of sending
    logger.info('Klaviyo not configured — skipping send (dev mode)', {
      recipient: record.recipient,
      template: record.template,
    });
    return;
  }

  // Delegate to the send-klaviyo-email edge function (single responsibility)
  const response = await fetch(`${supabaseUrl}/functions/v1/send-klaviyo-email`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: record.recipient,
      subject,
      html,
      text,
      fromEmail,
      fromName,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Klaviyo send failed (${response.status}): ${errorBody}`);
  }
}
