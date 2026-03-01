// Edge Function: Inventory Route Handlers (Security Hardened)
/**
 * Inventory Route Handlers
 * 
 * Unified handlers for inventory management
 */

import { createClient, corsHeaders, z } from '../../_shared/deps.ts';
import { sanitizeSearchInput } from '../../_shared/searchSanitize.ts';

type RequestHandler = (req: Request, params: Record<string, string>) => Promise<Response>;

// Validation schemas
const CreateProductSchema = z.object({
  name: z.string().min(1),
  sku: z.string().optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  unit_type: z.enum(['each', 'lb', 'oz', 'g']).default('each'),
  retail_price: z.number().nonnegative().optional(),
  wholesale_price_per_lb: z.number().nonnegative().optional(),
  wholesale_price_per_unit: z.number().nonnegative().optional(),
  is_wholesale: z.boolean().default(false),
  is_retail: z.boolean().default(true),
  stock_quantity: z.number().nonnegative().default(0),
  low_stock_threshold: z.number().nonnegative().optional(),
  image_url: z.string().url().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const StockAdjustmentSchema = z.object({
  quantity_change: z.number(),  // positive or negative
  movement_type: z.enum(['purchase_receive', 'sale', 'adjustment', 'transfer_in', 'transfer_out', 'return', 'waste']),
  reason: z.string().optional(),
  reference_type: z.string().optional(),
  reference_id: z.string().uuid().optional(),
});

const UpdateProductSchema = CreateProductSchema.partial();

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

// List products
async function listProducts(req: Request, params: Record<string, string>): Promise<Response> {
  try {
    const { supabase, tenantId } = await getAuthContext(req);
    const url = new URL(req.url);

    const category = url.searchParams.get('category');
    const search = url.searchParams.get('search');
    const inStock = url.searchParams.get('in_stock');
    const isWholesale = url.searchParams.get('wholesale');
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    let query = supabase
      .from('products')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true })
      .range(offset, offset + limit - 1);

    if (category) {
      query = query.eq('category', category);
    }
    if (search) {
      const escaped = sanitizeSearchInput(search);
      query = query.or(`name.ilike.%${escaped}%,sku.ilike.%${escaped}%`);
    }
    if (inStock === 'true') {
      query = query.gt('stock_quantity', 0);
    }
    if (isWholesale === 'true') {
      query = query.eq('is_wholesale', true);
    }

    const { data, error, count } = await query;

    if (error) {
      return errorResponse(error.message);
    }

    return jsonResponse({
      data,
      pagination: { total: count, limit, offset }
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Unknown error', 401);
  }
}

// Get single product
async function getProduct(req: Request, params: Record<string, string>): Promise<Response> {
  try {
    const { supabase, tenantId } = await getAuthContext(req);
    const productId = params.id;

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
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

// Create product
async function createProduct(req: Request, params: Record<string, string>): Promise<Response> {
  try {
    const { supabase, tenantId, userId } = await getAuthContext(req);
    const body = await req.json();

    // Validate input
    const validation = CreateProductSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse(`Validation error: ${(validation as { success: false; error: { message: string } }).error.message}`);
    }

    const input = validation.data;

    // Generate SKU if not provided
    let sku = input.sku;
    if (!sku) {
      const prefix = input.name.substring(0, 3).toUpperCase();
      const random = Math.random().toString(36).substring(2, 6).toUpperCase();
      sku = `${prefix}-${random}`;
    }

    // Create product
    const { data, error } = await supabase
      .from('products')
      .insert({
        tenant_id: tenantId,
        ...input,
        sku,
      })
      .select()
      .single();

    if (error) {
      return errorResponse(error.message);
    }

    // Log audit event
    await supabase.rpc('log_audit_event', {
      p_tenant_id: tenantId,
      p_category: 'inventory',
      p_event_type: 'product_created',
      p_actor_type: 'tenant_user',
      p_actor_id: userId,
      p_target_type: 'product',
      p_target_id: data.id,
      p_details: { sku, name: input.name },
    });

    return jsonResponse({ data }, 201);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Unknown error', 401);
  }
}

// Update product
async function updateProduct(req: Request, params: Record<string, string>): Promise<Response> {
  try {
    const { supabase, tenantId, userId } = await getAuthContext(req);
    const productId = params.id;
    const body = await req.json();

    // Validate input
    const validation = UpdateProductSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse(`Validation error: ${(validation as { success: false; error: { message: string } }).error.message}`);
    }

    const input = validation.data;

    // Update product
    const { data, error } = await supabase
      .from('products')
      .update(input)
      .eq('id', productId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      return errorResponse(error.message, error.code === 'PGRST116' ? 404 : 400);
    }

    // Log audit event
    await supabase.rpc('log_audit_event', {
      p_tenant_id: tenantId,
      p_category: 'inventory',
      p_event_type: 'product_updated',
      p_actor_type: 'tenant_user',
      p_actor_id: userId,
      p_target_type: 'product',
      p_target_id: productId,
      p_details: { updated_fields: Object.keys(input) },
    });

    return jsonResponse({ data });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Unknown error', 401);
  }
}

// Adjust stock - ATOMIC with row locking
async function adjustStock(req: Request, params: Record<string, string>): Promise<Response> {
  try {
    const { supabase, tenantId, userId } = await getAuthContext(req);
    const productId = params.id;
    const body = await req.json();

    // Validate input
    const validation = StockAdjustmentSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse(`Validation error: ${(validation as { success: false; error: { message: string } }).error.message}`);
    }

    const input = validation.data;

    // Use atomic RPC to prevent race conditions
    const { data: result, error } = await supabase.rpc('atomic_adjust_stock', {
      p_product_id: productId,
      p_tenant_id: tenantId,
      p_quantity_change: input.quantity_change,
      p_movement_type: input.movement_type,
      p_reason: input.reason || null,
      p_reference_id: input.reference_id || null,
      p_performed_by: userId
    });

    if (error) {
      return errorResponse(error.message);
    }

    if (!result?.success) {
      return errorResponse(result?.error || 'Stock adjustment failed',
        result?.error === 'Insufficient stock' ? 409 : 400);
    }

    // Log audit event
    await supabase.rpc('log_audit_event', {
      p_tenant_id: tenantId,
      p_category: 'inventory',
      p_event_type: 'stock_adjusted',
      p_actor_type: 'tenant_user',
      p_actor_id: userId,
      p_target_type: 'product',
      p_target_id: productId,
      p_details: {
        previous_quantity: result.previous_quantity,
        change: input.quantity_change,
        new_quantity: result.new_quantity,
        movement_type: input.movement_type,
        reason: input.reason,
      },
    });

    return jsonResponse({
      data: { id: productId, stock_quantity: result.new_quantity },
      previous_quantity: result.previous_quantity,
      new_quantity: result.new_quantity,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Unknown error', 401);
  }
}

// Get low stock alerts
async function getLowStockAlerts(req: Request, params: Record<string, string>): Promise<Response> {
  try {
    const { supabase, tenantId } = await getAuthContext(req);

    const { data, error } = await supabase
      .from('products')
      .select('id, name, sku, stock_quantity, low_stock_threshold, category')
      .eq('tenant_id', tenantId)
      .not('low_stock_threshold', 'is', null)
      .lt('stock_quantity', supabase.rpc('get_low_stock_threshold_column'))
      .order('stock_quantity', { ascending: true });

    // Fallback query if RPC doesn't exist
    const { data: lowStock, error: lowStockError } = await supabase
      .from('products')
      .select('id, name, sku, stock_quantity, low_stock_threshold, category')
      .eq('tenant_id', tenantId)
      .not('low_stock_threshold', 'is', null)
      .order('stock_quantity', { ascending: true });

    if (lowStockError) {
      return errorResponse(lowStockError.message);
    }

    // Filter in JS if RPC not available
    const alerts = (lowStock || []).filter(
      p => p.stock_quantity <= (p.low_stock_threshold || 0)
    );

    return jsonResponse({
      data: alerts,
      count: alerts.length,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Unknown error', 401);
  }
}

// Export route handlers
export const inventoryRouter: Record<string, RequestHandler> = {
  'GET /products': listProducts,
  'GET /products/:id': getProduct,
  'POST /products': createProduct,
  'PUT /products/:id': updateProduct,
  'POST /products/:id/stock': adjustStock,
  'GET /inventory/low-stock': getLowStockAlerts,
};

