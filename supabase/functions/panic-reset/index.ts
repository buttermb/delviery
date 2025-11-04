/**
 * Panic Reset Tool Edge Function
 * Allows super admins to reset tenant data (orders, inventory, etc.)
 * Phase 7: Panic Reset Tool
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Verify user is super admin
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: superAdmin } = await serviceClient
      .from('super_admins')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (!superAdmin) {
      return new Response(
        JSON.stringify({ error: 'Forbidden - Super admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    let requestBody: any = {};
    try {
      requestBody = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, tenant_id, reset_type, confirmation } = requestBody;

    if (!tenant_id) {
      return new Response(
        JSON.stringify({ error: 'tenant_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify tenant exists
    const { data: tenant } = await serviceClient
      .from('tenants')
      .select('id, business_name')
      .eq('id', tenant_id)
      .single();

    if (!tenant) {
      return new Response(
        JSON.stringify({ error: 'Tenant not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Require explicit confirmation for destructive operations
    if (action === 'reset' && confirmation !== 'CONFIRM_RESET') {
      return new Response(
        JSON.stringify({ 
          error: 'Confirmation required',
          message: 'You must provide confirmation: "CONFIRM_RESET" to proceed'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle reset action
    if (action === 'reset') {
      const tablesToReset: string[] = [];

      switch (reset_type) {
        case 'orders':
          tablesToReset.push('orders', 'order_items', 'wholesale_orders');
          break;
        case 'inventory':
          tablesToReset.push('wholesale_inventory', 'inventory_alerts', 'inventory_movements');
          break;
        case 'deliveries':
          tablesToReset.push('deliveries', 'courier_earnings');
          break;
        case 'invoices':
          tablesToReset.push('invoices', 'payments', 'customer_invoices');
          break;
        case 'all':
          tablesToReset.push(
            'orders', 'order_items', 'wholesale_orders',
            'wholesale_inventory', 'inventory_alerts', 'inventory_movements',
            'deliveries', 'courier_earnings',
            'invoices', 'payments', 'customer_invoices'
          );
          break;
        default:
          return new Response(
            JSON.stringify({ error: 'Invalid reset_type. Must be: orders, inventory, deliveries, invoices, or all' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
      }

      // Delete records from specified tables
      const results: Record<string, { deleted: number; error?: string }> = {};

      for (const table of tablesToReset) {
        try {
          // Check if table exists and has tenant_id column
          const { error: deleteError } = await serviceClient
            .from(table)
            .delete()
            .eq('tenant_id', tenant_id);

          if (deleteError) {
            // Table might not exist or might not have tenant_id - skip
            results[table] = { deleted: 0, error: deleteError.message };
          } else {
            // Get count of deleted records (approximate)
            const { count } = await serviceClient
              .from(table)
              .select('*', { count: 'exact', head: true })
              .eq('tenant_id', tenant_id);

            results[table] = { deleted: count || 0 };
          }
        } catch (error: any) {
          results[table] = { deleted: 0, error: error.message || 'Unknown error' };
        }
      }

      // Log the reset action
      await serviceClient
        .from('audit_logs')
        .insert({
          actor_id: user.id,
          actor_type: 'super_admin',
          action: 'panic_reset',
          resource_type: 'tenant',
          resource_id: tenant_id,
          tenant_id: tenant_id,
          changes: {
            reset_type,
            tables_reset: tablesToReset,
            results,
          },
          ip_address: req.headers.get('x-forwarded-for') || 'unknown',
          user_agent: req.headers.get('user-agent') || 'unknown',
        });

      return new Response(
        JSON.stringify({
          success: true,
          message: `Reset completed for tenant: ${tenant.business_name}`,
          reset_type,
          results,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get reset preview (what would be deleted)
    if (action === 'preview') {
      const preview: Record<string, number> = {};

      const tablesToCheck = [
        'orders',
        'order_items',
        'wholesale_orders',
        'wholesale_inventory',
        'deliveries',
        'invoices',
        'customer_invoices',
      ];

      for (const table of tablesToCheck) {
        try {
          const { count } = await serviceClient
            .from(table)
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenant_id);

          preview[table] = count || 0;
        } catch {
          preview[table] = 0;
        }
      }

      return new Response(
        JSON.stringify({
          tenant: {
            id: tenant.id,
            business_name: tenant.business_name,
          },
          preview,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Must be: reset or preview' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

