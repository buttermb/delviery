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

    console.log('Stripe webhook event:', event.type);

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

        // Update tenant subscription
        await supabase
          .from('tenants')
          .update({
            subscription_plan: planId,
            subscription_status: 'active',
            subscription_starts_at: new Date().toISOString(),
            stripe_subscription_id: object.subscription,
            updated_at: new Date().toISOString(),
          })
          .eq('id', tenantId);

        // Log subscription event
        await supabase.from('subscription_events').insert({
          tenant_id: tenantId,
          event_type: 'subscription_created',
          metadata: {
            plan_id: planId,
            subscription_id: object.subscription,
          },
        });

        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const tenantId = object.metadata?.tenant_id;

        if (tenantId) {
          const status = type.includes('deleted') ? 'cancelled' : object.status;

          await supabase
            .from('tenants')
            .update({
              subscription_status: status,
              updated_at: new Date().toISOString(),
            })
            .eq('id', tenantId);

          await supabase.from('subscription_events').insert({
            tenant_id: tenantId,
            event_type: 'subscription_updated',
            metadata: {
              status,
              subscription_id: object.id,
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
          await supabase
            .from('tenants')
            .update({
              subscription_status: 'past_due',
              updated_at: new Date().toISOString(),
            })
            .eq('id', tenantId);

          await supabase.from('subscription_events').insert({
            tenant_id: tenantId,
            event_type: 'payment_failed',
            metadata: {
              invoice_id: object.id,
            },
          });
        }

        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

