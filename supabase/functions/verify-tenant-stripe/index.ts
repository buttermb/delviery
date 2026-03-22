import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Stripe, STRIPE_API_VERSION } from '../_shared/stripe.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Auth check ---
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'User not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { stripeSecretKey, tenant_id } = await req.json();

    // Verify caller is admin/owner of the tenant
    if (tenant_id) {
      const { data: tenantUser } = await supabase
        .from('tenant_users')
        .select('role')
        .eq('tenant_id', tenant_id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!tenantUser || !['admin', 'owner'].includes(tenantUser.role)) {
        return new Response(
          JSON.stringify({ error: 'Insufficient permissions' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    // --- End auth check ---
    
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
      const stripe = new Stripe(stripeSecretKey, { apiVersion: STRIPE_API_VERSION });
      
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
    } catch (stripeError: unknown) {
      console.error('Stripe API test failed:', stripeError);

      return new Response(
        JSON.stringify({
          configured: true,
          valid: false,
          error: `Stripe API test failed: ${stripeError instanceof Error ? stripeError.message : 'Invalid API key or network error'}`
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
