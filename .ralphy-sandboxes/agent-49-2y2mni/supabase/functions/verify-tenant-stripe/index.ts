import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { stripeSecretKey } = await req.json();
    
    // Check if key exists
    if (!stripeSecretKey || stripeSecretKey.length === 0) {
      return new Response(
        JSON.stringify({ 
          configured: false,
          valid: false,
          error: 'Stripe secret key is required'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    // Check if it's a valid secret key (must start with sk_)
    if (!stripeSecretKey.startsWith('sk_')) {
      return new Response(
        JSON.stringify({ 
          configured: true,
          valid: false,
          error: 'Invalid key format. Must be a secret key starting with "sk_", not a publishable key (pk_) or restricted key (rk_)'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    // Test the key with a lightweight Stripe API call
    try {
      const stripe = new Stripe(stripeSecretKey, { apiVersion: "2025-08-27.basil" });
      
      // Make a lightweight test call - just list customers with limit 1
      await stripe.customers.list({ limit: 1 });
      
      return new Response(
        JSON.stringify({ 
          configured: true,
          valid: true,
          testMode: stripeSecretKey.startsWith('sk_test_')
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    } catch (stripeError: any) {
      console.error('Stripe API test failed:', stripeError);
      
      return new Response(
        JSON.stringify({ 
          configured: true,
          valid: false,
          error: `Stripe API test failed: ${stripeError.message || 'Invalid API key or network error'}`
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }
    
  } catch (error) {
    console.error('Error in verify-tenant-stripe:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(
      JSON.stringify({ 
        configured: false, 
        valid: false,
        error: errorMessage 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
