// Edge Function: stripe-webhook
/**
 * Stripe Webhook Handler
 * Processes Stripe events and updates tenant subscriptions + credit subscriptions
 *
 * IDEMPOTENCY: Uses stripe_event_id to prevent duplicate processing
 *
 * Credit Subscription Events:
 * - customer.subscription.updated: Syncs status changes to credit_subscriptions
 * - invoice.paid: Grants recurring credits for active credit subscriptions
 * - invoice.payment_failed: Sets credit_subscriptions to past_due status
 */

import { serve, createClient, corsHeaders } from '../_shared/deps.ts';
import Stripe from 'https://esm.sh/stripe@14.21.0';
import { validateStripeWebhook, type StripeWebhookInput } from './validation.ts';

const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') || '';
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Initialize Stripe for signature verification
const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

serve(async (req) => {
  // Webhooks don't need CORS but we handle OPTIONS for consistency
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get Stripe signature
    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      console.error('[STRIPE-WEBHOOK] Missing stripe-signature header');
      return new Response('Missing signature', { status: 400 });
    }

    const body = await req.text();

    // CRITICAL SECURITY: Verify webhook signature with Stripe
    if (!STRIPE_WEBHOOK_SECRET) {
      console.error('[STRIPE-WEBHOOK] CRITICAL: STRIPE_WEBHOOK_SECRET is not configured!');
      return new Response('Webhook secret not configured', { status: 500 });
    }

    let rawEvent: Stripe.Event;
    try {
      rawEvent = await stripe.webhooks.constructEventAsync(body, signature, STRIPE_WEBHOOK_SECRET);
      console.log('[STRIPE-WEBHOOK] Signature verified successfully for event:', rawEvent.id);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('[STRIPE-WEBHOOK] Signature verification failed:', errMsg);
      return new Response(`Webhook signature verification failed: ${errMsg}`, { status: 400 });
    }

    // Validate event structure
    const event: StripeWebhookInput = validateStripeWebhook(rawEvent);

    // IDEMPOTENCY CHECK: Prevent duplicate webhook processing
    const stripeEventId = rawEvent.id;
    if (stripeEventId) {
      const { data: existingEvent } = await supabase
        .from('subscription_events')
        .select('id')
        .eq('stripe_event_id', stripeEventId)
        .maybeSingle();

      if (existingEvent) {
        console.log('[WEBHOOK_IDEMPOTENCY] Event already processed, skipping:', stripeEventId);
        return new Response(JSON.stringify({ received: true, duplicate: true }), {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        });
      }
    }

    const { type, data } = event;
    const object = data.object;

    // Handle different event types
    switch (type) {
      case 'checkout.session.completed': {
        const tenantId = object.metadata?.tenant_id;
        const checkoutType = object.metadata?.type;

        // Handle credit purchase
        if (checkoutType === 'credit_purchase') {
          const credits = parseInt(String(object.metadata?.credits || '0'), 10);
          const packageSlug = object.metadata?.package_slug;

          if (!tenantId || !credits) {
            console.error('[STRIPE-WEBHOOK] Credit purchase missing data:', { tenantId, credits });
            return new Response('Missing tenant_id or credits', { status: 400 });
          }

          console.log('[STRIPE-WEBHOOK] Processing credit purchase:', { tenantId, credits, packageSlug });

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

          console.log(`[STRIPE-WEBHOOK] Granted ${credits} credits to tenant ${tenantId}`);
          break;
        }

        // Handle credit subscription checkout
        if (checkoutType === 'credit_subscription') {
          const creditsPerPeriod = parseInt(String(object.metadata?.credits_per_period || '0'), 10);
          const periodType = object.metadata?.period_type || 'monthly';
          const packageId = object.metadata?.package_id;
          const userId = object.metadata?.user_id;
          const subscriptionId = object.subscription as string;

          if (!tenantId || !creditsPerPeriod || !subscriptionId) {
            console.error('[STRIPE-WEBHOOK] Credit subscription missing data:', { tenantId, creditsPerPeriod, subscriptionId });
            return new Response('Missing credit subscription data', { status: 400 });
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

          console.log(`[STRIPE-WEBHOOK] Credit subscription created for tenant ${tenantId}: ${creditsPerPeriod} credits/${periodType}`);
          break;
        }

        // Handle subscription checkout (existing logic)
        const planId = object.metadata?.plan_id;
        const billingCycleFromMetadata = object.metadata?.billing_cycle || 'monthly';
        const skipTrialFromMetadata = object.metadata?.skip_trial === 'true';

        if (!tenantId || !planId) {
          return new Response('Missing tenant_id or plan_id', { status: 400 });
        }

        // Look up the plan to get the tier name
        const { data: plan } = await supabase
          .from('subscription_plans')
          .select('name, slug, display_name')
          .eq('id', planId)
          .maybeSingle();

        // Map plan to subscription tier
        let subscriptionTier = 'starter';
        if (plan) {
          const planName = (plan.name || plan.slug || '').toLowerCase().trim();
          if (planName === 'enterprise') {
            subscriptionTier = 'enterprise';
          } else if (planName === 'professional') {
            subscriptionTier = 'professional';
          } else if (planName === 'starter') {
            subscriptionTier = 'starter';
          } else {
            if (planName.includes('enterprise') || planName.includes('499')) {
              subscriptionTier = 'enterprise';
            } else if (planName.includes('professional') || planName.includes('pro') || planName.includes('150')) {
              subscriptionTier = 'professional';
            } else {
              subscriptionTier = 'starter';
            }
          }
        }

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

        console.log('[STRIPE-WEBHOOK] Checkout completed:', {
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

        break;
      }

      case 'customer.subscription.trial_will_end': {
        const tenantId = object.metadata?.tenant_id;

        if (tenantId) {
          await supabase.from('trial_events').insert({
            tenant_id: tenantId,
            event_type: 'trial_ending_soon',
            event_data: {
              subscription_id: object.id,
              trial_end: object.trial_end,
            },
          });
        }

        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const tenantId = object.metadata?.tenant_id;
        const stripeSubId = object.id;

        if (tenantId) {
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

            console.log('[STRIPE-WEBHOOK] Subscription active, synced is_free_tier=false:', { tenantId, status });
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

            console.log('[STRIPE-WEBHOOK] Subscription ended, reverted to free tier:', { tenantId, status });
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

        // --- Credit Subscription Status Sync ---
        // Update credit_subscriptions table if this subscription is a credit subscription
        if (stripeSubId) {
          const { data: creditSub } = await supabase
            .from('credit_subscriptions')
            .select('id, tenant_id, credits_per_period')
            .eq('stripe_subscription_id', stripeSubId)
            .maybeSingle();

          if (creditSub) {
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

            console.log('[STRIPE-WEBHOOK] Credit subscription status updated:', {
              creditSubId: creditSub.id,
              tenantId: creditSub.tenant_id,
              newStatus: creditSubStatus,
              stripeSubId,
            });
          }
        }

        break;
      }

      case 'invoice.paid': {
        // Handle recurring credit grants for credit subscriptions
        const subscriptionId = object.subscription as string | undefined;
        const tenantId = object.metadata?.tenant_id;

        if (subscriptionId) {
          // Check if this invoice belongs to a credit subscription
          const { data: creditSub } = await supabase
            .from('credit_subscriptions')
            .select('id, tenant_id, credits_per_period, period_type, status')
            .eq('stripe_subscription_id', subscriptionId)
            .maybeSingle();

          if (creditSub && creditSub.status === 'active') {
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

            console.log('[STRIPE-WEBHOOK] Recurring credits granted:', {
              tenantId: creditSub.tenant_id,
              credits: creditSub.credits_per_period,
              periodType: creditSub.period_type,
              invoiceId: object.id,
            });
          }
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

        break;
      }

      case 'invoice.payment_succeeded': {
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

        break;
      }

      case 'invoice.payment_failed': {
        const tenantId = object.metadata?.tenant_id;
        const subscriptionId = object.subscription as string | undefined;

        // --- Credit Subscription: Set to past_due ---
        if (subscriptionId) {
          const { data: creditSub } = await supabase
            .from('credit_subscriptions')
            .select('id, tenant_id')
            .eq('stripe_subscription_id', subscriptionId)
            .maybeSingle();

          if (creditSub) {
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

            console.log('[STRIPE-WEBHOOK] Credit subscription set to past_due:', {
              creditSubId: creditSub.id,
              tenantId: creditSub.tenant_id,
              invoiceId: object.id,
            });
          }
        }

        // --- Tenant subscription: Set to past_due with grace period ---
        if (tenantId) {
          const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
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

        break;
      }

      case 'payment_method.attached': {
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

        break;
      }

      case 'payment_method.detached': {
        const customerId = object.customer;

        if (customerId) {
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

        break;
      }

      case 'customer.deleted': {
        const customerId = object.id;
        console.log('[STRIPE-WEBHOOK] Customer deleted:', customerId);

        if (customerId) {
          const { data: tenant } = await supabase
            .from('tenants')
            .select('id')
            .eq('stripe_customer_id', customerId)
            .maybeSingle();

          if (tenant) {
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

            console.log('[STRIPE-WEBHOOK] Tenant reverted to free tier after customer deletion:', tenant.id);
          }
        }

        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Webhook processing failed';
    console.error('[STRIPE-WEBHOOK] Error:', errorMessage, error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
