/**
 * Check Stripe Config Edge Function
 * Checks if Stripe is properly configured and the secret key is valid
 */

import { serve, corsHeaders } from '../_shared/deps.ts';
import Stripe from 'https://esm.sh/stripe@18.5.0';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    // Check if it looks like a test key
    const isTestMode = STRIPE_SECRET_KEY.startsWith('sk_test_');

    // Initialize Stripe SDK
    const stripeClient = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2025-08-27.basil',
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
    } catch (stripeError: any) {
      console.error('Stripe validation error:', stripeError);
      return new Response(
        JSON.stringify({
          configured: true,
          valid: false,
          error: stripeError.message || 'Invalid Stripe key',
          testMode: isTestMode
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error: any) {
    console.error('Check Stripe Config Error:', error);
    return new Response(
      JSON.stringify({
        configured: false,
        valid: false,
        error: error.message || 'Internal server error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
