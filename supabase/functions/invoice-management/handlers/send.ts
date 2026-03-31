/**
 * Handler for sending invoices (action: 'send').
 */

import { corsHeaders } from '../../_shared/deps.ts';
import { checkCreditsAvailable, CREDIT_ACTIONS } from '../../_shared/creditGate.ts';

export async function handleSend(
  serviceClient: any,
  tenantId: string,
  invoiceId: string | undefined
): Promise<Response> {
  if (!invoiceId) {
    return new Response(
      JSON.stringify({ error: 'Invoice ID is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Verify invoice exists, belongs to tenant, and is in draft status
  const { data: invoiceToSend } = await serviceClient
    .from('invoices')
    .select('id, tenant_id, status')
    .eq('id', invoiceId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (!invoiceToSend) {
    return new Response(
      JSON.stringify({ error: 'Invoice not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (invoiceToSend.status !== 'draft') {
    return new Response(
      JSON.stringify({ error: 'Only draft invoices can be sent' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check and consume credits for free tier users
  const sendCreditCheck = await checkCreditsAvailable(serviceClient, tenantId, CREDIT_ACTIONS.INVOICE_SEND);
  if (sendCreditCheck.isFreeTier && !sendCreditCheck.hasCredits) {
    return new Response(
      JSON.stringify({
        error: 'Insufficient credits',
        code: 'INSUFFICIENT_CREDITS',
        message: 'You do not have enough credits to send an invoice',
        creditsRequired: sendCreditCheck.cost,
        currentBalance: sendCreditCheck.balance,
      }),
      { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Consume credits if on free tier
  if (sendCreditCheck.isFreeTier) {
    await serviceClient.rpc('consume_credits', {
      p_tenant_id: tenantId,
      p_action_key: CREDIT_ACTIONS.INVOICE_SEND,
      p_reference_id: invoiceId,
      p_reference_type: 'invoice',
      p_description: 'Invoice sent',
    });
  }

  // Update invoice status to sent
  const { data: sentInvoice, error: sendError } = await serviceClient
    .from('invoices')
    .update({ status: 'sent' })
    .eq('id', invoiceId)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (sendError) {
    return new Response(
      JSON.stringify({ error: 'Failed to send invoice', details: sendError.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ success: true, invoice: sentInvoice }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
