// Edge Function: stripe-webhook
/**
 * Stripe Webhook Router
 *
 * Handles CORS, verifies Stripe signature, checks idempotency,
 * then dispatches to the appropriate event handler.
 *
 * Event handlers live in ./handlers/ — one file per event type (or group).
 */

import { serve, createClient, corsHeaders } from '../_shared/deps.ts';
import { Stripe, STRIPE_API_VERSION } from '../_shared/stripe.ts';
import { validateStripeWebhook } from './validation.ts';
import type { HandlerContext } from './handlers/types.ts';
import { isHandlerError } from './handlers/types.ts';

// ── Handler imports ──────────────────────────────────────────────────────────
import { handleCheckoutCompleted } from './handlers/checkout-completed.ts';
import { handleTrialWillEnd } from './handlers/trial-will-end.ts';
import { handleSubscriptionChange } from './handlers/subscription-updated.ts';
import { handleInvoicePaid } from './handlers/invoice-paid.ts';
import { handleInvoicePaymentSucceeded } from './handlers/invoice-payment-succeeded.ts';
import { handleInvoicePaymentFailed } from './handlers/invoice-payment-failed.ts';
import { handlePaymentMethodAttached, handlePaymentMethodDetached } from './handlers/payment-method.ts';
import { handleCustomerDeleted } from './handlers/customer-deleted.ts';

// ── Environment & clients ────────────────────────────────────────────────────
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') || '';
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: STRIPE_API_VERSION });

// ── Event type → handler mapping ─────────────────────────────────────────────
type EventHandler = (ctx: HandlerContext) => Promise<void | { message: string; status: number }>;

const EVENT_HANDLERS: Record<string, EventHandler> = {
  'checkout.session.completed': handleCheckoutCompleted,
  'customer.subscription.trial_will_end': handleTrialWillEnd,
  'customer.subscription.updated': handleSubscriptionChange,
  'customer.subscription.deleted': handleSubscriptionChange,
  'invoice.paid': handleInvoicePaid,
  'invoice.payment_succeeded': handleInvoicePaymentSucceeded,
  'invoice.payment_failed': handleInvoicePaymentFailed,
  'payment_method.attached': handlePaymentMethodAttached,
  'payment_method.detached': handlePaymentMethodDetached,
  'customer.deleted': handleCustomerDeleted,
};

// ── Main server ──────────────────────────────────────────────────────────────
serve(async (req) => {
  // Webhooks don't need CORS but we handle OPTIONS for consistency
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── Signature verification ─────────────────────────────────────────────
    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      console.error('[STRIPE-WEBHOOK] Missing stripe-signature header');
      return new Response('Missing signature', { status: 400 });
    }

    const body = await req.text();

    if (!STRIPE_WEBHOOK_SECRET) {
      console.error('[STRIPE-WEBHOOK] CRITICAL: STRIPE_WEBHOOK_SECRET is not configured!');
      return new Response('Webhook secret not configured', { status: 500 });
    }

    let rawEvent: Stripe.Event;
    try {
      rawEvent = await stripe.webhooks.constructEventAsync(body, signature, STRIPE_WEBHOOK_SECRET);
      console.error('[STRIPE-WEBHOOK] Signature verified successfully for event:', rawEvent.id);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('[STRIPE-WEBHOOK] Signature verification failed:', errMsg);
      return new Response(`Webhook signature verification failed: ${errMsg}`, { status: 400 });
    }

    // ── Validate event structure ───────────────────────────────────────────
    const event = validateStripeWebhook(rawEvent);

    // ── Idempotency check ──────────────────────────────────────────────────
    const stripeEventId = rawEvent.id;
    if (stripeEventId) {
      const { error: idempotencyError } = await supabase
        .from('webhook_idempotency')
        .insert({ stripe_event_id: stripeEventId })
        .select('id')
        .maybeSingle();

      if (idempotencyError && idempotencyError.code === '23505') {
        console.error('[WEBHOOK_IDEMPOTENCY] Event already processed, skipping:', stripeEventId);
        return new Response(JSON.stringify({ received: true, duplicate: true }), {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      if (idempotencyError) {
        console.error('[WEBHOOK_IDEMPOTENCY] Unexpected DB error:', idempotencyError);
        return new Response(JSON.stringify({ error: 'Idempotency check failed' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 500,
        });
      }
    }

    // ── Route to handler ───────────────────────────────────────────────────
    const handler = EVENT_HANDLERS[event.type];
    if (handler) {
      const ctx: HandlerContext = { supabase, stripe, event, stripeEventId };
      const result = await handler(ctx);

      if (isHandlerError(result)) {
        return new Response(result.message, { status: result.status });
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
