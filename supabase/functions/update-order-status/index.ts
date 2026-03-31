import { serve, createClient, corsHeaders } from '../_shared/deps.ts';
import { validateOrderStatus, type OrderStatusInput } from './validation.ts';
import { withCreditGate, CREDIT_ACTIONS } from '../_shared/creditGate.ts';

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

      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: "Missing authorization header" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
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
          .maybeSingle();

        if (courierRecord) {
          courierRecordId = courierRecord.id;
        }
      }

      // Build update object
      const updateData: Record<string, unknown> = {
        status
      };

      // If confirming order and courier is accepting, assign them
      if (status === "confirmed" && courierRecordId) {
        updateData.courier_id = courierRecordId;
      }

      console.error("Updating order with data:", updateData);

      // SECURITY: Get user's tenant
      const { data: tenantUser } = await supabase
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", user.id)
        .maybeSingle();

      // FAIL-CLOSED: Require tenant_id for all operations
      if (!tenantUser?.tenant_id) {
        return new Response(
          JSON.stringify({ error: "No tenant associated with user" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify order belongs to user's tenant before updating
      const { data: existingOrder } = await supabase
        .from("orders")
        .select("id")
        .eq("id", orderId)
        .eq("tenant_id", tenantUser.tenant_id)
        .maybeSingle();

      if (!existingOrder) {
        return new Response(
          JSON.stringify({ error: "Order not found or access denied" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update order status - ALWAYS enforce tenant isolation
      const { error: updateError } = await supabase
        .from("orders")
        .update(updateData)
        .eq("id", orderId)
        .eq("tenant_id", tenantUser.tenant_id);

      if (updateError) {
        console.error("Update error details:", JSON.stringify(updateError));
        return new Response(
          JSON.stringify({ error: "Failed to update order", details: updateError }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.error("Order updated successfully");

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
          .eq("order_id", orderId)
          .eq("tenant_id", tenantUser.tenant_id);
      } else if (status === "delivered") {
        await supabase
          .from("deliveries")
          .update({ actual_dropoff_time: new Date().toISOString() })
          .eq("order_id", orderId)
          .eq("tenant_id", tenantUser.tenant_id);

        await supabase
          .from("orders")
          .update({
            payment_status: "completed"
          })
          .eq("id", orderId)
          .eq("tenant_id", tenantUser.tenant_id);
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
        // Get order details including customer - ALWAYS filter by tenant_id
        const { data: orderData } = await supabase
          .from("orders")
          .select("customer_id, order_number, tenant_id")
          .eq("id", orderId)
          .eq("tenant_id", tenantUser.tenant_id)
          .maybeSingle();

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
            console.error(`Push notification sent for order ${orderId} status: ${status}`);
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
