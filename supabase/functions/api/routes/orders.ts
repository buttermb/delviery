/**
 * Orders Route Handlers
 * 
 * Unified handlers for all order types:
 * - Retail orders
 * - Wholesale orders
 * - Menu orders
 * - POS transactions
 */

import { createClient, corsHeaders, z } from '../../_shared/deps.ts';

type RequestHandler = (req: Request, params: Record<string, string>) => Promise<Response>;

// Validation schemas
const CreateOrderSchema = z.object({
  order_type: z.enum(['retail', 'wholesale', 'menu', 'pos']),
  source: z.enum(['portal', 'menu_link', 'pos_terminal', 'b2b', 'admin', 'api']),
  items: z.array(z.object({
    product_id: z.string().uuid().optional(),
    inventory_id: z.string().uuid().optional(),
    product_name: z.string(),
    sku: z.string().optional(),
    quantity: z.number().positive(),
    quantity_unit: z.enum(['each', 'lb', 'oz', 'g', 'unit']).optional(),
    unit_price: z.number().nonnegative(),
    metadata: z.record(z.unknown()).optional(),
  })),
  customer_id: z.string().uuid().optional(),
  wholesale_client_id: z.string().uuid().optional(),
  menu_id: z.string().uuid().optional(),
  shift_id: z.string().uuid().optional(),
  delivery_address: z.string().optional(),
  delivery_notes: z.string().optional(),
  payment_method: z.enum(['cash', 'card', 'credit', 'debit', 'check', 'wire', 'crypto', 'other']).optional(),
  courier_id: z.string().uuid().optional(),
  contact_name: z.string().optional(),
  contact_phone: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const UpdateOrderStatusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'processing', 'in_transit', 'delivered', 'completed', 'cancelled', 'rejected', 'refunded']),
  notes: z.string().optional(),
});

// Helper to get authenticated user and tenant
async function getAuthContext(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing authorization');
  }

  const token = authHeader.split(' ')[1];
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    throw new Error('Invalid token');
  }

  const { data: tenantUser } = await supabase
    .from('tenant_users')
    .select('tenant_id')
    .eq('user_id', user.id)
    .single();

  if (!tenantUser?.tenant_id) {
    throw new Error('No tenant access');
  }

  return { supabase, userId: user.id, tenantId: tenantUser.tenant_id };
}

// Helper for error responses
function errorResponse(message: string, status: number = 400): Response {
  return new Response(
    JSON.stringify({ error: message }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Helper for success responses
function jsonResponse(data: unknown, status: number = 200): Response {
  return new Response(
    JSON.stringify(data),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// ============================================================================
// HANDLERS
// ============================================================================

// List orders with filtering
async function listOrders(req: Request, params: Record<string, string>): Promise<Response> {
  try {
    const { supabase, tenantId } = await getAuthContext(req);
    const url = new URL(req.url);
    
    // Parse query params
    const orderType = url.searchParams.get('type') || 'all';
    const status = url.searchParams.get('status');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    let query = supabase
      .from('unified_orders')
      .select(`
        *,
        items:unified_order_items(*),
        customer:customers(id, first_name, last_name, email),
        client:wholesale_clients(id, business_name, contact_name)
      `, { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (orderType !== 'all') {
      query = query.eq('order_type', orderType);
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;

    if (error) {
      return errorResponse(error.message);
    }

    return jsonResponse({ 
      data, 
      pagination: { 
        total: count, 
        limit, 
        offset,
        hasMore: (offset + limit) < (count || 0)
      } 
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Unknown error', 401);
  }
}

// Get single order
async function getOrder(req: Request, params: Record<string, string>): Promise<Response> {
  try {
    const { supabase, tenantId } = await getAuthContext(req);
    const orderId = params.id;

    const { data, error } = await supabase
      .from('unified_orders')
      .select(`
        *,
        items:unified_order_items(*),
        customer:customers(*),
        client:wholesale_clients(*),
        courier:couriers(*)
      `)
      .eq('id', orderId)
      .eq('tenant_id', tenantId)
      .single();

    if (error) {
      return errorResponse(error.message, error.code === 'PGRST116' ? 404 : 400);
    }

    return jsonResponse({ data });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Unknown error', 401);
  }
}

// Create order
async function createOrder(req: Request, params: Record<string, string>): Promise<Response> {
  try {
    const { supabase, tenantId, userId } = await getAuthContext(req);
    const body = await req.json();

    // Validate input
    const validation = CreateOrderSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse(`Validation error: ${(validation as { success: false; error: { message: string } }).error.message}`);
    }

    const input = validation.data;

    // Use the atomic RPC function
    const { data: orderId, error } = await supabase.rpc('create_unified_order', {
      p_tenant_id: tenantId,
      p_order_type: input.order_type,
      p_source: input.source,
      p_items: input.items,
      p_customer_id: input.customer_id,
      p_wholesale_client_id: input.wholesale_client_id,
      p_menu_id: input.menu_id,
      p_shift_id: input.shift_id,
      p_delivery_address: input.delivery_address,
      p_delivery_notes: input.delivery_notes,
      p_payment_method: input.payment_method,
      p_courier_id: input.courier_id,
      p_contact_name: input.contact_name,
      p_contact_phone: input.contact_phone,
      p_metadata: input.metadata || {},
    });

    if (error) {
      return errorResponse(error.message);
    }

    // Fetch the created order with relations
    const { data: order } = await supabase
      .from('unified_orders')
      .select('*, items:unified_order_items(*)')
      .eq('id', orderId)
      .single();

    // Log audit event
    await supabase.rpc('log_audit_event', {
      p_tenant_id: tenantId,
      p_category: 'order',
      p_event_type: 'order_created',
      p_actor_type: 'tenant_user',
      p_actor_id: userId,
      p_target_type: 'order',
      p_target_id: orderId,
      p_details: { order_type: input.order_type, source: input.source },
    });

    return jsonResponse({ data: order }, 201);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Unknown error', 401);
  }
}

// Update order status
async function updateOrderStatus(req: Request, params: Record<string, string>): Promise<Response> {
  try {
    const { supabase, tenantId, userId } = await getAuthContext(req);
    const orderId = params.id;
    const body = await req.json();

    // Validate input
    const validation = UpdateOrderStatusSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse(`Validation error: ${(validation as { success: false; error: { message: string } }).error.message}`);
    }

    const { status, notes } = validation.data;

    // Get current order
    const { data: currentOrder } = await supabase
      .from('unified_orders')
      .select('status, order_type')
      .eq('id', orderId)
      .eq('tenant_id', tenantId)
      .single();

    if (!currentOrder) {
      return errorResponse('Order not found', 404);
    }

    // Update order
    const updateData: Record<string, unknown> = { status };
    if (status === 'cancelled') {
      updateData.cancelled_at = new Date().toISOString();
      updateData.cancellation_reason = notes;
    }
    if (status === 'delivered') {
      updateData.delivered_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('unified_orders')
      .update(updateData)
      .eq('id', orderId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      return errorResponse(error.message);
    }

    // Log audit event
    await supabase.rpc('log_audit_event', {
      p_tenant_id: tenantId,
      p_category: 'order',
      p_event_type: 'order_status_changed',
      p_actor_type: 'tenant_user',
      p_actor_id: userId,
      p_target_type: 'order',
      p_target_id: orderId,
      p_details: { 
        previous_status: currentOrder.status, 
        new_status: status,
        notes,
      },
    });

    return jsonResponse({ data });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Unknown error', 401);
  }
}

// Cancel order
async function cancelOrder(req: Request, params: Record<string, string>): Promise<Response> {
  try {
    const { supabase, tenantId, userId } = await getAuthContext(req);
    const orderId = params.id;
    const body = await req.json();
    const reason = body.reason || 'Cancelled by user';

    // Get current order
    const { data: currentOrder } = await supabase
      .from('unified_orders')
      .select('status, order_type, wholesale_client_id, total_amount')
      .eq('id', orderId)
      .eq('tenant_id', tenantId)
      .single();

    if (!currentOrder) {
      return errorResponse('Order not found', 404);
    }

    if (['completed', 'cancelled', 'refunded'].includes(currentOrder.status)) {
      return errorResponse(`Cannot cancel order with status: ${currentOrder.status}`);
    }

    // Update order
    const { data, error } = await supabase
      .from('unified_orders')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason,
      })
      .eq('id', orderId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      return errorResponse(error.message);
    }

    // If wholesale order, reverse balance impact
    if (currentOrder.order_type === 'wholesale' && currentOrder.wholesale_client_id) {
      await supabase.rpc('update_contact_balance', {
        p_contact_id: currentOrder.wholesale_client_id,
        p_amount: currentOrder.total_amount,
        p_operation: 'subtract',
      });
    }

    // Log audit event
    await supabase.rpc('log_audit_event', {
      p_tenant_id: tenantId,
      p_category: 'order',
      p_event_type: 'order_cancelled',
      p_actor_type: 'tenant_user',
      p_actor_id: userId,
      p_target_type: 'order',
      p_target_id: orderId,
      p_details: { 
        previous_status: currentOrder.status, 
        reason,
        reversed_amount: currentOrder.order_type === 'wholesale' ? currentOrder.total_amount : null,
      },
    });

    return jsonResponse({ data, message: 'Order cancelled successfully' });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Unknown error', 401);
  }
}

// Export route handlers
export const ordersRouter: Record<string, RequestHandler> = {
  'GET /orders': listOrders,
  'GET /orders/:id': getOrder,
  'POST /orders': createOrder,
  'PATCH /orders/:id/status': updateOrderStatus,
  'POST /orders/:id/cancel': cancelOrder,
};

