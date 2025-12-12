import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts';
import { createLogger } from '../_shared/logger.ts';
import { MenuCache } from '../_shared/menu-cache.ts';
import { VelocityChecker } from '../_shared/velocity-check.ts';
import { MenuEventProcessor } from '../_shared/event-bus.ts';

const logger = createLogger('access-encrypted-menu-v2');

// Zod validation schema
const accessMenuSchema = z.object({
  url_token: z.string().min(1, 'URL token is required').max(255),
  access_code: z.string().max(50).optional(),
  bypass_cache: z.boolean().default(false),
});

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const redisHost = Deno.env.get('REDIS_HOST') || 'localhost';
    const redisPort = parseInt(Deno.env.get('REDIS_PORT') || '6379');
    const redisPassword = Deno.env.get('REDIS_PASSWORD');

    const supabase = createClient(supabaseUrl, supabaseKey);
    const cache = new MenuCache(redisHost, redisPort, redisPassword);
    const velocity = new VelocityChecker(redisHost, redisPort, redisPassword);
    const events = new MenuEventProcessor(supabaseUrl, supabaseKey);

    // Parse and validate request body
    const rawBody = await req.json();
    const validationResult = accessMenuSchema.safeParse(rawBody);

    if (!validationResult.success) {
      logger.warn('Validation failed', { errors: validationResult.error.flatten() });
      return new Response(
        JSON.stringify({
          error: 'Validation failed',
          details: validationResult.error.flatten().fieldErrors,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { url_token, access_code, bypass_cache } = validationResult.data;
    const clientIp = req.headers.get('x-forwarded-for') || 'unknown';

    // Fetch Menu (Metadata only)
    const { data: menu, error: menuError } = await supabase
      .from('disposable_menus')
      .select('*')
      .eq('encrypted_url_token', url_token)
      .single();

    if (menuError || !menu) {
      logger.warn('Menu not found', { url_token });
      return new Response(
        JSON.stringify({ error: 'Menu not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Velocity Check
    const velocityCheck = await velocity.checkVelocity(menu.id, clientIp);
    if (!velocityCheck.allowed) {
      logger.warn('Velocity limit exceeded', { menuId: menu.id, ip: clientIp });
      await events.process({
        type: 'SECURITY_BREACH',
        payload: { reason: 'Velocity limit exceeded', ip: clientIp, action: velocityCheck.action },
        timestamp: new Date(),
        tenantId: menu.tenant_id,
        menuId: menu.id,
      });
      return new Response(
        JSON.stringify({ error: 'Too many requests' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Status Check
    if (menu.status !== 'active') {
      logger.info('Menu not active', { menuId: menu.id, status: menu.status });
      return new Response(
        JSON.stringify({ error: 'Menu is not active' }),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Access Code Check
    if (menu.access_code_hash) {
      if (!access_code) {
        return new Response(
          JSON.stringify({ error: 'Access code required', require_code: true }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Get Data (Cached or Decrypted)
    let responseData;
    const cached = await cache.get(menu.tenant_id, menu.id);

    if (cached && !bypass_cache) {
      responseData = cached;
      await cache.incrementAccessCount(menu.tenant_id, menu.id);
    } else {
      // Decrypt
      const { data: decrypted, error: decryptError } = await supabase.rpc('decrypt_menu_data', {
        menu_id: menu.id,
      });

      if (decryptError) throw decryptError;

      // Fetch Products
      const { data: products } = await supabase
        .from('disposable_menu_products_decrypted')
        .select('*, product:wholesale_inventory(*)')
        .eq('menu_id', menu.id)
        .order('display_order');

      responseData = { menu: decrypted, products };

      // Cache it
      await cache.set(menu.tenant_id, menu.id, {
        decryptedData: decrypted,
        products: products || [],
        accessCount: 1,
        lastAccessed: new Date().toISOString(),
      });
    }

    // Log Access
    await events.process({
      type: 'MENU_ACCESSED',
      payload: { ip: clientIp, userAgent: req.headers.get('user-agent') },
      timestamp: new Date(),
      tenantId: menu.tenant_id,
      menuId: menu.id,
    });

    // Update Velocity Record
    await velocity.recordAccess(menu.id, clientIp);

    logger.info('Menu accessed successfully', { menuId: menu.id, tenantId: menu.tenant_id });

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    logger.error('Error accessing menu', { error: error instanceof Error ? error.message : 'Unknown' });
    return new Response(
      JSON.stringify({ error: 'Internal Server Error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
