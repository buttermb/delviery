import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function logAdminAction(
  supabase: any,
  adminId: string,
  action: string,
  entityType?: string,
  entityId?: string,
  details?: any,
  req?: Request
) {
  await supabase.from("admin_audit_logs").insert({
    admin_id: adminId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    details,
    ip_address: req?.headers.get("x-forwarded-for") || "unknown",
    user_agent: req?.headers.get("user-agent") || "unknown",
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate admin
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: adminUser } = await supabase
      .from("admin_users")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (!adminUser) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { action, orderId, reason, userId, details } = await req.json();

    // ==================== CANCEL ORDER ====================
    if (action === "cancel-order") {
      if (!orderId) {
        return new Response(
          JSON.stringify({ error: "Order ID required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: order, error: updateError } = await supabase
        .from("orders")
        .update({
          status: "cancelled",
          payment_status: "refunded",
        })
        .eq("id", orderId)
        .select()
        .single();

      if (updateError) {
        return new Response(
          JSON.stringify({ error: "Failed to cancel order" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Add tracking entry
      await supabase.from("order_tracking").insert({
        order_id: orderId,
        status: "cancelled",
        message: `Order cancelled by admin: ${reason || "No reason provided"}`,
      });

      await logAdminAction(supabase, adminUser.id, "CANCEL_ORDER", "order", orderId, { reason }, req);

      return new Response(
        JSON.stringify({ success: true, order }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==================== FLAG ORDER ====================
    if (action === "flag-order") {
      if (!orderId || !reason) {
        return new Response(
          JSON.stringify({ error: "Order ID and reason required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: order, error: updateError } = await supabase
        .from("orders")
        .update({
          flagged_reason: reason,
          flagged_at: new Date().toISOString(),
        })
        .eq("id", orderId)
        .select()
        .single();

      if (updateError) {
        return new Response(
          JSON.stringify({ error: "Failed to flag order" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await logAdminAction(supabase, adminUser.id, "FLAG_ORDER", "order", orderId, { reason }, req);

      return new Response(
        JSON.stringify({ success: true, order }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==================== UNFLAG ORDER ====================
    if (action === "unflag-order") {
      if (!orderId) {
        return new Response(
          JSON.stringify({ error: "Order ID required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: order, error: updateError } = await supabase
        .from("orders")
        .update({
          flagged_reason: null,
          flagged_at: null,
        })
        .eq("id", orderId)
        .select()
        .single();

      if (updateError) {
        return new Response(
          JSON.stringify({ error: "Failed to unflag order" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await logAdminAction(supabase, adminUser.id, "UNFLAG_ORDER", "order", orderId, { reason }, req);

      return new Response(
        JSON.stringify({ success: true, order }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==================== ACCEPT ORDER ====================
    if (action === "accept-order") {
      if (!orderId) {
        return new Response(
          JSON.stringify({ error: "Order ID required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get order with address
      const { data: orderData, error: fetchError } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single();

      if (fetchError || !orderData) {
        return new Response(
          JSON.stringify({ error: "Order not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get address if available
      let addressData = null;
      if (orderData.address_id) {
        const { data: addr } = await supabase
          .from("addresses")
          .select("*")
          .eq("id", orderData.address_id)
          .single();
        addressData = addr;
      }

      // Find available courier
      const { data: courier } = await supabase
        .from("couriers")
        .select("*")
        .eq("is_active", true)
        .eq("is_online", true)
        .limit(1)
        .single();

      console.log("Found courier:", courier);

      // Update order to accepted status
      const { data: order, error: updateError } = await supabase
        .from("orders")
        .update({
          status: "accepted",
          estimated_delivery: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
          courier_id: courier?.id || null,
        })
        .eq("id", orderId)
        .select()
        .single();

      if (updateError) {
        console.error("Update error:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to accept order" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create delivery record if courier is available
      if (courier) {
        const pickupLat = 40.7589; // Default NYC coordinates
        const pickupLng = -73.9851;
        const dropoffLat = addressData?.lat || 40.7589;
        const dropoffLng = addressData?.lng || -73.9851;

        const { error: deliveryError } = await supabase
          .from("deliveries")
          .insert({
            order_id: orderId,
            courier_id: courier.id,
            pickup_lat: pickupLat,
            pickup_lng: pickupLng,
            dropoff_lat: dropoffLat,
            dropoff_lng: dropoffLng,
            estimated_pickup_time: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
            estimated_dropoff_time: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
          });

        if (deliveryError) {
          console.error("Delivery creation error:", deliveryError);
        } else {
          console.log("Delivery created successfully");
        }
      }

      // Add tracking entry
      await supabase.from("order_tracking").insert({
        order_id: orderId,
        status: "accepted",
        message: courier 
          ? `Order accepted and assigned to ${courier.full_name}`
          : "Order accepted, awaiting courier assignment",
      });

      await logAdminAction(supabase, adminUser.id, "ACCEPT_ORDER", "order", orderId, { courier_id: courier?.id }, req);

      return new Response(
        JSON.stringify({ success: true, order, courier }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==================== DECLINE ORDER ====================
    if (action === "decline-order") {
      if (!orderId || !reason) {
        return new Response(
          JSON.stringify({ error: "Order ID and reason required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update order to cancelled status
      const { data: order, error: updateError } = await supabase
        .from("orders")
        .update({
          status: "cancelled",
          payment_status: "refunded",
        })
        .eq("id", orderId)
        .select()
        .single();

      if (updateError) {
        return new Response(
          JSON.stringify({ error: "Failed to decline order" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Add tracking entry
      await supabase.from("order_tracking").insert({
        order_id: orderId,
        status: "cancelled",
        message: `Order declined by admin: ${reason}`,
      });

      await logAdminAction(supabase, adminUser.id, "DECLINE_ORDER", "order", orderId, { reason }, req);

      return new Response(
        JSON.stringify({ success: true, order }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==================== SUSPEND USER ====================
    if (action === "suspend-user") {
      if (!userId || !reason) {
        return new Response(
          JSON.stringify({ error: "User ID and reason required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Note: You'd need to add a suspended field to profiles table
      const { data: profile, error: updateError } = await supabase
        .from("profiles")
        .update({
          age_verified: false, // Revoke access
        })
        .eq("user_id", userId)
        .select()
        .single();

      if (updateError) {
        return new Response(
          JSON.stringify({ error: "Failed to suspend user" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await logAdminAction(supabase, adminUser.id, "SUSPEND_USER", "user", userId, { reason }, req);

      return new Response(
        JSON.stringify({ success: true, profile }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==================== ASSIGN COURIER ====================
    if (action === "assign-courier") {
      const { courierId } = details || {};
      
      if (!orderId || !courierId) {
        return new Response(
          JSON.stringify({ error: "Order ID and Courier ID required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: order, error: updateError } = await supabase
        .from("orders")
        .update({
          courier_id: courierId,
          status: "confirmed",
        })
        .eq("id", orderId)
        .select()
        .single();

      if (updateError) {
        return new Response(
          JSON.stringify({ error: "Failed to assign courier" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Add tracking entry
      await supabase.from("order_tracking").insert({
        order_id: orderId,
        status: "confirmed",
        message: "Courier assigned by admin",
      });

      await logAdminAction(supabase, adminUser.id, "ASSIGN_COURIER", "order", orderId, { courierId }, req);

      return new Response(
        JSON.stringify({ success: true, order }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Admin action error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Action failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
