// Edge Function: panic-reset
/**
 * Panic Reset Tool Edge Function
 * Allows super admins to reset tenant data (orders, inventory, etc.)
 * DESTRUCTIVE OPERATION - Requires explicit confirmation
 */

import { serve, createClient, z } from '../_shared/deps.ts';
import { getAuthenticatedCorsHeaders } from '../_shared/cors.ts';
import { createRequestLogger } from '../_shared/logger.ts';
import { checkRateLimit } from '../_shared/rateLimiting.ts';

// Zod validation schemas
const resetRequestSchema = z.object({
  action: z.enum(['reset', 'preview']),
  tenant_id: z.string().uuid('Invalid tenant ID'),
  reset_type: z.enum(['orders', 'inventory', 'deliveries', 'invoices', 'all']).optional(),
  confirmation_token: z.string().uuid('Invalid confirmation token').optional(),
});

const PANIC_RESET_RATE_LIMIT = { key: 'panic_reset', limit: 3, windowMs: 60 * 60 * 1000 }; // 3 per hour

serve(async (req) => {
  const authCors = getAuthenticatedCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: authCors });
  }

  const logger = createRequestLogger('panic-reset', req);

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
        { status: 401, headers: { ...authCors, 'Content-Type': 'application/json' } }
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
        { status: 401, headers: { ...authCors, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user is super admin
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: superAdmin } = await serviceClient
      .from('super_admin_users')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (!superAdmin) {
      logger.warn('Non-super-admin attempted panic reset', { userId: user.id });
      return new Response(
        JSON.stringify({ error: 'Forbidden - Super admin access required' }),
        { status: 403, headers: { ...authCors, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting: 3 per hour per user
    const rateLimitResult = await checkRateLimit(PANIC_RESET_RATE_LIMIT, user.id);
    if (!rateLimitResult.allowed) {
      logger.warn('Rate limit exceeded for panic reset', { userId: user.id });
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }),
        { status: 429, headers: { ...authCors, 'Content-Type': 'application/json' } }
      );
    }

    // Parse and validate request body
    let rawBody;
    try {
      rawBody = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid request body' }),
        { status: 400, headers: { ...authCors, 'Content-Type': 'application/json' } }
      );
    }

    const validationResult = resetRequestSchema.safeParse(rawBody);

    if (!validationResult.success) {
      const zodError = validationResult as { success: false; error: { flatten: () => { fieldErrors: Record<string, string[]> } } };
      logger.warn('Validation failed', { errors: zodError.error.flatten(), userId: user.id });
      return new Response(
        JSON.stringify({
          error: 'Validation failed',
          details: zodError.error.flatten().fieldErrors,
        }),
        { status: 400, headers: { ...authCors, 'Content-Type': 'application/json' } }
      );
    }

    const { action, tenant_id, reset_type, confirmation_token } = validationResult.data;

    // Verify tenant exists
    const { data: tenant } = await serviceClient
      .from('tenants')
      .select('id, business_name')
      .eq('id', tenant_id)
      .maybeSingle();

    if (!tenant) {
      logger.warn('Tenant not found', { tenant_id });
      return new Response(
        JSON.stringify({ error: 'Tenant not found' }),
        { status: 404, headers: { ...authCors, 'Content-Type': 'application/json' } }
      );
    }

    // Handle reset action
    if (action === 'reset') {
      // Require a valid confirmation token for destructive operations
      if (!confirmation_token) {
        return new Response(
          JSON.stringify({
            error: 'Confirmation token required',
            message: 'You must first call preview to obtain a confirmation_token, then pass it to reset',
          }),
          { status: 400, headers: { ...authCors, 'Content-Type': 'application/json' } }
        );
      }

      // Verify the confirmation token from api_cache
      const cacheKey = `panic_reset:${tenant_id}`;
      const { data: cached } = await serviceClient
        .from('api_cache')
        .select('response')
        .eq('cache_key', cacheKey)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      const storedToken = (cached?.response as { token?: string })?.token;
      if (!storedToken || storedToken !== confirmation_token) {
        return new Response(
          JSON.stringify({
            error: 'Invalid or expired confirmation token',
            message: 'Call preview again to obtain a new confirmation_token',
          }),
          { status: 400, headers: { ...authCors, 'Content-Type': 'application/json' } }
        );
      }

      // Consume the token so it cannot be reused
      await serviceClient
        .from('api_cache')
        .delete()
        .eq('cache_key', cacheKey);

      if (!reset_type) {
        return new Response(
          JSON.stringify({ error: 'reset_type is required for reset action' }),
          { status: 400, headers: { ...authCors, 'Content-Type': 'application/json' } }
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
        { status: 200, headers: { ...authCors, 'Content-Type': 'application/json' } }
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

      // Generate a confirmation token and store in api_cache with 5-minute TTL
      const confirmationToken = crypto.randomUUID();
      const cacheKey = `panic_reset:${tenant_id}`;
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes

      await serviceClient
        .from('api_cache')
        .upsert(
          { cache_key: cacheKey, response: { token: confirmationToken }, expires_at: expiresAt },
          { onConflict: 'cache_key' }
        );

      logger.info('Panic reset preview', { tenant_id, preview });

      return new Response(
        JSON.stringify({
          tenant: { id: tenant.id, business_name: tenant.business_name },
          preview,
          confirmation_token: confirmationToken,
        }),
        { status: 200, headers: { ...authCors, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Must be: reset or preview' }),
      { status: 400, headers: { ...authCors, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    logger.error('Panic reset error', { error: error instanceof Error ? error.message : 'Unknown' });
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...authCors, 'Content-Type': 'application/json' } }
    );
  }
});
