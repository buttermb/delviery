/**
 * Credits Subscribe
 *
 * Creates a Stripe subscription for a credit subscription package,
 * inserts a credit_subscriptions row, grants the first period's credits
 * immediately, and returns subscription details.
 */

import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts';
import { createLogger } from '../_shared/logger.ts';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';

const logger = createLogger('credits-subscribe');

const RequestSchema = z.object({
  tenant_id: z.string().uuid(),
  package_id: z.string().uuid(),
  payment_method_id: z.string().min(1),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');

    if (!stripeSecretKey) {
      return new Response(
        JSON.stringify({ error: 'Stripe not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
    });

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse and validate request
    const body = await req.json();
    const { tenant_id, package_id, payment_method_id } = RequestSchema.parse(body);

    // Verify the credit package exists, is active, and is a subscription type
    const { data: creditPackage, error: packageError } = await supabase
      .from('credit_packages')
      .select('*')
      .eq('id', package_id)
      .eq('is_active', true)
      .eq('package_type', 'subscription')
      .maybeSingle();

    if (packageError || !creditPackage) {
      return new Response(
        JSON.stringify({ error: 'Invalid or inactive subscription package' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, slug, stripe_customer_id, owner_email')
      .eq('id', tenant_id)
      .maybeSingle();

    if (tenantError || !tenant) {
      return new Response(
        JSON.stringify({ error: 'Tenant not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user has access to this tenant
    const { data: tenantUser } = await supabase
      .from('tenant_users')
      .select('role')
      .eq('tenant_id', tenant_id)
      .eq('user_id', user.id)
      .maybeSingle();

    const isOwner = tenant.owner_email?.toLowerCase() === user.email?.toLowerCase();

    if (!isOwner && !tenantUser) {
      return new Response(
        JSON.stringify({ error: 'Not authorized for this tenant' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for existing active subscription for this tenant
    const { data: existingSubscription } = await supabase
      .from('credit_subscriptions')
      .select('id, status')
      .eq('tenant_id', tenant_id)
      .in('status', ['active', 'trialing'])
      .maybeSingle();

    if (existingSubscription) {
      return new Response(
        JSON.stringify({ error: 'Tenant already has an active credit subscription' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get or create Stripe customer
    let stripeCustomerId = tenant.stripe_customer_id;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          tenant_id: tenant_id,
          tenant_slug: tenant.slug,
        },
      });

      stripeCustomerId = customer.id;

      await supabase
        .from('tenants')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', tenant_id);
    }

    // Attach payment method to customer
    await stripe.paymentMethods.attach(payment_method_id, {
      customer: stripeCustomerId,
    });

    // Set as default payment method
    await stripe.customers.update(stripeCustomerId, {
      invoice_settings: {
        default_payment_method: payment_method_id,
      },
    });

    // Get or create Stripe product and recurring price for this package
    let stripePriceId = creditPackage.stripe_price_id;

    if (!stripePriceId) {
      // Create product in Stripe
      const product = await stripe.products.create({
        name: `${creditPackage.name} (Subscription)`,
        description: `${creditPackage.credits.toLocaleString()} credits per ${creditPackage.billing_interval} - ${creditPackage.description || ''}`,
        metadata: {
          package_id: creditPackage.id,
          package_slug: creditPackage.slug || '',
          credits: creditPackage.credits.toString(),
          type: 'credit_subscription',
        },
      });

      // Map billing_interval to Stripe interval
      const intervalMap: Record<string, string> = {
        monthly: 'month',
        yearly: 'year',
        weekly: 'week',
      };
      const stripeInterval = intervalMap[creditPackage.billing_interval] || 'month';

      // Create recurring price
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: creditPackage.price_cents,
        currency: 'usd',
        recurring: {
          interval: stripeInterval as Stripe.PriceCreateParams.Recurring.Interval,
        },
        metadata: {
          package_id: creditPackage.id,
          credits: creditPackage.credits.toString(),
        },
      });

      stripePriceId = price.id;

      // Update database with Stripe IDs
      await supabase
        .from('credit_packages')
        .update({
          stripe_product_id: product.id,
          stripe_price_id: price.id,
        })
        .eq('id', creditPackage.id);
    }

    // Create Stripe subscription
    const subscription = await stripe.subscriptions.create({
      customer: stripeCustomerId,
      items: [{ price: stripePriceId }],
      default_payment_method: payment_method_id,
      metadata: {
        tenant_id: tenant_id,
        package_id: package_id,
        credits_per_period: creditPackage.credits.toString(),
        type: 'credit_subscription',
      },
    });

    // Calculate period dates from Stripe subscription
    const currentPeriodStart = new Date(subscription.current_period_start * 1000).toISOString();
    const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();

    // Insert credit_subscriptions row
    const { data: creditSubscription, error: insertError } = await supabase
      .from('credit_subscriptions')
      .insert({
        user_id: user.id,
        tenant_id: tenant_id,
        package_id: package_id,
        stripe_subscription_id: subscription.id,
        stripe_customer_id: stripeCustomerId,
        status: subscription.status === 'active' ? 'active' : 'trialing',
        credits_per_period: creditPackage.credits,
        period_type: creditPackage.billing_interval || 'monthly',
        current_period_start: currentPeriodStart,
        current_period_end: currentPeriodEnd,
        credits_remaining_this_period: creditPackage.credits,
      })
      .select()
      .single();

    if (insertError) {
      logger.error('Failed to create credit subscription record', {
        tenantId: tenant_id,
        userId: user.id,
        error: insertError.message,
      });

      // Cancel the Stripe subscription since we failed to record it
      await stripe.subscriptions.cancel(subscription.id);

      return new Response(
        JSON.stringify({ error: 'Failed to create subscription record' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Grant first period credits immediately
    const creditsToGrant = creditPackage.credits + (creditPackage.bonus_credits || 0);
    const referenceId = `subscription_grant:${creditSubscription.id}:${currentPeriodStart}`;

    // Update tenant_credits balance
    const { data: tenantCredits } = await supabase
      .from('tenant_credits')
      .select('balance, lifetime_earned')
      .eq('tenant_id', tenant_id)
      .maybeSingle();

    const currentBalance = tenantCredits?.balance || 0;
    const currentLifetimeEarned = tenantCredits?.lifetime_earned || 0;
    const newBalance = currentBalance + creditsToGrant;

    if (tenantCredits) {
      await supabase
        .from('tenant_credits')
        .update({
          balance: newBalance,
          lifetime_earned: currentLifetimeEarned + creditsToGrant,
          purchased_credits_balance: (tenantCredits as Record<string, unknown>).purchased_credits_balance
            ? Number((tenantCredits as Record<string, unknown>).purchased_credits_balance) + creditsToGrant
            : creditsToGrant,
        })
        .eq('tenant_id', tenant_id);
    } else {
      await supabase
        .from('tenant_credits')
        .insert({
          tenant_id: tenant_id,
          balance: creditsToGrant,
          lifetime_earned: creditsToGrant,
          purchased_credits_balance: creditsToGrant,
        });
    }

    // Record credit transaction
    await supabase
      .from('credit_transactions')
      .insert({
        tenant_id: tenant_id,
        amount: creditsToGrant,
        balance_after: newBalance,
        transaction_type: 'subscription_grant',
        description: `${creditPackage.name} - first period credits`,
        reference_type: 'subscription',
        reference_id: referenceId,
        metadata: {
          subscription_id: creditSubscription.id,
          stripe_subscription_id: subscription.id,
          package_id: package_id,
          package_name: creditPackage.name,
          period_start: currentPeriodStart,
          period_end: currentPeriodEnd,
          credits_granted: creditPackage.credits,
          bonus_credits: creditPackage.bonus_credits || 0,
        },
      });

    // Track analytics
    await supabase
      .from('credit_analytics')
      .insert({
        tenant_id: tenant_id,
        event_type: 'subscription_created',
        metadata: {
          subscription_id: creditSubscription.id,
          package_id: package_id,
          package_name: creditPackage.name,
          credits_per_period: creditPackage.credits,
          billing_interval: creditPackage.billing_interval,
          price_cents: creditPackage.price_cents,
          stripe_subscription_id: subscription.id,
          credits_granted: creditsToGrant,
        },
      });

    logger.info('Credit subscription created successfully', {
      tenantId: tenant_id,
      userId: user.id,
      subscriptionId: creditSubscription.id,
      stripeSubscriptionId: subscription.id,
      creditsGranted: creditsToGrant.toString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        subscription: {
          id: creditSubscription.id,
          status: creditSubscription.status,
          credits_per_period: creditSubscription.credits_per_period,
          period_type: creditSubscription.period_type,
          current_period_start: creditSubscription.current_period_start,
          current_period_end: creditSubscription.current_period_end,
          stripe_subscription_id: subscription.id,
          package: {
            id: creditPackage.id,
            name: creditPackage.name,
            credits: creditPackage.credits,
            billing_interval: creditPackage.billing_interval,
            price_cents: creditPackage.price_cents,
          },
        },
        credits_granted: creditsToGrant,
        new_balance: newBalance,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    logger.error('Credits subscribe error', { error: (error as Error).message });

    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({ error: 'Invalid request', details: error.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
