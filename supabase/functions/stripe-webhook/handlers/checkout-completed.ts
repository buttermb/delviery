/**
 * Handler for checkout.session.completed events.
 *
 * Dispatches to the appropriate sub-handler based on checkout type:
 * - credit_purchase: One-time credit purchase
 * - credit_subscription: Recurring credit subscription checkout
 * - (default): Subscription plan checkout
 */
import type { HandlerContext, HandlerResult } from './types.ts';
import { handlerError } from './types.ts';
import { handleSubscriptionCheckout } from './checkout-subscription.ts';

export async function handleCheckoutCompleted(ctx: HandlerContext): Promise<HandlerResult> {
  const { supabase, stripe, event, stripeEventId } = ctx;
  const object = event.data.object;
  const tenantId = object.metadata?.tenant_id;
  const checkoutType = object.metadata?.type;

  if (checkoutType === 'credit_purchase') {
    return handleCreditPurchase(supabase, object, tenantId);
  }

  if (checkoutType === 'credit_subscription') {
    return handleCreditSubscription(supabase, stripe, object, tenantId);
  }

  return handleSubscriptionCheckout(supabase, stripe, object, tenantId, stripeEventId);
}

// ── Credit Purchase ──────────────────────────────────────────────────────────

async function handleCreditPurchase(
  supabase: HandlerContext['supabase'],
  object: HandlerContext['event']['data']['object'],
  tenantId: string | undefined,
): Promise<HandlerResult> {
  const credits = parseInt(String(object.metadata?.credits || '0'), 10);
  const packageSlug = object.metadata?.package_slug;

  if (!tenantId || !credits) {
    console.error('[STRIPE-WEBHOOK] Credit purchase missing data:', { tenantId, credits });
    return handlerError('Missing tenant_id or credits', 400);
  }

  console.error('[STRIPE-WEBHOOK] Processing credit purchase:', { tenantId, credits, packageSlug });

  // Grant credits to tenant
  await supabase.rpc('purchase_credits', {
    p_tenant_id: tenantId,
    p_amount: credits,
    p_stripe_payment_id: object.payment_intent as string,
  });

  // Track analytics
  await supabase.from('credit_analytics').insert({
    tenant_id: tenantId,
    event_type: 'credits_purchased',
    credits_at_event: credits,
    metadata: {
      package_slug: packageSlug,
      payment_intent: object.payment_intent,
      amount_paid: object.amount_total,
    },
  });

  // Reset warning flags so user gets notified again if they run low
  await supabase
    .from('tenant_credits')
    .update({
      warning_25_sent: false,
      warning_10_sent: false,
      warning_5_sent: false,
      warning_0_sent: false,
    })
    .eq('tenant_id', tenantId);

  console.error(`[STRIPE-WEBHOOK] Granted ${credits} credits to tenant ${tenantId}`);
}

// ── Credit Subscription ──────────────────────────────────────────────────────

async function handleCreditSubscription(
  supabase: HandlerContext['supabase'],
  stripe: HandlerContext['stripe'],
  object: HandlerContext['event']['data']['object'],
  tenantId: string | undefined,
): Promise<HandlerResult> {
  const creditsPerPeriod = parseInt(String(object.metadata?.credits_per_period || '0'), 10);
  const periodType = object.metadata?.period_type || 'monthly';
  const packageId = object.metadata?.package_id;
  const userId = object.metadata?.user_id;
  const subscriptionId = object.subscription as string;

  if (!tenantId || !creditsPerPeriod || !subscriptionId) {
    console.error('[STRIPE-WEBHOOK] Credit subscription missing data:', { tenantId, creditsPerPeriod, subscriptionId });
    return handlerError('Missing credit subscription data', 400);
  }

  // Fetch subscription details from Stripe for period info
  const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
  const periodStart = new Date(stripeSubscription.current_period_start * 1000).toISOString();
  const periodEnd = new Date(stripeSubscription.current_period_end * 1000).toISOString();
  const subStatus = stripeSubscription.status === 'trialing' ? 'trialing' : 'active';

  // Create credit_subscriptions row
  await supabase.from('credit_subscriptions').insert({
    user_id: userId || null,
    tenant_id: tenantId,
    package_id: packageId || null,
    stripe_subscription_id: subscriptionId,
    status: subStatus,
    credits_per_period: creditsPerPeriod,
    period_type: periodType,
    current_period_start: periodStart,
    current_period_end: periodEnd,
    credits_remaining_this_period: creditsPerPeriod,
  });

  // Grant first period credits immediately
  await supabase.rpc('purchase_credits', {
    p_tenant_id: tenantId,
    p_amount: creditsPerPeriod,
    p_stripe_payment_id: subscriptionId,
  });

  // Track analytics
  await supabase.from('credit_analytics').insert({
    tenant_id: tenantId,
    event_type: 'credit_subscription_started',
    credits_at_event: creditsPerPeriod,
    metadata: {
      subscription_id: subscriptionId,
      period_type: periodType,
      package_id: packageId,
    },
  });

  console.error(`[STRIPE-WEBHOOK] Credit subscription created for tenant ${tenantId}: ${creditsPerPeriod} credits/${periodType}`);
}
