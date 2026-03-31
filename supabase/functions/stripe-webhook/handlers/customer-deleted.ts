/**
 * Handler for customer.deleted events.
 *
 * Reverts tenant to free tier and cancels all active credit subscriptions
 * when a Stripe customer is deleted.
 */
import type { HandlerContext, HandlerResult } from './types.ts';

export async function handleCustomerDeleted(ctx: HandlerContext): Promise<HandlerResult> {
  const { supabase, event, stripeEventId } = ctx;
  const object = event.data.object;
  const customerId = object.id;
  console.error('[STRIPE-WEBHOOK] Customer deleted:', customerId);

  if (!customerId) return;

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();

  if (!tenant) return;

  // Revert to free tier and clear Stripe references
  await supabase
    .from('tenants')
    .update({
      stripe_customer_id: null,
      stripe_subscription_id: null,
      subscription_status: 'cancelled',
      is_free_tier: true,
      credits_enabled: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', tenant.id);

  await supabase
    .from('tenant_credits')
    .update({ is_free_tier: true })
    .eq('tenant_id', tenant.id);

  // Cancel any active credit subscriptions for this tenant
  await supabase
    .from('credit_subscriptions')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenant.id)
    .in('status', ['active', 'trialing', 'past_due']);

  await supabase.from('subscription_events').insert({
    tenant_id: tenant.id,
    event_type: 'customer_deleted',
    stripe_event_id: stripeEventId,
    metadata: {
      stripe_customer_id: customerId,
      reverted_to_free_tier: true,
    },
  });

  console.error('[STRIPE-WEBHOOK] Tenant reverted to free tier after customer deletion:', tenant.id);
}
