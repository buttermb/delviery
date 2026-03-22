/**
 * Send SMS Edge Function
 * Integrates with Twilio to send SMS messages
 * Credit-gated: deducts credits (action_key: send_sms) for free tier tenants
 */

import { corsHeaders, type SupabaseClient } from '../_shared/deps.ts';
import { withCreditGate, CREDIT_ACTIONS } from '../_shared/creditGate.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  return withCreditGate(req, CREDIT_ACTIONS.SEND_SMS, async (tenantId, serviceClient) => {
    const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
    const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
    const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER');

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      return new Response(
        JSON.stringify({
          error: 'Twilio not configured. Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in environment variables.',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { to, message, customerId } = await req.json();

    if (!to || !message) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to, message' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
        console.error('Twilio API error:', errorText);

        // Refund credits on Twilio failure
        await refundCredits(serviceClient, tenantId, creditCost);

        return new Response(
          JSON.stringify({
            error: 'Failed to send SMS via Twilio',
            details: errorText,
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
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
          console.error('Error logging message:', logError);
        }
      } catch (err) {
        console.warn('Could not log message:', err);
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
      console.error('SMS sending failed:', error);

      // Refund credits on network/unexpected errors
      await refundCredits(serviceClient, tenantId, creditCost);

      return new Response(
        JSON.stringify({
          error: 'Failed to send SMS',
          details: error instanceof Error ? error.message : 'Network error',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
  amount: number
): Promise<void> {
  try {
    const { error } = await supabaseClient.rpc('admin_adjust_credits', {
      p_tenant_id: tenantId,
      p_amount: amount,
      p_reason: 'Refund: send_sms failed (Twilio delivery error)',
      p_notes: 'Automatic refund after SMS delivery failure',
    });

    if (error) {
      console.error('Failed to refund credits:', error);
    }
  } catch (err) {
    console.error('Credit refund error:', err);
  }
}
