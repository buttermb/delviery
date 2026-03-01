// Edge Function: create-encrypted-menu
import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts';
import { withZenProtection } from '../_shared/zen-firewall.ts';

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
  })).optional(),
  expiration_date: z.string().datetime().optional(),
  never_expires: z.boolean().optional(),
});

serve(withZenProtection(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Missing environment variables' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    // Generate unique encrypted URL token
    const urlToken = crypto.randomUUID().replace(/-/g, '').substring(0, 24);

    // Hash the access code (for verification)
    const encoder = new TextEncoder();
    const accessCodeData = encoder.encode(menuData.access_code);
    const hashBuffer = await crypto.subtle.digest('SHA-256', accessCodeData);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const accessCodeHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Create menu with plaintext data first (including the access_code for later retrieval)
    const { data: menu, error: menuError } = await supabase
      .from('disposable_menus')
      .insert({
        tenant_id: menuData.tenant_id,
        name: menuData.name,
        description: menuData.description,
        custom_message: menuData.custom_message,
        show_product_images: menuData.show_product_images,
        encrypted_url_token: urlToken,
        access_code: menuData.access_code, // Store plaintext for sharing (will be encrypted later)
        access_code_hash: accessCodeHash,
        security_settings: menuData.security_settings || {},
        appearance_settings: menuData.appearance_settings || {},
        min_order_quantity: menuData.min_order_quantity,
        max_order_quantity: menuData.max_order_quantity,
        expiration_date: menuData.expiration_date,
        never_expires: menuData.never_expires ?? true,
        status: 'active',
        is_encrypted: false, // Will be set to true after encryption
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
      // Validate that all product_ids exist in wholesale_inventory and belong to the tenant
      // (disposable_menu_products.product_id references wholesale_inventory.id)
      const productIds = menuData.products.map(p => p.product_id);
      const { data: existingProducts, error: validationError } = await supabase
        .from('wholesale_inventory')
        .select('id')
        .eq('tenant_id', menuData.tenant_id)
        .in('id', productIds);

      if (validationError) {
        console.error('Failed to validate products:', validationError);
        await supabase.from('disposable_menus').delete().eq('id', menu.id);
        return new Response(
          JSON.stringify({ error: 'Failed to validate products', details: validationError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const existingProductIds = new Set(existingProducts?.map(p => p.id) || []);
      const invalidProducts = productIds.filter(id => !existingProductIds.has(id));

      if (invalidProducts.length > 0) {
        console.error('Invalid product IDs:', invalidProducts);
        await supabase.from('disposable_menus').delete().eq('id', menu.id);
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
        is_encrypted: false, // Will be set to true after encryption
      }));

      const { error: productsError } = await supabase
        .from('disposable_menu_products')
        .insert(productsToInsert);

      if (productsError) {
        console.error('Failed to add products:', productsError);
        // Rollback: delete the menu
        await supabase.from('disposable_menus').delete().eq('id', menu.id);
        return new Response(
          JSON.stringify({ error: 'Failed to add products', details: productsError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // NOW ENCRYPT THE MENU DATA
    const { data: encryptResult, error: encryptError } = await supabase
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
    await supabase
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
}));
