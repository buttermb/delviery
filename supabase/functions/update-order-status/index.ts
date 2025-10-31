import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { orderId, status, message, lat, lng, courierId } = await req.json();

    // Verify user has permission (courier or admin)
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["courier", "admin"]);

    if (!roles || roles.length === 0) {
      return new Response(
        JSON.stringify({ error: "Only couriers and admins can update order status" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get courier record if courierId provided or if user is a courier
    let courierRecordId = null;
    if (courierId || (roles.some(r => r.role === "courier") && status === "confirmed")) {
      const { data: courierRecord } = await supabase
        .from("couriers")
        .select("id")
        .eq("user_id", courierId || user.id)
        .single();
      
      if (courierRecord) {
        courierRecordId = courierRecord.id;
      }
    }

    // Build update object
    const updateData: any = { 
      status
    };

    // If confirming order and courier is accepting, assign them
    if (status === "confirmed" && courierRecordId) {
      updateData.courier_id = courierRecordId;
    }

    console.log("Updating order with data:", updateData);
    
    // Update order status
    const { error: updateError } = await supabase
      .from("orders")
      .update(updateData)
      .eq("id", orderId);

    if (updateError) {
      console.error("Update error details:", JSON.stringify(updateError));
      return new Response(
        JSON.stringify({ error: "Failed to update order", details: updateError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log("Order updated successfully");

    // Add tracking entry
    await supabase.from("order_tracking").insert({
      order_id: orderId,
      status,
      message: message || `Order ${status}`,
      lat,
      lng,
    });

    // Update delivery times if applicable
    if (status === "out_for_delivery") {
      await supabase
        .from("deliveries")
        .update({ actual_pickup_time: new Date().toISOString() })
        .eq("order_id", orderId);
    } else if (status === "delivered") {
      await supabase
        .from("deliveries")
        .update({ actual_dropoff_time: new Date().toISOString() })
        .eq("order_id", orderId);
      
      await supabase
        .from("orders")
        .update({ 
          payment_status: "completed"
        })
        .eq("id", orderId);
      
      // Automatically create giveaway entries (5 entries per purchase)
      try {
        console.log('Creating giveaway entries for order:', orderId);
        const giveawayResponse = await supabase.functions.invoke('process-order-giveaway', {
          body: { orderId }
        });
        
        if (giveawayResponse.data?.success) {
          console.log('Giveaway entries created successfully');
          // Notify customer via localStorage for UI update
          // This will be picked up by FloatingGiveawayButton
        }
      } catch (giveawayError) {
        console.error('Failed to create giveaway entries:', giveawayError);
        // Don't fail order delivery if giveaway fails
      }
    }

    // Create audit log
    await supabase.from("audit_logs").insert({
      entity_type: "order",
      entity_id: orderId,
      action: "STATUS_UPDATE",
      user_id: user.id,
      details: { status, message },
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Update order status error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to update order" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
