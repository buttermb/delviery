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

    const { client_id, items, delivery_address, delivery_notes } = await req.json();

    // Validate input
    if (!client_id || !items || items.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get client info to check credit
    const { data: client } = await supabaseClient
      .from('wholesale_clients')
      .select('*, credit_limit, outstanding_balance')
      .eq('id', client_id)
      .single();

    if (!client) {
      return new Response(
        JSON.stringify({ error: 'Client not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate order total
    let totalAmount = 0;
    const processedItems = [];

    for (const item of items) {
      const { data: inventory } = await supabaseClient
        .from('wholesale_inventory')
        .select('*, products(name, wholesale_price_per_lb)')
        .eq('id', item.inventory_id)
        .single();

      if (!inventory || inventory.quantity_lbs < item.quantity_lbs) {
        return new Response(
          JSON.stringify({ error: `Insufficient inventory for item ${item.inventory_id}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const itemTotal = item.quantity_lbs * inventory.products.wholesale_price_per_lb;
      totalAmount += itemTotal;

      processedItems.push({
        inventory_id: item.inventory_id,
        quantity_lbs: item.quantity_lbs,
        price_per_lb: inventory.products.wholesale_price_per_lb,
        subtotal: itemTotal
      });
    }

    // Check credit limit
    const newBalance = client.outstanding_balance + totalAmount;
    if (newBalance > client.credit_limit) {
      return new Response(
        JSON.stringify({ 
          error: 'Credit limit exceeded',
          available_credit: client.credit_limit - client.outstanding_balance,
          order_total: totalAmount
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create wholesale order
    const { data: order, error: orderError } = await supabaseClient
      .from('wholesale_orders')
      .insert({
        client_id,
        total_amount: totalAmount,
        delivery_address,
        delivery_notes,
        status: 'pending'
      })
      .select()
      .single();

    if (orderError) throw orderError;

    // Create order items
    const orderItems = processedItems.map(item => ({
      ...item,
      order_id: order.id
    }));

    const { error: itemsError } = await supabaseClient
      .from('wholesale_order_items')
      .insert(orderItems);

    if (itemsError) throw itemsError;

    // Update inventory quantities
    for (const item of items) {
      await supabaseClient.rpc('decrement_wholesale_inventory', {
        p_inventory_id: item.inventory_id,
        p_quantity: item.quantity_lbs
      });
    }

    // Update client outstanding balance
    await supabaseClient
      .from('wholesale_clients')
      .update({ outstanding_balance: newBalance })
      .eq('id', client_id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        order_id: order.id,
        order_number: order.order_number,
        total_amount: totalAmount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
