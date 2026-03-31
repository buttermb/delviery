import { serve, createClient } from '../_shared/deps.ts';
import { getAuthenticatedCorsHeaders } from '../_shared/cors.ts';
import { createLogger } from '../_shared/logger.ts';
import { validateAdminAction, type AdminActionInput } from './validation.ts';
import { resolveTenantId } from './shared.ts';
import {
  handleCancelOrder,
  handleAcceptOrder,
  handleAssignCourier,
} from './handlers/order-handlers.ts';
import {
  handleFlagOrder,
  handleUnflagOrder,
  handleDeclineOrder,
} from './handlers/order-status-handlers.ts';
import { handleSuspendUser } from './handlers/user-handlers.ts';

const logger = createLogger('admin-actions');

serve(async (req) => {
  const authCors = getAuthenticatedCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: authCors });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      logger.warn('Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...authCors, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      logger.warn('Authentication failed', { error: authError?.message });
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...authCors, 'Content-Type': 'application/json' } }
      );
    }

    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (!adminUser) {
      logger.warn('Non-admin attempted admin action', { userId: user.id });
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...authCors, 'Content-Type': 'application/json' } }
      );
    }

    // Resolve tenant_id for cross-tenant isolation
    const tenantId = await resolveTenantId(supabase, user.id, user.email);
    if (!tenantId) {
      logger.warn('Admin has no tenant association', { userId: user.id });
      return new Response(
        JSON.stringify({ error: 'Tenant not found or user not authorized' }),
        { status: 403, headers: { ...authCors, 'Content-Type': 'application/json' } }
      );
    }

    // Parse and validate request body
    const rawBody = await req.json();
    let validatedInput: AdminActionInput;

    try {
      validatedInput = validateAdminAction(rawBody);
    } catch (validationError) {
      logger.warn('Validation failed', {
        error: validationError instanceof Error ? validationError.message : 'Unknown',
        userId: user.id
      });
      return new Response(
        JSON.stringify({
          error: 'Validation failed',
          details: validationError instanceof Error ? validationError.message : 'Invalid input'
        }),
        { status: 400, headers: { ...authCors, 'Content-Type': 'application/json' } }
      );
    }

    const { action, orderId, reason, userId, details } = validatedInput;

    const ctx = { supabase, authCors, adminUser, tenantId, orderId, reason, userId, details, req };

    // Route to appropriate handler
    switch (action) {
      case 'cancel-order':
        return await handleCancelOrder(ctx);
      case 'flag-order':
        return await handleFlagOrder(ctx);
      case 'unflag-order':
        return await handleUnflagOrder(ctx);
      case 'accept-order':
        return await handleAcceptOrder(ctx);
      case 'decline-order':
        return await handleDeclineOrder(ctx);
      case 'suspend-user':
        return await handleSuspendUser(ctx);
      case 'assign-courier':
        return await handleAssignCourier(ctx);
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...authCors, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    logger.error('Admin action error', { error: error instanceof Error ? error.message : 'Unknown' });
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Action failed' }),
      { status: 500, headers: { ...authCors, 'Content-Type': 'application/json' } }
    );
  }
});
