/**
 * Stripe Customer Portal Edge Function
 * Creates a Stripe Customer Portal session for managing payment methods and subscriptions
 */

import { serve, corsHeaders } from '../_shared/deps.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import Stripe from 'https://esm.sh/stripe@18.5.0';

// Helper logging function
const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-PORTAL] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep('Function started');

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    if (!supabaseUrl || !supabaseServiceKey) {
      logStep('ERROR: Missing Supabase configuration');
      return new Response(
        JSON.stringify({ error: 'Missing Supabase configuration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth token from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      logStep('ERROR: Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user is authenticated
    logStep('Verifying user authentication');
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      logStep('ERROR: Authentication failed', { error: authError?.message });
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    logStep('User authenticated', { userId: user.id, email: user.email });

    const { tenant_id } = await req.json();

    if (!tenant_id) {
      logStep('ERROR: Missing tenant_id');
      return new Response(
        JSON.stringify({ error: 'Missing tenant_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    logStep('Fetching tenant', { tenantId: tenant_id });

    // Get tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenant_id)
      .single();

    if (tenantError || !tenant) {
      logStep('ERROR: Tenant not found', { error: tenantError?.message });
      return new Response(
        JSON.stringify({ error: 'Tenant not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    logStep('Tenant found', { slug: tenant.slug, stripeCustomerId: tenant.stripe_customer_id });

    // Verify user has permission - check both owner and tenant_users
    const isOwner = tenant.owner_email?.toLowerCase() === user.email?.toLowerCase();
    
    const { data: tenantUser } = await supabase
      .from('tenant_users')
      .select('role')
      .eq('tenant_id', tenant_id)
      .eq('user_id', user.id)
      .maybeSingle();

    const isAdmin = tenantUser?.role === 'admin' || tenantUser?.role === 'owner';

    if (!isOwner && !isAdmin) {
      logStep('ERROR: Insufficient permissions', { isOwner, isAdmin });
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions - admin or owner access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    logStep('User has permission', { isOwner, isAdmin });

    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
    
    if (!STRIPE_SECRET_KEY) {
      logStep('ERROR: Stripe not configured');
      return new Response(
        JSON.stringify({ error: 'Stripe not configured. Please set STRIPE_SECRET_KEY in environment variables.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    logStep('Initializing Stripe client');

    // Initialize Stripe SDK
    const stripeClient = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2025-08-27.basil',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Get or create Stripe customer
    let stripeCustomerId = tenant.stripe_customer_id;
    
    if (!stripeCustomerId) {
      logStep('Creating new Stripe customer');
      const customer = await stripeClient.customers.create({
        email: tenant.owner_email,
        name: tenant.business_name,
        metadata: {
          tenant_id: tenant.id,
        },
      });
      stripeCustomerId = customer.id;
      logStep('Stripe customer created', { customerId: stripeCustomerId });

      // Update tenant with Stripe customer ID
      await supabase.from('tenants').update({
        stripe_customer_id: stripeCustomerId,
      }).eq('id', tenant_id);
      
      logStep('Tenant updated with Stripe customer ID');
    } else {
      logStep('Using existing Stripe customer', { customerId: stripeCustomerId });
    }

    // Get site URL for return URL
    const siteUrl = Deno.env.get('SITE_URL') || req.headers.get('origin') || 'https://app.example.com';
    const returnUrl = `${siteUrl}/${tenant.slug}/admin/billing`;
    
    logStep('Creating Customer Portal session', { returnUrl });

    // Create Customer Portal session
    const session = await stripeClient.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl,
    });

    logStep('Customer Portal session created', { sessionId: session.id });

    return new Response(
      JSON.stringify({
        success: true,
        url: session.url,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    logStep('CRITICAL ERROR', { message: error.message, stack: error.stack });
    console.error('[STRIPE-PORTAL] Error creating Customer Portal session:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        details: error.stack || 'No stack trace available'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
