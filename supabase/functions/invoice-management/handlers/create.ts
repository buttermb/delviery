/**
 * Handler for creating invoices (action: 'create').
 */

import { corsHeaders } from '../../_shared/deps.ts';
import { checkCreditsAvailable, CREDIT_ACTIONS } from '../../_shared/creditGate.ts';

export async function handleCreate(
  serviceClient: any,
  tenantId: string,
  invoiceData: Record<string, unknown> | undefined
): Promise<Response> {
  if (!invoiceData) {
    return new Response(
      JSON.stringify({ error: 'Invoice data is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check and consume credits for free tier users
  const creditCheck = await checkCreditsAvailable(serviceClient, tenantId, CREDIT_ACTIONS.INVOICE_CREATE);
  if (creditCheck.isFreeTier && !creditCheck.hasCredits) {
    return new Response(
      JSON.stringify({
        error: 'Insufficient credits',
        code: 'INSUFFICIENT_CREDITS',
        message: 'You do not have enough credits to create an invoice',
        creditsRequired: creditCheck.cost,
        currentBalance: creditCheck.balance,
      }),
      { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Consume credits if on free tier
  if (creditCheck.isFreeTier) {
    await serviceClient.rpc('consume_credits', {
      p_tenant_id: tenantId,
      p_action_key: CREDIT_ACTIONS.INVOICE_CREATE,
      p_reference_type: 'invoice',
      p_description: 'Invoice creation',
    });
  }

  // Generate invoice number via robust DB generator (fallback to timestamp if RPC fails)
  let invoiceNumber: string | undefined = invoiceData.invoice_number as string | undefined;
  const fallbackInvoiceNumber = () => `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  if (!invoiceNumber) {
    try {
      const { data: gen, error: genErr } = await serviceClient.rpc('generate_invoice_number', { tenant_id: tenantId });
      if (!genErr && typeof gen === 'string' && gen.trim()) {
        invoiceNumber = gen.trim();
      } else {
        invoiceNumber = fallbackInvoiceNumber();
      }
    } catch (_e) {
      invoiceNumber = fallbackInvoiceNumber();
    }
  }

  // Calculate amounts if not provided
  const subtotal = (invoiceData.subtotal as number) || 0;
  const tax = (invoiceData.tax as number) || 0;
  const total = (invoiceData.total as number) || (subtotal + tax);
  const amountDue = total - ((invoiceData.amount_paid as number) || 0);

  let createdInvoice: Record<string, unknown> | null = null;
  let lastError: { message: string; code?: string } | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    const newInvoice = {
      tenant_id: tenantId,
      invoice_number: invoiceNumber,
      subtotal,
      tax,
      total,
      amount_paid: (invoiceData.amount_paid as number) || 0,
      amount_due: amountDue,
      line_items: invoiceData.line_items || [],
      billing_period_start: invoiceData.billing_period_start || null,
      billing_period_end: invoiceData.billing_period_end || null,
      issue_date: invoiceData.issue_date || new Date().toISOString().split('T')[0],
      due_date: invoiceData.due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: invoiceData.status || 'draft',
      stripe_invoice_id: invoiceData.stripe_invoice_id || null,
      stripe_payment_intent_id: invoiceData.stripe_payment_intent_id || null,
    };

    const { data, error } = await serviceClient
      .from('invoices')
      .insert(newInvoice)
      .select()
      .single();

    if (!error) {
      createdInvoice = data;
      lastError = null;
      break;
    }

    lastError = error;
    const code = error?.code || '';
    const msg = error?.message || '';
    const isUnique = code === '23505' || /duplicate key value|unique constraint/i.test(msg);

    if (attempt === 0 && isUnique) {
      // Retry once with a freshly generated number
      try {
        const { data: gen2, error: genErr2 } = await serviceClient.rpc('generate_invoice_number', { tenant_id: tenantId });
        if (!genErr2 && typeof gen2 === 'string' && gen2.trim()) {
          invoiceNumber = gen2.trim();
        } else {
          invoiceNumber = fallbackInvoiceNumber();
        }
      } catch (_e) {
        invoiceNumber = fallbackInvoiceNumber();
      }
      continue;
    } else {
      break;
    }
  }

  if (lastError) {
    return new Response(
      JSON.stringify({ error: 'Failed to create invoice', details: lastError.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ success: true, invoice: createdInvoice }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
