import { serve, corsHeaders } from '../_shared/deps.ts';
import { withCreditGate, CREDIT_ACTIONS } from '../_shared/creditGate.ts';

interface SmsRequest {
  phone: string;
  message: string;
  metadata?: Record<string, unknown>;
}

serve(async (req) => {
  // CORS preflight handled by withCreditGate, but keep explicit for clarity
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  return withCreditGate(req, CREDIT_ACTIONS.SEND_SMS, async (_tenantId, _serviceClient) => {
    const klaviyoApiKey = Deno.env.get('KLAVIYO_API_KEY');
    if (!klaviyoApiKey) {
      throw new Error('KLAVIYO_API_KEY not configured');
    }

    const { phone, message, metadata: _metadata = {} }: SmsRequest = await req.json();

    if (!phone || !message) {
      return new Response(
        JSON.stringify({ error: 'Phone number and message are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.error('Sending SMS via Klaviyo:', { phone, messageLength: message.length });

    // Klaviyo Campaigns API - Create SMS Campaign
    const response = await fetch('https://a.klaviyo.com/api/campaigns/', {
      method: 'POST',
      headers: {
        'Authorization': `Klaviyo-API-Key ${klaviyoApiKey}`,
        'Content-Type': 'application/json',
        'revision': '2024-10-15'
      },
      body: JSON.stringify({
        data: {
          type: 'campaign',
          attributes: {
            name: `SMS Test - ${new Date().toISOString()}`,
            audiences: {
              included: [phone]
            },
            messages: {
              sms: {
                body: message
              }
            },
            send_strategy: {
              method: 'immediate'
            }
          }
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Klaviyo SMS API error:', errorText);
      // TODO: Refund credits on API failure when refundCredits mechanism is available
      throw new Error(`Klaviyo API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.error('SMS sent successfully via Klaviyo:', result);

    return new Response(
      JSON.stringify({ success: true, messageId: result.data?.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  });
});
