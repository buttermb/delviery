import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

export function WeeklyTrendsWidget() {
    const { tenant } = useTenantAdminAuth();

    const { data: progress, isLoading } = useQuery({
        queryKey: ['hotbox-weekly', tenant?.id],
        queryFn: async () => {
            if (!tenant?.id) return null;

            const now = new Date();
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
            weekStart.setHours(0, 0, 0, 0);

            const lastWeekStart = new Date(weekStart);
            lastWeekStart.setDate(lastWeekStart.getDate() - 7);
            const lastWeekEnd = new Date(weekStart);
            lastWeekEnd.setMilliseconds(-1);

            // This week's orders and revenue
            const { data: thisWeekOrders } = await supabase
                .from('orders')
                .select('total_amount')
                .eq('tenant_id', tenant.id)
                .gte('created_at', weekStart.toISOString())
                .not('status', 'in', '("cancelled","rejected","refunded")');

            // Last week's orders (for goal comparison)
            const { data: lastWeekOrders } = await supabase
                .from('orders')
                .select('total_amount')
                .eq('tenant_id', tenant.id)
                .gte('created_at', lastWeekStart.toISOString())
                .lt('created_at', weekStart.toISOString())
                .not('status', 'in', '("cancelled","rejected","refunded")');

            // New customers this week
            const { count: newCustomers } = await supabase
                .from('customers')
                .select('*', { count: 'exact', head: true })
                .eq('tenant_id', tenant.id)
                .gte('created_at', weekStart.toISOString());

            // Last week's new customers (for goal)
            const { count: lastWeekNewCustomers } = await supabase
                .from('customers')
                .select('*', { count: 'exact', head: true })
                .eq('tenant_id', tenant.id)
                .gte('created_at', lastWeekStart.toISOString())
                .lt('created_at', weekStart.toISOString());

            const thisWeekRevenue = thisWeekOrders?.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) || 0;
            const lastWeekRevenue = lastWeekOrders?.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) || 0;

            // Goals = last week's numbers + 10% growth target
            const revenueGoal = Math.round(lastWeekRevenue * 1.1) || 5000;
            const ordersGoal = Math.round((lastWeekOrders?.length || 10) * 1.1);
            const customersGoal = Math.round((lastWeekNewCustomers || 5) * 1.1);

            return {
                revenueGoal: Math.max(revenueGoal, 1000), // Minimum goals
                revenueCurrent: thisWeekRevenue,
                ordersGoal: Math.max(ordersGoal, 10),
                ordersCurrent: thisWeekOrders?.length || 0,
                customersGoal: Math.max(customersGoal, 5),
                customersCurrent: newCustomers || 0,
            };
        },
        enabled: !!tenant?.id,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });

    if (isLoading) {
        return (
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-medium flex items-center gap-2">
                        <span className="text-xl">📊</span> WEEKLY PROGRESS
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-center py-8 text-muted-foreground">
                        Calculating progress...
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (!progress) {
        return (
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-medium flex items-center gap-2">
                        <span className="text-xl">📊</span> WEEKLY PROGRESS
                        <Badge variant="outline" className="text-xs ml-auto">
                            Starting fresh
                        </Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-6">
                        <p className="text-muted-foreground mb-3">No data for this week yet</p>
                        <p className="text-sm text-muted-foreground">
                            Progress tracking will begin once you have orders
                        </p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    const metrics = [
        {
            label: 'Weekly Revenue',
            current: progress.revenueCurrent,
            goal: progress.revenueGoal,
            format: (v: number) => `$${v.toLocaleString()}`,
        },
        {
            label: 'Orders',
            current: progress.ordersCurrent,
            goal: progress.ordersGoal,
            format: (v: number) => v.toString(),
        },
        {
            label: 'New Customers',
            current: progress.customersCurrent,
            goal: progress.customersGoal,
            format: (v: number) => v.toString(),
        },
    ];

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-lg font-medium flex items-center gap-2">
                    <span className="text-xl">📊</span> WEEKLY PROGRESS
                    <Badge variant="outline" className="text-xs ml-auto">
                        vs last week +10%
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {metrics.map((metric) => {
                    const percent = metric.goal > 0 ? Math.min(100, Math.round((metric.current / metric.goal) * 100)) : 0;
                    const isAhead = percent >= 100;
                    return (
                        <div key={metric.label} className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="font-medium">{metric.label}</span>
                                <span className="text-muted-foreground">
                                    {metric.format(metric.current)} / {metric.format(metric.goal)}
                                </span>
                            </div>
                            <Progress
                                value={percent}
                                className={cn('h-2', isAhead && 'bg-green-200 [&>div]:bg-green-500')}
                            />
                            <div className={cn(
                                'text-xs text-right',
                                isAhead ? 'text-green-600 font-medium' : 'text-muted-foreground'
                            )}>
                                {percent}% of goal {isAhead && '🎉'}
                            </div>
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
}
