/**
 * Handler for invoice.paid events.
 *
 * Grants recurring credits for active credit subscriptions and logs payment events.
 */
import type { HandlerContext, HandlerResult } from './types.ts';

export async function handleInvoicePaid(ctx: HandlerContext): Promise<HandlerResult> {
  const { supabase, stripe, event, stripeEventId } = ctx;
  const object = event.data.object;
  const subscriptionId = object.subscription as string | undefined;
  const tenantId = object.metadata?.tenant_id;

  if (subscriptionId) {
    await grantRecurringCredits(supabase, stripe, object, subscriptionId);
  }

  // Log general payment success event
  if (tenantId) {
    await supabase.from('subscription_events').insert({
      tenant_id: tenantId,
      event_type: 'payment_succeeded',
      stripe_event_id: stripeEventId,
      metadata: {
        invoice_id: object.id,
        amount: object.amount_paid,
        subscription_id: subscriptionId,
      },
    });
  }
}

// ── Recurring Credit Grant ───────────────────────────────────────────────────

async function grantRecurringCredits(
  supabase: HandlerContext['supabase'],
  stripe: HandlerContext['stripe'],
  object: HandlerContext['event']['data']['object'],
  subscriptionId: string,
): Promise<void> {
  // Check if this invoice belongs to a credit subscription
  const { data: creditSub } = await supabase
    .from('credit_subscriptions')
    .select('id, tenant_id, credits_per_period, period_type, status')
    .eq('stripe_subscription_id', subscriptionId)
    .maybeSingle();

  if (!creditSub || creditSub.status !== 'active') return;

  // Fetch subscription from Stripe for updated period info
  const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
  const periodStart = new Date(stripeSubscription.current_period_start * 1000).toISOString();
  const periodEnd = new Date(stripeSubscription.current_period_end * 1000).toISOString();

  // Grant credits for this billing period
  await supabase.rpc('purchase_credits', {
    p_tenant_id: creditSub.tenant_id,
    p_amount: creditSub.credits_per_period,
    p_stripe_payment_id: object.id as string, // invoice ID as reference
  });

  // Update credit subscription period info and reset remaining credits
  await supabase
    .from('credit_subscriptions')
    .update({
      current_period_start: periodStart,
      current_period_end: periodEnd,
      credits_remaining_this_period: creditSub.credits_per_period,
      status: 'active', // Restore to active if was past_due
    })
    .eq('id', creditSub.id);

  // Reset warning flags
  await supabase
    .from('tenant_credits')
    .update({
      warning_25_sent: false,
      warning_10_sent: false,
      warning_5_sent: false,
      warning_0_sent: false,
    })
    .eq('tenant_id', creditSub.tenant_id);

  // Track analytics
  await supabase.from('credit_analytics').insert({
    tenant_id: creditSub.tenant_id,
    event_type: 'credit_subscription_renewed',
    credits_at_event: creditSub.credits_per_period,
    metadata: {
      subscription_id: subscriptionId,
      invoice_id: object.id,
      period_start: periodStart,
      period_end: periodEnd,
      period_type: creditSub.period_type,
    },
  });

  console.error('[STRIPE-WEBHOOK] Recurring credits granted:', {
    tenantId: creditSub.tenant_id,
    credits: creditSub.credits_per_period,
    periodType: creditSub.period_type,
    invoiceId: object.id,
  });
}
