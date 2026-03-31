/**
 * Handler for getting a single invoice (action: 'get').
 */

import { corsHeaders } from '../../_shared/deps.ts';

export async function handleGet(
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

  // Call RPC function to get single invoice
  const { data: invoice, error: rpcError } = await serviceClient
    .rpc('get_invoice', { invoice_id: invoiceId });

  if (rpcError) {
    // Fallback to direct query -- select the same columns the RPC returns
    const { data: invoiceData, error: queryError } = await serviceClient
      .from('invoices')
      .select('id, tenant_id, invoice_number, subtotal, tax, total, amount_paid, amount_due, line_items, billing_period_start, billing_period_end, issue_date, due_date, paid_at, status, stripe_invoice_id, stripe_payment_intent_id, created_at, updated_at')
      .eq('id', invoiceId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (queryError) {
      return new Response(
        JSON.stringify({ error: 'Invoice not found', details: queryError.message }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ invoice: invoiceData }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ invoice }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
