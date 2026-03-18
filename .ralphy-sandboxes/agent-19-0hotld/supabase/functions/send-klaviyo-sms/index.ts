import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SmsRequest {
  phone: string;
  message: string;
  metadata?: Record<string, any>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const klaviyoApiKey = Deno.env.get('KLAVIYO_API_KEY');
    if (!klaviyoApiKey) {
      throw new Error('KLAVIYO_API_KEY not configured');
    }

    const { phone, message, metadata = {} }: SmsRequest = await req.json();

    if (!phone || !message) {
      return new Response(
        JSON.stringify({ error: 'Phone number and message are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Sending SMS via Klaviyo:', { phone, messageLength: message.length });

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
      throw new Error(`Klaviyo API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('SMS sent successfully via Klaviyo:', result);

    return new Response(
      JSON.stringify({ success: true, messageId: result.data?.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in send-klaviyo-sms function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
