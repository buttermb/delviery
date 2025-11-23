import { logger } from '@/lib/logger';

import { useState, useEffect } from 'react';
import { BusinessIntelligenceEngine, BusinessInsight } from '@/lib/analytics/bi-engine';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';

export interface DashboardMetrics {
    activeUsers: number;
    ordersToday: number;
    revenueToday: number;
    securityAlerts: number;
}

export function useSmartDashboard() {
    const { tenant } = useTenantAdminAuth();
    const [insights, setInsights] = useState<BusinessInsight[]>([]);
    const [metrics, setMetrics] = useState<DashboardMetrics>({
        activeUsers: 0,
        ordersToday: 0,
        revenueToday: 0,
        securityAlerts: 0
    });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!tenant?.id) return;

        const biEngine = BusinessIntelligenceEngine.getInstance();

        // 1. Fetch Initial Insights
        const fetchInsights = async () => {
            try {
                const data = await biEngine.generateInsights(tenant.id);
                setInsights(data);
            } catch (error) {
                logger.error('Failed to generate insights:', error);
            }
        };

        // 2. Fetch Initial Metrics
        const fetchMetrics = async () => {
            try {
                // Fix timestamp format - use ISO string instead of milliseconds
                const startOfDay = new Date();
                startOfDay.setHours(0, 0, 0, 0);
                
                // @ts-ignore - Avoid deep type instantiation
                const { count: orderCount } = await supabase
                    .from('menu_orders')
                    .select('id', { count: 'exact', head: true })
                    .eq('tenant_id', tenant.id)
                    .gte('created_at', startOfDay.toISOString());

                setMetrics(prev => ({
                    ...prev,
                    ordersToday: orderCount || 0,
                    activeUsers: Math.floor(Math.random() * 10) + 2 // Mock active users
                }));
            } catch (error) {
                logger.error('Failed to fetch metrics:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchInsights();
        fetchMetrics();

        // 3. Set up Real-time Subscriptions
        const channel = supabase
            .channel('smart-dashboard')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'menu_orders', filter: `tenant_id=eq.${tenant.id}` },
                (payload) => {
                    setMetrics(prev => ({
                        ...prev,
                        ordersToday: prev.ordersToday + 1,
                        revenueToday: prev.revenueToday + (payload.new.total_amount || 0)
                    }));
                }
            )
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'menu_security_events' },
                () => {
                    setMetrics(prev => ({
                        ...prev,
                        securityAlerts: prev.securityAlerts + 1
                    }));
                }
            )
            .subscribe((status) => {
                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    logger.error('Smart dashboard subscription error', { status });
                }
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [tenant?.id]);

    return {
        insights,
        metrics,
        isLoading
    };
}
