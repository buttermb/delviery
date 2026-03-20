import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simplified Tier Definitions for Edge Function
const TIER_PRESETS = {
    street: {
        enabledFeatures: [
            'dashboard', 'pos-system', 'products', 'basic-orders', 'customers-basic',
            'disposable-menus', 'delivery-management', 'inventory-basic', 'compliance-basic', 'settings'
        ],
        hiddenFeatures: [
            'advanced-analytics', 'multi-location', 'wholesale-marketplace', 'fleet-management',
            'api-access', 'white-label', 'predictive-par', 'custom-integrations', 'metrc-integration',
            'team-management', 'marketing-automation', 'customer-insights', 'financial-center'
        ],
        dashboardWidgets: [
            'todays_revenue', 'top_5_products', 'pending_orders', 'low_stock_alerts', 'recent_orders'
        ],
        automationRules: [
            'low_stock_alert', 'daily_revenue_summary', 'compliance_reminders'
        ],
        limits: {
            locations: 1,
            users: 3,
            products: 500,
            ordersPerMonth: 1000
        }
    },
    trap: {
        enabledFeatures: [
            'dashboard', 'pos-system', 'products', 'basic-orders', 'customers-basic',
            'disposable-menus', 'delivery-management', 'inventory-dashboard', 'team-management',
            'compliance-basic', 'settings', 'reports', 'loyalty-program', 'stock-alerts'
        ],
        hiddenFeatures: [
            'advanced-analytics', 'wholesale-marketplace', 'fleet-management', 'api-access',
            'white-label', 'predictive-par', 'custom-integrations', 'metrc-integration',
            'financial-center', 'marketing-automation'
        ],
        dashboardWidgets: [
            'revenue_trend', 'top_products', 'pending_orders', 'team_activity',
            'low_stock_alerts', 'customer_tabs', 'delivery_status', 'weekly_comparison'
        ],
        automationRules: [
            'low_stock_alert', 'auto_reorder_top_sellers', 'customer_winback',
            'daily_summary', 'delivery_eta_notifications', 'loyalty_rewards'
        ],
        limits: {
            locations: 2,
            users: 10,
            products: 1000,
            ordersPerMonth: 3000
        }
    },
    block: {
        enabledFeatures: [
            'dashboard', 'pos-system', 'products', 'basic-orders', 'customers-advanced',
            'disposable-menus', 'delivery-management', 'inventory-dashboard', 'inventory-transfers',
            'team-management', 'compliance', 'settings', 'reports', 'loyalty-program',
            'stock-alerts', 'multi-location', 'wholesale-portal', 'financial-center',
            'route-optimization', 'purchase-orders', 'customer-insights'
        ],
        hiddenFeatures: [
            'wholesale-marketplace', 'api-access', 'white-label', 'predictive-par',
            'custom-integrations', 'advanced-fleet'
        ],
        dashboardWidgets: [
            'revenue_by_location', 'location_comparison', 'top_products_network',
            'pending_orders_all', 'team_performance', 'inventory_value', 'delivery_efficiency',
            'wholesale_pipeline', 'weekly_trends', 'profit_margins'
        ],
        automationRules: [
            'low_stock_alert', 'auto_reorder_top_sellers', 'customer_winback',
            'daily_summary', 'weekly_reports', 'delivery_eta_notifications',
            'loyalty_rewards', 'location_performance_alerts', 'inventory_transfer_suggestions'
        ],
        limits: {
            locations: 5,
            users: 25,
            products: 5000,
            ordersPerMonth: 10000
        }
    },
    hood: {
        enabledFeatures: [
            'dashboard', 'pos-system', 'products', 'basic-orders', 'customers-advanced',
            'disposable-menus', 'delivery-management', 'inventory-dashboard', 'inventory-transfers',
            'team-management', 'compliance', 'settings', 'reports', 'loyalty-program',
            'stock-alerts', 'multi-location', 'wholesale-portal', 'financial-center',
            'route-optimization', 'purchase-orders', 'customer-insights', 'advanced-analytics',
            'fleet-management', 'marketing-automation', 'api-access', 'predictive-par', 'audit-trail'
        ],
        hiddenFeatures: [
            'white-label', 'custom-integrations', 'developer-tools'
        ],
        dashboardWidgets: [
            'executive_summary', 'mtd_revenue', 'projected_close', 'net_profit',
            'cash_position', 'kpi_grid', 'location_scorecard', 'customer_ltv',
            'churn_rate', 'compliance_status', 'management_alerts', 'budget_variance'
        ],
        automationRules: [
            'predictive_inventory', 'customer_lifecycle_campaigns', 'loyalty_tier_upgrades',
            'delivery_route_optimization', 'executive_weekly_reports', 'compliance_auto_reminders',
            'employee_performance_reviews', 'wholesale_order_processing', 'budget_variance_alerts',
            'churn_risk_detection'
        ],
        limits: {
            locations: 10,
            users: 50,
            products: 10000,
            ordersPerMonth: 30000
        }
    },
    empire: {
        enabledFeatures: ['all'],
        hiddenFeatures: ['debug-console', 'bug-scanner', 'link-checker'],
        dashboardWidgets: [
            'organization_health', 'ebitda', 'cash_flow', 'ar_outstanding', 'ap_due',
            'regional_performance', 'strategic_decisions', 'market_share', 'competitor_alerts',
            'expansion_opportunities', 'compliance_audit_status', 'board_report_preview'
        ],
        automationRules: [
            'predictive_inventory', 'customer_lifecycle_campaigns', 'loyalty_tier_upgrades',
            'delivery_route_optimization', 'executive_weekly_reports', 'compliance_auto_filing',
            'employee_performance_reviews', 'wholesale_order_processing', 'fraud_detection',
            'revenue_forecasting', 'competitor_monitoring', 'market_share_tracking',
            'board_report_generation', 'regulatory_compliance_check'
        ],
        limits: {
            locations: 999,
            users: 999,
            products: 999999,
            ordersPerMonth: 999999
        }
    }
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Authenticate user
        const authHeader = req.headers.get("Authorization")!;
        const token = authHeader.replace("Bearer ", "");
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return new Response(
                JSON.stringify({ error: "Unauthorized" }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const { tenantId, tier } = await req.json();

        if (!tenantId || !tier) {
            return new Response(
                JSON.stringify({ error: "Tenant ID and tier are required" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const preset = TIER_PRESETS[tier];
        if (!preset) {
            return new Response(
                JSON.stringify({ error: "Invalid tier" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Update tenant record
        const { error: tenantError } = await supabase
            .from('tenants')
            .update({
                business_tier: tier,
                tier_override: true,
                tier_detected_at: new Date().toISOString()
            })
            .eq('id', tenantId);

        if (tenantError) {
            throw tenantError;
        }

        // Save preset config to tenant_settings
        const { error: settingsError } = await supabase
            .from('tenant_settings')
            .upsert({
                tenant_id: tenantId,
                enabled_features: preset.enabledFeatures,
                hidden_features: preset.hiddenFeatures,
                dashboard_widgets: preset.dashboardWidgets,
                automation_rules: preset.automationRules,
                feature_limits: preset.limits,
                updated_at: new Date().toISOString()
            });

        if (settingsError) {
            throw settingsError;
        }

        return new Response(
            JSON.stringify({ success: true, tier, preset }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("Error applying tier preset:", error);
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : "Internal Server Error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
