import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts';
import { withZenProtection } from '../_shared/zen-firewall.ts';

// Request validation schema
const RequestSchema = z.object({
  product_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  menu_ids: z.array(z.string().uuid()).optional(),
});

serve(withZenProtection(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Missing environment variables' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate request body
    const rawBody = await req.json();
    const validationResult = RequestSchema.safeParse(rawBody);

    if (!validationResult.success) {
      return new Response(
        JSON.stringify({
          error: 'Invalid input',
          details: (validationResult as { success: false; error: { errors: unknown[] } }).error.errors
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const { product_id, tenant_id, menu_ids } = validationResult.data;

    // Get product to check visibility and stock
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, menu_visibility, available_quantity, name')
      .eq('id', product_id)
      .eq('tenant_id', tenant_id)
      .single();

    if (productError || !product) {
      console.error('Product query failed:', productError);
      return new Response(
        JSON.stringify({ 
          error: 'Product not found',
          details: productError?.message || 'No product found with given ID and tenant'
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Only sync if product should be visible in menus
    if (!product.menu_visibility || (product.available_quantity ?? 0) <= 0) {
      // Remove from all menus
      await supabase
        .from('disposable_menu_products')
        .delete()
        .eq('product_id', product_id);

      return new Response(
        JSON.stringify({ 
          message: 'Product removed from menus (out of stock or hidden)',
          synced: false
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Get menus to sync to
    let menusToSync: string[] = [];

    if (menu_ids && menu_ids.length > 0) {
      // Sync to specific menus
      menusToSync = menu_ids;
    } else {
      // Find all active menus for tenant
      const { data: menus, error: menusError } = await supabase
        .from('disposable_menus')
        .select('id')
        .eq('tenant_id', tenant_id)
        .eq('status', 'active');

      if (menusError) {
        throw menusError;
      }

      menusToSync = menus?.map(m => m.id) || [];
    }

    if (menusToSync.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: 'No active menus found to sync',
          synced: false
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Sync product to each menu
    const syncResults = [];
    for (const menuId of menusToSync) {
      // Check if product already exists in menu
      const { data: existing } = await supabase
        .from('disposable_menu_products')
        .select('id')
        .eq('menu_id', menuId)
        .eq('product_id', product_id)
        .maybeSingle();

      if (!existing) {
        // Get current max display_order for this menu
        const { data: maxOrder } = await supabase
          .from('disposable_menu_products')
          .select('display_order')
          .eq('menu_id', menuId)
          .order('display_order', { ascending: false })
          .limit(1)
          .maybeSingle();

        const nextOrder = (maxOrder?.display_order ?? -1) + 1;

        // Insert product into menu
        const { error: insertError } = await supabase
          .from('disposable_menu_products')
          .insert({
            menu_id: menuId,
            product_id: product_id,
            display_availability: true,
            display_order: nextOrder
          });

        if (insertError) {
          syncResults.push({ menu_id: menuId, success: false, error: insertError.message });
        } else {
          syncResults.push({ menu_id: menuId, success: true });
        }
      } else {
        // Already exists, update availability
        await supabase
          .from('disposable_menu_products')
          .update({ display_availability: true })
          .eq('id', existing.id);

        syncResults.push({ menu_id: menuId, success: true, already_exists: true });
      }
    }

    const successCount = syncResults.filter(r => r.success).length;

    return new Response(
      JSON.stringify({ 
        message: `Synced to ${successCount} menu(s)`,
        synced: true,
        results: syncResults
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error: unknown) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}));

