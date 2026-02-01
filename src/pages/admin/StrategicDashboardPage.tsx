/**
 * Strategic Dashboard Page
 * 
 * High-level KPIs and growth metrics
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3, TrendingUp, Target, Zap, DollarSign, ShoppingCart, Users, Package2, ArrowUpRight, ArrowDownRight, Sparkles, Loader2 } from 'lucide-react';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

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
                <div className="text-center space-y-4">
                    <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-purple-500/20 to-pink-500/20 rounded-full blur-xl animate-pulse" />
                        <Loader2 className="h-12 w-12 animate-spin text-primary relative z-10" />
                    </div>
                    <p className="text-muted-foreground font-medium">Loading strategic insights...</p>
                </div>
            </div>
        );
    }

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
    };

    const growthIsPositive = (strategicData?.revenueGrowth || 0) >= 0;

    return (
        <motion.div
            className="space-y-6 p-4 sm:p-6"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
        >
            {/* Hero Header with Gradient - Using Design System Colors */}
            <motion.div
                variants={itemVariants}
                className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 p-6 sm:p-8 text-white"
            >
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iYSIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVHJhbnNmb3JtPSJyb3RhdGUoNDUpIj48cGF0aCBkPSJNLTEwIDMwaDYwdjJoLTYweiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3QgZmlsbD0idXJsKCNhKSIgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIvPjwvc3ZnPg==')] opacity-50" />
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                            <BarChart3 className="h-6 w-6" />
                        </div>
                        <Badge className="bg-white/20 hover:bg-white/30 text-white border-0">
                            <Sparkles className="h-3 w-3 mr-1" />
                            Live Metrics
                        </Badge>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-bold">Strategic Dashboard</h1>
                    <p className="text-white/80 mt-1">High-level KPIs and growth metrics for {tenant?.slug || 'your business'}</p>
                </div>

                {/* Decorative elements */}
                <div className="absolute right-0 top-0 w-40 h-40 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                <div className="absolute left-20 bottom-0 w-32 h-32 bg-white/10 rounded-full blur-2xl translate-y-1/2" />
            </motion.div>

            {/* Key Metrics Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <motion.div variants={itemVariants}>
                    <Card className="relative overflow-hidden border shadow-sm hover:shadow-md transition-shadow">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Revenue (MTD)</CardTitle>
                            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                                <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">${strategicData?.currentRevenue.toLocaleString()}</div>
                            <div className="flex items-center gap-1 text-xs mt-1">
                                {growthIsPositive ? (
                                    <ArrowUpRight className="h-3 w-3 text-emerald-600" />
                                ) : (
                                    <ArrowDownRight className="h-3 w-3 text-red-600" />
                                )}
                                <span className={growthIsPositive ? 'text-emerald-600 font-medium' : 'text-red-600 font-medium'}>
                                    {Math.abs(strategicData?.revenueGrowth || 0).toFixed(1)}%
                                </span>
                                <span className="text-muted-foreground">vs last month</span>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                <motion.div variants={itemVariants}>
                    <Card className="relative overflow-hidden border shadow-sm hover:shadow-md transition-shadow">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                <ShoppingCart className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{strategicData?.totalOrders}</div>
                            <p className="text-xs text-muted-foreground mt-1">This month</p>
                        </CardContent>
                    </Card>
                </motion.div>

                <motion.div variants={itemVariants}>
                    <Card className="relative overflow-hidden border shadow-sm hover:shadow-md transition-shadow">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
                            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                                <Users className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{strategicData?.totalCustomers}</div>
                            <p className="text-xs text-muted-foreground mt-1">+{strategicData?.newCustomersThisMonth} this month</p>
                        </CardContent>
                    </Card>
                </motion.div>

                <motion.div variants={itemVariants}>
                    <Card className="relative overflow-hidden border shadow-sm hover:shadow-md transition-shadow">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Avg Order Value</CardTitle>
                            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                                <Target className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">${(strategicData?.avgOrderValue || 0).toFixed(2)}</div>
                            <p className="text-xs text-muted-foreground mt-1">Per order</p>
                        </CardContent>
                    </Card>
                </motion.div>
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
        </motion.div>
    );
}
