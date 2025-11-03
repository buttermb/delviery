import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Subscription plan limits and features configuration
const PLAN_CONFIGS = {
  starter: {
    limits: { menus: 3, users: 3, products: 100, customers: 50, locations: 2 },
    features: {
      api_access: false,
      sms_enabled: false,
      white_label: false,
      custom_branding: false,
      advanced_analytics: false,
    },
    mrr: 99,
  },
  professional: {
    limits: { menus: 10, users: 10, products: 500, customers: 500, locations: 5 },
    features: {
      api_access: true,
      sms_enabled: true,
      white_label: false,
      custom_branding: true,
      advanced_analytics: true,
    },
    mrr: 299,
  },
  enterprise: {
    limits: { menus: -1, users: -1, products: -1, customers: -1, locations: -1 },
    features: {
      api_access: true,
      sms_enabled: true,
      white_label: true,
      custom_branding: true,
      advanced_analytics: true,
    },
    mrr: 999,
  },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[UPDATE-SUBSCRIPTION] Function started');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get the authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      console.error('[UPDATE-SUBSCRIPTION] Auth error:', userError);
      throw new Error('Unauthorized');
    }

    console.log('[UPDATE-SUBSCRIPTION] User authenticated:', user.id);

    // Parse request body
    const { tenant_id, new_plan, use_stripe } = await req.json();
    console.log('[UPDATE-SUBSCRIPTION] Request:', { tenant_id, new_plan, use_stripe });

    // Validate plan
    if (!['starter', 'professional', 'enterprise'].includes(new_plan)) {
      throw new Error('Invalid plan');
    }

    // Verify user has access to this tenant
    const { data: tenantUser, error: tenantUserError } = await supabase
      .from('tenant_users')
      .select('role')
      .eq('tenant_id', tenant_id)
      .eq('user_id', user.id)
      .single();

    if (tenantUserError || !tenantUser) {
      console.error('[UPDATE-SUBSCRIPTION] Tenant access error:', tenantUserError);
      throw new Error('No access to this tenant');
    }

    // Only owners can update subscription
    if (tenantUser.role !== 'owner') {
      throw new Error('Only owners can update subscription');
    }

    console.log('[UPDATE-SUBSCRIPTION] User verified as owner');

    // Get plan configuration
    const planConfig = PLAN_CONFIGS[new_plan as keyof typeof PLAN_CONFIGS];

    // Update tenant subscription
    const { data: updatedTenant, error: updateError } = await supabase
      .from('tenants')
      .update({
        subscription_plan: new_plan,
        subscription_status: 'active',
        limits: planConfig.limits,
        features: planConfig.features,
        mrr: planConfig.mrr,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tenant_id)
      .select()
      .single();

    if (updateError) {
      console.error('[UPDATE-SUBSCRIPTION] Update error:', updateError);
      throw updateError;
    }

    console.log('[UPDATE-SUBSCRIPTION] Tenant updated successfully');

    // Create invoice record
    const invoiceNumber = `INV-${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    
    const { error: invoiceError } = await supabase
      .from('platform_invoices')
      .insert({
        tenant_id,
        invoice_number: invoiceNumber,
        amount: planConfig.mrr,
        status: 'paid',
        issue_date: new Date().toISOString(),
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        paid_date: new Date().toISOString(),
        billing_period_start: new Date().toISOString(),
        billing_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        description: `${new_plan.charAt(0).toUpperCase() + new_plan.slice(1)} Plan - Monthly Subscription`,
      });

    if (invoiceError) {
      console.error('[UPDATE-SUBSCRIPTION] Invoice creation warning:', invoiceError);
      // Don't fail the entire operation if invoice creation fails
    } else {
      console.log('[UPDATE-SUBSCRIPTION] Invoice created:', invoiceNumber);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        tenant: updatedTenant,
        message: 'Subscription updated successfully'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('[UPDATE-SUBSCRIPTION] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
