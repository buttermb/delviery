/**
 * Analytics API Edge Function
 * Exposes analytics data for external BI tool consumption.
 * Authenticates via API key (from api_keys table), rate limited per key.
 *
 * Endpoints (via ?endpoint= query param):
 *   revenue   - Revenue summary for date range
 *   orders    - Orders summary for date range
 *   inventory - Current inventory snapshot
 *   customers - Customer summary for date range
 */

import { serve, createClient, corsHeaders, z } from "../_shared/deps.ts";
import { createLogger } from "../_shared/logger.ts";
import { withZenProtection } from "../_shared/zen-firewall.ts";
import { checkRateLimit, getRateLimitHeaders } from "../_shared/rateLimiting.ts";

const logger = createLogger("analytics-api");

const querySchema = z.object({
  endpoint: z.enum(["revenue", "orders", "inventory", "customers"]),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
});

/** Validate API key and return the associated tenant_id */
async function authenticateApiKey(
  apiKey: string,
  serviceClient: ReturnType<typeof createClient>
): Promise<{ tenantId: string; keyId: string } | null> {
  const { data, error } = await serviceClient
    .from("api_keys")
    .select("id, tenant_id, is_active, expires_at, permissions")
    .eq("key", apiKey)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) return null;

  // Check expiry
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return null;
  }

  // Check analytics permission
  const perms = (data.permissions ?? []) as string[];
  if (perms.length > 0 && !perms.includes("analytics") && !perms.includes("*")) {
    return null;
  }

  // Update last_used_at (fire-and-forget)
  serviceClient
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then();

  return { tenantId: data.tenant_id, keyId: data.id };
}

serve(
  withZenProtection(async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    if (req.method !== "GET") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    try {
      // --- API key authentication ---
      const authHeader = req.headers.get("authorization");
      const apiKey =
        authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

      if (!apiKey) {
        return new Response(
          JSON.stringify({ error: "Missing API key. Provide via Authorization: Bearer <key>" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const serviceClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      const auth = await authenticateApiKey(apiKey, serviceClient);
      if (!auth) {
        logger.warn("Invalid or expired API key used");
        return new Response(
          JSON.stringify({ error: "Invalid or expired API key" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { tenantId, keyId } = auth;

      // --- Rate limiting ---
      const rateResult = await checkRateLimit(
        { key: "analytics_api", limit: 60, windowMs: 60 * 1000 },
        keyId
      );

      if (!rateResult.allowed) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Try again later." }),
          {
            status: 429,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
              ...getRateLimitHeaders(rateResult),
            },
          }
        );
      }

      // --- Parse query params ---
      const url = new URL(req.url);
      const parsed = querySchema.safeParse({
        endpoint: url.searchParams.get("endpoint"),
        start_date: url.searchParams.get("start_date") || undefined,
        end_date: url.searchParams.get("end_date") || undefined,
      });

      if (!parsed.success) {
        return new Response(
          JSON.stringify({
            error: "Invalid parameters",
            details: parsed.error.flatten().fieldErrors,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { endpoint, start_date, end_date } = parsed.data;
      const startDate =
        start_date ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = end_date ?? new Date().toISOString();

      let responseData: Record<string, unknown>;

      // --- Endpoint handlers ---
      switch (endpoint) {
        case "revenue": {
          const { data: orders, error: ordersErr } = await serviceClient
            .from("orders")
            .select("total, created_at, status")
            .eq("tenant_id", tenantId)
            .gte("created_at", startDate)
            .lte("created_at", endDate);

          if (ordersErr) throw ordersErr;

          const completed = (orders ?? []).filter((o) => o.status !== "cancelled");
          responseData = {
            total_revenue: completed.reduce((s, o) => s + (o.total ?? 0), 0),
            order_count: completed.length,
            average_order_value:
              completed.length > 0
                ? completed.reduce((s, o) => s + (o.total ?? 0), 0) / completed.length
                : 0,
            period: { start: startDate, end: endDate },
          };
          break;
        }

        case "orders": {
          const { data: orders, error: ordersErr } = await serviceClient
            .from("orders")
            .select("id, status, total, created_at")
            .eq("tenant_id", tenantId)
            .gte("created_at", startDate)
            .lte("created_at", endDate)
            .order("created_at", { ascending: false })
            .limit(500);

          if (ordersErr) throw ordersErr;

          const list = orders ?? [];
          const byStatus: Record<string, number> = {};
          for (const o of list) {
            byStatus[o.status ?? "unknown"] = (byStatus[o.status ?? "unknown"] ?? 0) + 1;
          }

          responseData = {
            total_orders: list.length,
            by_status: byStatus,
            total_revenue: list.reduce((s, o) => s + (o.total ?? 0), 0),
            period: { start: startDate, end: endDate },
          };
          break;
        }

        case "inventory": {
          const { data: products, error: productsErr } = await serviceClient
            .from("products")
            .select("id, name, stock_quantity, price, status")
            .eq("tenant_id", tenantId);

          if (productsErr) throw productsErr;

          const list = products ?? [];
          responseData = {
            total_products: list.length,
            in_stock: list.filter((p) => (p.stock_quantity ?? 0) > 0).length,
            low_stock: list.filter(
              (p) => (p.stock_quantity ?? 0) > 0 && (p.stock_quantity ?? 0) < 10
            ).length,
            out_of_stock: list.filter((p) => (p.stock_quantity ?? 0) === 0).length,
            total_inventory_value: list.reduce(
              (s, p) => s + (p.price ?? 0) * (p.stock_quantity ?? 0),
              0
            ),
          };
          break;
        }

        case "customers": {
          const { data: customers, error: customersErr } = await serviceClient
            .from("customers")
            .select("id, created_at")
            .eq("tenant_id", tenantId);

          if (customersErr) throw customersErr;

          const list = customers ?? [];
          const newInPeriod = list.filter(
            (c) =>
              new Date(c.created_at) >= new Date(startDate) &&
              new Date(c.created_at) <= new Date(endDate)
          );

          responseData = {
            total_customers: list.length,
            new_customers_in_period: newInPeriod.length,
            period: { start: startDate, end: endDate },
          };
          break;
        }
      }

      logger.info("Analytics API request served", {
        tenantId,
        endpoint,
      });

      return new Response(
        JSON.stringify({
          success: true,
          endpoint,
          data: responseData,
          generated_at: new Date().toISOString(),
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            ...getRateLimitHeaders(rateResult),
          },
        }
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      logger.error("Analytics API error", { error: msg });
      return new Response(
        JSON.stringify({ error: "Internal server error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  })
);
