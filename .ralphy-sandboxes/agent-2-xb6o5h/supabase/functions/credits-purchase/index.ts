import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts';

/**
 * Credits Purchase Edge Function
 *
 * Accepts package_id and payment_method_id, validates package availability,
 * creates a Stripe PaymentIntent, and on success calls the purchase_credits
 * database function to atomically update the balance and create a transaction.
 *
 * Returns the updated balance and transaction details.
 *
 * To deploy:
 * supabase functions deploy credits-purchase
 */

const RequestSchema = z.object({
  package_id: z.string().uuid(),
  payment_method_id: z.string().min(1),
});

interface CreditPackage {
  id: string;
  name: string;
  slug: string;
  credits: number;
  price_cents: number;
  stripe_price_id: string | null;
  stripe_product_id: string | null;
  is_active: boolean;
}

interface PurchaseCreditsResult {
  success: boolean;
  new_balance: number;
  error_message: string | null;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate environment
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Server misconfigured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!stripeSecretKey) {
      return new Response(
        JSON.stringify({ error: 'Payment processing not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse and validate request body
    const body = await req.json();
    const { package_id, payment_method_id } = RequestSchema.parse(body);

    // Look up the user's tenant
    const { data: tenantUser, error: tenantUserError } = await supabase
      .from('tenant_users')
      .select('tenant_id, role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (tenantUserError || !tenantUser) {
      return new Response(
        JSON.stringify({ error: 'No tenant associated with user' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantId = tenantUser.tenant_id;

    // Validate the credit package exists and is active
    const { data: creditPackage, error: packageError } = await supabase
      .from('credit_packages')
      .select('*')
      .eq('id', package_id)
      .eq('is_active', true)
      .maybeSingle();

    if (packageError || !creditPackage) {
      return new Response(
        JSON.stringify({ error: 'Credit package not found or unavailable' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const pkg = creditPackage as CreditPackage;

    // Get tenant's Stripe customer ID
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, slug, stripe_customer_id')
      .eq('id', tenantId)
      .maybeSingle();

    if (tenantError || !tenant) {
      return new Response(
        JSON.stringify({ error: 'Tenant not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Ensure Stripe customer exists
    let stripeCustomerId = tenant.stripe_customer_id;

    if (!stripeCustomerId) {
      // Create a Stripe customer for this tenant
      const createCustomerResponse = await fetch('https://api.stripe.com/v1/customers', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripeSecretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          'email': user.email || '',
          'metadata[tenant_id]': tenantId,
          'metadata[tenant_slug]': tenant.slug || '',
        }),
      });

      if (!createCustomerResponse.ok) {
        const err = await createCustomerResponse.json();
        console.error('[CREDITS_PURCHASE] Failed to create Stripe customer:', err);
        return new Response(
          JSON.stringify({ error: 'Failed to set up payment account' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const customer = await createCustomerResponse.json();
      stripeCustomerId = customer.id;

      // Persist customer ID on tenant
      await supabase
        .from('tenants')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', tenantId);
    }

    // Create a PaymentIntent with the saved payment method
    const idempotencyKey = `credits-purchase:${tenantId}:${package_id}:${Date.now()}`;

    const paymentIntentResponse = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': idempotencyKey,
      },
      body: new URLSearchParams({
        'amount': pkg.price_cents.toString(),
        'currency': 'usd',
        'customer': stripeCustomerId,
        'payment_method': payment_method_id,
        'off_session': 'true',
        'confirm': 'true',
        'description': `Credit purchase: ${pkg.name} (${pkg.credits.toLocaleString()} credits)`,
        'metadata[tenant_id]': tenantId,
        'metadata[package_id]': package_id,
        'metadata[package_slug]': pkg.slug,
        'metadata[credits]': pkg.credits.toString(),
        'metadata[type]': 'credit_purchase',
      }),
    });

    const paymentIntent = await paymentIntentResponse.json();

    // Handle payment failures gracefully
    if (!paymentIntentResponse.ok || paymentIntent.error) {
      const stripeError = paymentIntent.error;
      const errorCode = stripeError?.code || 'unknown';
      const errorMessage = stripeError?.message || 'Payment failed';

      console.error('[CREDITS_PURCHASE] Stripe payment failed:', {
        code: errorCode,
        message: errorMessage,
        tenant_id: tenantId,
        package_id,
      });

      // Track failed attempt in analytics
      await supabase
        .from('credit_analytics')
        .insert({
          tenant_id: tenantId,
          event_type: 'purchase_payment_failed',
          metadata: {
            package_id,
            package_slug: pkg.slug,
            credits: pkg.credits,
            price_cents: pkg.price_cents,
            error_code: errorCode,
            error_message: errorMessage,
          },
        });

      // Map Stripe error codes to user-friendly messages
      let userMessage = 'Payment could not be processed';
      if (errorCode === 'card_declined') {
        userMessage = 'Your card was declined. Please try a different payment method.';
      } else if (errorCode === 'expired_card') {
        userMessage = 'Your card has expired. Please update your payment method.';
      } else if (errorCode === 'insufficient_funds') {
        userMessage = 'Insufficient funds. Please try a different payment method.';
      } else if (errorCode === 'incorrect_cvc') {
        userMessage = 'Incorrect security code. Please check your card details.';
      } else if (errorCode === 'processing_error') {
        userMessage = 'A processing error occurred. Please try again.';
      } else if (errorCode === 'authentication_required') {
        userMessage = 'Additional authentication is required. Please use a different payment method or try again.';
      }

      return new Response(
        JSON.stringify({
          error: userMessage,
          code: errorCode,
          requires_action: errorCode === 'authentication_required',
        }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check PaymentIntent status
    if (paymentIntent.status === 'requires_action' || paymentIntent.status === 'requires_confirmation') {
      // SCA / 3D Secure required - return client_secret for client-side confirmation
      return new Response(
        JSON.stringify({
          requires_action: true,
          client_secret: paymentIntent.client_secret,
          payment_intent_id: paymentIntent.id,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (paymentIntent.status !== 'succeeded') {
      console.error('[CREDITS_PURCHASE] Unexpected payment status:', paymentIntent.status);
      return new Response(
        JSON.stringify({
          error: 'Payment not completed',
          status: paymentIntent.status,
        }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Payment succeeded - call process_credit_purchase (purchase_credits RPC)
    const { data: purchaseResult, error: purchaseError } = await supabase
      .rpc('purchase_credits', {
        p_tenant_id: tenantId,
        p_amount: pkg.credits,
        p_stripe_payment_id: paymentIntent.id,
      });

    if (purchaseError) {
      console.error('[CREDITS_PURCHASE] purchase_credits RPC failed:', purchaseError);

      // Payment succeeded but credit allocation failed - critical error
      // Log for manual resolution
      await supabase.from('credit_analytics').insert({
        tenant_id: tenantId,
        event_type: 'purchase_credit_allocation_failed',
        metadata: {
          package_id,
          package_slug: pkg.slug,
          credits: pkg.credits,
          payment_intent_id: paymentIntent.id,
          error: purchaseError.message,
        },
      });

      return new Response(
        JSON.stringify({
          error: 'Payment successful but credit allocation failed. Our team has been notified and will resolve this shortly.',
          payment_intent_id: paymentIntent.id,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract result from RPC response
    const result = (Array.isArray(purchaseResult) ? purchaseResult[0] : purchaseResult) as PurchaseCreditsResult;

    if (!result?.success) {
      console.error('[CREDITS_PURCHASE] purchase_credits returned failure:', result?.error_message);
      return new Response(
        JSON.stringify({
          error: result?.error_message || 'Credit allocation failed',
          payment_intent_id: paymentIntent.id,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Track successful purchase in analytics
    await supabase.from('credit_analytics').insert({
      tenant_id: tenantId,
      event_type: 'purchase_completed',
      credits_at_event: result.new_balance,
      metadata: {
        package_id,
        package_slug: pkg.slug,
        credits_added: pkg.credits,
        price_cents: pkg.price_cents,
        payment_intent_id: paymentIntent.id,
        new_balance: result.new_balance,
      },
    });

    // Fetch the latest transaction for the response
    const { data: latestTransaction } = await supabase
      .from('credit_transactions')
      .select('id, amount, balance_after, transaction_type, description, created_at, metadata')
      .eq('tenant_id', tenantId)
      .eq('transaction_type', 'purchase')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    console.log(`[CREDITS_PURCHASE] Success: tenant=${tenant.slug}, package=${pkg.slug}, credits=${pkg.credits}, new_balance=${result.new_balance}`);

    return new Response(
      JSON.stringify({
        success: true,
        balance: result.new_balance,
        credits_added: pkg.credits,
        transaction: latestTransaction || {
          amount: pkg.credits,
          balance_after: result.new_balance,
          transaction_type: 'purchase',
        },
        payment_intent_id: paymentIntent.id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[CREDITS_PURCHASE] Error:', error);

    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({ error: 'Invalid request', details: error.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
