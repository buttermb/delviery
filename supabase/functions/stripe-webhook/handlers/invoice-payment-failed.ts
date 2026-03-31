/**
 * Handler for invoice.payment_failed events.
 *
 * Sets credit subscriptions to past_due and applies grace period to tenant subscriptions.
 */
import type { HandlerContext, HandlerResult } from './types.ts';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export async function handleInvoicePaymentFailed(ctx: HandlerContext): Promise<HandlerResult> {
  const { supabase, event, stripeEventId } = ctx;
  const object = event.data.object;
  const tenantId = object.metadata?.tenant_id;
  const subscriptionId = object.subscription as string | undefined;

  // --- Credit Subscription: Set to past_due ---
  if (subscriptionId) {
    await setCreditSubscriptionPastDue(supabase, subscriptionId, object);
  }

  // --- Tenant subscription: Set to past_due with grace period ---
  if (tenantId) {
    await setTenantPastDue(supabase, tenantId, subscriptionId, object, stripeEventId);
  }
}

// ── Credit Subscription past_due ─────────────────────────────────────────────

async function setCreditSubscriptionPastDue(
  supabase: HandlerContext['supabase'],
  subscriptionId: string,
  object: HandlerContext['event']['data']['object'],
): Promise<void> {
  const { data: creditSub } = await supabase
    .from('credit_subscriptions')
    .select('id, tenant_id')
    .eq('stripe_subscription_id', subscriptionId)
    .maybeSingle();

  if (!creditSub) return;

  await supabase
    .from('credit_subscriptions')
    .update({ status: 'past_due' })
    .eq('id', creditSub.id);

  // Track analytics
  await supabase.from('credit_analytics').insert({
    tenant_id: creditSub.tenant_id,
    event_type: 'credit_subscription_payment_failed',
    metadata: {
      subscription_id: subscriptionId,
      invoice_id: object.id,
    },
  });

  console.error('[STRIPE-WEBHOOK] Credit subscription set to past_due:', {
    creditSubId: creditSub.id,
    tenantId: creditSub.tenant_id,
    invoiceId: object.id,
  });
}

// ── Tenant past_due with grace period ────────────────────────────────────────

async function setTenantPastDue(
  supabase: HandlerContext['supabase'],
  tenantId: string,
  subscriptionId: string | undefined,
  object: HandlerContext['event']['data']['object'],
  stripeEventId: string,
): Promise<void> {
  const gracePeriodEnds = new Date(Date.now() + SEVEN_DAYS_MS);

  await supabase
    .from('tenants')
    .update({
      subscription_status: 'past_due',
      grace_period_ends_at: gracePeriodEnds.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', tenantId);

  await supabase.from('subscription_events').insert({
    tenant_id: tenantId,
    event_type: 'payment_failed',
    stripe_event_id: stripeEventId,
    metadata: {
      invoice_id: object.id,
      grace_period_ends_at: gracePeriodEnds.toISOString(),
      subscription_id: subscriptionId,
    },
  });

  await supabase.from('trial_events').insert({
    tenant_id: tenantId,
    event_type: 'payment_failed_grace_period',
    event_data: {
      invoice_id: object.id,
      grace_period_ends_at: gracePeriodEnds.toISOString(),
    },
  });
}
