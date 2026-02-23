import { useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { queryKeys } from '@/lib/queryKeys';
import { ANALYTICS_QUERY_CONFIG } from '@/lib/react-query-config';
import { logger } from '@/lib/logger';
import { formatCurrency, formatCompactCurrency } from '@/lib/formatters';

interface RevenueChartProps {
  storeId: string;
  dateRange: { from: Date | undefined; to: Date | undefined };
  className?: string;
}

type Granularity = 'daily' | 'weekly' | 'monthly';

interface RevenueDataPoint {
  label: string;
  revenue: number;
  orders: number;
}

function groupByGranularity(
  orders: Array<{ total: number | null; created_at: string | null }>,
  granularity: Granularity
): RevenueDataPoint[] {
  const grouped = new Map<string, { revenue: number; orders: number }>();

  orders.forEach((order) => {
    if (!order.created_at) return;
    const date = new Date(order.created_at);
    let key: string;

    switch (granularity) {
      case 'daily':
        key = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        break;
      case 'weekly': {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = `W ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
        break;
      }
      case 'monthly':
        key = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        break;
    }

    const existing = grouped.get(key) || { revenue: 0, orders: 0 };
    grouped.set(key, {
      revenue: existing.revenue + (order.total || 0),
      orders: existing.orders + 1,
    });
  });

  return Array.from(grouped.entries()).map(([label, data]) => ({
    label,
    revenue: Math.round(data.revenue * 100) / 100,
    orders: data.orders,
  }));
}

export function RevenueChart({ storeId, dateRange, className }: RevenueChartProps) {
  const [granularity, setGranularity] = useState<Granularity>('daily');

  const { data: revenueData, isLoading, error } = useQuery({
    queryKey: queryKeys.analytics.revenue(storeId, { from: dateRange.from?.toISOString(), to: dateRange.to?.toISOString(), granularity }),
    queryFn: async (): Promise<{ data: RevenueDataPoint[]; totalRevenue: number }> => {
      let query = supabase
        .from('storefront_orders')
        .select('total, created_at')
        .eq('store_id', storeId)
        .order('created_at', { ascending: true });

      if (dateRange.from) {
        query = query.gte('created_at', dateRange.from.toISOString());
      }
      if (dateRange.to) {
        const endOfDay = new Date(dateRange.to);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte('created_at', endOfDay.toISOString());
      }

      const { data: orders, error: ordersError } = await query;

      if (ordersError || !orders?.length) {
        if (ordersError) logger.warn('Failed to fetch revenue data', ordersError);
        return { data: [], totalRevenue: 0 };
      }

      const grouped = groupByGranularity(orders, granularity);
      const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);

      return { data: grouped, totalRevenue: Math.round(totalRevenue * 100) / 100 };
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

  if (error || !revenueData?.data?.length) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Revenue</CardTitle>
          <CardDescription>Revenue over time</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center h-[300px] text-muted-foreground">
          No revenue data available
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle>Revenue</CardTitle>
          <CardDescription>
            Total: <span className="text-2xl font-bold text-foreground">{formatCurrency(revenueData.totalRevenue)}</span>
          </CardDescription>
        </div>
        <Select value={granularity} onValueChange={(v) => setGranularity(v as Granularity)}>
          <SelectTrigger className="w-28">
            <SelectValue placeholder="Granularity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={revenueData.data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={(v: number) => formatCompactCurrency(v)}
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                width={60}
              />
              <Tooltip
                formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  borderColor: 'hsl(var(--border))',
                  borderRadius: '8px',
                }}
                itemStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
