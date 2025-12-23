// @ts-nocheck
/**
 * Stripe Webhook Handler
 * Processes Stripe events and updates tenant subscriptions
 * 
 * IDEMPOTENCY: Uses stripe_event_id to prevent duplicate processing
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
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
  try {
    // Get Stripe signature
    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      console.error('[STRIPE-WEBHOOK] Missing stripe-signature header');
      return new Response('Missing signature', { status: 400 });
    }

    const body = await req.text();

    // CRITICAL SECURITY: Verify webhook signature with Stripe
    let rawEvent: any;
    if (STRIPE_WEBHOOK_SECRET) {
      try {
        rawEvent = await stripe.webhooks.constructEventAsync(body, signature, STRIPE_WEBHOOK_SECRET);
        console.log('[STRIPE-WEBHOOK] Signature verified successfully for event:', rawEvent.id);
      } catch (err: any) {
        console.error('[STRIPE-WEBHOOK] Signature verification failed:', err.message);
        return new Response(`Webhook signature verification failed: ${err.message}`, { status: 400 });
      }
    } else {
      // Fallback for development without webhook secret (log warning)
      console.warn('[STRIPE-WEBHOOK] WARNING: No STRIPE_WEBHOOK_SECRET configured - signature verification skipped!');
      rawEvent = JSON.parse(body);
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
          const credits = parseInt(object.metadata?.credits || '0', 10);
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

        // Handle subscription checkout
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
        // Plan names in DB are: 'starter', 'professional', 'enterprise'
        // We need to ensure we save one of these exact values
        let subscriptionTier = 'starter'; // default
        if (plan) {
          const planName = (plan.name || plan.slug || '').toLowerCase().trim();
          
          // Exact match first
          if (planName === 'enterprise') {
            subscriptionTier = 'enterprise';
          } else if (planName === 'professional') {
            subscriptionTier = 'professional';
          } else if (planName === 'starter') {
            subscriptionTier = 'starter';
          } else {
            // Fallback: check for partial matches (for legacy/custom plan names)
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
          // Fetch subscription details from Stripe to check trial and billing interval
          const Stripe = (await import('https://esm.sh/stripe@14.21.0')).default;
          const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
            apiVersion: '2023-10-16',
          });
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          
          if (subscription.status === 'trialing' && subscription.trial_end) {
            subscriptionStatus = 'trial';
            trialEndsAt = new Date(subscription.trial_end * 1000).toISOString();
          }
          
          // Check if payment method was added
          paymentMethodAdded = !!subscription.default_payment_method;

          // Get billing interval from subscription items
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

        // Update tenant subscription with the TIER NAME and billing cycle
        // CRITICAL: Set is_free_tier = false when subscribing to a paid plan
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
            is_free_tier: false, // Switch off free tier when subscribing
            credits_enabled: false, // Disable credit consumption for paid users
            updated_at: new Date().toISOString(),
          })
          .eq('id', tenantId);

        // ALSO update tenant_credits to keep is_free_tier in sync
        await supabase
          .from('tenant_credits')
          .update({ is_free_tier: false })
          .eq('tenant_id', tenantId);

        // Log subscription event with stripe_event_id for idempotency
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
          // Log immediate purchase event
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

        if (tenantId) {
          const isDeleted = type.includes('deleted');
          // Normalize status: Stripe uses 'canceled', we use 'cancelled'
          const normalizedStatus = object.status === 'canceled' ? 'cancelled' : object.status;
          const status = isDeleted ? 'cancelled' : normalizedStatus;
          
          // Check if trial converted to active
          const wasTrialing = object.status === 'active' && object.trial_end;
          
          const updateData: any = {
            subscription_status: status,
            updated_at: new Date().toISOString(),
          };

          // If trial converted to active OR status becomes active - ensure is_free_tier stays false
          if (wasTrialing || status === 'active') {
            if (wasTrialing) {
              updateData.trial_converted_at = new Date().toISOString();
            }
            updateData.is_free_tier = false;
            updateData.credits_enabled = false;
            
            // SYNC: Also update tenant_credits when becoming active
            await supabase
              .from('tenant_credits')
              .update({ is_free_tier: false })
              .eq('tenant_id', tenantId);
            
            if (wasTrialing) {
              await supabase.from('trial_events').insert({
                tenant_id: tenantId,
                event_type: 'trial_converted',
                event_data: {
                  subscription_id: object.id,
                  converted_at: new Date().toISOString(),
                },
              });
            }
            
            console.log('[STRIPE-WEBHOOK] Subscription active, synced is_free_tier=false:', { tenantId, status });
          }

          // If subscription is cancelled or deleted, revert to free tier
          // This allows them to continue using the platform with credits
          if (isDeleted || status === 'cancelled' || status === 'unpaid') {
            updateData.is_free_tier = true;
            updateData.credits_enabled = true;
            
            // Grant them free credits when reverting to free tier
            await supabase.rpc('grant_free_credits', {
              p_tenant_id: tenantId,
              p_amount: 10000,
            });

            // ALSO update tenant_credits to keep is_free_tier in sync
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
              subscription_id: object.id,
              trial_converted: wasTrialing,
              reverted_to_free_tier: isDeleted || status === 'cancelled',
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

        if (tenantId) {
          // Grant 7-day grace period - FIXED: Use milliseconds for exact 7 days (avoids DST issues)
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
            
          // Log warning event
          const { data: tenant } = await supabase
            .from('tenants')
            .select('id')
            .eq('stripe_customer_id', customerId)
            .single();
            
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
        // Handle Stripe customer deletion - clean up tenant data
        const customerId = object.id;
        console.log('[STRIPE-WEBHOOK] Customer deleted:', customerId);

        if (customerId) {
          // Find the tenant with this Stripe customer ID
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

            // Sync tenant_credits table
            await supabase
              .from('tenant_credits')
              .update({ is_free_tier: true })
              .eq('tenant_id', tenant.id);

            // Log the event
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
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : 'Webhook processing failed';
    console.error('Webhook error:', errorMessage, error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

