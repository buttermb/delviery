import { logger } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

interface MenuOrderData {
    order_data: Json;
}

export interface BusinessInsight {
    type: 'opportunity' | 'risk' | 'trend' | 'anomaly';
    title: string;
    description: string;
    impact: 'low' | 'medium' | 'high';
    recommendations: string[];
    confidence: number;
}

export class BusinessIntelligenceEngine {
    private static instance: BusinessIntelligenceEngine;

    private constructor() { }

    static getInstance(): BusinessIntelligenceEngine {
        if (!BusinessIntelligenceEngine.instance) {
            BusinessIntelligenceEngine.instance = new BusinessIntelligenceEngine();
        }
        return BusinessIntelligenceEngine.instance;
    }

    async generateInsights(tenantId: string): Promise<BusinessInsight[]> {
        const insights: BusinessInsight[] = [];

        logger.debug(`Generating BI insights for tenant ${tenantId}...`);

        // 1. Customer Behavior Analysis - Calculate real repeat purchase rate
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data: customers } = await supabase
            .from('customers')
            .select('id')
            .eq('tenant_id', tenantId);

        const totalCustomers = customers?.length || 0;

        if (totalCustomers > 0) {
            const { data: repeatCustomers } = await supabase
                .from('orders')
                .select('user_id')
                .eq('tenant_id', tenantId)
                .gte('created_at', thirtyDaysAgo.toISOString());

            const customerOrderCounts = (repeatCustomers || []).reduce((acc: Record<string, number>, order: any) => {
                if (order.user_id) {
                    acc[order.user_id] = (acc[order.user_id] || 0) + 1;
                }
                return acc;
            }, {});

            const repeatCount = Object.values(customerOrderCounts).filter(count => count > 1).length;
            const repeatRate = (repeatCount / totalCustomers) * 100;

            if (repeatRate < 40) {
                insights.push({
                    type: 'opportunity',
                    title: 'Low Repeat Purchase Rate',
                    description: `Only ${repeatRate.toFixed(0)}% of customers make repeat purchases within 30 days.`,
                    impact: repeatRate < 20 ? 'high' : 'medium',
                    recommendations: [
                        'Implement loyalty program',
                        'Send follow-up offers after first purchase',
                        'Create VIP menus for repeat customers'
                    ],
                    confidence: 0.85
                });
            }
        }

        // 2. Inventory Performance - Calculate real slow-moving inventory
        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

        const { data: products } = await supabase
            .from('products')
            .select('id, name')
            .eq('tenant_id', tenantId);

        if (products && products.length > 0) {
            const slowMovers = [];

            const { data: recentOrders } = await supabase
                .from('menu_orders')
                .select('order_data')
                .eq('tenant_id', tenantId)
                .gte('created_at', fourteenDaysAgo.toISOString()) as { data: MenuOrderData[] | null };

            // Simple check - if product hasn't appeared in recent orders
            const productsSold = new Set();
            recentOrders?.forEach((order: any) => {
                if (order.order_data?.items) {
                    order.order_data.items.forEach((item: any) => {
                        productsSold.add(item.product_id);
                    });
                }
            });

            products.forEach((product: any) => {
                if (!productsSold.has(product.id)) {
                    slowMovers.push(product);
                }
            });

            if (slowMovers.length > 0) {
                insights.push({
                    type: 'risk',
                    title: 'Slow-Moving Inventory',
                    description: `${slowMovers.length} products have not sold in the last 14 days.`,
                    impact: slowMovers.length > 5 ? 'high' : 'medium',
                    recommendations: [
                        'Create flash sale for slow movers',
                        'Bundle with popular products',
                        'Adjust pricing strategy'
                    ],
                    confidence: 0.92
                });
            }
        }

        // 3. Security Analysis - Check real security events
        const { data: securityEvents } = await supabase
            .from('security_events')
            .select('id, event_type')
            .gte('created_at', thirtyDaysAgo.toISOString())
            .in('event_type', ['failed_login', 'unauthorized_access']) as { data: { id: string; event_type: string }[] | null };

        if (securityEvents && securityEvents.length > 5) {
            insights.push({
                type: 'risk',
                title: 'Elevated Security Risk',
                description: `${securityEvents.length} failed access attempts detected in the last 30 days.`,
                impact: securityEvents.length > 20 ? 'high' : 'medium',
                recommendations: [
                    'Enable two-factor authentication for admin',
                    'Review IP whitelist settings',
                    'Increase access code complexity'
                ],
                confidence: 0.95
            });
        }

        return insights;
    }
}
