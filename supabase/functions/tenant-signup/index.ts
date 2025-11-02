import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate slug from business name
function generateSlug(businessName: string): string {
  return businessName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const requestBody = await req.json();
    const { email, password, business_name, owner_name, phone, state, industry, company_size } = requestBody;

    // Validate required fields
    if (!email || !password || !business_name || !owner_name) {
      return new Response(
        JSON.stringify({ error: 'Email, password, business name, and owner name are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (password.length < 8) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 8 characters long' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if email already exists in Supabase Auth
    const { data: existingAuthUser } = await supabase.auth.admin.listUsers();
    const authUserExists = existingAuthUser?.users.some(
      (user) => user.email?.toLowerCase() === email.toLowerCase()
    );

    if (authUserExists) {
      return new Response(
        JSON.stringify({ 
          error: 'An account with this email already exists. Please try logging in or use a different email address.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if email already exists in tenant_users
    const { data: existingUser } = await supabase
      .from('tenant_users')
      .select('id')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (existingUser) {
      return new Response(
        JSON.stringify({ error: 'An account with this email already exists' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate unique slug
    let slug = generateSlug(business_name);
    let slugExists = true;
    let attempts = 0;
    while (slugExists && attempts < 10) {
      const { count } = await supabase
        .from('tenants')
        .select('id', { count: 'exact', head: true })
        .eq('slug', slug);
      
      if (count === 0) {
        slugExists = false;
      } else {
        slug = `${generateSlug(business_name)}-${Date.now()}`;
        attempts++;
      }
    }

    if (slugExists) {
      return new Response(
        JSON.stringify({ error: 'Unable to generate unique slug. Please try a different business name.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase Auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email.toLowerCase(),
      password: password,
      email_confirm: true, // Auto-confirm email for signup
      user_metadata: {
        name: owner_name,
        business_name: business_name,
      },
    });

    if (authError || !authData.user) {
      console.error('Auth user creation error:', authError);
      return new Response(
        JSON.stringify({ error: authError?.message || 'Failed to create user account' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate trial end date (14 days from now)
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

    // Create tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        business_name,
        slug,
        owner_email: email.toLowerCase(),
        owner_name,
        phone: phone || null,
        state: state || null,
        industry: industry || null,
        company_size: company_size || null,
        subscription_plan: 'starter',
        subscription_status: 'trial',
        trial_ends_at: trialEndsAt.toISOString(),
        limits: {
          customers: 50,
          menus: 3,
          products: 100,
          locations: 2,
          users: 3,
        },
        usage: {
          customers: 0,
          menus: 0,
          products: 0,
          locations: 0,
          users: 1,
        },
        features: {
          api_access: false,
          custom_branding: false,
          white_label: false,
          advanced_analytics: false,
          sms_enabled: false,
        },
        mrr: 99,
      })
      .select()
      .single();

    if (tenantError || !tenant) {
      console.error('Tenant creation error:', tenantError);
      // Try to clean up auth user if tenant creation failed
      await supabase.auth.admin.deleteUser(authData.user.id);
      
      return new Response(
        JSON.stringify({ error: tenantError?.message || 'Failed to create tenant' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create tenant user (owner)
    // Note: Password is handled by Supabase Auth, no need to store hash separately
    const { data: tenantUser, error: userError } = await supabase
      .from('tenant_users')
      .insert({
        tenant_id: tenant.id,
        user_id: authData.user.id,
        email: email.toLowerCase(),
        name: owner_name,
        role: 'owner',
        status: 'active',
        invited_at: new Date().toISOString(),
        accepted_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (userError || !tenantUser) {
      console.error('Tenant user creation error:', userError);
      // Try to clean up
      await supabase.from('tenants').delete().eq('id', tenant.id);
      await supabase.auth.admin.deleteUser(authData.user.id);
      
      return new Response(
        JSON.stringify({ error: userError?.message || 'Failed to create tenant user' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create subscription event
    await supabase.from('subscription_events').insert({
      tenant_id: tenant.id,
      event_type: 'trial_started',
      to_plan: 'starter',
      amount: 0,
    });

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        tenant: {
          id: tenant.id,
          business_name: tenant.business_name,
          slug: tenant.slug,
          owner_email: tenant.owner_email,
          subscription_plan: tenant.subscription_plan,
          subscription_status: tenant.subscription_status,
        },
        user: {
          id: tenantUser.id,
          email: tenantUser.email,
          name: tenantUser.name,
          role: tenantUser.role,
          tenant_id: tenantUser.tenant_id,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in tenant-signup:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

