import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // Verify authenticated user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const {
      menu_id,
      burn_type = 'hard',
      burn_reason,
      auto_regenerate = false,
      migrate_customers = false
    } = await req.json();

    // Validate input
    if (!menu_id || !burn_reason) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: menu_id, burn_reason' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get menu data
    const { data: menu, error: menuError } = await supabaseClient
      .from('disposable_menus')
      .select(`
        *,
        disposable_menu_products(*),
        menu_access_whitelist(*),
        menu_access_logs(count),
        menu_orders(count, total_amount)
      `)
      .eq('id', menu_id)
      .single();

    if (menuError || !menu) {
      return new Response(
        JSON.stringify({ error: 'Menu not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate stats snapshot
    const totalOrders = menu.menu_orders?.length || 0;
    const totalRevenue = menu.menu_orders?.reduce((sum: number, order: any) => sum + parseFloat(order.total_amount || 0), 0) || 0;
    const totalViews = menu.menu_access_logs?.[0]?.count || 0;

    const stats_snapshot = {
      total_views: totalViews,
      total_orders: totalOrders,
      total_revenue: totalRevenue,
      total_customers: menu.menu_access_whitelist?.length || 0
    };

    // Update menu status
    const burnStatus = burn_type === 'hard' ? 'hard_burned' : 'soft_burned';
    const { error: updateError } = await supabaseClient
      .from('disposable_menus')
      .update({
        status: burnStatus,
        burned_at: new Date().toISOString(),
        burn_reason
      })
      .eq('id', menu_id);

    if (updateError) throw updateError;

    // Revoke all access
    await supabaseClient
      .from('menu_access_whitelist')
      .update({
        status: 'revoked',
        revoked_at: new Date().toISOString(),
        revoked_reason: `Menu burned: ${burn_reason}`
      })
      .eq('menu_id', menu_id)
      .neq('status', 'blocked');

    let newMenu = null;
    let customersToNotify: any[] = [];

    // Auto-regenerate if requested
    if (auto_regenerate) {
      // Generate new tokens
      const generateToken = () => {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let token = '';
        for (let i = 0; i < 12; i++) {
          token += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return token;
      };

      const generateAccessCode = () => {
        return Math.floor(100000 + Math.random() * 900000).toString();
      };

      const hashAccessCode = async (code: string) => {
        const encoder = new TextEncoder();
        const data = encoder.encode(code);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      };

      const newToken = generateToken();
      const newAccessCode = generateAccessCode();
      const newAccessCodeHash = await hashAccessCode(newAccessCode);

      // Create new menu
      const { data: regeneratedMenu, error: regenError } = await supabaseClient
        .from('disposable_menus')
        .insert({
          name: `${menu.name} (v2)`,
          description: menu.description,
          encrypted_url_token: newToken,
          access_code_hash: newAccessCodeHash,
          security_settings: menu.security_settings,
          appearance_settings: menu.appearance_settings,
          min_order_quantity: menu.min_order_quantity,
          max_order_quantity: menu.max_order_quantity,
          created_by: user.id
        })
        .select()
        .single();

      if (regenError) throw regenError;
      newMenu = { ...regeneratedMenu, access_code: newAccessCode, token: newToken };

      // Copy products
      const newProducts = menu.disposable_menu_products.map((p: any) => ({
        menu_id: regeneratedMenu.id,
        product_id: p.product_id,
        custom_price: p.custom_price,
        display_order: p.display_order
      }));

      await supabaseClient.from('disposable_menu_products').insert(newProducts);

      // Migrate customers if requested
      if (migrate_customers) {
        const activeCustomers = menu.menu_access_whitelist.filter((w: any) => w.status === 'active');
        
        for (const customer of activeCustomers) {
          const newUniqueToken = generateToken();
          
          await supabaseClient.from('menu_access_whitelist').insert({
            menu_id: regeneratedMenu.id,
            customer_id: customer.customer_id,
            customer_name: customer.customer_name,
            customer_phone: customer.customer_phone,
            customer_email: customer.customer_email,
            unique_access_token: newUniqueToken,
            status: 'pending',
            invited_by: user.id
          });

          customersToNotify.push({
            name: customer.customer_name,
            phone: customer.customer_phone,
            email: customer.customer_email,
            new_token: newUniqueToken,
            new_access_code: newAccessCode
          });
        }
      }
    }

    // Create burn history record
    await supabaseClient.from('menu_burn_history').insert({
      menu_id,
      burn_type,
      burn_reason,
      burned_by: user.id,
      regenerated_menu_id: newMenu?.id || null,
      customers_migrated: customersToNotify.length,
      stats_snapshot
    });

    console.log(`Menu ${menu_id} burned successfully. Type: ${burn_type}`);

    return new Response(
      JSON.stringify({
        success: true,
        burned_menu_id: menu_id,
        regenerated_menu_id: newMenu?.id || null,
        new_url: newMenu ? `${Deno.env.get('SUPABASE_URL')?.replace('/rest/v1', '')}/m/${newMenu.token}` : null,
        new_access_code: newMenu?.access_code || null,
        customers_to_notify: customersToNotify,
        stats_snapshot
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
