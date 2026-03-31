/**
 * Sub-handler for checkout.session.completed when the checkout type
 * is a subscription plan purchase (neither credit_purchase nor credit_subscription).
 */
import type { HandlerContext, HandlerResult } from './types.ts';
import { handlerError } from './types.ts';

export async function handleSubscriptionCheckout(
  supabase: HandlerContext['supabase'],
  stripe: HandlerContext['stripe'],
  object: HandlerContext['event']['data']['object'],
  tenantId: string | undefined,
  stripeEventId: string,
): Promise<HandlerResult> {
  const planId = object.metadata?.plan_id;
  const billingCycleFromMetadata = object.metadata?.billing_cycle || 'monthly';
  const skipTrialFromMetadata = object.metadata?.skip_trial === 'true';

  if (!tenantId || !planId) {
    return handlerError('Missing tenant_id or plan_id', 400);
  }

  // Look up the plan to get the tier name
  const { data: plan } = await supabase
    .from('subscription_plans')
    .select('name, slug, display_name')
    .eq('id', planId)
    .maybeSingle();

  // Map plan to subscription tier
  const subscriptionTier = resolveSubscriptionTier(plan);

  // Check if this is a trial subscription
  const subscriptionId = object.subscription as string;
  let subscriptionStatus = 'active';
  let trialEndsAt = null;
  let paymentMethodAdded = false;
  let billingCycle = billingCycleFromMetadata;

  if (subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    if (subscription.status === 'trialing' && subscription.trial_end) {
      subscriptionStatus = 'trial';
      trialEndsAt = new Date(subscription.trial_end * 1000).toISOString();
    }

    paymentMethodAdded = !!subscription.default_payment_method;

    if (subscription.items?.data?.[0]?.price?.recurring?.interval) {
      const interval = subscription.items.data[0].price.recurring.interval;
      billingCycle = interval === 'year' ? 'yearly' : 'monthly';
    }
  }

  console.error('[STRIPE-WEBHOOK] Checkout completed:', {
    planId,
    planName: plan?.name,
    resolvedTier: subscriptionTier,
    billingCycle,
    subscriptionStatus,
    skipTrial: skipTrialFromMetadata
  });

  // Update tenant subscription
  await supabase
    .from('tenants')
    .update({
      subscription_plan: subscriptionTier,
      subscription_status: subscriptionStatus,
      subscription_starts_at: new Date().toISOString(),
      stripe_subscription_id: subscriptionId,
      trial_ends_at: trialEndsAt,
      trial_started_at: trialEndsAt ? new Date().toISOString() : null,
      payment_method_added: paymentMethodAdded,
      billing_cycle: billingCycle,
      is_free_tier: false,
      credits_enabled: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', tenantId);

  // Sync tenant_credits
  await supabase
    .from('tenant_credits')
    .update({ is_free_tier: false })
    .eq('tenant_id', tenantId);

  // Log subscription event
  await supabase.from('subscription_events').insert({
    tenant_id: tenantId,
    event_type: subscriptionStatus === 'trial' ? 'trial_started' : 'subscription_created',
    stripe_event_id: stripeEventId,
    metadata: {
      plan_id: planId,
      subscription_id: subscriptionId,
      trial_ends_at: trialEndsAt,
      billing_cycle: billingCycle,
      skip_trial: skipTrialFromMetadata,
    },
  });

  // Log trial event if applicable
  if (subscriptionStatus === 'trial') {
    await supabase.from('trial_events').insert({
      tenant_id: tenantId,
      event_type: 'trial_started',
      event_data: {
        plan_id: planId,
        subscription_id: subscriptionId,
        trial_ends_at: trialEndsAt,
        payment_method_added: paymentMethodAdded,
        billing_cycle: billingCycle,
      },
    });
  } else if (skipTrialFromMetadata) {
    await supabase.from('trial_events').insert({
      tenant_id: tenantId,
      event_type: 'immediate_purchase',
      event_data: {
        plan_id: planId,
        subscription_id: subscriptionId,
        billing_cycle: billingCycle,
      },
    });
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function resolveSubscriptionTier(
  plan: { name?: string; slug?: string; display_name?: string } | null,
): string {
  if (!plan) return 'starter';

  const planName = (plan.name || plan.slug || '').toLowerCase().trim();

  if (planName === 'enterprise') return 'enterprise';
  if (planName === 'professional') return 'professional';
  if (planName === 'starter') return 'starter';

  if (planName.includes('enterprise') || planName.includes('499')) return 'enterprise';
  if (planName.includes('professional') || planName.includes('pro') || planName.includes('150')) return 'professional';

  return 'starter';
}
