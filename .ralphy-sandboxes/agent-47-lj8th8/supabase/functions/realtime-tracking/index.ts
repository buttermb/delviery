import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { status: 400 });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);
  
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  socket.onopen = () => {
    console.log("WebSocket connection established");
    socket.send(JSON.stringify({ type: "connected", message: "Real-time tracking active" }));
  };

  socket.onmessage = async (event) => {
    try {
      const data = JSON.parse(event.data);

      if (data.type === "subscribe-order") {
        const { orderId } = data;
        
        // Set up real-time subscription
        const channel = supabase
          .channel(`order-${orderId}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "order_tracking",
              filter: `order_id=eq.${orderId}`,
            },
            (payload) => {
              socket.send(
                JSON.stringify({
                  type: "tracking-update",
                  data: payload.new,
                })
              );
            }
          )
          .subscribe();

        socket.send(
          JSON.stringify({
            type: "subscribed",
            orderId,
          })
        );
      } else if (data.type === "courier-location") {
        const { courierId, lat, lng } = data;

        // Update courier location
        await supabase
          .from("couriers")
          .update({ current_lat: lat, current_lng: lng })
          .eq("id", courierId);

        // Broadcast to relevant orders
        const { data: activeDeliveries } = await supabase
          .from("deliveries")
          .select("order_id")
          .eq("courier_id", courierId);

        if (activeDeliveries) {
          for (const delivery of activeDeliveries) {
            await supabase.from("order_tracking").insert({
              order_id: delivery.order_id,
              status: "location_update",
              message: "Courier location updated",
              lat,
              lng,
            });
          }
        }
      }
    } catch (error) {
      console.error("WebSocket message error:", error);
      socket.send(
        JSON.stringify({
          type: "error",
          message: error instanceof Error ? error.message : "Unknown error",
        })
      );
    }
  };

  socket.onerror = (error) => {
    console.error("WebSocket error:", error);
  };

  socket.onclose = () => {
    console.log("WebSocket connection closed");
  };

  return response;
});
