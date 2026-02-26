import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { useCredits } from "@/contexts/CreditContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { logger } from "@/lib/logger";
import {
    ShoppingBag,
    DollarSign,
    Users,
    ExternalLink,
    Settings,
    Package,
    Tag,
    Coins,
    AlertTriangle,
    FolderTree
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { queryKeys } from '@/lib/queryKeys';

interface RecentSale {
    id: string;
    customer_name: string;
    total_amount: number;
    order_number: string;
    status: string;
}

interface ChartDataPoint {
    date: string;
    revenue: number;
}

interface AnalyticsData {
    total_revenue: number;
    total_orders: number;
    active_customers: number;
    recent_sales: RecentSale[];
    chart_data: ChartDataPoint[];
}

export default function MarketplaceDashboard() {
    const { tenant } = useTenantAdminAuth();
    const { credits } = useCredits();
    const navigate = useNavigate();

    // Fetch store profile
    const { data: profile } = useQuery({
        queryKey: queryKeys.marketplaceProfileAdmin.byTenant(tenant?.id),
        queryFn: async () => {
            if (!tenant?.id) return null;
            const { data, error } = await supabase
                .from('marketplace_profiles')
                .select('*')
                .eq('tenant_id', tenant.id)
                .maybeSingle();

            if (error) {
                logger.error('Failed to fetch marketplace profile', error);
                return null;
            }
            return data;
        },
        enabled: !!tenant?.id
    });

    // Fetch analytics
    const { data: analytics } = useQuery({
        queryKey: queryKeys.marketplaceAnalytics.byProfile(profile?.id),
        queryFn: async () => {
            if (!profile?.id) return null;
            const rpc = supabase.rpc as unknown as (fn: string, params: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
            const { data, error } = await rpc('get_marketplace_analytics', { p_store_id: profile.id }); // Supabase type limitation

            if (error) {
                logger.error('Failed to fetch analytics', error);
                throw error;
            }
            return data as unknown as AnalyticsData;
        },
        enabled: !!profile?.id
    });

    const copyStoreUrl = () => {
        if (!profile?.slug) return;
        const url = `${window.location.origin}/shop/${profile.slug}`;
        navigator.clipboard.writeText(url);
        toast.success("Store URL copied to clipboard");
    };

    return (
        <div className="space-y-4 p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl font-bold tracking-tight">Marketplace Dashboard</h1>
                    <p className="text-muted-foreground mt-1">
                        Manage your customer-facing storefront metrics and performance.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => navigate('orders')}>
                        <ShoppingBag className="mr-2 h-4 w-4" />
                        Orders
                    </Button>
                    <Button variant="outline" onClick={() => navigate('products')}>
                        <Package className="mr-2 h-4 w-4" />
                        Products
                    </Button>
                    <Button variant="outline" onClick={() => navigate('categories')}>
                        <FolderTree className="mr-2 h-4 w-4" />
                        Categories
                    </Button>
                    <Button variant="outline" onClick={() => navigate('coupons')}>
                        <Tag className="mr-2 h-4 w-4" />
                        Coupons
                    </Button>
                    <Button variant="outline" onClick={() => navigate('settings')}>
                        <Settings className="mr-2 h-4 w-4" />
                        Store Settings
                    </Button>
                    <Button onClick={copyStoreUrl} disabled={!profile?.slug}>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Visit Store
                    </Button>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {analytics ? formatCurrency(analytics.total_revenue ?? 0) : '$0.00'}
                        </div>
                        <p className="text-xs text-muted-foreground">Lifetime revenue</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Orders</CardTitle>
                        <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{analytics?.total_orders ?? 0}</div>
                        <p className="text-xs text-muted-foreground">Total orders received</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Credit Balance</CardTitle>
                        <Coins className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <div className={`text-2xl font-bold ${credits < 500 ? 'text-red-500' : ''}`}>
                                {credits}
                            </div>
                            {credits < 500 && (
                                <AlertTriangle className="h-4 w-4 text-red-500" />
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Cost per order: 100 credits
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Customers</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{analytics?.active_customers ?? 0}</div>
                        <p className="text-xs text-muted-foreground">Unique customers</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Revenue Overview</CardTitle>
                        <CardDescription>Daily revenue for the last 30 days</CardDescription>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <div className="h-[200px] w-full">
                            {analytics?.chart_data ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={analytics.chart_data}>
                                        <XAxis
                                            dataKey="date"
                                            stroke="#888888"
                                            fontSize={12}
                                            tickLine={false}
                                            axisLine={false}
                                        />
                                        <YAxis
                                            stroke="#888888"
                                            fontSize={12}
                                            tickLine={false}
                                            axisLine={false}
                                            tickFormatter={(value) => `$${value}`}
                                        />
                                        <Tooltip
                                            cursor={{ fill: 'transparent' }}
                                            content={({ active, payload }) => {
                                                if (active && payload && payload.length) {
                                                    return (
                                                        <div className="rounded-lg border bg-background p-2 shadow-sm">
                                                            <div className="grid grid-cols-2 gap-2">
                                                                <div className="flex flex-col">
                                                                    <span className="text-[0.70rem] uppercase text-muted-foreground">
                                                                        Revenue
                                                                    </span>
                                                                    <span className="font-bold text-muted-foreground">
                                                                        {formatCurrency(payload[0].value as number)}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )
                                                }
                                                return null;
                                            }}
                                        />
                                        <Bar
                                            dataKey="revenue"
                                            fill="currentColor"
                                            radius={[4, 4, 0, 0]}
                                            className="fill-primary"
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg">
                                    No data available
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>Recent Sales</CardTitle>
                        <CardDescription>
                            Latest 5 orders
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-8">
                            {analytics?.recent_sales?.map((order) => (
                                <div className="flex items-center" key={order.id}>
                                    <div className="ml-4 space-y-1 flex-1">
                                        <div className="flex justify-between items-center">
                                            <p className="text-sm font-medium leading-none">{order.customer_name}</p>
                                            <div className="ml-auto font-medium">{formatCurrency(order.total_amount)}</div>
                                        </div>
                                        <div className="flex justify-between items-center text-xs text-muted-foreground">
                                            <span>{order.order_number}</span>
                                            <Badge variant={order.status === 'completed' ? 'default' : 'secondary'} className="text-[10px] px-1 h-5">
                                                {order.status}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {(!analytics?.recent_sales || analytics.recent_sales.length === 0) && (
                                <p className="text-sm text-center text-muted-foreground py-8">No recent orders found.</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
