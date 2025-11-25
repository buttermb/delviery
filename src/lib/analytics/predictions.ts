import { logger } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';

export interface MenuPrediction {
    predictedOrders: number;
    predictedRevenue: number;
    optimalExpiration: Date;
    suggestedProducts: string[];
    riskScore: number;
}

export class MenuAnalyticsEngine {
    private static instance: MenuAnalyticsEngine;

    private constructor() { }

    static getInstance(): MenuAnalyticsEngine {
        if (!MenuAnalyticsEngine.instance) {
            MenuAnalyticsEngine.instance = new MenuAnalyticsEngine();
        }
        return MenuAnalyticsEngine.instance;
    }

    async generatePredictions(menuId: string): Promise<MenuPrediction> {
        logger.debug(`Generating predictions for menu ${menuId}...`);

        // Get menu details
        const { data: menu } = await supabase
            .from('disposable_menus')
            .select('tenant_id, created_at')
            .eq('id', menuId)
            .single();

        if (!menu) {
            // Return conservative defaults if menu not found
            return {
                predictedOrders: 0,
                predictedRevenue: 0,
                optimalExpiration: new Date(Date.now() + 48 * 60 * 60 * 1000),
                suggestedProducts: [],
                riskScore: 0.5
            };
        }

        // 1. Forecast Orders based on historical data
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data: historicalOrders } = await supabase
            .from('menu_orders')
            .select('id, total_amount')
            .eq('tenant_id', menu.tenant_id)
            .gte('created_at', thirtyDaysAgo.toISOString());

        const avgOrdersPerMenu = historicalOrders ? Math.ceil(historicalOrders.length / 4) : 15;
        const predictedOrders = Math.max(10, avgOrdersPerMenu);

        // 2. Forecast Revenue based on historical average order value
        const totalRevenue = (historicalOrders || []).reduce((sum, order) => sum + (order.total_amount || 0), 0);
        const avgOrderValue = historicalOrders && historicalOrders.length > 0 
            ? totalRevenue / historicalOrders.length 
            : 150;
        const predictedRevenue = predictedOrders * avgOrderValue;

        // 3. Optimal Expiration (use default for now)
        const optimalExpiration = new Date(Date.now() + 48 * 60 * 60 * 1000);

        // 4. Product Recommendations based on top sellers
        const { data: topProducts } = await supabase
            .from('wholesale_inventory')
            .select('id')
            .eq('tenant_id', menu.tenant_id)
            .order('quantity_lbs', { ascending: false })
            .limit(3);

        const suggestedProducts = topProducts?.map(p => p.id) || [];

        // 5. Risk Assessment based on data quality
        const hasHistoricalData = (historicalOrders?.length || 0) > 5;
        const riskScore = hasHistoricalData ? 0.15 : 0.45;

        return {
            predictedOrders,
            predictedRevenue,
            optimalExpiration,
            suggestedProducts,
            riskScore
        };
    }
}
