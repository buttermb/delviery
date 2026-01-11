// @ts-nocheck
/**
 * Panic Reset Tool Edge Function
 * Allows super admins to reset tenant data (orders, inventory, etc.)
 * DESTRUCTIVE OPERATION - Requires explicit confirmation
 */

import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts';
import { createLogger } from '../_shared/logger.ts';

const logger = createLogger('panic-reset');

// Zod validation schemas
const resetRequestSchema = z.object({
  action: z.enum(['reset', 'preview']),
  tenant_id: z.string().uuid('Invalid tenant ID'),
  reset_type: z.enum(['orders', 'inventory', 'deliveries', 'invoices', 'all']).optional(),
  confirmation: z.literal('CONFIRM_RESET').optional(),
});

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
      logger.warn('Missing or invalid authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing or invalid authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      logger.warn('Unauthorized access attempt', { error: authError?.message });
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
      logger.warn('Non-super-admin attempted panic reset', { userId: user.id });
      return new Response(
        JSON.stringify({ error: 'Forbidden - Super admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse and validate request body
    let rawBody;
    try {
      rawBody = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validationResult = resetRequestSchema.safeParse(rawBody);

    if (!validationResult.success) {
      logger.warn('Validation failed', { errors: validationResult.error.flatten(), userId: user.id });
      return new Response(
        JSON.stringify({
          error: 'Validation failed',
          details: validationResult.error.flatten().fieldErrors,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, tenant_id, reset_type, confirmation } = validationResult.data;

    // Verify tenant exists
    const { data: tenant } = await serviceClient
      .from('tenants')
      .select('id, business_name')
      .eq('id', tenant_id)
      .single();

    if (!tenant) {
      logger.warn('Tenant not found', { tenant_id });
      return new Response(
        JSON.stringify({ error: 'Tenant not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle reset action
    if (action === 'reset') {
      // Require explicit confirmation for destructive operations
      if (confirmation !== 'CONFIRM_RESET') {
        return new Response(
          JSON.stringify({
            error: 'Confirmation required',
            message: 'You must provide confirmation: "CONFIRM_RESET" to proceed',
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!reset_type) {
        return new Response(
          JSON.stringify({ error: 'reset_type is required for reset action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

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
            'orders',
            'order_items',
            'wholesale_orders',
            'wholesale_inventory',
            'inventory_alerts',
            'inventory_movements',
            'deliveries',
            'courier_earnings',
            'invoices',
            'payments',
            'customer_invoices'
          );
          break;
      }

      logger.warn('Executing panic reset', { tenant_id, reset_type, tables: tablesToReset, userId: user.id });

      const results: Record<string, { deleted: number; error?: string }> = {};

      for (const table of tablesToReset) {
        try {
          const { error: deleteError } = await serviceClient
            .from(table)
            .delete()
            .eq('tenant_id', tenant_id);

          if (deleteError) {
            results[table] = { deleted: 0, error: deleteError.message };
          } else {
            const { count } = await serviceClient
              .from(table)
              .select('*', { count: 'exact', head: true })
              .eq('tenant_id', tenant_id);

            results[table] = { deleted: count || 0 };
          }
        } catch (error) {
          results[table] = { deleted: 0, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      }

      // Log the reset action
      await serviceClient.from('audit_logs').insert({
        actor_id: user.id,
        actor_type: 'super_admin',
        action: 'panic_reset',
        resource_type: 'tenant',
        resource_id: tenant_id,
        tenant_id: tenant_id,
        changes: { reset_type, tables_reset: tablesToReset, results },
        ip_address: req.headers.get('x-forwarded-for') || 'unknown',
        user_agent: req.headers.get('user-agent') || 'unknown',
      });

      logger.info('Panic reset completed', { tenant_id, reset_type, results });

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

    // Get reset preview
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

      logger.info('Panic reset preview', { tenant_id, preview });

      return new Response(
        JSON.stringify({
          tenant: { id: tenant.id, business_name: tenant.business_name },
          preview,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Must be: reset or preview' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    logger.error('Panic reset error', { error: error instanceof Error ? error.message : 'Unknown' });
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
