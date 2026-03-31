/**
 * Handlers for payment_method.attached and payment_method.detached events.
 *
 * Tracks whether a tenant has a payment method on file.
 */
import type { HandlerContext, HandlerResult } from './types.ts';

export async function handlePaymentMethodAttached(ctx: HandlerContext): Promise<HandlerResult> {
  const { supabase, event } = ctx;
  const object = event.data.object;
  const customerId = object.customer;

  if (customerId) {
    await supabase
      .from('tenants')
      .update({
        payment_method_added: true,
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_customer_id', customerId);
  }
}

export async function handlePaymentMethodDetached(ctx: HandlerContext): Promise<HandlerResult> {
  const { supabase, event } = ctx;
  const object = event.data.object;
  const customerId = object.customer;

  if (!customerId) return;

  await supabase
    .from('tenants')
    .update({
      payment_method_added: false,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_customer_id', customerId);

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();

  if (tenant) {
    await supabase.from('trial_events').insert({
      tenant_id: tenant.id,
      event_type: 'payment_method_removed',
      event_data: {
        payment_method_id: object.id,
      },
    });
  }
}
