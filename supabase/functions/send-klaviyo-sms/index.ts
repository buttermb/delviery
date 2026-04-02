/**
 * Send SMS via Klaviyo Edge Function
 * Uses Klaviyo Events API to track an SMS event that triggers a Klaviyo flow.
 * Credit-gated with auto-refund: deducts credits (action_key: send_sms)
 * for free tier tenants and refunds on API failure.
 */

import { corsHeaders } from '../_shared/deps.ts';
import { withCreditGateAndRefund, CREDIT_ACTIONS } from '../_shared/creditGate.ts';

interface SmsRequest {
  to?: string;
  phone?: string;
  message: string;
  metadata?: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  return withCreditGateAndRefund(req, CREDIT_ACTIONS.SEND_SMS, async (_tenantId, _serviceClient) => {
    const klaviyoApiKey = Deno.env.get('KLAVIYO_API_KEY');
    if (!klaviyoApiKey) {
      return new Response(
        JSON.stringify({ error: 'KLAVIYO_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: SmsRequest = await req.json();
    const phone = body.to || body.phone;
    const { message, metadata = {} } = body;

    if (!phone || !message) {
      return new Response(
        JSON.stringify({ error: 'Phone number and message are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Klaviyo Events API — track a custom event on a profile identified by phone.
    // A Klaviyo flow triggered by this metric sends the actual SMS.
    const response = await fetch('https://a.klaviyo.com/api/events/', {
      method: 'POST',
      headers: {
        'Authorization': `Klaviyo-API-Key ${klaviyoApiKey}`,
        'Content-Type': 'application/json',
        'revision': '2024-10-15',
      },
      body: JSON.stringify({
        data: {
          type: 'event',
          attributes: {
            metric: {
              data: {
                type: 'metric',
                attributes: { name: 'SMS Requested' },
              },
            },
            profile: {
              data: {
                type: 'profile',
                attributes: { phone_number: phone },
              },
            },
            properties: {
              message,
              ...metadata,
            },
          },
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[send-klaviyo-sms] Klaviyo API error:', response.status, errorText);
      return new Response(
        JSON.stringify({
          error: 'Klaviyo API error',
          details: `${response.status} - ${errorText}`,
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await response.json();

    return new Response(
      JSON.stringify({ success: true, eventId: result.data?.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  });
});
