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

        // 1. Fetch all tenants with their settings
        const { data: tenants, error: tenantsError } = await supabase
            .from('tenants')
            .select(`
        id,
        business_name,
        tenant_settings (
          automation_rules
        )
      `);

        if (tenantsError) throw tenantsError;

        const results = [];

        // 2. Iterate and process rules
        for (const tenant of tenants || []) {
            // Check if settings exist and automation is enabled
            // Note: tenant_settings is an object, not array, because it's a 1-to-1 relationship usually, 
            // but Supabase might return array if not specified as single. 
            // Assuming 1-to-1 or taking first if array.
            const settings = Array.isArray(tenant.tenant_settings) ? tenant.tenant_settings[0] : tenant.tenant_settings;

            if (!settings?.automation_rules?.enabled) continue;

            const rules = settings.automation_rules.rules || [];
            if (rules.length === 0) continue;

            const tenantResults = { tenant: tenant.business_name, actions: [] as string[] };

            // Rule: Low Stock Alert
            if (rules.includes('low_stock_alert')) {
                const { count } = await supabase
                    .from('products')
                    .select('*', { count: 'exact', head: true })
                    .eq('tenant_id', tenant.id)
                    .lt('stock_quantity', 10)
                    .gt('stock_quantity', 0);

                if (count && count > 0) {
                    // Log alert
                    await supabase.from('activity_logs').insert({
                        tenant_id: tenant.id,
                        action: 'automation_alert',
                        resource: 'inventory',
                        details: {
                            type: 'low_stock',
                            count,
                            message: `${count} items are running low on stock.`
                        }
                    });
                    tenantResults.actions.push(`Logged low stock alert for ${count} items`);
                }
            }

            // Rule: Daily Revenue Summary
            if (rules.includes('daily_revenue_summary')) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const { data: orders } = await supabase
                    .from('orders')
                    .select('total_amount')
                    .eq('tenant_id', tenant.id)
                    .gte('created_at', today.toISOString())
                    .not('status', 'in', '("cancelled","rejected","refunded")');

                const revenue = orders?.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) || 0;

                if (revenue > 0) {
                    await supabase.from('activity_logs').insert({
                        tenant_id: tenant.id,
                        action: 'automation_summary',
                        resource: 'finance',
                        details: {
                            type: 'daily_revenue',
                            amount: revenue,
                            message: `Daily revenue summary: $${revenue.toLocaleString()}`
                        }
                    });
                    tenantResults.actions.push(`Logged daily revenue: $${revenue}`);
                }
            }

            if (tenantResults.actions.length > 0) {
                results.push(tenantResults);
            }
        }

        return new Response(
            JSON.stringify({ success: true, processed: results }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
