/**
 * Handler for listing invoices (action: 'list').
 */

import { corsHeaders } from '../../_shared/deps.ts';

export async function handleList(
  supabase: any,
  serviceClient: any,
  tenantId: string
): Promise<Response> {
  // Call RPC function to get invoices (use user-authenticated client so auth.uid() works in the RPC)
  const { data: invoices, error: rpcError } = await supabase
    .rpc('get_tenant_invoices', { tenant_id: tenantId });

  if (rpcError) {
    // Fallback to direct query -- select the same columns the RPC returns
    const { data: invoiceData, error: queryError } = await serviceClient
      .from('invoices')
      .select('id, invoice_number, subtotal, tax, total, amount_paid, amount_due, line_items, billing_period_start, billing_period_end, issue_date, due_date, paid_at, status, stripe_invoice_id, stripe_payment_intent_id, created_at, updated_at')
      .eq('tenant_id', tenantId)
      .order('issue_date', { ascending: false })
      .limit(100);

    if (queryError) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch invoices', details: queryError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ invoices: invoiceData || [] }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ invoices: invoices || [] }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
