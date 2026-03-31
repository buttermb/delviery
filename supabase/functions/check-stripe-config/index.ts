/**
 * Check Stripe Config Edge Function
 * Checks if Stripe is properly configured and the secret key is valid
 */

import { serve, corsHeaders, createClient } from '../_shared/deps.ts';
import { Stripe, STRIPE_API_VERSION } from '../_shared/stripe.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check — this endpoint reveals Stripe configuration status
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const authHeader = req.headers.get('Authorization');

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');

    if (!STRIPE_SECRET_KEY) {
      return new Response(
        JSON.stringify({
          configured: false,
          valid: false,
          error: 'STRIPE_SECRET_KEY is missing'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate that it's a secret key, not a publishable key
    if (!STRIPE_SECRET_KEY.startsWith('sk_')) {
      return new Response(
        JSON.stringify({
          configured: true,
          valid: false,
          error: 'Invalid Stripe configuration. The key must be a SECRET key (starts with sk_), not a publishable key (pk_).'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if it looks like a test key or live key
    const isTestMode = STRIPE_SECRET_KEY.startsWith('sk_test_');
    const isLiveMode = STRIPE_SECRET_KEY.startsWith('sk_live_');

    // Initialize Stripe SDK
    const stripeClient = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: STRIPE_API_VERSION,
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Verify key by making a lightweight API call
    try {
      await stripeClient.customers.list({ limit: 1 });

      return new Response(
        JSON.stringify({
          configured: true,
          valid: true,
          testMode: isTestMode
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (stripeError: unknown) {
      console.error('Stripe validation error:', stripeError);
      return new Response(
        JSON.stringify({
          configured: true,
          valid: false,
          error: stripeError instanceof Error ? stripeError.message : 'Invalid Stripe key',
          testMode: isTestMode
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error: unknown) {
    console.error('Check Stripe Config Error:', error);
    return new Response(
      JSON.stringify({
        configured: false,
        valid: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
