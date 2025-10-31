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

    const { delivery_id, status, location, notes } = await req.json();

    // Validate input
    if (!delivery_id || !status) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validStatuses = ['assigned', 'picked_up', 'in_transit', 'delivered', 'failed'];
    if (!validStatuses.includes(status)) {
      return new Response(
        JSON.stringify({ error: 'Invalid status' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get delivery info
    const { data: delivery } = await supabaseClient
      .from('wholesale_deliveries')
      .select('order_id, runner_id, status')
      .eq('id', delivery_id)
      .single();

    if (!delivery) {
      return new Response(
        JSON.stringify({ error: 'Delivery not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update delivery record
    const updateData: any = { status };
    
    if (status === 'picked_up') updateData.picked_up_at = new Date().toISOString();
    if (status === 'delivered') updateData.delivered_at = new Date().toISOString();
    if (location) updateData.current_location = location;
    if (notes) updateData.notes = notes;

    const { error: updateError } = await supabaseClient
      .from('wholesale_deliveries')
      .update(updateData)
      .eq('id', delivery_id);

    if (updateError) throw updateError;

    // Update order status
    const orderStatus = status === 'delivered' ? 'completed' : 
                       status === 'failed' ? 'failed' : 'in_progress';
    
    await supabaseClient
      .from('wholesale_orders')
      .update({ status: orderStatus })
      .eq('id', delivery.order_id);

    // If delivered, update runner status to available
    if (status === 'delivered' || status === 'failed') {
      await supabaseClient
        .from('wholesale_runners')
        .update({ status: 'available' })
        .eq('id', delivery.runner_id);

      // Update runner stats
      if (status === 'delivered') {
        await supabaseClient.rpc('increment_runner_deliveries', {
          p_runner_id: delivery.runner_id
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Delivery status updated to ${status}`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
