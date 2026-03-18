/**
 * Marketing Automation Edge Function
 * Handles email sending, SMS, campaign scheduling, and event tracking
 * for the marketing automation system.
 *
 * Email delivery: Resend API (primary), graceful fallback to logging.
 * All actions are logged to email_logs / failed_emails for retry.
 */

import { serve, createClient, corsHeaders } from '../_shared/deps.ts';
import { createLogger } from '../_shared/logger.ts';
import {
  validateMarketingAutomation,
  type MarketingAutomationInput,
  type EmailPayload,
  type SmsPayload,
  type ScheduleCampaignPayload,
  type TrackEventPayload,
} from './validation.ts';

const logger = createLogger('marketing-automation');

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const DEFAULT_FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'noreply@floraiq.com';
const DEFAULT_FROM_NAME = Deno.env.get('FROM_NAME') ?? 'FloraIQ';

interface ResendEmailResponse {
  id: string;
}

interface ResendErrorResponse {
  statusCode: number;
  message: string;
  name: string;
}

/**
 * Send an email via the Resend API.
 * Returns the provider message ID on success, or throws on failure.
 */
async function sendEmailViaResend(
  to: string,
  subject: string,
  html: string,
  text: string | undefined,
  fromName: string,
  fromEmail: string,
): Promise<string> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: `${fromName} <${fromEmail}>`,
      to: [to],
      subject,
      html,
      ...(text ? { text } : {}),
    }),
  });

  if (!response.ok) {
    const errorData: ResendErrorResponse = await response.json();
    throw new Error(`Resend API error ${response.status}: ${errorData.message}`);
  }

  const result: ResendEmailResponse = await response.json();
  return result.id;
}

/**
 * Log a sent email to the email_logs table.
 */
async function logEmail(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  recipient: string,
  status: 'sent' | 'failed',
  opts: {
    template?: string;
    providerMessageId?: string;
    errorMessage?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await supabase.from('email_logs').insert({
    tenant_id: tenantId,
    template: opts.template ?? 'marketing_campaign',
    recipient,
    status,
    provider_message_id: opts.providerMessageId ?? null,
    error_message: opts.errorMessage ?? null,
    metadata: opts.metadata ?? {},
    sent_at: status === 'sent' ? new Date().toISOString() : null,
    failed_at: status === 'failed' ? new Date().toISOString() : null,
  });

  if (error) {
    logger.warn('Failed to insert email log', { tenantId, error: error.message });
  }
}

/**
 * Queue a failed email for retry via the failed_emails table.
 */
async function queueForRetry(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  recipient: string,
  template: string,
  emailData: Record<string, unknown>,
  errorMessage: string,
): Promise<void> {
  const { error } = await supabase.from('failed_emails').insert({
    tenant_id: tenantId,
    template,
    recipient,
    email_data: emailData,
    error_message: errorMessage,
    retry_count: 0,
    max_retries: 3,
    next_retry: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  });

  if (error) {
    logger.error('Failed to queue email for retry', { tenantId, error: error.message });
  }
}

/**
 * Handle the send_email action.
 */
async function handleSendEmail(
  supabase: ReturnType<typeof createClient>,
  payload: EmailPayload,
): Promise<Response> {
  const {
    tenant_id,
    campaign_id,
    recipient_email,
    recipient_name,
    subject,
    html_content,
    text_content,
    from_name,
    from_email,
    metadata,
  } = payload;

  const senderName = from_name ?? DEFAULT_FROM_NAME;
  const senderEmail = from_email ?? DEFAULT_FROM_EMAIL;

  logger.info('Sending marketing email', {
    tenantId: tenant_id,
    recipient: recipient_email,
    subject,
    campaignId: campaign_id,
  });

  if (!RESEND_API_KEY) {
    logger.warn('RESEND_API_KEY not configured, logging email without sending', {
      tenantId: tenant_id,
    });

    await logEmail(supabase, tenant_id, recipient_email, 'sent', {
      template: 'marketing_campaign',
      metadata: { ...metadata, dry_run: true, recipient_name },
    });

    return jsonResponse({
      success: true,
      message: 'Email logged (no provider configured)',
      dry_run: true,
    });
  }

  try {
    const providerMessageId = await sendEmailViaResend(
      recipient_email,
      subject,
      html_content,
      text_content,
      senderName,
      senderEmail,
    );

    logger.info('Email sent successfully', {
      tenantId: tenant_id,
      providerMessageId,
      recipient: recipient_email,
    });

    await logEmail(supabase, tenant_id, recipient_email, 'sent', {
      template: 'marketing_campaign',
      providerMessageId,
      metadata: { ...metadata, campaign_id, recipient_name },
    });

    // Update campaign stats if campaign_id provided
    if (campaign_id) {
      await updateCampaignStatus(supabase, campaign_id, tenant_id);
    }

    return jsonResponse({
      success: true,
      message: 'Email sent',
      provider_message_id: providerMessageId,
    });
  } catch (sendError: unknown) {
    const errorMessage = sendError instanceof Error ? sendError.message : 'Unknown send error';
    logger.error('Email send failed', {
      tenantId: tenant_id,
      recipient: recipient_email,
      error: errorMessage,
    });

    await logEmail(supabase, tenant_id, recipient_email, 'failed', {
      template: 'marketing_campaign',
      errorMessage,
      metadata: { ...metadata, campaign_id, recipient_name },
    });

    await queueForRetry(
      supabase,
      tenant_id,
      recipient_email,
      'marketing_campaign',
      {
        subject,
        html_content,
        text_content,
        from_name: senderName,
        from_email: senderEmail,
        campaign_id,
        recipient_name,
      },
      errorMessage,
    );

    return jsonResponse(
      { success: false, error: `Email delivery failed: ${errorMessage}` },
      500,
    );
  }
}

/**
 * Handle the send_sms action (placeholder — requires Twilio integration).
 */
async function handleSendSms(
  supabase: ReturnType<typeof createClient>,
  payload: SmsPayload,
): Promise<Response> {
  const { tenant_id, campaign_id, recipient_phone, message, metadata } = payload;

  logger.info('SMS send requested', {
    tenantId: tenant_id,
    recipient: recipient_phone,
    campaignId: campaign_id,
  });

  // Log the SMS attempt (Twilio integration is a separate task)
  await logEmail(supabase, tenant_id, recipient_phone, 'sent', {
    template: 'marketing_sms',
    metadata: { ...metadata, campaign_id, message_length: message.length, channel: 'sms' },
  });

  if (campaign_id) {
    await updateCampaignStatus(supabase, campaign_id, tenant_id);
  }

  return jsonResponse({
    success: true,
    message: 'SMS logged (Twilio integration pending)',
  });
}

/**
 * Handle schedule_campaign action.
 */
async function handleScheduleCampaign(
  supabase: ReturnType<typeof createClient>,
  payload: ScheduleCampaignPayload,
): Promise<Response> {
  const { campaign_id, tenant_id, scheduled_at } = payload;

  logger.info('Scheduling campaign', {
    tenantId: tenant_id,
    campaignId: campaign_id,
    scheduledAt: scheduled_at,
  });

  const { error } = await supabase
    .from('marketing_campaigns')
    .update({
      status: 'scheduled',
      scheduled_at,
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaign_id)
    .eq('tenant_id', tenant_id);

  if (error) {
    logger.error('Failed to schedule campaign', {
      tenantId: tenant_id,
      campaignId: campaign_id,
      error: error.message,
    });
    return jsonResponse({ success: false, error: error.message }, 400);
  }

  return jsonResponse({ success: true, message: 'Campaign scheduled' });
}

/**
 * Handle track_event action (open, click, bounce, unsubscribe).
 */
async function handleTrackEvent(
  supabase: ReturnType<typeof createClient>,
  payload: TrackEventPayload,
): Promise<Response> {
  const { campaign_id, tenant_id, event_type, recipient_email, metadata } = payload;

  logger.info('Tracking marketing event', {
    tenantId: tenant_id,
    campaignId: campaign_id,
    eventType: event_type,
  });

  const columnMap: Record<string, string> = {
    open: 'opened_count',
    click: 'clicked_count',
  };

  const countColumn = columnMap[event_type];
  if (countColumn) {
    // Fetch current count and increment
    const { data: campaign, error: fetchError } = await supabase
      .from('marketing_campaigns')
      .select(countColumn)
      .eq('id', campaign_id)
      .eq('tenant_id', tenant_id)
      .maybeSingle();

    if (fetchError) {
      logger.error('Failed to fetch campaign for tracking', {
        tenantId: tenant_id,
        error: fetchError.message,
      });
      return jsonResponse({ success: false, error: fetchError.message }, 400);
    }

    if (campaign) {
      const currentCount = (campaign[countColumn] as number) ?? 0;
      const { error: updateError } = await supabase
        .from('marketing_campaigns')
        .update({ [countColumn]: currentCount + 1 })
        .eq('id', campaign_id)
        .eq('tenant_id', tenant_id);

      if (updateError) {
        logger.warn('Failed to update campaign tracking count', {
          tenantId: tenant_id,
          error: updateError.message,
        });
      }
    }
  }

  // Log the event
  await logEmail(supabase, tenant_id, recipient_email ?? 'unknown', 'sent', {
    template: `marketing_event_${event_type}`,
    metadata: { ...metadata, campaign_id, event_type },
  });

  return jsonResponse({ success: true, message: `Event '${event_type}' tracked` });
}

/**
 * Increment sent_count and mark campaign as sending/sent.
 */
async function updateCampaignStatus(
  supabase: ReturnType<typeof createClient>,
  campaignId: string,
  tenantId: string,
): Promise<void> {
  const { data: campaign, error: fetchError } = await supabase
    .from('marketing_campaigns')
    .select('sent_count, status')
    .eq('id', campaignId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (fetchError || !campaign) {
    logger.warn('Failed to fetch campaign for status update', {
      tenantId,
      campaignId,
      error: fetchError?.message,
    });
    return;
  }

  const newSentCount = (campaign.sent_count ?? 0) + 1;
  const { error: updateError } = await supabase
    .from('marketing_campaigns')
    .update({
      sent_count: newSentCount,
      status: 'sent',
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaignId)
    .eq('tenant_id', tenantId);

  if (updateError) {
    logger.warn('Failed to update campaign status', {
      tenantId,
      campaignId,
      error: updateError.message,
    });
  }
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const rawBody = await req.json();
    const input: MarketingAutomationInput = validateMarketingAutomation(rawBody);

    switch (input.action) {
      case 'send_email':
        return await handleSendEmail(supabase, input.payload);
      case 'send_sms':
        return await handleSendSms(supabase, input.payload);
      case 'schedule_campaign':
        return await handleScheduleCampaign(supabase, input.payload);
      case 'track_event':
        return await handleTrackEvent(supabase, input.payload);
      default:
        return jsonResponse({ error: 'Unknown action' }, 400);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to execute marketing action';
    logger.error('Marketing automation error', { error: message });
    return jsonResponse({ error: message }, 400);
  }
});
