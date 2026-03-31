/**
 * Handler for customer.subscription.updated and customer.subscription.deleted events.
 *
 * Updates tenant subscription status and syncs credit subscription status.
 */
import type { HandlerContext, HandlerResult } from './types.ts';

export async function handleSubscriptionChange(ctx: HandlerContext): Promise<HandlerResult> {
  const { supabase, event, stripeEventId } = ctx;
  const { type, data } = event;
  const object = data.object;
  const tenantId = object.metadata?.tenant_id;
  const stripeSubId = object.id;

  if (tenantId) {
    await updateTenantSubscription(supabase, type, object, tenantId, stripeSubId, stripeEventId);
  }

  // --- Credit Subscription Status Sync ---
  if (stripeSubId) {
    await syncCreditSubscription(supabase, type, object, stripeSubId);
  }
}

// ── Tenant Subscription Update ───────────────────────────────────────────────

async function updateTenantSubscription(
  supabase: HandlerContext['supabase'],
  type: string,
  object: HandlerContext['event']['data']['object'],
  tenantId: string,
  stripeSubId: string | undefined,
  stripeEventId: string,
): Promise<void> {
  const isDeleted = type.includes('deleted');
  const normalizedStatus = object.status === 'canceled' ? 'cancelled' : object.status;
  const status = isDeleted ? 'cancelled' : normalizedStatus;

  // Check if trial converted to active
  const wasTrialing = object.status === 'active' && object.trial_end;

  const updateData: Record<string, unknown> = {
    subscription_status: status,
    updated_at: new Date().toISOString(),
  };

  if (wasTrialing || status === 'active') {
    if (wasTrialing) {
      updateData.trial_converted_at = new Date().toISOString();
    }
    updateData.is_free_tier = false;
    updateData.credits_enabled = false;

    await supabase
      .from('tenant_credits')
      .update({ is_free_tier: false })
      .eq('tenant_id', tenantId);

    if (wasTrialing) {
      await supabase.from('trial_events').insert({
        tenant_id: tenantId,
        event_type: 'trial_converted',
        event_data: {
          subscription_id: stripeSubId,
          converted_at: new Date().toISOString(),
        },
      });
    }

    console.error('[STRIPE-WEBHOOK] Subscription active, synced is_free_tier=false:', { tenantId, status });
  }

  // If subscription is cancelled or deleted, revert to free tier
  if (isDeleted || status === 'cancelled' || status === 'unpaid') {
    updateData.is_free_tier = true;
    updateData.credits_enabled = true;

    await supabase.rpc('grant_free_credits', {
      p_tenant_id: tenantId,
      p_amount: 10000,
    });

    await supabase
      .from('tenant_credits')
      .update({ is_free_tier: true })
      .eq('tenant_id', tenantId);

    console.error('[STRIPE-WEBHOOK] Subscription ended, reverted to free tier:', { tenantId, status });
  }

  await supabase
    .from('tenants')
    .update(updateData)
    .eq('id', tenantId);

  await supabase.from('subscription_events').insert({
    tenant_id: tenantId,
    event_type: 'subscription_updated',
    stripe_event_id: stripeEventId,
    metadata: {
      status,
      subscription_id: stripeSubId,
      trial_converted: wasTrialing,
      reverted_to_free_tier: isDeleted || status === 'cancelled',
    },
  });
}

// ── Credit Subscription Sync ─────────────────────────────────────────────────

async function syncCreditSubscription(
  supabase: HandlerContext['supabase'],
  type: string,
  object: HandlerContext['event']['data']['object'],
  stripeSubId: string,
): Promise<void> {
  const { data: creditSub } = await supabase
    .from('credit_subscriptions')
    .select('id, tenant_id, credits_per_period')
    .eq('stripe_subscription_id', stripeSubId)
    .maybeSingle();

  if (!creditSub) return;

  const isDeleted = type.includes('deleted');
  const normalizedCreditStatus = object.status === 'canceled' ? 'cancelled' : object.status;

  // Map Stripe status to our allowed statuses
  let creditSubStatus: string;
  if (isDeleted) {
    creditSubStatus = 'cancelled';
  } else if (['active', 'past_due', 'trialing'].includes(normalizedCreditStatus || '')) {
    creditSubStatus = normalizedCreditStatus || 'active';
  } else if (normalizedCreditStatus === 'cancelled' || normalizedCreditStatus === 'canceled') {
    creditSubStatus = 'cancelled';
  } else if (normalizedCreditStatus === 'paused') {
    creditSubStatus = 'paused';
  } else {
    creditSubStatus = 'cancelled';
  }

  const creditSubUpdate: Record<string, unknown> = {
    status: creditSubStatus,
  };

  // If cancelled, record the cancellation time
  if (creditSubStatus === 'cancelled') {
    creditSubUpdate.cancelled_at = new Date().toISOString();
  }

  // If subscription has cancel_at_period_end flag
  if (object.cancel_at_period_end !== undefined) {
    creditSubUpdate.cancel_at_period_end = object.cancel_at_period_end;
  }

  // Update period info if available from the subscription object
  if (object.current_period_start) {
    creditSubUpdate.current_period_start = new Date(
      (object.current_period_start as number) * 1000
    ).toISOString();
  }
  if (object.current_period_end) {
    creditSubUpdate.current_period_end = new Date(
      (object.current_period_end as number) * 1000
    ).toISOString();
  }

  await supabase
    .from('credit_subscriptions')
    .update(creditSubUpdate)
    .eq('id', creditSub.id);

  console.error('[STRIPE-WEBHOOK] Credit subscription status updated:', {
    creditSubId: creditSub.id,
    tenantId: creditSub.tenant_id,
    newStatus: creditSubStatus,
    stripeSubId,
  });
}
