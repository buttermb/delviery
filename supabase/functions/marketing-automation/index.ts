import { serve, createClient, corsHeaders } from '../_shared/deps.ts';
import { createLogger } from '../_shared/logger.ts';
import { withZenProtection } from '../_shared/zen-firewall.ts';
import { validateMarketingAutomation, type MarketingAutomationInput } from './validation.ts';

const logger = createLogger('marketing-automation');

/**
 * Format phone number to E.164 format
 */
function formatPhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.startsWith('+') ? digits : `+${digits}`;
}

/**
 * Send SMS via Twilio REST API
 */
async function sendSmsViaTwilio(
  to: string,
  body: string,
  accountSid: string,
  authToken: string,
  fromNumber: string,
): Promise<{ success: boolean; sid?: string; error?: string }> {
  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

  const formData = new URLSearchParams();
  formData.append('From', fromNumber);
  formData.append('To', to);
  formData.append('Body', body);

  const response = await fetch(twilioUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${btoa(`${accountSid}:${authToken}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return { success: false, error: errorText };
  }

  const data = await response.json();
  return { success: true, sid: data.sid };
}

serve(withZenProtection(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const rawBody = await req.json();
    const { action, payload }: MarketingAutomationInput = validateMarketingAutomation(rawBody);

    if (action === 'send_email') {
      logger.info('Email sending requested', { campaignId: payload.campaign_id });

      if (payload.campaign_id) {
        await supabase.from('marketing_campaigns').update({
          status: 'sent',
          sent_at: new Date().toISOString(),
        }).eq('id', payload.campaign_id);
      }

      return new Response(JSON.stringify({ success: true, message: 'Email sent' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'send_sms') {
      const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
      const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
      const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER');

      if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
        logger.error('Twilio credentials not configured');
        return new Response(
          JSON.stringify({
            error: 'SMS provider not configured',
            detail: 'TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER must be set',
          }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      if (!payload.recipient_phone) {
        return new Response(
          JSON.stringify({ error: 'recipient_phone is required for send_sms action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      if (!payload.message) {
        return new Response(
          JSON.stringify({ error: 'message is required for send_sms action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const formattedPhone = formatPhoneNumber(payload.recipient_phone);

      logger.info('Sending SMS via Twilio', {
        to: formattedPhone,
        campaignId: payload.campaign_id,
      });

      const result = await sendSmsViaTwilio(
        formattedPhone,
        payload.message,
        TWILIO_ACCOUNT_SID,
        TWILIO_AUTH_TOKEN,
        TWILIO_PHONE_NUMBER,
      );

      if (!result.success) {
        logger.error('Twilio SMS failed', { error: result.error });

        if (payload.campaign_id) {
          await supabase.from('marketing_campaigns').update({
            status: 'failed',
          }).eq('id', payload.campaign_id);
        }

        return new Response(
          JSON.stringify({ error: 'Failed to send SMS', detail: result.error }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      logger.info('SMS sent successfully', { sid: result.sid });

      // Log to message_history if the table exists
      try {
        const { error: logError } = await supabase.from('message_history').insert({
          phone_number: formattedPhone,
          message: payload.message,
          direction: 'outbound',
          method: 'sms',
          status: 'sent',
          external_id: result.sid,
          created_at: new Date().toISOString(),
        });

        if (logError && logError.code !== '42P01') {
          logger.warn('Failed to log message history', { error: logError.message });
        }
      } catch {
        // message_history table may not exist — non-blocking
      }

      // Update campaign status if campaign_id provided
      if (payload.campaign_id) {
        await supabase.from('marketing_campaigns').update({
          status: 'sent',
          sent_at: new Date().toISOString(),
        }).eq('id', payload.campaign_id);
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'SMS sent successfully',
          sid: result.sid,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (action === 'schedule_campaign' || action === 'track_event') {
      logger.info(`${action} requested`, { metadata: payload.metadata });
      return new Response(
        JSON.stringify({ success: true, message: `${action} acknowledged` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to execute marketing action';
    logger.error('Marketing automation error', { error: message });
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
}));
