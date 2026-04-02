/**
 * Send SMS Edge Function
 * Integrates with Twilio to send SMS messages
 * Credit-gated: deducts credits (action_key: send_sms) for free tier tenants
 */

import { corsHeaders, type SupabaseClient } from '../_shared/deps.ts';
import { withCreditGate, CREDIT_ACTIONS } from '../_shared/creditGate.ts';
import { errorResponse } from '../_shared/error-response.ts';
import { createRequestLogger } from '../_shared/logger.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  return withCreditGate(req, CREDIT_ACTIONS.SEND_SMS, async (tenantId, serviceClient) => {
    const logger = createRequestLogger('send-sms', req);

    const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
    const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
    const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER');

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      return errorResponse(
        500,
        'Twilio not configured. Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in environment variables.',
        'TWILIO_NOT_CONFIGURED',
      );
    }

    // Parse request body with safe error handling
    let to: string;
    let message: string;
    let customerId: string | undefined;
    try {
      const body = await req.json();
      to = body.to;
      message = body.message;
      customerId = body.customerId;
    } catch {
      return errorResponse(400, 'Invalid JSON in request body', 'INVALID_JSON');
    }

    if (!to || !message) {
      return errorResponse(400, 'Missing required fields: to, message', 'MISSING_FIELDS');
    }

    // Look up actual credit cost for accurate refunds
    const creditCost = await getCreditCost(serviceClient, CREDIT_ACTIONS.SEND_SMS);

    // Format phone number (ensure it starts with +)
    const formattedPhone = to.startsWith('+') ? to : `+${to.replace(/\D/g, '')}`;

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;

    const formData = new URLSearchParams();
    formData.append('From', TWILIO_PHONE_NUMBER);
    formData.append('To', formattedPhone);
    formData.append('Body', message);

    // Wrap Twilio call in try-catch to ensure refund on network errors
    try {
      const twilioResponse = await fetch(twilioUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      if (!twilioResponse.ok) {
        const errorText = await twilioResponse.text();
        logger.error('Twilio API error', { errorText, to: formattedPhone });

        // Refund credits on Twilio failure
        await refundCredits(serviceClient, tenantId, creditCost, logger);

        return errorResponse(502, 'Failed to send SMS via Twilio', 'TWILIO_ERROR', errorText);
      }

      const twilioData = await twilioResponse.json();

      // Log message to database (non-critical — SMS already sent successfully)
      try {
        const { error: logError } = await serviceClient.from('message_history').insert({
          tenant_id: tenantId,
          customer_id: customerId,
          phone_number: formattedPhone,
          message: message,
          direction: 'outbound',
          method: 'sms',
          status: 'sent',
          external_id: twilioData.sid,
          created_at: new Date().toISOString(),
        });

        if (logError && logError.code !== '42P01') {
          logger.error('Error logging message', { code: logError.code, message: logError.message });
        }
      } catch (err) {
        logger.warn('Could not log message', { error: String(err) });
      }

      return new Response(
        JSON.stringify({
          success: true,
          sid: twilioData.sid,
          message: 'SMS sent successfully',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (error: unknown) {
      logger.error('SMS sending failed', { error: error instanceof Error ? error.message : String(error) });

      // Refund credits on network/unexpected errors
      await refundCredits(serviceClient, tenantId, creditCost, logger);

      return errorResponse(
        500,
        'Failed to send SMS',
        'SMS_SEND_FAILED',
        error instanceof Error ? error.message : 'Network error',
      );
    }
  });
});

/**
 * Look up the credit cost for an action from the credit_costs table.
 */
async function getCreditCost(
  supabaseClient: SupabaseClient,
  actionKey: string
): Promise<number> {
  try {
    const { data } = await supabaseClient
      .from('credit_costs')
      .select('credits')
      .eq('action_key', actionKey)
      .eq('is_active', true)
      .maybeSingle();

    return data?.credits ?? 25;
  } catch {
    return 25; // Fallback if lookup fails
  }
}

/**
 * Refund credits after a failed action by inserting a positive credit adjustment.
 * Uses admin_adjust_credits RPC to properly record the refund transaction.
 */
async function refundCredits(
  supabaseClient: SupabaseClient,
  tenantId: string,
  amount: number,
  logger: { error: (msg: string, data?: Record<string, unknown>) => void },
): Promise<void> {
  try {
    const { error } = await supabaseClient.rpc('admin_adjust_credits', {
      p_tenant_id: tenantId,
      p_amount: amount,
      p_reason: 'Refund: send_sms failed (Twilio delivery error)',
      p_notes: 'Automatic refund after SMS delivery failure',
    });

    if (error) {
      logger.error('Failed to refund credits', { code: error.code, message: error.message });
    }
  } catch (err) {
    logger.error('Credit refund error', { error: String(err) });
  }
}
