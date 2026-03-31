import { serve, createClient } from '../_shared/deps.ts';
import { getAuthenticatedCorsHeaders } from '../_shared/cors.ts';
import { createRequestLogger } from '../_shared/logger.ts';
import { validateAdminApiOperation, type AdminApiOperationInput } from './validation.ts';
import { checkCreditsAvailable, CREDIT_ACTIONS } from '../_shared/creditGate.ts';

serve(async (req) => {
  const authCors = getAuthenticatedCorsHeaders(req);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: authCors });
  }

  const logger = createRequestLogger('admin-api-operations', req);

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
        { status: 401, headers: { ...authCors, 'Content-Type': 'application/json' } }
      );
    }

    // Verify Supabase JWT token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      logger.error('Auth error', { error: authError?.message });
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...authCors, 'Content-Type': 'application/json' } }
      );
    }

    // Get tenant_id from tenant_users table
    const { data: tenantUser, error: tenantError } = await supabaseAdmin
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (tenantError) {
      logger.error('Tenant lookup error', { error: tenantError?.message });
      return new Response(
        JSON.stringify({ error: 'Tenant lookup failed' }),
        { status: 500, headers: { ...authCors, 'Content-Type': 'application/json' } }
      );
    }

    if (!tenantUser) {
      return new Response(
        JSON.stringify({ error: 'Tenant not found for user' }),
        { status: 403, headers: { ...authCors, 'Content-Type': 'application/json' } }
      );
    }

    const tokenData = {
      tenant_id: tenantUser.tenant_id,
      admin_id: user.id
    };

    // Parse and validate request body
    const rawBody = await req.json();
    const { action, resource, data, id } = validateAdminApiOperation(rawBody);

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
        // Deduct credits for product creation (free tier only)
        if (resource === 'products') {
          const creditCheck = await checkCreditsAvailable(
            supabaseAdmin,
            tokenData.tenant_id,
            CREDIT_ACTIONS.ADD_PRODUCT
          );

          if (creditCheck.isFreeTier && !creditCheck.hasCredits) {
            return new Response(
              JSON.stringify({
                error: 'Insufficient credits',
                code: 'INSUFFICIENT_CREDITS',
                message: 'You do not have enough credits to add a product',
                creditsRequired: creditCheck.cost,
                currentBalance: creditCheck.balance,
              }),
              { status: 402, headers: { ...authCors, 'Content-Type': 'application/json' } }
            );
          }

          if (creditCheck.isFreeTier) {
            await supabaseAdmin.rpc('consume_credits', {
              p_tenant_id: tokenData.tenant_id,
              p_action_key: CREDIT_ACTIONS.ADD_PRODUCT,
              p_reference_type: 'product',
              p_description: 'Product creation via admin API',
            });
          }
        }

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
            { status: 400, headers: { ...authCors, 'Content-Type': 'application/json' } }
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
            { status: 400, headers: { ...authCors, 'Content-Type': 'application/json' } }
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
          { status: 400, headers: { ...authCors, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(
      JSON.stringify({ data: result }),
      { headers: { ...authCors, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    logger.error('Operation failed', { error: error instanceof Error ? error.message : 'Unknown' });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...authCors, 'Content-Type': 'application/json' } }
    );
  }
});
