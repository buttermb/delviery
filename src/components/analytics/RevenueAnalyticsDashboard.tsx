import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { Loader2, TrendingUp, TrendingDown, DollarSign, Calendar } from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area
} from '@/components/ui/lazy-recharts';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { queryKeys } from '@/lib/queryKeys';
import { CHART_COLORS } from '@/lib/chartColors';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface RevenueAnalyticsDashboardProps {
  tenantId: string;
}

type DateRange = '7d' | '30d' | '90d' | '365d';

interface DailyRevenue {
  date: string;
  revenue: number;
  orders: number;
}

interface RevenueStats {
  totalRevenue: number;
  previousPeriodRevenue: number;
  percentageChange: number;
  averageOrderValue: number;
  totalOrders: number;
  dailyRevenue: DailyRevenue[];
  revenueBySource: Array<{ name: string; value: number }>;
}

export function RevenueAnalyticsDashboard({ tenantId }: RevenueAnalyticsDashboardProps) {
  const [dateRange, setDateRange] = useState<DateRange>('30d');

  const { data: revenueStats, isLoading } = useQuery({
    queryKey: queryKeys.analytics.revenue(tenantId, dateRange),
    queryFn: async (): Promise<RevenueStats> => {
      const days = parseInt(dateRange);
      const endDate = endOfDay(new Date());
      const startDate = startOfDay(subDays(endDate, days));
      const previousStartDate = startOfDay(subDays(startDate, days));

      // Fetch unified orders
      const { data: orders } = await supabase
        .from('unified_orders')
        .select('id, total_amount, created_at, source')
        .eq('tenant_id', tenantId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .in('status', ['confirmed', 'delivered', 'completed', 'paid']);

      // Fetch previous period orders for comparison
      const { data: previousOrders } = await supabase
        .from('unified_orders')
        .select('total_amount')
        .eq('tenant_id', tenantId)
        .gte('created_at', previousStartDate.toISOString())
        .lt('created_at', startDate.toISOString())
        .in('status', ['confirmed', 'delivered', 'completed', 'paid']);

      const totalRevenue = (orders ?? []).reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
      const totalOrders = orders?.length ?? 0;
      const previousPeriodRevenue = (previousOrders ?? []).reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);

      const percentageChange = previousPeriodRevenue > 0
        ? ((totalRevenue - previousPeriodRevenue) / previousPeriodRevenue) * 100
        : 0;

      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      // Group by date
      const revenueByDate = new Map<string, { revenue: number; orders: number }>();
      for (let i = 0; i < days; i++) {
        const date = format(subDays(endDate, i), 'yyyy-MM-dd');
        revenueByDate.set(date, { revenue: 0, orders: 0 });
      }

      (orders ?? []).forEach(order => {
        const date = format(new Date(order.created_at), 'yyyy-MM-dd');
        const current = revenueByDate.get(date);
        if (current) {
          current.revenue += Number(order.total_amount) || 0;
          current.orders += 1;
        }
      });

      const dailyRevenue = Array.from(revenueByDate.entries())
        .map(([date, data]) => ({
          date: format(new Date(date), 'MMM d'),
          revenue: data.revenue,
          orders: data.orders
        }))
        .reverse();

      // Revenue by source
      const bySource = (orders ?? []).reduce((acc, o) => {
        const source = o.source || 'pos';
        acc[source] = (acc[source] ?? 0) + (Number(o.total_amount) || 0);
        return acc;
      }, {} as Record<string, number>);

      const revenueBySource = Object.entries(bySource).map(([name, value]) => ({
        name: name === 'pos' ? 'POS' : name === 'wholesale' ? 'Wholesale' : 'Menu',
        value
      }));

      return {
        totalRevenue,
        previousPeriodRevenue,
        percentageChange,
        averageOrderValue,
        totalOrders,
        dailyRevenue,
        revenueBySource
      };
    },
    enabled: !!tenantId,
    staleTime: 60_000
  });

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!revenueStats) return null;

  const isPositiveChange = revenueStats.percentageChange >= 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Revenue Analytics</h2>
          <p className="text-sm text-muted-foreground">Track revenue trends and performance</p>
        </div>
        <div className="flex gap-2">
          {(['7d', '30d', '90d', '365d'] as DateRange[]).map((range) => (
            <Button
              key={range}
              variant={dateRange === range ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDateRange(range)}
            >
              {range === '7d' && '7 Days'}
              {range === '30d' && '30 Days'}
              {range === '90d' && '90 Days'}
              {range === '365d' && '1 Year'}
            </Button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(revenueStats.totalRevenue)}</div>
            <div className="flex items-center gap-1 text-xs">
              {isPositiveChange ? (
                <TrendingUp className="h-3 w-3 text-emerald-500" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-500" />
              )}
              <span className={isPositiveChange ? 'text-emerald-500' : 'text-red-500'}>
                {Math.abs(revenueStats.percentageChange).toFixed(1)}%
              </span>
              <span className="text-muted-foreground">vs previous period</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Order Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(revenueStats.averageOrderValue)}</div>
            <p className="text-xs text-muted-foreground">Per transaction</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{revenueStats.totalOrders}</div>
            <p className="text-xs text-muted-foreground">In selected period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Previous Period</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(revenueStats.previousPeriodRevenue)}</div>
            <p className="text-xs text-muted-foreground">For comparison</p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Trend</CardTitle>
          <CardDescription>Daily revenue over the selected period</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueStats.dailyRevenue}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS[0]} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={CHART_COLORS[0]} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" tickFormatter={(value) => `$${value}`} />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke={CHART_COLORS[0]}
                  fillOpacity={1}
                  fill="url(#colorRevenue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Revenue by Source & Daily Orders */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue by Source</CardTitle>
            <CardDescription>Breakdown by sales channel</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueStats.revenueBySource}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" tickFormatter={(value) => `$${value}`} />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  />
                  <Bar dataKey="value" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Daily Order Volume</CardTitle>
            <CardDescription>Number of orders per day</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueStats.dailyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="orders"
                    stroke={CHART_COLORS[2]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="Orders"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
