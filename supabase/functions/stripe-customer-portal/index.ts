/**
 * Stripe Customer Portal Edge Function
 * Creates a Stripe Customer Portal session for managing payment methods and subscriptions
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Missing Supabase configuration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth token from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { tenant_id } = await req.json();

    if (!tenant_id) {
      return new Response(
        JSON.stringify({ error: 'Missing tenant_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenant_id)
      .single();

    if (tenantError || !tenant) {
      return new Response(
        JSON.stringify({ error: 'Tenant not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user has permission
    const { data: tenantUser } = await supabase
      .from('tenant_users')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('email', user.email)
      .maybeSingle();

    if (!tenantUser || (tenantUser.role !== 'owner' && tenantUser.role !== 'admin')) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
    
    if (!STRIPE_SECRET_KEY) {
      return new Response(
        JSON.stringify({ error: 'Stripe not configured. Please set STRIPE_SECRET_KEY in environment variables.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Import Stripe SDK
    const stripe = await import('https://esm.sh/stripe@14.21.0?target=deno');
    const stripeClient = stripe.default(STRIPE_SECRET_KEY);

    // Get or create Stripe customer
    let stripeCustomerId = tenant.stripe_customer_id;
    
    if (!stripeCustomerId) {
      const customer = await stripeClient.customers.create({
        email: tenant.owner_email,
        name: tenant.business_name,
        metadata: {
          tenant_id: tenant.id,
        },
      });
      stripeCustomerId = customer.id;

      // Update tenant with Stripe customer ID
      await supabase.from('tenants').update({
        stripe_customer_id: stripeCustomerId,
      }).eq('id', tenant_id);
    }

    // Get site URL for return URL
    const siteUrl = Deno.env.get('SITE_URL') || 'https://app.example.com';
    const returnUrl = `${siteUrl}/${tenant.slug}/admin/billing`;

    // Create Customer Portal session
    const session = await stripeClient.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl,
    });

    return new Response(
      JSON.stringify({
        success: true,
        url: session.url,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error creating Customer Portal session:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

