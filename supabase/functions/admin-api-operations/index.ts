import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify Supabase JWT token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get tenant_id from tenant_users table
    const { data: tenantUser, error: tenantError } = await supabaseAdmin
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', user.id)
      .single();

    if (tenantError || !tenantUser) {
      console.error('Tenant lookup error:', tenantError);
      return new Response(
        JSON.stringify({ error: 'Tenant not found for user' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokenData = {
      tenant_id: tenantUser.tenant_id,
      admin_id: user.id
    };

    // Parse request body
    const { action, resource, data, id } = await req.json();

    console.log('Admin API operation:', { action, resource, tenant_id: tokenData.tenant_id });

    let result;

    switch (action) {
      case 'list': {
        const { data: records, error } = await supabaseAdmin
          .from(resource)
          .select('*')
          .eq('tenant_id', tokenData.tenant_id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        result = records;
        break;
      }

      case 'create': {
        const { data: record, error } = await supabaseAdmin
          .from(resource)
          .insert({
            ...data,
            tenant_id: tokenData.tenant_id
          })
          .select()
          .single();

        if (error) throw error;

        // Log to audit trail
        await supabaseAdmin.from('audit_trail').insert({
          tenant_id: tokenData.tenant_id,
          admin_id: tokenData.admin_id,
          action: 'create',
          resource_type: resource,
          resource_id: record.id,
          details: { data }
        });

        result = record;
        break;
      }

      case 'update': {
        if (!id) {
          return new Response(
            JSON.stringify({ error: 'ID required for update' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: record, error } = await supabaseAdmin
          .from(resource)
          .update(data)
          .eq('id', id)
          .eq('tenant_id', tokenData.tenant_id)
          .select()
          .single();

        if (error) throw error;

        // Log to audit trail
        await supabaseAdmin.from('audit_trail').insert({
          tenant_id: tokenData.tenant_id,
          admin_id: tokenData.admin_id,
          action: 'update',
          resource_type: resource,
          resource_id: id,
          details: { data }
        });

        result = record;
        break;
      }

      case 'delete': {
        if (!id) {
          return new Response(
            JSON.stringify({ error: 'ID required for delete' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error } = await supabaseAdmin
          .from(resource)
          .delete()
          .eq('id', id)
          .eq('tenant_id', tokenData.tenant_id);

        if (error) throw error;

        // Log to audit trail
        await supabaseAdmin.from('audit_trail').insert({
          tenant_id: tokenData.tenant_id,
          admin_id: tokenData.admin_id,
          action: 'delete',
          resource_type: resource,
          resource_id: id,
          details: {}
        });

        result = { success: true };
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(
      JSON.stringify({ data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in admin-api-operations:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
