import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hash, compare } from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Hash password using bcrypt
async function hashPassword(password: string): Promise<string> {
  return await hash(password);
}

// Compare password with hash
async function comparePassword(password: string, hash: string): Promise<boolean> {
  return await compare(password, hash);
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

    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    
    // Only parse JSON body for actions that need it
    let requestBody: any = {};
    if (action !== 'verify' && action !== 'logout' && req.method === 'POST') {
      try {
        requestBody = await req.json();
      } catch (e) {
        console.error('Failed to parse JSON body:', e);
        requestBody = {};
      }
    }

    if (action === 'login') {
      const { email, password, tenantSlug } = requestBody;

      console.log('Tenant admin login attempt:', { email, tenantSlug });

      if (!email || !password || !tenantSlug) {
        return new Response(
          JSON.stringify({ error: 'Email, password, and tenant slug are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create a separate service role client for tenant lookup (bypasses RLS)
      const serviceClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // Get tenant by slug BEFORE authentication (using service role)
      const { data: tenant, error: tenantError } = await serviceClient
        .from('tenants')
        .select('*')
        .eq('slug', tenantSlug.toLowerCase())
        .maybeSingle();

      if (tenantError || !tenant) {
        console.error('Tenant not found:', tenantSlug, tenantError);
        return new Response(
          JSON.stringify({ error: 'Tenant not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify credentials with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        console.error('Auth error:', authError);
        return new Response(
          JSON.stringify({ error: 'Invalid credentials' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!authData.user) {
        return new Response(
          JSON.stringify({ error: 'Authentication failed' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify user has access to this tenant (check if email matches tenant owner or is a tenant user)
      const isOwner = tenant.owner_email?.toLowerCase() === email.toLowerCase();
      
      let tenantUser = null;
      if (!isOwner) {
        const { data: userCheck, error: userCheckError } = await serviceClient
          .from('tenant_users')
          .select('*')
          .eq('email', email.toLowerCase())
          .eq('tenant_id', tenant.id)
          .maybeSingle();

        if (userCheckError) {
          console.error('Tenant user check error:', userCheckError);
        }
        
        tenantUser = userCheck;
        
        if (!tenantUser) {
          return new Response(
            JSON.stringify({ error: 'You do not have access to this tenant' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Build admin object
      const admin = tenantUser ? {
        id: tenantUser.id,
        email: tenantUser.email,
        name: tenantUser.name,
        role: tenantUser.role,
        tenant_id: tenantUser.tenant_id,
      } : {
        id: authData.user.id,
        email: authData.user.email,
        name: tenant.owner_name,
        role: 'owner',
        tenant_id: tenant.id,
      };

      console.log('Login successful for:', email, 'tenant:', tenant.business_name);

      // Return user data with tenant context
      return new Response(
        JSON.stringify({
          user: authData.user,
          session: authData.session,
          admin,
          tenant: {
            id: tenant.id,
            business_name: tenant.business_name,
            slug: tenant.slug,
            owner_email: tenant.owner_email,
            subscription_plan: tenant.subscription_plan,
            subscription_status: tenant.subscription_status,
          },
          access_token: authData.session?.access_token,
          refresh_token: authData.session?.refresh_token,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'refresh') {
      const { refresh_token } = requestBody;

      if (!refresh_token) {
        return new Response(
          JSON.stringify({ error: 'Refresh token required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data, error } = await supabase.auth.refreshSession({
        refresh_token,
      });

      if (error) {
        console.error('Token refresh error:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to refresh token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          user: data.user,
          session: data.session,
          access_token: data.session?.access_token,
          refresh_token: data.session?.refresh_token,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === "logout") {
      const authHeader = req.headers.get("Authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.replace("Bearer ", "");
        await supabase.from("tenant_admin_sessions").delete().eq("token", token);
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "setup-password") {
      // Setup password for newly created tenant user (during signup)
      const { email, password, tenantSlug } = await req.json();

      if (!email || !password || !tenantSlug) {
        return new Response(
          JSON.stringify({ error: "Email, password, and tenant slug are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (password.length < 8) {
        return new Response(
          JSON.stringify({ error: "Password must be at least 8 characters long" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Find tenant by slug
      const { data: tenant, error: tenantError } = await supabase
        .from("tenants")
        .select("*")
        .eq("slug", tenantSlug.toLowerCase())
        .maybeSingle();

      if (tenantError || !tenant) {
        return new Response(
          JSON.stringify({ error: "Tenant not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Find tenant admin user (can be pending status)
      const { data: adminUser, error: adminError } = await supabase
        .from("tenant_users")
        .select("*")
        .eq("email", email.toLowerCase())
        .eq("tenant_id", tenant.id)
        .maybeSingle();

      if (adminError || !adminUser) {
        return new Response(
          JSON.stringify({ error: "User not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if password already set
      if (adminUser.password_hash) {
        return new Response(
          JSON.stringify({ error: "Password already set. Use login instead." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Hash password
      const passwordHash = await hashPassword(password);

      // Update password_hash and activate user
      const { error: updateError } = await supabase
        .from("tenant_users")
        .update({ 
          password_hash: passwordHash,
          status: 'active' // Activate user when password is set
        })
        .eq("id", adminUser.id);

      if (updateError) {
        return new Response(
          JSON.stringify({ error: "Failed to setup password" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: "Password setup successful" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === 'verify') {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(
          JSON.stringify({ error: 'No token provided' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const token = authHeader.replace('Bearer ', '');
      
      const { data: { user }, error } = await supabase.auth.getUser(token);

      if (error || !user) {
        return new Response(
          JSON.stringify({ error: 'Invalid or expired token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get tenant_users record to find tenant
      const { data: tenantUser, error: tenantUserError } = await supabase
        .from('tenant_users')
        .select('*, tenants(*)')
        .eq('user_id', user.id)
        .maybeSingle();

      if (tenantUserError || !tenantUser) {
        return new Response(
          JSON.stringify({ error: 'Tenant access not found' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const admin = {
        id: tenantUser.id,
        email: tenantUser.email,
        name: tenantUser.name,
        role: tenantUser.role,
        tenant_id: tenantUser.tenant_id,
      };

      const tenant = {
        id: tenantUser.tenants.id,
        business_name: tenantUser.tenants.business_name,
        slug: tenantUser.tenants.slug,
        subscription_plan: tenantUser.tenants.subscription_plan,
        subscription_status: tenantUser.tenants.subscription_status,
      };

      return new Response(
        JSON.stringify({ user, admin, tenant }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in tenant-admin-auth:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
