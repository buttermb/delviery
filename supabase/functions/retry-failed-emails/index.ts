// Retry Failed Emails
//
// Cron/internal function that retries failed email deliveries.
// Reads from the failed_emails table, attempts to resend via Klaviyo,
// and applies exponential backoff on continued failures.
//
// Auth: x-internal-api-key header (internal calls only)

import { serve, createClient, corsHeaders } from '../_shared/deps.ts';
import { createLogger } from '../_shared/logger.ts';

const logger = createLogger('retry-failed-emails');

const BATCH_SIZE = 50;

// Exponential backoff: 5min, 15min, 45min
function getBackoffMs(retryCount: number): number {
  return 5 * Math.pow(3, retryCount) * 60 * 1000;
}

interface FailedEmail {
  id: string;
  tenant_id: string;
  template: string;
  recipient: string;
  email_data: Record<string, unknown>;
  error_message: string | null;
  retry_count: number;
  max_retries: number;
}

async function sendViaKlaviyo(
  supabaseUrl: string,
  serviceKey: string,
  email: FailedEmail,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const emailData = email.email_data;

  const payload = {
    to: email.recipient,
    subject: (emailData.subject as string) || `[Retry] ${email.template}`,
    html: (emailData.html as string) || undefined,
    text: (emailData.text as string) || undefined,
    fromEmail: (emailData.fromEmail as string) || undefined,
    fromName: (emailData.fromName as string) || undefined,
    metadata: {
      retry_attempt: email.retry_count + 1,
      original_template: email.template,
      ...(emailData.metadata as Record<string, unknown> || {}),
    },
  };

  const response = await fetch(`${supabaseUrl}/functions/v1/send-klaviyo-email`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return { success: false, error: `Klaviyo API error: ${response.status} - ${errorText}` };
  }

  const result = await response.json();
  if (!result.success) {
    return { success: false, error: result.error || 'Unknown provider error' };
  }

  return { success: true, messageId: result.messageId };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate internal API key
    const INTERNAL_API_KEY = Deno.env.get('INTERNAL_API_KEY');
    if (!INTERNAL_API_KEY) {
      logger.error('INTERNAL_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Function not properly configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const providedKey = req.headers.get('x-internal-api-key');
    if (!providedKey || providedKey !== INTERNAL_API_KEY) {
      logger.warn('Unauthorized access attempt');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    logger.info('Starting retry job');

    // Fetch failed emails ready for retry (next_retry in the past, under max retries)
    const { data: failedEmails, error: fetchError } = await supabase
      .from('failed_emails')
      .select('*')
      .lt('next_retry', new Date().toISOString())
      .order('next_retry', { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchError) {
      throw new Error(`Failed to fetch emails: ${fetchError.message}`);
    }

    // Filter to only those under their max_retries limit
    const retryable = (failedEmails as FailedEmail[] | null)?.filter(
      (e) => e.retry_count < e.max_retries,
    ) ?? [];

    if (retryable.length === 0) {
      logger.info('No emails to retry');
      return new Response(
        JSON.stringify({ success: true, processed: 0, successCount: 0, failCount: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    logger.info(`Found ${retryable.length} emails to retry`);

    let successCount = 0;
    let failCount = 0;

    for (const email of retryable) {
      const nextAttempt = email.retry_count + 1;

      try {
        logger.info(`Retrying email`, {
          tenantId: email.tenant_id,
          recipient: email.recipient,
          template: email.template,
          attempt: String(nextAttempt),
        });

        const result = await sendViaKlaviyo(supabaseUrl, supabaseServiceKey, email);

        if (!result.success) {
          throw new Error(result.error || 'Send failed');
        }

        // Record success in email_logs
        await supabase.from('email_logs').insert({
          tenant_id: email.tenant_id,
          template: email.template,
          recipient: email.recipient,
          status: 'sent',
          provider_message_id: result.messageId || null,
          metadata: {
            retry_attempt: nextAttempt,
            original_error: email.error_message,
            ...email.email_data,
          },
          sent_at: new Date().toISOString(),
        });

        // Remove from retry queue
        await supabase.from('failed_emails').delete().eq('id', email.id);
        successCount++;

        logger.info(`Email sent successfully`, {
          tenantId: email.tenant_id,
          recipient: email.recipient,
          attempt: String(nextAttempt),
        });
      } catch (sendError: unknown) {
        const errorMessage = sendError instanceof Error ? sendError.message : 'Unknown error';
        failCount++;

        // Check if we've exhausted retries
        if (nextAttempt >= email.max_retries) {
          logger.warn(`Max retries exhausted, marking as permanently failed`, {
            tenantId: email.tenant_id,
            recipient: email.recipient,
            attempt: String(nextAttempt),
          });

          // Log permanent failure
          await supabase.from('email_logs').insert({
            tenant_id: email.tenant_id,
            template: email.template,
            recipient: email.recipient,
            status: 'failed',
            error_message: errorMessage,
            metadata: {
              retry_attempts: nextAttempt,
              original_error: email.error_message,
              ...email.email_data,
            },
            failed_at: new Date().toISOString(),
          });

          // Remove from retry queue — no more attempts
          await supabase.from('failed_emails').delete().eq('id', email.id);
        } else {
          // Schedule next retry with exponential backoff
          const backoffMs = getBackoffMs(email.retry_count);
          const nextRetry = new Date(Date.now() + backoffMs);

          logger.info(`Scheduling retry`, {
            tenantId: email.tenant_id,
            recipient: email.recipient,
            attempt: String(nextAttempt),
            nextRetry: nextRetry.toISOString(),
          });

          await supabase
            .from('failed_emails')
            .update({
              retry_count: nextAttempt,
              next_retry: nextRetry.toISOString(),
              error_message: errorMessage,
              updated_at: new Date().toISOString(),
            })
            .eq('id', email.id);
        }
      }
    }

    logger.info(`Retry job completed`, {
      processed: String(retryable.length),
      successCount: String(successCount),
      failCount: String(failCount),
    });

    return new Response(
      JSON.stringify({
        success: true,
        processed: retryable.length,
        successCount,
        failCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Retry job failed', { error: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
