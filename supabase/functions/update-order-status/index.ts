import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateOrderStatus, type OrderStatusInput } from './validation.ts';
import { withCreditGate, CREDIT_ACTIONS } from '../_shared/creditGate.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Wrap with credit gating for free tier users
  return withCreditGate(req, CREDIT_ACTIONS.UPDATE_ORDER_STATUS, async (creditTenantId, serviceClient) => {
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

      // Parse and validate request body
      const rawBody = await req.json();
      const { orderId, status, message, lat, lng, courierId } = validateOrderStatus(rawBody);

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
      }

      // Create audit log
      await supabase.from("audit_logs").insert({
        entity_type: "order",
        entity_id: orderId,
        action: "STATUS_UPDATE",
        user_id: user.id,
        details: { status, message },
      });

      // Send push notification to customer for status updates
      try {
        // Get order details including customer
        const { data: orderData } = await supabase
          .from("orders")
          .select("customer_id, order_number, tenant_id")
          .eq("id", orderId)
          .single();

        if (orderData?.customer_id) {
          // Build notification message based on status
          const statusMessages: Record<string, { title: string; body: string }> = {
            confirmed: { title: "Order Confirmed!", body: `Your order ${orderData.order_number} has been confirmed.` },
            preparing: { title: "Order Being Prepared", body: `Your order ${orderData.order_number} is being prepared.` },
            ready: { title: "Order Ready!", body: `Your order ${orderData.order_number} is ready for pickup/delivery.` },
            out_for_delivery: { title: "Out for Delivery!", body: `Your order ${orderData.order_number} is on its way!` },
            delivered: { title: "Order Delivered!", body: `Your order ${orderData.order_number} has been delivered. Enjoy!` },
            cancelled: { title: "Order Cancelled", body: `Your order ${orderData.order_number} has been cancelled.` },
          };

          const notification = statusMessages[status];
          if (notification) {
            // Call send-push-notification function
            await supabase.functions.invoke("send-push-notification", {
              body: {
                userId: orderData.customer_id,
                title: notification.title,
                body: notification.body,
                data: {
                  orderId,
                  orderNumber: orderData.order_number,
                  status,
                  route: `/orders/${orderId}`,
                  critical: status === "out_for_delivery" || status === "delivered",
                },
              },
            });
            console.log(`Push notification sent for order ${orderId} status: ${status}`);
          }
        }
      } catch (pushError) {
        // Don't fail the status update if push notification fails
        console.error("Failed to send push notification:", pushError);
      }

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
  }); // End of withCreditGate
});
