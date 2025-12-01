/**
 * Real-Time Sales Widget
 * Live sales metrics showing today's performance vs goals and trends
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    DollarSign,
    ShoppingCart,
    TrendingUp,
    TrendingDown,
    Minus
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { formatCurrency } from '@/lib/utils/formatCurrency';

export function RealtimeSalesWidget() {
    const { tenant } = useTenantAdminAuth();
    const tenantId = tenant?.id;

    const { data: salesMetrics, isLoading } = useQuery({
        queryKey: ['realtime-sales', tenantId],
        queryFn: async () => {
            if (!tenantId) return null;

            const now = new Date();
            const today = new Date(now);
            today.setHours(0, 0, 0, 0);

            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);

            // Get today's orders
            const { data: todayOrders, error: todayError } = await supabase
                .from('wholesale_orders')
                .select('total_amount, created_at')
                .eq('tenant_id', tenantId)
                .gte('created_at', today.toISOString());

            if (todayError) throw todayError;

            // Get yesterday's orders for comparison
            const { data: yesterdayOrders, error: yesterdayError } = await supabase
                .from('wholesale_orders')
                .select('total_amount')
                .eq('tenant_id', tenantId)
                .gte('created_at', yesterday.toISOString())
                .lt('created_at', today.toISOString());

            if (yesterdayError) throw yesterdayError;

            // Calculate metrics
            const todayRevenue = (todayOrders || []).reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
            const todayOrderCount = todayOrders?.length || 0;
            const todayAvgOrder = todayOrderCount > 0 ? todayRevenue / todayOrderCount : 0;

            const yesterdayRevenue = (yesterdayOrders || []).reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
            const yesterdayOrderCount = yesterdayOrders?.length || 0;
            const yesterdayAvgOrder = yesterdayOrderCount > 0 ? yesterdayRevenue / yesterdayOrderCount : 0;

            // Calculate trends
            const revenueTrend = yesterdayRevenue > 0
                ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100
                : todayRevenue > 0 ? 100 : 0;

            const orderTrend = yesterdayOrderCount > 0
                ? ((todayOrderCount - yesterdayOrderCount) / yesterdayOrderCount) * 100
                : todayOrderCount > 0 ? 100 : 0;

            const avgOrderTrend = yesterdayAvgOrder > 0
                ? ((todayAvgOrder - yesterdayAvgOrder) / yesterdayAvgOrder) * 100
                : todayAvgOrder > 0 ? 100 : 0;

            return {
                revenue: todayRevenue,
                orderCount: todayOrderCount,
                avgOrder: todayAvgOrder,
                revenueTrend,
                orderTrend,
                avgOrderTrend,
                yesterdayRevenue,
                yesterdayOrderCount
            };
        },
        enabled: !!tenantId,
        refetchInterval: 30000 // Refresh every 30 seconds
    });

    const getTrendIcon = (trend: number) => {
        if (trend > 5) return <TrendingUp className="h-4 w-4 text-green-600" />;
        if (trend < -5) return <TrendingDown className="h-4 w-4 text-red-600" />;
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    };

    const getTrendColor = (trend: number) => {
        if (trend > 5) return 'text-green-600';
        if (trend < -5) return 'text-red-600';
        return 'text-muted-foreground';
    };

    const formatTrend = (trend: number) => {
        const sign = trend >= 0 ? '+' : '';
        return `${sign}${trend.toFixed(1)}%`;
    };

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Today's Performance</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center h-32">
                    <div className="text-sm text-muted-foreground">Loading...</div>
                </CardContent>
            </Card>
        );
    }

    if (!salesMetrics) return null;

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        Today's Performance
                        <Badge variant="outline" className="text-xs">Live</Badge>
                    </CardTitle>
                    <span className="text-xs text-muted-foreground">vs yesterday</span>
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Revenue */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <DollarSign className="h-4 w-4" />
                            <span>Revenue</span>
                        </div>
                        <div className="space-y-1">
                            <div className="text-2xl font-bold">
                                {formatCurrency(salesMetrics.revenue)}
                            </div>
                            <div className={`flex items-center gap-1 text-sm font-medium ${getTrendColor(salesMetrics.revenueTrend)}`}>
                                {getTrendIcon(salesMetrics.revenueTrend)}
                                <span>{formatTrend(salesMetrics.revenueTrend)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Orders */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <ShoppingCart className="h-4 w-4" />
                            <span>Orders</span>
                        </div>
                        <div className="space-y-1">
                            <div className="text-2xl font-bold">
                                {salesMetrics.orderCount}
                            </div>
                            <div className={`flex items-center gap-1 text-sm font-medium ${getTrendColor(salesMetrics.orderTrend)}`}>
                                {getTrendIcon(salesMetrics.orderTrend)}
                                <span>{formatTrend(salesMetrics.orderTrend)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Avg Order Value */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <TrendingUp className="h-4 w-4" />
                            <span>Avg Order</span>
                        </div>
                        <div className="space-y-1">
                            <div className="text-2xl font-bold">
                                {formatCurrency(salesMetrics.avgOrder)}
                            </div>
                            <div className={`flex items-center gap-1 text-sm font-medium ${getTrendColor(salesMetrics.avgOrderTrend)}`}>
                                {getTrendIcon(salesMetrics.avgOrderTrend)}
                                <span>{formatTrend(salesMetrics.avgOrderTrend)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
