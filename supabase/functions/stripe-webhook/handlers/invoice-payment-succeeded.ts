/**
 * Handler for invoice.payment_succeeded events.
 *
 * Logs payment success to subscription_events.
 */
import type { HandlerContext, HandlerResult } from './types.ts';

export async function handleInvoicePaymentSucceeded(ctx: HandlerContext): Promise<HandlerResult> {
  const { supabase, event, stripeEventId } = ctx;
  const object = event.data.object;
  const tenantId = object.metadata?.tenant_id;

  if (tenantId) {
    await supabase.from('subscription_events').insert({
      tenant_id: tenantId,
      event_type: 'payment_succeeded',
      stripe_event_id: stripeEventId,
      metadata: {
        invoice_id: object.id,
        amount: object.amount_paid,
      },
    });
  }
}
