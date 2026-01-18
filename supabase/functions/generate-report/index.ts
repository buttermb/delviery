/**
 * Generate Report Edge Function
 * Generates custom reports from various tables
 * 
 * SECURITY FIX: Added JWT authentication and tenant ownership verification.
 * Reports are scoped to the caller's authenticated tenant only.
 */

import { serve, createClient, corsHeaders } from "../_shared/deps.ts";

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ========================
    // SECURITY: Extract and validate JWT
    // ========================
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const jwt = authHeader.replace("Bearer ", "");

    // Create authenticated Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: `Bearer ${jwt}` } },
      }
    );

    // Get authenticated user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    // ========================
    // SECURITY: Look up user's tenant (derive, don't trust client)
    // ========================
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: tenantUser, error: tenantUserError } = await serviceClient
      .from("tenant_users")
      .select("tenant_id, role, tenants!inner(id, name)")
      .eq("user_id", user.id)
      .single();

    if (tenantUserError || !tenantUser) {
      return new Response(
        JSON.stringify({ error: "User not associated with a tenant" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    // Use the authenticated user's tenant_id (not from client!)
    const tenant_id = tenantUser.tenant_id;

    const { report_type, date_range, filters } = await req.json();

    if (!report_type) {
      return new Response(
        JSON.stringify({ error: "report_type is required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    let reportData: any = null;
    const startDate = date_range?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = date_range?.end || new Date().toISOString();

    switch (report_type) {
      case "sales":
        // Sales report
        const { data: orders, error: ordersError } = await serviceClient
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
        const { data: products, error: productsError } = await serviceClient
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
        const { data: customers, error: customersError } = await serviceClient
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
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
    }

    // Log report execution
    try {
      await serviceClient.from("report_executions").insert({
        tenant_id,
        user_id: user.id,
        report_type,
        filters: filters || {},
        executed_at: new Date().toISOString(),
        status: "completed",
      });
    } catch (error) {
      // Ignore if table doesn't exist
      console.warn("Could not log report execution:", error);
    }

    console.log(`[GENERATE-REPORT] ${report_type} report generated for tenant ${tenant_id} by user ${user.email}`);

    return new Response(
      JSON.stringify({
        success: true,
        report_type,
        data: reportData,
        generated_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error("[GENERATE-REPORT] Error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
