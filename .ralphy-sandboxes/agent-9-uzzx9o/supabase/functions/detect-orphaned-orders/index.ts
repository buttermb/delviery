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
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient(supabaseUrl, supabaseServiceKey) as any;

    console.log("Starting orphaned orders detection...");

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    // Find unified orders stuck in pending > 30 days
    const { data: unifiedOrphaned, error: unifiedError } = await supabase
      .from("unified_orders")
      .select("id, order_number, tenant_id, created_at, status")
      .eq("status", "pending")
      .is("orphaned_at", null)
      .lt("created_at", thirtyDaysAgo.toISOString());

    if (unifiedError) {
      console.error("Error fetching unified orders:", unifiedError);
      throw unifiedError;
    }

    // Find wholesale orders stuck in pending > 30 days
    const { data: wholesaleOrphaned, error: wholesaleError } = await supabase
      .from("wholesale_orders")
      .select("id, order_number, tenant_id, created_at, status")
      .eq("status", "pending")
      .is("orphaned_at", null)
      .lt("created_at", thirtyDaysAgo.toISOString());

    if (wholesaleError) {
      console.error("Error fetching wholesale orders:", wholesaleError);
      throw wholesaleError;
    }

    const results = {
      unified_flagged: 0,
      unified_auto_cancelled: 0,
      wholesale_flagged: 0,
      wholesale_auto_cancelled: 0,
      errors: [] as string[],
    };

    // Process unified orders
    for (const order of unifiedOrphaned || []) {
      const orderDate = new Date(order.created_at);
      const daysPending = Math.floor((now.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24));

      try {
        if (orderDate < sixtyDaysAgo) {
          // Auto-cancel orders older than 60 days
          await supabase
            .from("unified_orders")
            .update({
              status: "cancelled",
              orphaned_at: now.toISOString(),
              cancellation_reason: "Auto-cancelled: Order pending for over 60 days",
              cancelled_at: now.toISOString(),
            })
            .eq("id", order.id);

          // Release reserved inventory
          await releaseReservedInventory(supabase, order.id, "unified_order_items");

          results.unified_auto_cancelled++;
          console.log(`Auto-cancelled unified order ${order.order_number} (${daysPending} days old)`);
        } else {
          // Flag as orphaned (30-60 days)
          await supabase
            .from("unified_orders")
            .update({ orphaned_at: now.toISOString() })
            .eq("id", order.id);

          results.unified_flagged++;
          console.log(`Flagged unified order ${order.order_number} as orphaned (${daysPending} days old)`);
        }

        await createNotification(supabase, order, daysPending);
      } catch (err) {
        const errorMsg = `Failed to process unified order ${order.id}: ${err}`;
        console.error(errorMsg);
        results.errors.push(errorMsg);
      }
    }

    // Process wholesale orders
    for (const order of wholesaleOrphaned || []) {
      const orderDate = new Date(order.created_at);
      const daysPending = Math.floor((now.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24));

      try {
        if (orderDate < sixtyDaysAgo) {
          await supabase
            .from("wholesale_orders")
            .update({
              status: "cancelled",
              orphaned_at: now.toISOString(),
            })
            .eq("id", order.id);

          await releaseReservedInventory(supabase, order.id, "wholesale_order_items");

          results.wholesale_auto_cancelled++;
          console.log(`Auto-cancelled wholesale order ${order.order_number} (${daysPending} days old)`);
        } else {
          await supabase
            .from("wholesale_orders")
            .update({ orphaned_at: now.toISOString() })
            .eq("id", order.id);

          results.wholesale_flagged++;
          console.log(`Flagged wholesale order ${order.order_number} as orphaned (${daysPending} days old)`);
        }

        await createNotification(supabase, order, daysPending);
      } catch (err) {
        const errorMsg = `Failed to process wholesale order ${order.id}: ${err}`;
        console.error(errorMsg);
        results.errors.push(errorMsg);
      }
    }

    console.log("Orphaned orders detection completed:", results);

    return new Response(JSON.stringify({ 
      success: true, 
      results,
      timestamp: now.toISOString(),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in detect-orphaned-orders:", error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function releaseReservedInventory(supabase: any, orderId: string, itemsTable: string) {
  try {
    const { data: items } = await supabase
      .from(itemsTable)
      .select("product_id, quantity")
      .eq("order_id", orderId);

    if (!items?.length) return;

    for (const item of items) {
      const { data: product } = await supabase
        .from("products")
        .select("reserved_quantity")
        .eq("id", item.product_id)
        .single();

      if (product) {
        await supabase
          .from("products")
          .update({
            reserved_quantity: Math.max(0, (product.reserved_quantity || 0) - item.quantity),
          })
          .eq("id", item.product_id);
      }
    }

    console.log(`Released reserved inventory for order ${orderId}`);
  } catch (err) {
    console.error(`Failed to release inventory for order ${orderId}:`, err);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function createNotification(supabase: any, order: { id: string; order_number: string; tenant_id: string }, daysPending: number) {
  try {
    await supabase
      .from("notifications")
      .insert({
        tenant_id: order.tenant_id,
        title: daysPending >= 60 
          ? `Order ${order.order_number} auto-cancelled` 
          : `Stale order detected: ${order.order_number}`,
        message: daysPending >= 60
          ? `Order ${order.order_number} was automatically cancelled after ${daysPending} days in pending status.`
          : `Order ${order.order_number} has been pending for ${daysPending} days. Please review and take action.`,
        type: daysPending >= 60 ? "warning" : "info",
        priority: daysPending >= 60 ? "high" : "medium",
        entity_type: "order",
        entity_id: order.id,
      });
  } catch (err) {
    // Ignore if notifications table doesn't exist
    console.error("Error creating notification:", err);
  }
}
