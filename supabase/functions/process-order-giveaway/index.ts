import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { orderId } = await req.json();

    if (!orderId) {
      throw new Error("Order ID is required");
    }

    // Get order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        id,
        user_id,
        customer_name,
        customer_email,
        customer_phone,
        delivery_borough,
        status
      `)
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      throw new Error('Order not found');
    }

    // Only process delivered orders
    if (order.status !== 'delivered') {
      return new Response(
        JSON.stringify({ 
          success: false,
          message: 'Order must be delivered to earn entries'
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if entry already exists for this order
    const { data: existingEntry } = await supabase
      .from('giveaway_entries')
      .select('id')
      .eq('order_id', orderId)
      .single();

    if (existingEntry) {
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Entries already created for this order'
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get active giveaway
    const { data: giveaway } = await supabase
      .from('giveaways')
      .select('id')
      .eq('status', 'active')
      .single();

    if (!giveaway) {
      console.log('No active giveaway found');
      return new Response(
        JSON.stringify({ 
          success: false,
          message: 'No active giveaway'
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create giveaway entry
    const createResponse = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/create-giveaway-entry-robust`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
        },
        body: JSON.stringify({
          giveawayId: giveaway.id,
          email: order.customer_email,
          phone: order.customer_phone,
          firstName: order.customer_name?.split(' ')[0] || '',
          lastName: order.customer_name?.split(' ').slice(1).join(' ') || '',
          borough: order.delivery_borough,
          entryType: 'purchase',
          orderId: order.id,
          ipAddress: 'system',
          userAgent: 'purchase-processor'
        })
      }
    );

    const result = await createResponse.json();

    if (result.success) {
      // Send confirmation email/SMS
      try {
        await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-klaviyo-email`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
            },
            body: JSON.stringify({
              to: order.customer_email,
              event: 'Giveaway Entry Earned',
              properties: {
                first_name: order.customer_name?.split(' ')[0] || 'Customer',
                entries_earned: 5,
                total_entries: result.total_entries,
                entry_numbers: `${result.entry_start}-${result.entry_end}`
              }
            })
          }
        );
      } catch (emailError) {
        console.error('Failed to send confirmation:', emailError);
      }
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Process order giveaway error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});