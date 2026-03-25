/**
 * Send Email Edge Function (via Resend)
 * Sends transactional email via Resend API with credit deduction (action_key: send_email, 10 credits)
 *
 * NOTE: Directory kept as send-klaviyo-email to avoid updating all caller URLs.
 */

import { serve } from '../_shared/deps.ts';
import { withCreditGate, CREDIT_ACTIONS } from '../_shared/creditGate.ts';
import type { SupabaseClient } from '../_shared/deps.ts';
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
  return withCreditGate(req, CREDIT_ACTIONS.SEND_EMAIL, async (tenantId: string, supabaseClient: SupabaseClient) => {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured');
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

    console.error('Sending email via Resend:', { to, subject, fromEmail, tenantId });

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

      // Refund credits on API failure
      await refundCredits(supabaseClient, tenantId, CREDIT_ACTIONS.SEND_EMAIL, `Resend API error: ${response.status}`);

      return new Response(
        JSON.stringify({ error: `Resend API error: ${response.status}`, refunded: true }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await response.json();
    console.error('Email sent successfully via Resend:', { messageId: result.id, tenantId });

    return new Response(
      JSON.stringify({ success: true, messageId: result.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }, {
    referenceType: 'email',
    description: 'Resend email send',
  });
});

/**
 * Refund credits after a failed API call.
 * Looks up the action cost from credit_costs, adds credits back, and logs a refund transaction.
 */
async function refundCredits(
  supabaseClient: SupabaseClient,
  tenantId: string,
  actionKey: string,
  reason: string
): Promise<void> {
  try {
    // Look up the cost for this action
    const { data: costData } = await supabaseClient
      .from('credit_costs')
      .select('credits')
      .eq('action_key', actionKey)
      .eq('is_active', true)
      .maybeSingle();

    const cost = costData?.credits ?? 0;
    if (cost === 0) return;

    // Get current balance to compute balance_after for the transaction record
    const { data: creditData } = await supabaseClient
      .from('tenant_credits')
      .select('balance')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    const currentBalance = creditData?.balance ?? 0;
    const newBalance = currentBalance + cost;

    // Add credits back atomically
    const { error: updateError } = await supabaseClient
      .from('tenant_credits')
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId);

    if (updateError) {
      console.error('Credit refund balance update failed:', updateError);
    }

    // Record refund transaction
    await supabaseClient
      .from('credit_transactions')
      .insert({
        tenant_id: tenantId,
        amount: cost,
        balance_after: newBalance,
        transaction_type: 'refund',
        action_type: actionKey,
        description: `Refund: ${reason}`,
      });

    console.error('Credits refunded:', { tenantId, amount: cost, reason });
  } catch (err) {
    console.error('Failed to refund credits:', err);
  }
}
