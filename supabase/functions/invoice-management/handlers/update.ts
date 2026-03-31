/**
 * Handler for updating invoices (action: 'update').
 */

import { corsHeaders } from '../../_shared/deps.ts';

export async function handleUpdate(
  serviceClient: any,
  tenantId: string,
  invoiceId: string | undefined,
  invoiceData: Record<string, unknown> | undefined
): Promise<Response> {
  if (!invoiceId || !invoiceData) {
    return new Response(
      JSON.stringify({ error: 'Invoice ID and data are required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Verify invoice exists and belongs to this tenant before updating
  const { data: existingInvoice } = await serviceClient
    .from('invoices')
    .select('id, tenant_id')
    .eq('id', invoiceId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (!existingInvoice) {
    return new Response(
      JSON.stringify({ error: 'Invoice not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Recalculate amounts if relevant fields are updated
  const updateData: Record<string, unknown> = { ...invoiceData };
  if (updateData.subtotal !== undefined || updateData.tax !== undefined) {
    const subtotal = updateData.subtotal || 0;
    const tax = updateData.tax || 0;
    updateData.total = (subtotal as number) + (tax as number);
    updateData.amount_due = (updateData.total as number) - ((updateData.amount_paid as number) || 0);
  }

  const { data: updatedInvoice, error: updateError } = await serviceClient
    .from('invoices')
    .update(updateData)
    .eq('id', invoiceId)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (updateError) {
    return new Response(
      JSON.stringify({ error: 'Failed to update invoice', details: updateError.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ success: true, invoice: updatedInvoice }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
