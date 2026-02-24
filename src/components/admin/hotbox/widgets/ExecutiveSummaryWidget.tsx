import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { queryKeys } from '@/lib/queryKeys';

export function ExecutiveSummaryWidget() {
    const { tenant } = useTenantAdminAuth();

    const { data: summary, isLoading } = useQuery({
        queryKey: queryKeys.hotbox.executive(tenant?.id),
        queryFn: async () => {
            if (!tenant?.id) return null;

            const now = new Date();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

            // MTD Revenue (orders + POS)
            const [ordersResult, posResult, lastMonthOrders] = await Promise.all([
                supabase
                    .from('orders')
                    .select('total_amount')
                    .eq('tenant_id', tenant.id)
                    .gte('created_at', monthStart.toISOString())
                    .not('status', 'in', '("cancelled","rejected","refunded")'),

                supabase
                    .from('pos_transactions')
                    .select('total_amount')
                    .eq('tenant_id', tenant.id)
                    .gte('created_at', monthStart.toISOString())
                    .eq('payment_status', 'paid'),

                supabase
                    .from('orders')
                    .select('total_amount')
                    .eq('tenant_id', tenant.id)
                    .gte('created_at', lastMonthStart.toISOString())
                    .lte('created_at', lastMonthEnd.toISOString())
                    .not('status', 'in', '("cancelled","rejected","refunded")'),
            ]);

            const ordersRevenue = ordersResult.data?.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) || 0;
            const posRevenue = posResult.data?.reduce((sum, t) => sum + Number(t.total_amount || 0), 0) || 0;
            const mtdRevenue = ordersRevenue + posRevenue;

            const lastMonthRevenue = lastMonthOrders.data?.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) || 0;

            // Calculate change percentage
            const revenueChange = lastMonthRevenue > 0
                ? Math.round(((mtdRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
                : 0;

            // Project end of month (simple linear projection)
            const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
            const daysPassed = now.getDate();
            const projectedClose = daysPassed > 0
                ? Math.round((mtdRevenue / daysPassed) * daysInMonth)
                : mtdRevenue;

            // Estimate profit (25% margin)
            const profitMargin = 25;
            const netProfit = Math.round(mtdRevenue * (profitMargin / 100));

            // AR Outstanding - actual unpaid invoices and customer tabs
            const [invoicesResult, tabsResult] = await Promise.all([
                // Unpaid invoices
                supabase
                    .from('invoices')
                    .select('total')
                    .eq('tenant_id', tenant.id)
                    .in('status', ['pending', 'overdue', 'sent']),

                // Customer tabs (unpaid balances)
                supabase
                    .from('customers')
                    .select('balance')
                    .eq('tenant_id', tenant.id)
                    .gt('balance', 0),
            ]);

            const unpaidInvoices = invoicesResult.data?.reduce((sum, i) => sum + Number(i.total || 0), 0) || 0;
            const unpaidTabs = tabsResult.data?.reduce((sum, c) => sum + Number(c.balance || 0), 0) || 0;
            const arOutstanding = unpaidInvoices + unpaidTabs;

            return {
                mtdRevenue,
                revenueChange,
                projectedClose,
                netProfit,
                profitMargin,
                arOutstanding,
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
                        EXECUTIVE SUMMARY
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[1, 2, 3, 4].map((i) => (
                            <Skeleton key={i} className="h-16" />
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-lg font-medium flex items-center gap-2">
                    EXECUTIVE SUMMARY
                    <Badge variant="outline" className="text-xs ml-auto">
                        {format(new Date(), 'MMMM yyyy')}
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                        <div className="text-sm text-muted-foreground">MTD Revenue</div>
                        <div className="text-xl font-bold">${(summary?.mtdRevenue || 0).toLocaleString()}</div>
                        {summary?.revenueChange !== undefined && summary.revenueChange !== 0 && (
                            <div className={cn(
                                'text-xs',
                                summary.revenueChange > 0 ? 'text-green-600' : 'text-red-600'
                            )}>
                                {summary.revenueChange > 0 ? '↑' : '↓'} {Math.abs(summary.revenueChange)}% vs last month
                            </div>
                        )}
                    </div>
                    <div className="space-y-1">
                        <div className="text-sm text-muted-foreground">Projected Close</div>
                        <div className="text-xl font-bold">${(summary?.projectedClose || 0).toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">at current pace</div>
                    </div>
                    <div className="space-y-1">
                        <div className="text-sm text-muted-foreground">Est. Profit</div>
                        <div className="text-xl font-bold">${(summary?.netProfit || 0).toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">~{summary?.profitMargin}% margin</div>
                    </div>
                    <div className="space-y-1">
                        <div className="text-sm text-muted-foreground">AR Outstanding</div>
                        <div className={cn(
                            "text-xl font-bold",
                            (summary?.arOutstanding || 0) > 0 && "text-yellow-600"
                        )}>${(summary?.arOutstanding || 0).toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">
                            {(summary?.arOutstanding || 0) > 0 ? 'to collect' : 'all collected'}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
