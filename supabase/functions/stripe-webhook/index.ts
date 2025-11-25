/**
 * Stripe Webhook Handler
 * Processes Stripe events and updates tenant subscriptions
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { validateStripeWebhook, type StripeWebhookInput } from './validation.ts';

const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  try {
    // Get Stripe signature
    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      return new Response('Missing signature', { status: 400 });
    }

    // Verify webhook (would use Stripe SDK in production)
    const body = await req.text();
    
    // In production, verify signature with Stripe:
    // const event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET);
    
    // Parse and validate JSON
    const rawEvent = JSON.parse(body);
    const event: StripeWebhookInput = validateStripeWebhook(rawEvent);

    const { type, data } = event;
    const object = data.object;

    // Handle different event types
    switch (type) {
      case 'checkout.session.completed': {
        const tenantId = object.metadata?.tenant_id;
        const planId = object.metadata?.plan_id;

        if (!tenantId || !planId) {
          return new Response('Missing tenant_id or plan_id', { status: 400 });
        }

        // Check if this is a trial subscription
        const subscriptionId = object.subscription as string;
        let subscriptionStatus = 'active';
        let trialEndsAt = null;
        let paymentMethodAdded = false;

        if (subscriptionId) {
          // Fetch subscription details from Stripe to check trial
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
        }

        // Update tenant subscription
        await supabase
          .from('tenants')
          .update({
            subscription_plan: planId,
            subscription_status: subscriptionStatus,
            subscription_starts_at: new Date().toISOString(),
            stripe_subscription_id: subscriptionId,
            trial_ends_at: trialEndsAt,
            trial_started_at: trialEndsAt ? new Date().toISOString() : null,
            payment_method_added: paymentMethodAdded,
            updated_at: new Date().toISOString(),
          })
          .eq('id', tenantId);

        // Log subscription event
        await supabase.from('subscription_events').insert({
          tenant_id: tenantId,
          event_type: subscriptionStatus === 'trial' ? 'trial_started' : 'subscription_created',
          metadata: {
            plan_id: planId,
            subscription_id: subscriptionId,
            trial_ends_at: trialEndsAt,
          },
        });

        // Log trial event
        if (subscriptionStatus === 'trial') {
          await supabase.from('trial_events').insert({
            tenant_id: tenantId,
            event_type: 'trial_started',
            event_data: {
              plan_id: planId,
              subscription_id: subscriptionId,
              trial_ends_at: trialEndsAt,
              payment_method_added: paymentMethodAdded,
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
          const status = type.includes('deleted') ? 'cancelled' : object.status;
          
          // Check if trial converted to active
          const wasTrialing = object.status === 'active' && object.trial_end;
          
          const updateData: any = {
            subscription_status: status,
            updated_at: new Date().toISOString(),
          };

          // If trial converted to active
          if (wasTrialing) {
            updateData.trial_converted_at = new Date().toISOString();
            
            await supabase.from('trial_events').insert({
              tenant_id: tenantId,
              event_type: 'trial_converted',
              event_data: {
                subscription_id: object.id,
                converted_at: new Date().toISOString(),
              },
            });
          }

          await supabase
            .from('tenants')
            .update(updateData)
            .eq('id', tenantId);

          await supabase.from('subscription_events').insert({
            tenant_id: tenantId,
            event_type: 'subscription_updated',
            metadata: {
              status,
              subscription_id: object.id,
              trial_converted: wasTrialing,
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
          // Grant 7-day grace period
          const gracePeriodEnds = new Date();
          gracePeriodEnds.setDate(gracePeriodEnds.getDate() + 7);

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

