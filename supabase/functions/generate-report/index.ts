// Generate Report Edge Function
// Generates custom reports from various tables

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { report_type, tenant_id, date_range, filters } = await req.json();

    if (!report_type || !tenant_id) {
      return new Response(
        JSON.stringify({ error: "report_type and tenant_id are required" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    let reportData: any = null;
    const startDate = date_range?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = date_range?.end || new Date().toISOString();

    switch (report_type) {
      case "sales":
        // Sales report
        const { data: orders, error: ordersError } = await supabaseClient
          .from("orders")
          .select("*")
          .eq("tenant_id", tenant_id)
          .gte("created_at", startDate)
          .lte("created_at", endDate)
          .order("created_at", { ascending: false });

        if (ordersError) throw ordersError;

        reportData = {
          total_orders: orders?.length || 0,
          total_revenue: orders?.reduce((sum, o) => sum + (o.total || 0), 0) || 0,
          orders: orders || [],
        };
        break;

      case "inventory":
        // Inventory report
        const { data: products, error: productsError } = await supabaseClient
          .from("products")
          .select("*")
          .eq("tenant_id", tenant_id);

        if (productsError) throw productsError;

        reportData = {
          total_products: products?.length || 0,
          low_stock: products?.filter((p) => (p.stock_quantity || 0) < 10).length || 0,
          out_of_stock: products?.filter((p) => (p.stock_quantity || 0) === 0).length || 0,
          products: products || [],
        };
        break;

      case "customers":
        // Customer report
        const { data: customers, error: customersError } = await supabaseClient
          .from("customers")
          .select("*")
          .eq("tenant_id", tenant_id)
          .gte("created_at", startDate)
          .lte("created_at", endDate);

        if (customersError) throw customersError;

        reportData = {
          total_customers: customers?.length || 0,
          new_customers: customers?.filter(
            (c) => new Date(c.created_at) >= new Date(startDate)
          ).length || 0,
          customers: customers || [],
        };
        break;

      default:
        return new Response(
          JSON.stringify({ error: `Unknown report_type: ${report_type}` }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
          }
        );
    }

    // Log report execution if table exists
    try {
      await supabaseClient.from("report_executions").insert({
        tenant_id,
        report_type,
        filters: filters || {},
        executed_at: new Date().toISOString(),
        status: "completed",
      });
    } catch (error) {
      // Ignore if table doesn't exist
      console.warn("Could not log report execution:", error);
    }

    return new Response(
      JSON.stringify({
        success: true,
        report_type,
        data: reportData,
        generated_at: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

