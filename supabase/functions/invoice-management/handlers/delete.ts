/**
 * Handler for deleting invoices (action: 'delete').
 */

import { corsHeaders } from '../../_shared/deps.ts';

export async function handleDelete(
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

  // Only allow deletion of draft invoices
  const { data: invoice } = await serviceClient
    .from('invoices')
    .select('status')
    .eq('id', invoiceId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (!invoice) {
    return new Response(
      JSON.stringify({ error: 'Invoice not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (invoice.status !== 'draft') {
    return new Response(
      JSON.stringify({ error: 'Only draft invoices can be deleted' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { error: deleteError } = await serviceClient
    .from('invoices')
    .delete()
    .eq('id', invoiceId)
    .eq('tenant_id', tenantId);

  if (deleteError) {
    return new Response(
      JSON.stringify({ error: 'Failed to delete invoice', details: deleteError.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
