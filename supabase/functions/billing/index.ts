/**
 * Billing Edge Function
 * Handles tenant billing operations with proper authentication
 */

import { serve, createClient, corsHeaders } from '../_shared/deps.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    // Get auth token from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Create client with user token for auth validation
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    let requestBody: any = {};
    try {
      requestBody = await req.json();
    } catch {
      requestBody = {};
    }

    const { action, tenant_id } = requestBody;

    // Get tenant_id from user context if not provided
    let tenantId = tenant_id;
    
    if (!tenantId) {
      // Try to get from tenant_users
      const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
      const { data: tenantUser } = await serviceClient
        .from('tenant_users')
        .select('tenant_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (tenantUser) {
        tenantId = tenantUser.tenant_id;
      } else {
        // Check if user is tenant owner
        const { data: tenant } = await serviceClient
          .from('tenants')
          .select('id')
          .eq('owner_email', user.email)
          .maybeSingle();

        if (tenant) {
          tenantId = tenant.id;
        }
      }
    }

    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: 'Tenant not found or user not authorized' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user has access to this tenant
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: tenant } = await serviceClient
      .from('tenants')
      .select('id, owner_email')
      .eq('id', tenantId)
      .single();

    if (!tenant) {
      return new Response(
        JSON.stringify({ error: 'Tenant not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isOwner = tenant.owner_email?.toLowerCase() === user.email?.toLowerCase();
    const { data: tenantUser } = await serviceClient
      .from('tenant_users')
      .select('role')
      .eq('tenant_id', tenantId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!isOwner && !tenantUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - no access to this tenant' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle different actions
    if (action === 'get_billing' || !action) {
      // Call RPC function to get billing info
      const { data: billingData, error: rpcError } = await serviceClient
        .rpc('get_tenant_billing', { tenant_id: tenantId });

      if (rpcError) {
        // Fallback if RPC doesn't exist yet
        const { data: tenantData } = await serviceClient
          .from('tenants')
          .select('subscription_plan, subscription_status, limits, usage, stripe_customer_id')
          .eq('id', tenantId)
          .single();

        if (!tenantData) {
          return new Response(
            JSON.stringify({ error: 'Tenant not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({
            billing: {
              plan: tenantData.subscription_plan || 'starter',
              status: tenantData.subscription_status || 'active',
              limits: tenantData.limits || {},
              usage: tenantData.usage || {},
              stripe_customer_id: tenantData.stripe_customer_id,
            }
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // RPC returns single jsonb object - wrap in billing key for consistency
      return new Response(
        JSON.stringify({ billing: billingData }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'get_payment_methods') {
      // Get payment methods via RPC
      const { data: paymentMethods, error: pmError } = await serviceClient
        .rpc('get_payment_methods', { tenant_id: tenantId });

      if (pmError) {
        // Fallback - return empty array if RPC doesn't exist
        return new Response(
          JSON.stringify({ payment_methods: [] }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // RPC returns jsonb array - ensure it's an array
      const methods = Array.isArray(paymentMethods) ? paymentMethods : (paymentMethods || []);
      
      return new Response(
        JSON.stringify({ payment_methods: methods }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

