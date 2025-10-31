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
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: courier } = await supabase
      .from("couriers")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!courier || !courier.is_active) {
      return new Response(
        JSON.stringify({ error: "Courier account not found or inactive" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body to get endpoint
    const body = await req.json();
    const endpoint = body.endpoint;
    
    console.log("Courier app request:", { endpoint, courier: courier.email });

    if (endpoint === "login") {
      await supabase
        .from("couriers")
        .update({ last_login_at: new Date().toISOString() })
        .eq("id", courier.id);

      return new Response(
        JSON.stringify({
          courier: {
            id: courier.id,
            email: courier.email,
            full_name: courier.full_name,
            phone: courier.phone,
            vehicle_type: courier.vehicle_type,
            is_online: courier.is_online,
            commission_rate: courier.commission_rate
          }
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (endpoint === "toggle-online") {
      const isOnline = body.is_online;

      let shiftId = null;
      if (isOnline) {
        const { data: shift } = await supabase
          .from("courier_shifts")
          .insert({
            courier_id: courier.id,
            started_at: new Date().toISOString(),
            status: 'active'
          })
          .select()
          .single();
        shiftId = shift?.id;
      } else {
        const { data: activeShift } = await supabase
          .from("courier_shifts")
          .select("*")
          .eq("courier_id", courier.id)
          .eq("status", "active")
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (activeShift) {
          const endTime = new Date();
          const startTime = new Date(activeShift.started_at);
          const hours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);

          await supabase
            .from("courier_shifts")
            .update({
              ended_at: endTime.toISOString(),
              total_hours: hours,
              status: 'completed'
            })
            .eq("id", activeShift.id);
        }
      }

      const { data: updatedCourier } = await supabase
        .from("couriers")
        .update({ 
          is_online: isOnline,
          available_for_orders: isOnline
        })
        .eq("id", courier.id)
        .select()
        .single();

      return new Response(
        JSON.stringify({ 
          success: true, 
          is_online: isOnline,
          shift_id: shiftId,
          courier: updatedCourier
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (endpoint === "update-location") {
      const { lat, lng, accuracy, speed, heading, order_id } = body;

      await supabase
        .from("couriers")
        .update({
          current_lat: lat,
          current_lng: lng,
          last_location_update: new Date().toISOString()
        })
        .eq("id", courier.id);

      await supabase
        .from("courier_location_history")
        .insert({
          courier_id: courier.id,
          lat,
          lng,
          accuracy,
          speed,
          heading,
          order_id
        });

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (endpoint === "my-orders") {
      const status = body.status || "all";
      
      let query = supabase
        .from("orders")
        .select(`
          *,
          merchants (*),
          addresses (*),
          order_items (
            *,
            products (*)
          )
        `)
        .eq("courier_id", courier.id)
        .order("created_at", { ascending: false });

      if (status === "active") {
        // Active orders are preparing or out for delivery
        query = query.in("status", ["preparing", "out_for_delivery"]);
      } else if (status !== "all") {
        query = query.eq("status", status);
      }

      const { data: orders, error } = await query;

      if (error) {
        console.error("Orders query error:", error);
        return new Response(
          JSON.stringify({ error: error.message, orders: [] }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Fetch customer info from profiles table
      const ordersWithCustomerInfo = await Promise.all(
        (orders || []).map(async (order) => {
          let customerName = order.customer_name;
          let customerPhone = order.customer_phone;
          
          // If customer info is missing, fetch from profiles
          if (!customerName || !customerPhone) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("full_name, phone")
              .eq("user_id", order.user_id)
              .maybeSingle();
            
            if (profile) {
              customerName = profile.full_name || customerName;
              customerPhone = profile.phone || customerPhone;
            }
          }
          
          const commission = (parseFloat(order.subtotal || order.total_amount) * courier.commission_rate) / 100;
          return {
            ...order,
            customer_name: customerName,
            customer_phone: customerPhone,
            courier_commission: commission.toFixed(2)
          };
        })
      );

      return new Response(
        JSON.stringify({ 
          orders: ordersWithCustomerInfo,
          count: ordersWithCustomerInfo.length
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (endpoint === "available-orders") {
      const { data: orders } = await supabase
        .from("orders")
        .select(`
          *,
          merchants (*),
          addresses (*)
        `)
        .eq("status", "pending")
        .is("courier_id", null)
        .order("created_at", { ascending: true })
        .limit(20);

      // Fetch customer info from profiles table
      const ordersWithCustomerInfo = await Promise.all(
        (orders || []).map(async (order) => {
          let customerName = order.customer_name;
          let customerPhone = order.customer_phone;
          
          // If customer info is missing, fetch from profiles
          if (!customerName || !customerPhone) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("full_name, phone")
              .eq("user_id", order.user_id)
              .maybeSingle();
            
            if (profile) {
              customerName = profile.full_name || customerName;
              customerPhone = profile.phone || customerPhone;
            }
          }
          
          return {
            ...order,
            customer_name: customerName,
            customer_phone: customerPhone
          };
        })
      );

      return new Response(
        JSON.stringify({ orders: ordersWithCustomerInfo }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (endpoint === "accept-order") {
      const orderId = body.order_id;
      console.log('Accept order request for:', orderId);

      const { data: order } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .is("courier_id", null)
        .maybeSingle();

      if (!order) {
        console.log('Order not available or already assigned');
        return new Response(
          JSON.stringify({ error: "Order no longer available" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log('Updating order and fetching full details...');
      const { data: updatedOrder, error: updateError } = await supabase
        .from("orders")
        .update({
          courier_id: courier.id,
          courier_assigned_at: new Date().toISOString(),
          courier_accepted_at: new Date().toISOString(),
          status: "preparing"
        })
        .eq("id", orderId)
        .select(`
          *,
          merchants (
            id,
            business_name,
            address,
            phone,
            latitude,
            longitude
          ),
          addresses (
            street,
            apartment,
            city,
            state,
            zip_code,
            borough,
            latitude,
            longitude
          ),
          order_items (
            id,
            quantity,
            price,
            product_name,
            products (
              id,
              name,
              image_url,
              description
            )
          )
        `)
        .single();

      if (updateError) {
        console.error('Error updating order:', updateError);
        return new Response(
          JSON.stringify({ error: updateError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log('✅ Order updated successfully:', updatedOrder);

      // Fetch customer info from profiles
      let customerName = updatedOrder.customer_name;
      let customerPhone = updatedOrder.customer_phone;
      
      if (!customerName || !customerPhone) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, phone")
          .eq("user_id", updatedOrder.user_id)
          .maybeSingle();
        
        if (profile) {
          customerName = profile.full_name || customerName;
          customerPhone = profile.phone || customerPhone;
        }
      }

      // Get customer order count
      const { count } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', updatedOrder.user_id)
        .eq('status', 'delivered');

      const orderWithCustomerInfo = {
        ...updatedOrder,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_order_count: count || 0
      };

      await supabase
        .from("order_tracking")
        .insert({
          order_id: orderId,
          status: "preparing",
          message: `Courier ${courier.full_name} accepted the order`
        });

      console.log('Returning response with full order data');
      return new Response(
        JSON.stringify({ 
          success: true,
          order: orderWithCustomerInfo
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (endpoint === "update-order-status") {
      const body = await req.json();
      const { order_id, status, notes } = body;

      const { data: updatedOrder } = await supabase
        .from("orders")
        .update({ status })
        .eq("id", order_id)
        .eq("courier_id", courier.id)
        .select()
        .single();

      await supabase
        .from("order_tracking")
        .insert({
          order_id,
          status,
          message: notes || `Status updated to ${status}`
        });

      return new Response(
        JSON.stringify({ success: true, order: updatedOrder }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (endpoint === "mark-picked-up") {
      const body = await req.json();
      const { order_id, pickup_photo_url } = body;

      await supabase
        .from("orders")
        .update({ status: "out_for_delivery" })
        .eq("id", order_id)
        .eq("courier_id", courier.id);

      await supabase
        .from("deliveries")
        .update({ 
          actual_pickup_time: new Date().toISOString(),
          pickup_photo_url
        })
        .eq("order_id", order_id);

      await supabase
        .from("order_tracking")
        .insert({
          order_id,
          status: "out_for_delivery",
          message: "Order picked up and out for delivery"
        });

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (endpoint === "mark-delivered") {
      const body = await req.json();
      const { 
        order_id, 
        delivery_photo_url, 
        signature_url,
        id_verification_photo_url,
        customer_present 
      } = body;

      await supabase
        .from("orders")
        .update({ 
          status: "delivered",
          delivered_at: new Date().toISOString()
        })
        .eq("id", order_id)
        .eq("courier_id", courier.id);

      await supabase
        .from("deliveries")
        .update({
          actual_dropoff_time: new Date().toISOString(),
          delivery_photo_url,
          signature_url,
          id_verification_url: id_verification_photo_url,
          delivery_notes: customer_present ? "Delivered to customer" : "Left at door"
        })
        .eq("order_id", order_id);

      await supabase
        .from("order_tracking")
        .insert({
          order_id,
          status: "delivered",
          message: "Order delivered successfully"
        });

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (endpoint === "earnings") {
      const period = body.period || "week";
      
      let query = supabase
        .from("courier_earnings")
        .select("*")
        .eq("courier_id", courier.id)
        .order("created_at", { ascending: false });

      if (period === "week") {
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        weekStart.setHours(0, 0, 0, 0);
        query = query.gte("created_at", weekStart.toISOString());
      } else if (period === "month") {
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        query = query.gte("created_at", monthStart.toISOString());
      }

      const { data: earnings } = await query;

      const totalEarned = earnings?.reduce((sum, e) => sum + parseFloat(e.total_earned), 0) || 0;
      const totalDeliveries = earnings?.length || 0;
      const avgPerDelivery = totalDeliveries > 0 ? totalEarned / totalDeliveries : 0;

      return new Response(
        JSON.stringify({
          earnings: earnings || [],
          summary: {
            total_earned: totalEarned.toFixed(2),
            total_deliveries: totalDeliveries,
            avg_per_delivery: avgPerDelivery.toFixed(2)
          }
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (endpoint === "today-stats") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [
        { data: todayOrders },
        { data: todayEarnings },
        { data: activeShift }
      ] = await Promise.all([
        supabase
          .from("orders")
          .select("*")
          .eq("courier_id", courier.id)
          .gte("created_at", today.toISOString()),
        supabase
          .from("courier_earnings")
          .select("total_earned")
          .eq("courier_id", courier.id)
          .gte("created_at", today.toISOString()),
        supabase
          .from("courier_shifts")
          .select("*")
          .eq("courier_id", courier.id)
          .eq("status", "active")
          .maybeSingle()
      ]);

      const deliveries = todayOrders?.filter(o => o.status === "delivered").length || 0;
      const totalEarnings = todayEarnings?.reduce((sum, e) => sum + parseFloat(e.total_earned), 0) || 0;
      
      let hoursOnline = 0;
      if (activeShift) {
        const now = new Date();
        const start = new Date(activeShift.started_at);
        hoursOnline = (now.getTime() - start.getTime()) / (1000 * 60 * 60);
      }

      return new Response(
        JSON.stringify({
          deliveries_completed: deliveries,
          total_earned: totalEarnings.toFixed(2),
          hours_online: hoursOnline.toFixed(1),
          active_orders: todayOrders?.filter(o => ["preparing", "out_for_delivery"].includes(o.status)).length || 0
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid endpoint" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Courier app error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Request failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
