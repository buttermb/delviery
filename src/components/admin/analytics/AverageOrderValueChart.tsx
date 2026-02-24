import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { ANALYTICS_QUERY_CONFIG } from '@/lib/react-query-config';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import { formatCurrency } from '@/lib/formatters';

interface AverageOrderValueChartProps {
    storeId?: string;
    className?: string;
}

interface AOVDataPoint {
    date: string;
    aov: number;
}

export function AverageOrderValueChart({ storeId, className }: AverageOrderValueChartProps) {
    const [timeRange, setTimeRange] = useState<'7' | '30' | '90'>('30');

    const { data: aovData, isLoading } = useQuery({
        queryKey: queryKeys.storefrontAnalytics.averageOrderValue(storeId, timeRange),
        queryFn: async (): Promise<{ data: AOVDataPoint[]; currentAOV: number; trend: number }> => {
            if (!storeId) return { data: [], currentAOV: 0, trend: 0 };

            const daysAgo = parseInt(timeRange);
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - daysAgo);

            const { data: orders, error: ordersError } = await supabase
                .from('storefront_orders')
                .select('total, created_at')
                .eq('store_id', storeId)
                .gte('created_at', startDate.toISOString())
                .order('created_at', { ascending: true });

            if (ordersError || !orders?.length) {
                logger.warn('No orders found for AOV analysis', ordersError);
                return { data: [], currentAOV: 0, trend: 0 };
            }

            // Group orders by date and calculate daily AOV
            const dailyData = new Map<string, { total: number; count: number }>();

            orders.forEach((order) => {
                const date = new Date(order.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric'
                });
                const existing = dailyData.get(date) || { total: 0, count: 0 };
                dailyData.set(date, {
                    total: existing.total + (order.total ?? 0),
                    count: existing.count + 1
                });
            });

            const result: AOVDataPoint[] = Array.from(dailyData.entries()).map(([date, { total, count }]) => ({
                date,
                aov: Math.round((total / count) * 100) / 100,
            }));

            // Calculate overall AOV and trend
            const totalRevenue = orders.reduce((sum: number, o) => sum + (Number(o.total) || 0), 0);
            const currentAOV = orders.length > 0 ? totalRevenue / orders.length : 0;

            // Calculate trend (compare first half to second half)
            const midpoint = Math.floor(orders.length / 2);
            if (midpoint > 0) {
                const firstHalf = orders.slice(0, midpoint);
                const secondHalf = orders.slice(midpoint);
                const firstAOV = firstHalf.reduce((s: number, o) => s + (Number(o.total) || 0), 0) / firstHalf.length;
                const secondAOV = secondHalf.reduce((s: number, o) => s + (Number(o.total) || 0), 0) / secondHalf.length;
                const trend = firstAOV > 0 ? ((secondAOV - firstAOV) / firstAOV) * 100 : 0;
                return { data: result, currentAOV: Math.round(currentAOV * 100) / 100, trend: Math.round(trend * 10) / 10 };
            }

            return { data: result, currentAOV: Math.round(currentAOV * 100) / 100, trend: 0 };
        },
        enabled: !!storeId,
        ...ANALYTICS_QUERY_CONFIG,
    });

    if (isLoading) {
        return (
            <Card className={className}>
                <CardHeader>
                    <Skeleton className="h-6 w-48 mb-2" />
                    <Skeleton className="h-4 w-32" />
                </CardHeader>
                <CardContent className="h-[300px]">
                    <Skeleton className="h-full w-full" />
                </CardContent>
            </Card>
        );
    }

    if (!aovData?.data?.length) {
        return (
            <Card className={className}>
                <CardHeader>
                    <CardTitle>Average Order Value</CardTitle>
                    <CardDescription>Order value trend over time</CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center items-center h-[300px] text-muted-foreground">
                    No order data available
                </CardContent>
            </Card>
        );
    }

    const TrendIcon = aovData.trend >= 0 ? TrendingUp : TrendingDown;
    const trendColor = aovData.trend >= 0 ? 'text-emerald-500' : 'text-red-500';

    return (
        <Card className={className}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                    <CardTitle>Average Order Value</CardTitle>
                    <CardDescription className="flex items-center gap-2">
                        <span className="text-2xl font-bold text-foreground">{formatCurrency(aovData.currentAOV)}</span>
                        <span className={`flex items-center gap-1 text-sm ${trendColor}`}>
                            <TrendIcon className="h-4 w-4" />
                            {Math.abs(aovData.trend)}%
                        </span>
                    </CardDescription>
                </div>
                <Select value={timeRange} onValueChange={(v) => setTimeRange(v as '7' | '30' | '90')}>
                    <SelectTrigger className="w-24" aria-label="Select time range">
                        <SelectValue placeholder="Time range" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="7">7 days</SelectItem>
                        <SelectItem value="30">30 days</SelectItem>
                        <SelectItem value="90">90 days</SelectItem>
                    </SelectContent>
                </Select>
            </CardHeader>
            <CardContent>
                <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={aovData.data}>
                            <defs>
                                <linearGradient id="aovGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis
                                dataKey="date"
                                tick={{ fontSize: 12 }}
                                tickLine={false}
                                axisLine={false}
                            />
                            <YAxis
                                tickFormatter={(v) => formatCurrency(v)}
                                tick={{ fontSize: 12 }}
                                tickLine={false}
                                axisLine={false}
                                width={60}
                            />
                            <Tooltip
                                formatter={(value: number) => [formatCurrency(value), 'AOV']}
                                contentStyle={{
                                    backgroundColor: 'hsl(var(--card))',
                                    borderColor: 'hsl(var(--border))',
                                    borderRadius: '8px'
                                }}
                                itemStyle={{ color: 'hsl(var(--foreground))' }}
                            />
                            <Area
                                type="monotone"
                                dataKey="aov"
                                stroke="#10b981"
                                strokeWidth={2}
                                fill="url(#aovGradient)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
