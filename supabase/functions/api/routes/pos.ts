/**
 * POS Route Handlers
 *
 * Handles Point of Sale transactions including:
 * - Creating transactions (with atomic inventory updates)
 * - Listing transaction history
 * - Getting transaction details
 */

import { createClient, corsHeaders, z } from '../../_shared/deps.ts';

type RequestHandler = (req: Request, params: Record<string, string>) => Promise<Response>;

// Validation schemas matching CashRegister.tsx payload structure
const POSItemSchema = z.object({
  product_id: z.string().uuid(),
  product_name: z.string(),
  quantity: z.number().positive(),
  unit_price: z.number().nonnegative(),
  price_at_order_time: z.number().nonnegative(),
  total_price: z.number().nonnegative(),
  stock_quantity: z.number().int().optional(),
});

const CreatePOSTransactionSchema = z.object({
  p_tenant_id: z.string().uuid(),
  p_items: z.array(POSItemSchema).min(1),
  p_payment_method: z.enum(['cash', 'debit', 'credit', 'other']),
  p_subtotal: z.number().nonnegative(),
  p_tax_amount: z.number().nonnegative().optional().default(0),
  p_discount_amount: z.number().nonnegative().optional().default(0),
  p_customer_id: z.string().uuid().nullable().optional(),
  p_shift_id: z.string().uuid().nullable().optional(),
});

// Helper to get authenticated user and tenant (optional for offline queue)
async function getAuthContext(req: Request) {
  const authHeader = req.headers.get('Authorization');

  // Use service role for all operations since tenant_id is in payload
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // If auth header exists, validate it
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (!error && user) {
      const { data: tenantUser } = await supabase
        .from('tenant_users')
        .select('tenant_id')
        .eq('user_id', user.id)
        .single();

      return {
        supabase,
        userId: user.id,
        tenantId: tenantUser?.tenant_id ?? null,
        authenticated: true
      };
    }
  }

  // For offline queue - no auth but still allow (tenant_id validated in RPC)
  return {
    supabase,
    userId: null,
    tenantId: null,
    authenticated: false
  };
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

/**
 * Create POS Transaction
 * Calls the atomic RPC function that handles inventory and transaction creation
 */
async function createTransaction(req: Request, params: Record<string, string>): Promise<Response> {
  try {
    const { supabase, userId, tenantId: userTenantId, authenticated } = await getAuthContext(req);
    const body = await req.json();

    // Validate input
    const validation = CreatePOSTransactionSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse(`Validation error: ${(validation as { success: false; error: { message: string } }).error.message}`);
    }

    const input = validation.data;

    // Security check: if authenticated, ensure tenant matches
    if (authenticated && userTenantId && userTenantId !== input.p_tenant_id) {
      return errorResponse('Tenant mismatch', 403);
    }

    // Validate tenant exists and is active
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, status')
      .eq('id', input.p_tenant_id)
      .single();

    if (tenantError || !tenant) {
      return errorResponse('Invalid tenant', 400);
    }

    if (tenant.status !== 'active') {
      return errorResponse('Tenant is not active', 403);
    }

    // Call the atomic RPC function
    const { data: result, error: rpcError } = await supabase.rpc('create_pos_transaction_atomic', {
      p_tenant_id: input.p_tenant_id,
      p_items: input.p_items,
      p_payment_method: input.p_payment_method,
      p_subtotal: input.p_subtotal,
      p_tax_amount: input.p_tax_amount,
      p_discount_amount: input.p_discount_amount,
      p_customer_id: input.p_customer_id,
      p_shift_id: input.p_shift_id,
    });

    if (rpcError) {
      console.error('POS transaction RPC error:', rpcError);

      // Handle specific error codes
      if (rpcError.code === 'PGRST202' || rpcError.message?.includes('does not exist')) {
        return errorResponse('POS system not configured. Please contact support.', 500);
      }

      // Extract meaningful error message
      const errorMessage = rpcError.message?.includes('Insufficient stock')
        ? rpcError.message
        : rpcError.message || 'Transaction failed. Please try again.';

      return errorResponse(errorMessage);
    }

    // Handle RPC result
    if (!result.success) {
      // Handle insufficient stock with detailed info
      if (result.error_code === 'INSUFFICIENT_STOCK' && result.insufficient_items) {
        const stockDetails = result.insufficient_items.map((item: { product_name: string; requested: number; available: number }) =>
          `${item.product_name}: need ${item.requested}, have ${item.available}`
        ).join('; ');
        return errorResponse(`Insufficient stock: ${stockDetails}`, 400);
      }
      return errorResponse(result.error || 'Transaction failed', 400);
    }

    return jsonResponse({
      success: true,
      transaction_id: result.transaction_id,
      transaction_number: result.transaction_number,
    }, 201);
  } catch (error) {
    console.error('POS transaction error:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Unknown error occurred',
      500
    );
  }
}

/**
 * List POS Transactions
 */
async function listTransactions(req: Request, params: Record<string, string>): Promise<Response> {
  try {
    const { supabase, tenantId, authenticated } = await getAuthContext(req);

    if (!authenticated || !tenantId) {
      return errorResponse('Authentication required', 401);
    }

    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');

    let query = supabase
      .from('pos_transactions')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
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

/**
 * Get single POS Transaction
 */
async function getTransaction(req: Request, params: Record<string, string>): Promise<Response> {
  try {
    const { supabase, tenantId, authenticated } = await getAuthContext(req);

    if (!authenticated || !tenantId) {
      return errorResponse('Authentication required', 401);
    }

    const transactionId = params.id;

    const { data, error } = await supabase
      .from('pos_transactions')
      .select('*, items:pos_transaction_items(*)')
      .eq('id', transactionId)
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

// Export route handlers
export const posRouter: Record<string, RequestHandler> = {
  'POST /pos/transaction': createTransaction,
  'GET /pos/transactions': listTransactions,
  'GET /pos/transactions/:id': getTransaction,
};
