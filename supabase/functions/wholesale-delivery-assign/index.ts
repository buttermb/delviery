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

    const { order_id, runner_id } = await req.json();

    // Validate input
    if (!order_id || !runner_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if order exists and is pending
    const { data: order } = await supabaseClient
      .from('wholesale_orders')
      .select('status')
      .eq('id', order_id)
      .single();

    if (!order || order.status !== 'pending') {
      return new Response(
        JSON.stringify({ error: 'Order not available for assignment' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if runner exists and is available
    const { data: runner } = await supabaseClient
      .from('wholesale_runners')
      .select('status')
      .eq('id', runner_id)
      .single();

    if (!runner || runner.status !== 'available') {
      return new Response(
        JSON.stringify({ error: 'Runner not available' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create delivery record
    const { data: delivery, error: deliveryError } = await supabaseClient
      .from('wholesale_deliveries')
      .insert({
        order_id,
        runner_id,
        status: 'assigned',
        assigned_at: new Date().toISOString()
      })
      .select()
      .single();

    if (deliveryError) throw deliveryError;

    // Update order status
    await supabaseClient
      .from('wholesale_orders')
      .update({ status: 'assigned' })
      .eq('id', order_id);

    // Update runner status
    await supabaseClient
      .from('wholesale_runners')
      .update({ status: 'on_delivery' })
      .eq('id', runner_id);

    return new Response(
      JSON.stringify({ 
        success: true,
        delivery_id: delivery.id,
        message: 'Delivery assigned successfully'
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
