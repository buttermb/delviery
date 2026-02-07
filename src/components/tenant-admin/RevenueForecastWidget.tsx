/**
 * Revenue Forecast Widget
 * Projects future revenue based on current trends and historical data
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    TrendingUp,
    TrendingDown,
    DollarSign,
    Calendar
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { formatCurrency } from '@/lib/utils/formatCurrency';

export function RevenueForecastWidget() {
    const { tenant } = useTenantAdminAuth();
    const tenantId = tenant?.id;

    const { data: forecast, isLoading } = useQuery({
        queryKey: ['revenue-forecast', tenantId],
        queryFn: async () => {
            if (!tenantId) return null;

            // Get last 30 days of revenue
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const { data: orders } = await supabase
                .from('wholesale_orders')
                .select('total_amount, created_at')
                .eq('tenant_id', tenantId)
                .gte('created_at', thirtyDaysAgo.toISOString())
                .order('created_at', { ascending: true });

            if (!orders || orders.length === 0) return null;

            // Calculate daily average revenue
            const totalRevenue = orders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
            const dailyAverage = totalRevenue / 30;

            // Calculate growth trend (compare first 15 days vs last 15 days)
            const midPoint = new Date();
            midPoint.setDate(midPoint.getDate() - 15);

            const firstHalf = orders.filter(o => new Date(o.created_at) < midPoint);
            const secondHalf = orders.filter(o => new Date(o.created_at) >= midPoint);

            const firstHalfRev = firstHalf.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
            const secondHalfRev = secondHalf.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);

            // Simple linear projection
            const growthRate = firstHalfRev > 0 ? (secondHalfRev - firstHalfRev) / firstHalfRev : 0;

            // Project next 30 days
            const projectedRevenue = totalRevenue * (1 + growthRate);
            const projectedDaily = dailyAverage * (1 + growthRate);

            return {
                currentMonthly: totalRevenue,
                projectedMonthly: projectedRevenue,
                dailyAverage,
                growthRate: growthRate * 100,
                confidence: orders.length > 10 ? 'High' : 'Low' // Simple confidence metric
            };
        },
        enabled: !!tenantId,
    });

    if (isLoading) {
        return (
            <Card className="glass-card">
                <CardHeader>
                    <CardTitle>Revenue Forecast</CardTitle>
                </CardHeader>
                <CardContent className="h-40 flex items-center justify-center text-muted-foreground">
                    Calculating projections...
                </CardContent>
            </Card>
        );
    }

    if (!forecast) return null;

    const isPositive = forecast.growthRate >= 0;

    return (
        <Card className="glass-card bg-gradient-to-br from-blue-50/40 to-blue-100/40 dark:from-blue-900/10 dark:to-blue-950/20 border-blue-100/50 dark:border-blue-900/50">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-blue-900 dark:text-blue-100">
                        <TrendingUp className="h-5 w-5" />
                        Revenue Forecast
                    </CardTitle>
                    <Badge variant="outline" className="bg-white/50 border-blue-200 text-blue-700">
                        Next 30 Days
                    </Badge>
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            Projected Revenue
                        </span>
                        <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                            {formatCurrency(forecast.projectedMonthly)}
                        </div>
                        <div className={`text-xs font-medium flex items-center gap-1 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                            {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            {Math.abs(forecast.growthRate).toFixed(1)}% vs last 30 days
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="space-y-1">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                Daily Average
                            </span>
                            <div className="text-lg font-semibold">
                                {formatCurrency(forecast.dailyAverage)}
                            </div>
                        </div>

                        <div className="space-y-1">
                            <span className="text-xs text-muted-foreground">Forecast Confidence</span>
                            <Badge variant={forecast.confidence === 'High' ? 'default' : 'secondary'} className="text-[10px] h-5">
                                {forecast.confidence}
                            </Badge>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
