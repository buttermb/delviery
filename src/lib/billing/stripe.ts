/**
 * Stripe Billing Integration
 * Handles subscription management, payments, and webhooks
 */

import { supabase } from '@/integrations/supabase/client';

// Stripe configuration (should be in env)
const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';
const STRIPE_API_URL = '/api/stripe'; // Proxy to backend

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  interval: 'month' | 'year';
  features: string[];
  limits: {
    customers: number;
    menus: number;
    products: number;
    locations: number;
    users: number;
  };
}

/**
 * Initialize Stripe checkout session for subscription
 */
export async function createCheckoutSession(
  tenantId: string,
  planId: 'starter' | 'professional' | 'enterprise',
  successUrl: string,
  cancelUrl: string
): Promise<{ sessionId: string; url: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('create-checkout-session', {
      body: {
        tenant_id: tenantId,
        plan_id: planId,
        success_url: successUrl,
        cancel_url: cancelUrl,
      },
    });

    if (error) throw error;

    return {
      sessionId: data.session_id,
      url: data.url,
    };
  } catch (error: any) {
    console.error('Failed to create checkout session:', error);
    throw error;
  }
}

/**
 * Create or update Stripe customer for tenant
 */
export async function createStripeCustomer(tenantId: string): Promise<string> {
  try {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('business_name, owner_email')
      .eq('id', tenantId)
      .single();

    if (!tenant) throw new Error('Tenant not found');

    const { data, error } = await supabase.functions.invoke('create-stripe-customer', {
      body: {
        tenant_id: tenantId,
        name: tenant.business_name,
        email: tenant.owner_email,
      },
    });

    if (error) throw error;

    // Update tenant with Stripe customer ID
    await supabase
      .from('tenants')
      .update({ stripe_customer_id: data.customer_id })
      .eq('id', tenantId);

    return data.customer_id;
  } catch (error: any) {
    console.error('Failed to create Stripe customer:', error);
    throw error;
  }
}

/**
 * Start trial period for new tenant
 */
export async function startTrial(tenantId: string): Promise<void> {
  try {
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 14); // 14-day trial

    await supabase
      .from('tenants')
      .update({
        subscription_status: 'trialing',
        trial_ends_at: trialEndDate.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', tenantId);

    // Log subscription event
    await supabase.from('subscription_events').insert({
      tenant_id: tenantId,
      event_type: 'trial_started',
      metadata: {
        trial_ends_at: trialEndDate.toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Failed to start trial:', error);
    throw error;
  }
}

/**
 * Handle Stripe webhook event (called by backend)
 */
export async function handleStripeWebhook(
  event: {
    type: string;
    data: {
      object: any;
    };
  }
): Promise<void> {
  try {
    const { type, data } = event;
    const object = data.object;

    switch (type) {
      case 'checkout.session.completed': {
        const tenantId = object.metadata?.tenant_id;
        const planId = object.metadata?.plan_id;

        if (!tenantId || !planId) return;

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

        // Log event
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

        if (!tenantId) return;

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

        break;
      }

      case 'invoice.payment_succeeded': {
        const tenantId = object.metadata?.tenant_id;

        if (!tenantId) return;

        await supabase.from('subscription_events').insert({
          tenant_id: tenantId,
          event_type: 'payment_succeeded',
          metadata: {
            invoice_id: object.id,
            amount: object.amount_paid,
          },
        });

        break;
      }

      case 'invoice.payment_failed': {
        const tenantId = object.metadata?.tenant_id;

        if (!tenantId) return;

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

        break;
      }
    }
  } catch (error: any) {
    console.error('Failed to handle Stripe webhook:', error);
    throw error;
  }
}

/**
 * Change subscription plan
 */
export async function changePlan(
  tenantId: string,
  newPlanId: 'starter' | 'professional' | 'enterprise'
): Promise<void> {
  try {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('stripe_subscription_id')
      .eq('id', tenantId)
      .single();

    if (!tenant?.stripe_subscription_id) {
      throw new Error('No active subscription found');
    }

    const { error } = await supabase.functions.invoke('change-subscription-plan', {
      body: {
        tenant_id: tenantId,
        subscription_id: tenant.stripe_subscription_id,
        new_plan_id: newPlanId,
      },
    });

    if (error) throw error;

    // Log event
    await supabase.from('subscription_events').insert({
      tenant_id: tenantId,
      event_type: 'plan_changed',
      metadata: {
        new_plan_id: newPlanId,
      },
    });
  } catch (error: any) {
    console.error('Failed to change plan:', error);
    throw error;
  }
}

/**
 * Cancel subscription
 */
export async function cancelSubscription(
  tenantId: string,
  immediately: boolean = false
): Promise<void> {
  try {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('stripe_subscription_id')
      .eq('id', tenantId)
      .single();

    if (!tenant?.stripe_subscription_id) {
      throw new Error('No active subscription found');
    }

    const { error } = await supabase.functions.invoke('cancel-subscription', {
      body: {
        tenant_id: tenantId,
        subscription_id: tenant.stripe_subscription_id,
        immediately,
      },
    });

    if (error) throw error;

    // Update tenant status
    await supabase
      .from('tenants')
      .update({
        subscription_status: immediately ? 'cancelled' : 'cancelling',
        updated_at: new Date().toISOString(),
      })
      .eq('id', tenantId);

    await supabase.from('subscription_events').insert({
      tenant_id: tenantId,
      event_type: 'subscription_cancelled',
      metadata: {
        immediately,
      },
    });
  } catch (error: any) {
    console.error('Failed to cancel subscription:', error);
    throw error;
  }
}

/**
 * Get payment methods for tenant
 */
export async function getPaymentMethods(tenantId: string) {
  try {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('stripe_customer_id')
      .eq('id', tenantId)
      .single();

    if (!tenant?.stripe_customer_id) {
      return [];
    }

    const { data, error } = await supabase.functions.invoke('get-payment-methods', {
      body: {
        customer_id: tenant.stripe_customer_id,
      },
    });

    if (error) throw error;
    return data.payment_methods || [];
  } catch (error: any) {
    console.error('Failed to get payment methods:', error);
    return [];
  }
}

/**
 * Track usage for billing
 */
export async function trackUsage(
  tenantId: string,
  eventType: string,
  quantity: number = 1,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    await supabase.from('usage_events').insert({
      tenant_id: tenantId,
      event_type: eventType,
      quantity,
      metadata: metadata || {},
    });
  } catch (error: any) {
    console.error('Failed to track usage:', error);
  }
}

