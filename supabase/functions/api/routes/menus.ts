/**
 * Menus Route Handlers
 * 
 * Handlers for disposable menu operations
 */

import { createClient, corsHeaders, z } from '../../_shared/deps.ts';

type RequestHandler = (req: Request, params: Record<string, string>) => Promise<Response>;

// Validation schemas
const CreateMenuSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  product_ids: z.array(z.string().uuid()),
  expires_at: z.string().datetime().optional(),
  max_views: z.number().int().positive().optional(),
  is_one_time: z.boolean().default(false),
  geofence_enabled: z.boolean().default(false),
  geofence_latitude: z.number().optional(),
  geofence_longitude: z.number().optional(),
  geofence_radius_miles: z.number().optional(),
  security_settings: z.object({
    require_pin: z.boolean().default(false),
    pin_code: z.string().optional(),
    block_screenshots: z.boolean().default(true),
    device_lock: z.boolean().default(false),
  }).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const AddWhitelistSchema = z.object({
  customer_name: z.string(),
  customer_phone: z.string().optional(),
  customer_email: z.string().email().optional(),
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

// Generate unique access token
function generateAccessToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// ============================================================================
// HANDLERS
// ============================================================================

// List menus
async function listMenus(req: Request, params: Record<string, string>): Promise<Response> {
  try {
    const { supabase, tenantId } = await getAuthContext(req);
    const url = new URL(req.url);
    
    const status = url.searchParams.get('status');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    let query = supabase
      .from('disposable_menus')
      .select(`
        *,
        products:disposable_menu_products(
          product_id,
          product:products(id, name, price, image_url)
        ),
        whitelist:menu_access_whitelist(count)
      `, { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
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

// Get single menu
async function getMenu(req: Request, params: Record<string, string>): Promise<Response> {
  try {
    const { supabase, tenantId } = await getAuthContext(req);
    const menuId = params.id;

    const { data, error } = await supabase
      .from('disposable_menus')
      .select(`
        *,
        products:disposable_menu_products(
          product_id,
          product:products(*)
        ),
        whitelist:menu_access_whitelist(*)
      `)
      .eq('id', menuId)
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

// Create menu
async function createMenu(req: Request, params: Record<string, string>): Promise<Response> {
  try {
    const { supabase, tenantId, userId } = await getAuthContext(req);
    const body = await req.json();

    // Validate input
    const validation = CreateMenuSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse(`Validation error: ${(validation as { success: false; error: { message: string } }).error.message}`);
    }

    const input = validation.data;
    const accessToken = generateAccessToken();

    // Create menu
    const { data: menu, error: menuError } = await supabase
      .from('disposable_menus')
      .insert({
        tenant_id: tenantId,
        name: input.name,
        description: input.description,
        access_token: accessToken,
        expires_at: input.expires_at,
        max_views: input.max_views,
        is_one_time: input.is_one_time,
        geofence_enabled: input.geofence_enabled,
        geofence_latitude: input.geofence_latitude,
        geofence_longitude: input.geofence_longitude,
        geofence_radius_miles: input.geofence_radius_miles,
        security_settings: input.security_settings,
        created_by: userId,
        status: 'active',
      })
      .select()
      .single();

    if (menuError) {
      return errorResponse(menuError.message);
    }

    // Add products to menu
    if (input.product_ids.length > 0) {
      const productInserts = input.product_ids.map(productId => ({
        menu_id: menu.id,
        product_id: productId,
      }));

      const { error: productError } = await supabase
        .from('disposable_menu_products')
        .insert(productInserts);

      if (productError) {
        // Rollback menu creation
        await supabase.from('disposable_menus').delete().eq('id', menu.id);
        return errorResponse(`Failed to add products: ${productError.message}`);
      }
    }

    // Generate shareable URL
    const baseUrl = Deno.env.get('PUBLIC_SITE_URL') || 'https://app.floraiq.io';
    const shareableUrl = `${baseUrl}/m/${accessToken}`;

    // Log audit event
    await supabase.rpc('log_audit_event', {
      p_tenant_id: tenantId,
      p_category: 'admin_action',
      p_event_type: 'menu_created',
      p_actor_type: 'tenant_user',
      p_actor_id: userId,
      p_target_type: 'menu',
      p_target_id: menu.id,
      p_details: { 
        product_count: input.product_ids.length,
        has_expiration: !!input.expires_at,
        has_geofence: input.geofence_enabled,
      },
    });

    return jsonResponse({ 
      data: { ...menu, shareable_url: shareableUrl } 
    }, 201);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Unknown error', 401);
  }
}

// Burn (deactivate) menu
async function burnMenu(req: Request, params: Record<string, string>): Promise<Response> {
  try {
    const { supabase, tenantId, userId } = await getAuthContext(req);
    const menuId = params.id;
    const body = await req.json();
    const burnType = body.type || 'soft'; // 'soft' or 'hard'

    // Get current menu
    const { data: menu } = await supabase
      .from('disposable_menus')
      .select('status')
      .eq('id', menuId)
      .eq('tenant_id', tenantId)
      .single();

    if (!menu) {
      return errorResponse('Menu not found', 404);
    }

    if (menu.status === 'burned') {
      return errorResponse('Menu is already burned');
    }

    // Update menu status
    const { error: updateError } = await supabase
      .from('disposable_menus')
      .update({
        status: 'burned',
        burned_at: new Date().toISOString(),
        burned_by: userId,
      })
      .eq('id', menuId)
      .eq('tenant_id', tenantId);

    if (updateError) {
      return errorResponse(updateError.message);
    }

    // If hard burn, also delete sensitive data
    if (burnType === 'hard') {
      await supabase
        .from('menu_access_whitelist')
        .delete()
        .eq('menu_id', menuId);
    }

    // Log to burn history
    await supabase.from('menu_burn_history').insert({
      menu_id: menuId,
      tenant_id: tenantId,
      burned_by: userId,
      burn_type: burnType,
      reason: body.reason || 'Manual burn',
    });

    // Log audit event
    await supabase.rpc('log_audit_event', {
      p_tenant_id: tenantId,
      p_category: 'menu_security',
      p_event_type: 'menu_burned',
      p_severity: 'warning',
      p_actor_type: 'tenant_user',
      p_actor_id: userId,
      p_target_type: 'menu',
      p_target_id: menuId,
      p_details: { burn_type: burnType, reason: body.reason },
    });

    return jsonResponse({ message: 'Menu burned successfully' });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Unknown error', 401);
  }
}

// Add to whitelist
async function addToWhitelist(req: Request, params: Record<string, string>): Promise<Response> {
  try {
    const { supabase, tenantId, userId } = await getAuthContext(req);
    const menuId = params.id;
    const body = await req.json();

    // Validate input
    const validation = AddWhitelistSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse(`Validation error: ${(validation as { success: false; error: { message: string } }).error.message}`);
    }

    const input = validation.data;
    const accessToken = generateAccessToken();

    // Verify menu exists and belongs to tenant
    const { data: menu } = await supabase
      .from('disposable_menus')
      .select('id, tenant_id')
      .eq('id', menuId)
      .eq('tenant_id', tenantId)
      .single();

    if (!menu) {
      return errorResponse('Menu not found', 404);
    }

    // Add to whitelist
    const { data, error } = await supabase
      .from('menu_access_whitelist')
      .insert({
        menu_id: menuId,
        customer_name: input.customer_name,
        customer_phone: input.customer_phone,
        customer_email: input.customer_email,
        unique_token: accessToken,
        notes: input.notes,
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      return errorResponse(error.message);
    }

    // Generate personalized link
    const baseUrl = Deno.env.get('PUBLIC_SITE_URL') || 'https://app.floraiq.io';
    const personalizedUrl = `${baseUrl}/m/${accessToken}`;

    return jsonResponse({ 
      data: { ...data, personalized_url: personalizedUrl } 
    }, 201);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Unknown error', 401);
  }
}

// Export route handlers
export const menusRouter: Record<string, RequestHandler> = {
  'GET /menus': listMenus,
  'GET /menus/:id': getMenu,
  'POST /menus': createMenu,
  'POST /menus/:id/burn': burnMenu,
  'POST /menus/:id/whitelist': addToWhitelist,
};

