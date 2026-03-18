import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailRequest {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  fromEmail?: string;
  fromName?: string;
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

    const { 
      to, 
      subject, 
      html, 
      text, 
      fromEmail = 'noreply@nymdelivery.com', 
      fromName = 'NYM Delivery',
      metadata = {} 
    }: EmailRequest = await req.json();

    if (!to || !subject || (!html && !text)) {
      return new Response(
        JSON.stringify({ error: 'Email, subject, and content (html or text) are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Sending email via Klaviyo:', { to, subject, fromEmail });

    // Klaviyo Campaigns API - Create Email Campaign
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
            name: `Email Test - ${new Date().toISOString()}`,
            audiences: {
              included: [to]
            },
            messages: {
              email: {
                subject: subject,
                from_email: fromEmail,
                from_label: fromName,
                content: {
                  html: html,
                  plain_text: text
                }
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
      console.error('Klaviyo Email API error:', errorText);
      throw new Error(`Klaviyo API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('Email sent successfully via Klaviyo:', result);

    return new Response(
      JSON.stringify({ success: true, messageId: result.data?.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in send-klaviyo-email function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
