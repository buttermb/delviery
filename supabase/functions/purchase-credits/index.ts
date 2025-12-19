/**
 * Purchase Credits
 * 
 * Creates a Stripe checkout session for purchasing credit packs.
 */

import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';

const RequestSchema = z.object({
  tenant_id: z.string().uuid(),
  package_slug: z.enum(['starter-pack', 'growth-pack', 'power-pack']),
  success_url: z.string().url(),
  cancel_url: z.string().url(),
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
    const { tenant_id, package_slug, success_url, cancel_url } = RequestSchema.parse(body);

    // Get credit package
    const { data: creditPackage, error: packageError } = await supabase
      .from('credit_packages')
      .select('*')
      .eq('slug', package_slug)
      .eq('is_active', true)
      .single();

    if (packageError || !creditPackage) {
      return new Response(
        JSON.stringify({ error: 'Invalid credit package' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, slug, stripe_customer_id, owner_email')
      .eq('id', tenant_id)
      .single();

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

      // Update tenant with Stripe customer ID
      await supabase
        .from('tenants')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', tenant_id);
    }

    // Get or create Stripe price for this package
    let stripePriceId = creditPackage.stripe_price_id;

    if (!stripePriceId) {
      // Create product in Stripe
      const product = await stripe.products.create({
        name: creditPackage.name,
        description: `${creditPackage.credits.toLocaleString()} credits - ${creditPackage.description}`,
        metadata: {
          package_slug: creditPackage.slug,
          credits: creditPackage.credits.toString(),
          type: 'credit_pack',
        },
      });

      // Create price
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: creditPackage.price_cents,
        currency: 'usd',
        metadata: {
          package_slug: creditPackage.slug,
          credits: creditPackage.credits.toString(),
        },
      });

      stripePriceId = price.id;

      // Update database
      await supabase
        .from('credit_packages')
        .update({
          stripe_product_id: product.id,
          stripe_price_id: price.id,
        })
        .eq('id', creditPackage.id);
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: success_url,
      cancel_url: cancel_url,
      metadata: {
        tenant_id: tenant_id,
        package_slug: package_slug,
        credits: creditPackage.credits.toString(),
        type: 'credit_purchase',
      },
    });

    // Track analytics
    await supabase
      .from('credit_analytics')
      .insert({
        tenant_id: tenant_id,
        event_type: 'purchase_checkout_started',
        metadata: {
          package_slug: package_slug,
          credits: creditPackage.credits,
          price_cents: creditPackage.price_cents,
          checkout_session_id: session.id,
        },
      });

    console.log(`[PURCHASE_CREDITS] Created checkout session for ${tenant.slug}, package: ${package_slug}`);

    return new Response(
      JSON.stringify({
        success: true,
        checkout_url: session.url,
        session_id: session.id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[PURCHASE_CREDITS] Error:', error);
    
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







