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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const {
      menu_id,
      access_token,
      order_items,
      delivery_method,
      payment_method,
      contact_phone,
      delivery_address,
      customer_notes
    } = await req.json();

    // Validate input
    if (!menu_id || !order_items || order_items.length === 0 || !contact_phone) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify menu is active
    const { data: menu, error: menuError } = await supabaseClient
      .from('disposable_menus')
      .select('*')
      .eq('id', menu_id)
      .single();

    if (menuError || !menu || menu.status !== 'active') {
      return new Response(
        JSON.stringify({ error: 'Menu not available' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find whitelist entry if access token provided
    let whitelistEntry = null;
    if (access_token) {
      const { data: whitelist } = await supabaseClient
        .from('menu_access_whitelist')
        .select('*')
        .eq('menu_id', menu_id)
        .eq('unique_access_token', access_token)
        .single();

      if (whitelist && whitelist.status === 'active') {
        whitelistEntry = whitelist;
      }
    }

    // Calculate total
    const total_amount = order_items.reduce((sum: number, item: any) => {
      return sum + (parseFloat(item.price) * parseFloat(item.quantity));
    }, 0);

    // Check min/max order quantities
    const totalQuantity = order_items.reduce((sum: number, item: any) => sum + parseFloat(item.quantity), 0);
    
    if (menu.min_order_quantity && totalQuantity < menu.min_order_quantity) {
      return new Response(
        JSON.stringify({ 
          error: `Minimum order quantity is ${menu.min_order_quantity}` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (menu.max_order_quantity && totalQuantity > menu.max_order_quantity) {
      return new Response(
        JSON.stringify({ 
          error: `Maximum order quantity is ${menu.max_order_quantity}` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create order
    const { data: order, error: orderError } = await supabaseClient
      .from('menu_orders')
      .insert({
        menu_id,
        tenant_id: menu.tenant_id,
        access_whitelist_id: whitelistEntry?.id || null,
        order_data: { items: order_items },
        total_amount,
        delivery_method,
        payment_method,
        contact_phone,
        delivery_address,
        customer_notes
      })
      .select()
      .single();

    if (orderError) throw orderError;

    // Log action in access logs
    if (whitelistEntry) {
      await supabaseClient
        .from('menu_access_logs')
        .insert({
          menu_id,
          access_whitelist_id: whitelistEntry.id,
          actions_taken: { action: 'placed_order', order_id: order.id }
        });
    }

    console.log(`Order placed successfully: ${order.id} for menu ${menu_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        order_id: order.id,
        order_number: `MENU-${order.id.slice(0, 8).toUpperCase()}`,
        total: total_amount,
        status: 'pending'
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
