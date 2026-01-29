// @ts-nocheck
import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts';
import { withZenProtection } from '../_shared/zen-firewall.ts';

const impersonateSchema = z.object({
  tenant_id: z.string().uuid(),
});

serve(
  withZenProtection(async (req) => {
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Verify super admin authentication
      const authHeader = req.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const token = authHeader.replace('Bearer ', '');

      // Verify super admin token (using super-admin-auth function logic)
      // For now, we'll verify by checking super_admin_users table
      // Verify the token belongs to a real user
      let user = null;
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser(token);
        user = authUser;
      } catch {
        user = null;
      }

      if (!user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized - Invalid or expired token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify the authenticated user is a super admin
      const { data: superAdmin } = await supabase
        .from('super_admin_users')
        .select('id, email, role')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (!superAdmin) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized - Super admin access required' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Parse and validate request body
      const body = await req.json();
      const { tenant_id } = impersonateSchema.parse(body);

      // Get tenant
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('id, business_name, slug, subscription_plan, subscription_status, status')
        .eq('id', tenant_id)
        .maybeSingle();

      if (tenantError || !tenant) {
        return new Response(
          JSON.stringify({ error: 'Tenant not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if tenant is active
      if (tenant.status && tenant.status !== 'active') {
        return new Response(
          JSON.stringify({ error: `Cannot impersonate tenant with status: ${tenant.status}` }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get tenant admin user (first owner/admin)
      const { data: tenantAdmin, error: adminError } = await supabase
        .from('tenant_users')
        .select('id, user_id, email, role, tenant_id')
        .eq('tenant_id', tenant_id)
        .in('role', ['owner', 'admin'])
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (adminError || !tenantAdmin) {
        return new Response(
          JSON.stringify({ error: 'No active admin found for tenant' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generate temporary tenant admin token via tenant-admin-auth
      const { data: authData, error: authError } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: tenantAdmin.email,
      });

      if (authError || !authData) {
        // Fallback: Call tenant-admin-auth edge function to generate token
        const tenantAuthResponse = await fetch(`${supabaseUrl}/functions/v1/tenant-admin-auth?action=impersonate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            tenant_id: tenant_id,
            super_admin_id: user?.id || 'system',
          }),
        });

        if (!tenantAuthResponse.ok) {
          return new Response(
            JSON.stringify({ error: 'Failed to generate impersonation token' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const tokenData = await tenantAuthResponse.json();

        // Log impersonation
        await supabase.from('super_admin_audit_logs').insert({
          super_admin_id: user?.id || 'system',
          action: 'TENANT_IMPERSONATION',
          entity_type: 'tenant',
          entity_id: tenant_id,
          details: {
            tenant_name: tenant.business_name,
            tenant_slug: tenant.slug,
            impersonated_admin: tenantAdmin.email,
          },
        });

        return new Response(
          JSON.stringify({
            success: true,
            token: tokenData.token || tokenData.access_token,
            tenant: {
              id: tenant.id,
              business_name: tenant.business_name,
              slug: tenant.slug,
              subscription_plan: tenant.subscription_plan,
              subscription_status: tenant.subscription_status,
            },
            admin: {
              id: tenantAdmin.id,
              email: tenantAdmin.email,
              role: tenantAdmin.role,
            },
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Log impersonation
      await supabase.from('super_admin_audit_logs').insert({
        super_admin_id: user?.id || 'system',
        action: 'TENANT_IMPERSONATION',
        entity_type: 'tenant',
        entity_id: tenant_id,
        details: {
          tenant_name: tenant.business_name,
          tenant_slug: tenant.slug,
          impersonated_admin: tenantAdmin.email,
        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          magic_link: authData.properties.action_link,
          tenant: {
            id: tenant.id,
            business_name: tenant.business_name,
            slug: tenant.slug,
            subscription_plan: tenant.subscription_plan,
            subscription_status: tenant.subscription_status,
          },
          admin: {
            id: tenantAdmin.id,
            email: tenantAdmin.email,
            role: tenantAdmin.role,
          },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      console.error('Impersonation error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to impersonate tenant' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  })
);

