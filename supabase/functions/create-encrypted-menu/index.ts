// Edge Function: create-encrypted-menu
import { corsHeaders, z } from '../_shared/deps.ts';
import { withCreditGate } from '../_shared/creditGate.ts';

// Request validation schema
const CreateMenuSchema = z.object({
  tenant_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  custom_message: z.string().max(500).optional(),
  show_product_images: z.boolean().optional(),
  security_settings: z.object({}).passthrough().optional(),
  appearance_settings: z.object({}).passthrough().optional(),
  min_order_quantity: z.number().positive().optional(),
  max_order_quantity: z.number().positive().optional(),
  access_code: z.string().min(6),
  products: z.array(z.object({
    product_id: z.string().uuid(),
    custom_price: z.number().positive().optional(),
    display_availability: z.boolean().optional(),
    display_order: z.number().int().optional(),
    prices: z.array(z.object({
      label: z.string().min(1),
      price: z.number().positive(),
      weight_grams: z.number().positive().optional(),
      max_qty: z.number().int().positive().optional(),
      note: z.string().optional(),
    })).optional(),
    vendor_name: z.string().optional(),
    badge: z.string().optional(),
  })).optional(),
  expiration_date: z.string().datetime().optional(),
  never_expires: z.boolean().optional(),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  return withCreditGate(req, 'menu_create', async (tenantId, serviceClient) => {
    try {
      // Parse and validate request
      const body = await req.json();
      const validationResult = CreateMenuSchema.safeParse(body);

      if (!validationResult.success) {
        const zodError = validationResult as { success: false; error: { errors: unknown[] } };
        return new Response(
          JSON.stringify({
            error: 'Invalid input',
            details: zodError.error.errors
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const menuData = validationResult.data;

      // Verify the request tenant_id matches the authenticated tenant
      if (menuData.tenant_id !== tenantId) {
        // Fallback: check if user is the tenant owner via the requested tenant_id
        const authHeader = req.headers.get('Authorization');
        const token = authHeader?.replace('Bearer ', '') ?? '';
        const { data: { user } } = await serviceClient.auth.getUser(token);

        if (user) {
          const { data: tenant } = await serviceClient
            .from('tenants')
            .select('id')
            .eq('id', menuData.tenant_id)
            .eq('owner_email', user.email)
            .maybeSingle();

          if (!tenant) {
            return new Response(
              JSON.stringify({ error: 'Forbidden - you do not belong to this tenant' }),
              { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } else {
          return new Response(
            JSON.stringify({ error: 'Forbidden - you do not belong to this tenant' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Generate unique encrypted URL token
      const urlToken = crypto.randomUUID().replace(/-/g, '').substring(0, 24);

      // Hash the access code (for verification)
      const encoder = new TextEncoder();
      const accessCodeData = encoder.encode(menuData.access_code);
      const hashBuffer = await crypto.subtle.digest('SHA-256', accessCodeData);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const accessCodeHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      // Create menu with plaintext data first (including the access_code for later retrieval)
      const { data: menu, error: menuError } = await serviceClient
        .from('disposable_menus')
        .insert({
          tenant_id: menuData.tenant_id,
          name: menuData.name,
          description: menuData.description,
          custom_message: menuData.custom_message,
          show_product_images: menuData.show_product_images,
          encrypted_url_token: urlToken,
          access_code: menuData.access_code,
          access_code_hash: accessCodeHash,
          security_settings: menuData.security_settings || {},
          appearance_settings: menuData.appearance_settings || {},
          min_order_quantity: menuData.min_order_quantity,
          max_order_quantity: menuData.max_order_quantity,
          expiration_date: menuData.expiration_date,
          never_expires: menuData.never_expires ?? true,
          status: 'active',
          is_encrypted: false,
        })
        .select('id')
        .single();

      if (menuError || !menu) {
        console.error('Failed to create menu:', menuError);
        return new Response(
          JSON.stringify({ error: 'Failed to create menu', details: menuError?.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Add products if provided
      if (menuData.products && menuData.products.length > 0) {
        const productIds = menuData.products.map(p => p.product_id);
        const { data: existingProducts, error: validationError } = await serviceClient
          .from('wholesale_inventory')
          .select('id')
          .eq('tenant_id', menuData.tenant_id)
          .in('id', productIds);

        if (validationError) {
          console.error('Failed to validate products:', validationError);
          await serviceClient.from('disposable_menus').delete().eq('id', menu.id);
          return new Response(
            JSON.stringify({ error: 'Failed to validate products', details: validationError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const existingProductIds = new Set(existingProducts?.map(p => p.id) || []);
        const invalidProducts = productIds.filter(id => !existingProductIds.has(id));

        if (invalidProducts.length > 0) {
          console.error('Invalid product IDs:', invalidProducts);
          await serviceClient.from('disposable_menus').delete().eq('id', menu.id);
          return new Response(
            JSON.stringify({
              error: 'Invalid product IDs',
              details: `The following product IDs do not exist or do not belong to this tenant: ${invalidProducts.join(', ')}`
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const productsToInsert = menuData.products.map(p => ({
          menu_id: menu.id,
          product_id: p.product_id,
          custom_price: p.custom_price,
          display_availability: p.display_availability ?? true,
          display_order: p.display_order ?? 0,
          prices: p.prices && p.prices.length > 0 ? p.prices : null,
          vendor_name: p.vendor_name ?? null,
          badge: p.badge ?? null,
          is_encrypted: false,
        }));

        const { error: productsError } = await serviceClient
          .from('disposable_menu_products')
          .insert(productsToInsert);

        if (productsError) {
          console.error('Failed to add products:', productsError);
          await serviceClient.from('disposable_menus').delete().eq('id', menu.id);
          return new Response(
            JSON.stringify({ error: 'Failed to add products', details: productsError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // NOW ENCRYPT THE MENU DATA
      const { data: encryptResult, error: encryptError } = await serviceClient
        .rpc('encrypt_disposable_menu', { menu_id: menu.id });

      if (encryptError || !encryptResult) {
        console.error('Encryption failed:', encryptError);
        return new Response(
          JSON.stringify({
            error: 'Menu created but encryption failed',
            menu_id: menu.id,
            details: encryptError?.message
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Log the encryption for audit
      await serviceClient
        .from('menu_decryption_audit')
        .insert({
          menu_id: menu.id,
          access_method: 'api_encryption',
          success: true,
        });

      return new Response(
        JSON.stringify({
          success: true,
          menu_id: menu.id,
          url_token: urlToken,
          encrypted: true,
          message: 'Menu created and encrypted successfully',
        }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (error: unknown) {
      console.error('Unexpected error:', error);
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Internal server error'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  });
});
