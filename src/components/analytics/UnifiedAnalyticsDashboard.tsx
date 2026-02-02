import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import TrendingUp from "lucide-react/dist/esm/icons/trending-up";
import ShoppingCart from "lucide-react/dist/esm/icons/shopping-cart";
import DollarSign from "lucide-react/dist/esm/icons/dollar-sign";
import CreditCard from "lucide-react/dist/esm/icons/credit-card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { format } from 'date-fns';

interface UnifiedAnalyticsProps {
    tenantId: string;
}

interface Transaction {
    id: string;
    source: 'wholesale' | 'pos' | 'menu';
    amount: number;
    created_at: string;
    status: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28'];

export function UnifiedAnalyticsDashboard({ tenantId }: UnifiedAnalyticsProps) {
    const { data: analytics, isLoading } = useQuery({
        queryKey: ['unified-analytics', tenantId],
        queryFn: async () => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // 1. Fetch Wholesale Orders
            const { data: wholesale } = await supabase
                .from('wholesale_orders')
                .select('id, total_amount, created_at, status')
                .eq('tenant_id', tenantId)
                .order('created_at', { ascending: false })
                .limit(50);

            // 2. Fetch POS Transactions
            const { data: pos } = await supabase
                .from('pos_transactions')
                .select('id, total_amount, created_at, payment_status')
                .eq('tenant_id', tenantId)
                .order('created_at', { ascending: false })
                .limit(50);

            // 3. Fetch Disposable Menu Orders
            const { data: menu } = await supabase
                .from('menu_orders')
                .select('id, total_amount, created_at, status')
                .eq('tenant_id', tenantId)
                .order('created_at', { ascending: false })
                .limit(50);

            const transactions: Transaction[] = [
                ...(wholesale as any[] || []).map(o => ({
                    id: o.id,
                    source: 'wholesale' as const,
                    amount: Number(o.total_amount) || 0,
                    created_at: o.created_at,
                    status: o.status
                })),
                ...(pos as any[] || []).map(o => ({
                    id: o.id,
                    source: 'pos' as const,
                    amount: Number(o.total_amount) || 0,
                    created_at: o.created_at,
                    status: o.payment_status || 'completed'
                })),
                ...(menu as any[] || []).map(o => ({
                    id: o.id,
                    source: 'menu' as const,
                    amount: Number(o.total_amount) || 0,
                    created_at: o.created_at,
                    status: o.status
                }))
            ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

            // Calculate Totals
            const totalRevenue = transactions.reduce((sum, t) => sum + t.amount, 0);
            const totalOrders = transactions.length;

            // Calculate Source Breakdown
            const bySource = transactions.reduce((acc, t) => {
                acc[t.source] = (acc[t.source] || 0) + t.amount;
                return acc;
            }, {} as Record<string, number>);

            const sourceData = [
                { name: 'Wholesale', value: bySource.wholesale || 0 },
                { name: 'POS', value: bySource.pos || 0 },
                { name: 'Disposable Menus', value: bySource.menu || 0 },
            ].filter(d => d.value > 0);

            return {
                totalRevenue,
                totalOrders,
                averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
                sourceData,
                recentTransactions: transactions.slice(0, 10)
            };
        },
        enabled: !!tenantId
    });

    if (isLoading) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!analytics) return null;

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold tracking-tight">Unified Analytics</h2>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(analytics.totalRevenue)}</div>
                        <p className="text-xs text-muted-foreground">Across all channels</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                        <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{analytics.totalOrders}</div>
                        <p className="text-xs text-muted-foreground">Combined transactions</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Avg. Order Value</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(analytics.averageOrderValue)}</div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                {/* Revenue by Source Chart */}
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Revenue by Source</CardTitle>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <div className="h-[300px] w-full">
                            {analytics.sourceData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={analytics.sourceData}
                                            cx="50%"
                                            cy="50%"
                                            labelLine={false}
                                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                            outerRadius={80}
                                            fill="#8884d8"
                                            dataKey="value"
                                        >
                                            {analytics.sourceData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex h-full items-center justify-center text-muted-foreground">
                                    No revenue data available
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Recent Transactions List */}
                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>Recent Transactions</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-8">
                            {analytics.recentTransactions.map((transaction) => (
                                <div key={transaction.id} className="flex items-center">
                                    <div className="mr-4 rounded-full p-2 bg-muted/50">
                                        {transaction.source === 'wholesale' && <ShoppingCart className="h-4 w-4 text-blue-500" />}
                                        {transaction.source === 'pos' && <CreditCard className="h-4 w-4 text-green-500" />}
                                        {transaction.source === 'menu' && <TrendingUp className="h-4 w-4 text-orange-500" />}
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium leading-none">
                                            {transaction.source === 'wholesale' && 'Wholesale Order'}
                                            {transaction.source === 'pos' && 'POS Sale'}
                                            {transaction.source === 'menu' && 'Disposable Menu'}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {format(new Date(transaction.created_at), 'MMM d, h:mm a')}
                                        </p>
                                    </div>
                                    <div className="ml-auto font-medium">
                                        {formatCurrency(transaction.amount)}
                                    </div>
                                </div>
                            ))}
                            {analytics.recentTransactions.length === 0 && (
                                <div className="text-center text-muted-foreground">No recent transactions</div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
