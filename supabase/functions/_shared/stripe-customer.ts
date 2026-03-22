/**
 * Idempotent Stripe customer creation for tenants.
 *
 * Uses two layers of protection against duplicate customers:
 * 1. Stripe idempotency key (`tenant_customer_create:{tenant_id}`) so
 *    concurrent calls to Stripe itself return the same customer object.
 * 2. Atomic DB update with `stripe_customer_id IS NULL` guard so only the
 *    first writer persists the new ID; any loser re-reads the winning value.
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { createLogger } from './logger.ts';

const logger = createLogger('stripe-customer');

interface Tenant {
  id: string;
  owner_email: string | null;
  business_name: string | null;
  slug: string | null;
  stripe_customer_id: string | null;
}

interface StripeCustomerParams {
  /** Initialised Stripe SDK instance */
  stripe: {
    customers: {
      create: (
        params: Record<string, unknown>,
        options?: { idempotencyKey?: string },
      ) => Promise<{ id: string }>;
    };
  };
  /** Supabase service-role client */
  supabase: SupabaseClient;
  /** Tenant row (must include id, owner_email, business_name, slug, stripe_customer_id) */
  tenant: Tenant;
  /** Optional: override email (e.g. user email instead of owner email) */
  email?: string;
}

/**
 * Returns an existing Stripe customer ID for the tenant, or creates one
 * idempotently if none exists.
 *
 * Safe to call concurrently from multiple edge-function invocations for the
 * same tenant — at most one Stripe customer will be created.
 */
export async function getOrCreateStripeCustomer({
  stripe,
  supabase,
  tenant,
  email,
}: StripeCustomerParams): Promise<string> {
  // Fast path: customer already exists
  if (tenant.stripe_customer_id) {
    return tenant.stripe_customer_id;
  }

  const customerEmail = email || tenant.owner_email || undefined;

  // Stable idempotency key so Stripe de-dupes concurrent requests
  const idempotencyKey = `tenant_customer_create:${tenant.id}`;

  logger.info('Creating Stripe customer', {
    tenantId: tenant.id,
    idempotencyKey,
  });

  const customer = await stripe.customers.create(
    {
      email: customerEmail,
      name: tenant.business_name || undefined,
      metadata: {
        tenant_id: tenant.id,
        tenant_slug: tenant.slug || '',
      },
    },
    { idempotencyKey },
  );

  // Atomic update: only succeed if no other request already set the ID.
  // The `is` filter matches NULL values in PostgREST.
  const { data: updated, error: updateError } = await supabase
    .from('tenants')
    .update({ stripe_customer_id: customer.id })
    .eq('id', tenant.id)
    .is('stripe_customer_id', null)
    .select('stripe_customer_id')
    .maybeSingle();

  if (updateError) {
    logger.error('Failed to persist Stripe customer ID', {
      tenantId: tenant.id,
      customerId: customer.id,
      error: updateError.message,
    });
    // Even on DB error, return the customer ID we got from Stripe
    // so the current request can proceed.
    return customer.id;
  }

  if (updated) {
    // We won the race — our customer ID was stored.
    logger.info('Stripe customer persisted', {
      tenantId: tenant.id,
      customerId: customer.id,
    });
    return customer.id;
  }

  // Another request already set stripe_customer_id. Re-read the winning value.
  logger.info('Another request already created Stripe customer, re-reading', {
    tenantId: tenant.id,
  });

  const { data: refreshed } = await supabase
    .from('tenants')
    .select('stripe_customer_id')
    .eq('id', tenant.id)
    .maybeSingle();

  return refreshed?.stripe_customer_id ?? customer.id;
}
