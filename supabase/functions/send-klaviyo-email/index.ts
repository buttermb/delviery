/**
 * Send Email Edge Function (via Resend)
 * Sends transactional email via Resend API.
 *
 * This function is called internally by other edge functions using the
 * service role key. It does NOT apply credit gating — callers are responsible
 * for their own credit deduction if needed. The previous withCreditGate wrapper
 * rejected all internal (service-role) calls because the credit gate expects
 * a user JWT to identify the tenant.
 *
 * NOTE: Directory kept as send-klaviyo-email to avoid updating all caller URLs.
 */

import { serve } from '../_shared/deps.ts';
import { corsHeaders } from '../_shared/deps.ts';

interface EmailRequest {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  fromEmail?: string;
  fromName?: string;
  metadata?: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: 'RESEND_API_KEY not configured' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const {
      to,
      subject,
      html,
      text,
      fromEmail = 'noreply@nymdelivery.com',
      fromName = 'NYM Delivery',
    }: EmailRequest = await req.json();

    if (!to || !subject || (!html && !text)) {
      return new Response(
        JSON.stringify({ error: 'Email, subject, and content (html or text) are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.error('Sending email via Resend:', { to, subject, fromEmail });

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [to],
        subject,
        html: html || undefined,
        text: text || undefined,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Resend API error:', errorText);
      return new Response(
        JSON.stringify({ error: `Resend API error: ${response.status}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await response.json();
    console.error('Email sent successfully via Resend:', { messageId: result.id });

    return new Response(
      JSON.stringify({ success: true, messageId: result.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Send email error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
