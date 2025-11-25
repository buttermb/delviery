/**
 * Strategic Dashboard Page
 * 
 * High-level KPIs and growth metrics
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3, TrendingUp, Target, Zap, DollarSign, ShoppingCart, Users, Package2 } from 'lucide-react';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export default function StrategicDashboardPage() {
    const { tenant } = useTenantAdminAuth();

    const { data: strategicData, isLoading } = useQuery({
        queryKey: ['strategic-metrics', tenant?.id],
        queryFn: async () => {
            if (!tenant?.id) throw new Error('No tenant');

            const today = new Date();
            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59);

            // Current month metrics
            const { data: currentMonthOrders } = await supabase
                .from('orders')
                .select('total_amount')
                .eq('tenant_id', tenant.id)
                .gte('created_at', startOfMonth.toISOString())
                .not('status', 'in', '("cancelled","rejected","refunded")');

            // Last month metrics
            const { data: lastMonthOrders } = await supabase
                .from('orders')
                .select('total_amount')
                .eq('tenant_id', tenant.id)
                .gte('created_at', startOfLastMonth.toISOString())
                .lt('created_at', endOfLastMonth.toISOString())
                .not('status', 'in', '("cancelled","rejected","refunded")');

            const currentRevenue = currentMonthOrders?.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) || 0;
            const lastRevenue = lastMonthOrders?.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) || 0;
            const revenueGrowth = lastRevenue > 0 ? ((currentRevenue - lastRevenue) / lastRevenue) * 100 : 0;

            // Customer metrics
            const { count: totalCustomers } = await supabase
                .from('customers')
                .select('*', { count: 'exact', head: true })
                .eq('tenant_id', tenant.id);

            const { count: newCustomersThisMonth } = await supabase
                .from('customers')
                .select('*', { count: 'exact', head: true })
                .eq('tenant_id', tenant.id)
                .gte('created_at', startOfMonth.toISOString());

            // Order metrics
            const { count: totalOrders } = await supabase
                .from('orders')
                .select('*', { count: 'exact', head: true })
                .eq('tenant_id', tenant.id)
                .gte('created_at', startOfMonth.toISOString());

            // Product metrics
            const { count: totalProducts } = await supabase
                .from('products')
                .select('*', { count: 'exact', head: true })
                .eq('tenant_id', tenant.id);

            return {
                currentRevenue,
                lastRevenue,
                revenueGrowth,
                totalCustomers: totalCustomers || 0,
                newCustomersThisMonth: newCustomersThisMonth || 0,
                totalOrders: totalOrders || 0,
                totalProducts: totalProducts || 0,
                avgOrderValue: totalOrders ? currentRevenue / totalOrders : 0,
            };
        },
        enabled: !!tenant?.id,
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="mt-2 text-muted-foreground">Loading strategic metrics...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold flex items-center gap-2">
                    <BarChart3 className="h-8 w-8" />
                    Strategic Dashboard
                </h1>
                <p className="text-muted-foreground mt-1">High-level KPIs and growth metrics</p>
            </div>

            {/* Key Metrics Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Revenue (MTD)</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">${strategicData?.currentRevenue.toLocaleString()}</div>
                        <div className="flex items-center gap-1 text-xs">
                            {(strategicData?.revenueGrowth || 0) >= 0 ? (
                                <TrendingUp className="h-3 w-3 text-green-600" />
                            ) : (
                                <TrendingUp className="h-3 w-3 text-red-600 rotate-180" />
                            )}
                            <span className={(strategicData?.revenueGrowth || 0) >= 0 ? 'text-green-600' : 'text-red-600'}>
                                {Math.abs(strategicData?.revenueGrowth || 0).toFixed(1)}%
                            </span>
                            <span className="text-muted-foreground">vs last month</span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                        <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{strategicData?.totalOrders}</div>
                        <p className="text-xs text-muted-foreground">This month</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{strategicData?.totalCustomers}</div>
                        <p className="text-xs text-muted-foreground">+{strategicData?.newCustomersThisMonth} this month</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Avg Order Value</CardTitle>
                        <Target className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">${(strategicData?.avgOrderValue || 0).toFixed(2)}</div>
                        <p className="text-xs text-muted-foreground">Per order</p>
                    </CardContent>
                </Card>
            </div>

            {/* Growth Trends */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        Growth Trends
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                        <div>
                            <p className="text-sm font-medium">Revenue Growth</p>
                            <p className="text-2xl font-bold text-green-600">+{Math.abs(strategicData?.revenueGrowth || 0).toFixed(1)}%</p>
                        </div>
                        <Badge variant="secondary">Month over Month</Badge>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                        <div>
                            <p className="text-sm font-medium">New Customers</p>
                            <p className="text-2xl font-bold text-blue-600">+{strategicData?.newCustomersThisMonth}</p>
                        </div>
                        <Badge variant="secondary">This Month</Badge>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                        <div>
                            <p className="text-sm font-medium">Total Products</p>
                            <p className="text-2xl font-bold">{strategicData?.totalProducts}</p>
                        </div>
                        <Badge variant="secondary">In Catalog</Badge>
                    </div>
                </CardContent>
            </Card>

            {/* Strategic Goals */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Zap className="h-5 w-5" />
                        Strategic Focus Areas
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex items-start gap-3 p-3 border rounded-lg">
                        <Package2 className="h-5 w-5 text-primary mt-0.5" />
                        <div className="flex-1">
                            <h4 className="font-medium">Expand Product Catalog</h4>
                            <p className="text-sm text-muted-foreground">Currently at {strategicData?.totalProducts} products</p>
                        </div>
                        <Badge>In Progress</Badge>
                    </div>

                    <div className="flex items-start gap-3 p-3 border rounded-lg">
                        <Users className="h-5 w-5 text-primary mt-0.5" />
                        <div className="flex-1">
                            <h4 className="font-medium">Customer Acquisition</h4>
                            <p className="text-sm text-muted-foreground">+{strategicData?.newCustomersThisMonth} new customers this month</p>
                        </div>
                        <Badge variant="secondary">On Track</Badge>
                    </div>

                    <div className="flex items-start gap-3 p-3 border rounded-lg">
                        <DollarSign className="h-5 w-5 text-primary mt-0.5" />
                        <div className="flex-1">
                            <h4 className="font-medium">Revenue Optimization</h4>
                            <p className="text-sm text-muted-foreground">Avg order value: ${(strategicData?.avgOrderValue || 0).toFixed(2)}</p>
                        </div>
                        <Badge variant="secondary">Monitoring</Badge>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
