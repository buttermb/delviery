import { useQuery } from '@tanstack:react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Users, TrendingUp, UserPlus, Repeat } from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from '@/components/ui/lazy-recharts';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { queryKeys } from '@/lib/queryKeys';
import { CHART_COLORS } from '@/lib/chartColors';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface CustomerAcquisitionReportProps {
  tenantId: string;
}

type DateRange = '30d' | '90d' | '365d';

interface DailyAcquisition {
  date: string;
  newCustomers: number;
  returningCustomers: number;
}

interface CustomerAcquisitionStats {
  totalCustomers: number;
  newCustomersThisPeriod: number;
  returningCustomers: number;
  growthRate: number;
  acquisitionRate: number;
  dailyAcquisition: DailyAcquisition[];
  averageNewPerDay: number;
}

export function CustomerAcquisitionReport({ tenantId }: CustomerAcquisitionReportProps) {
  const [dateRange, setDateRange] = useState<DateRange>('30d');

  const { data: acquisitionStats, isLoading } = useQuery({
    queryKey: queryKeys.analytics.customers(tenantId, { dateRange, type: 'acquisition' }),
    queryFn: async (): Promise<CustomerAcquisitionStats> => {
      const days = parseInt(dateRange);
      const endDate = endOfDay(new Date());
      const startDate = startOfDay(subDays(endDate, days));
      const previousStartDate = startOfDay(subDays(startDate, days));

      // Fetch customers created in this period
      const { data: newCustomers } = await supabase
        .from('customers')
        .select('id, created_at')
        .eq('tenant_id', tenantId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      // Fetch customers from previous period for comparison
      const { data: previousCustomers } = await supabase
        .from('customers')
        .select('id')
        .eq('tenant_id', tenantId)
        .gte('created_at', previousStartDate.toISOString())
        .lt('created_at', startDate.toISOString());

      // Fetch total customers
      const { count: totalCustomers } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);

      // Fetch orders to identify returning customers
      const { data: orders } = await supabase
        .from('unified_orders')
        .select('customer_id, created_at')
        .eq('tenant_id', tenantId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .not('customer_id', 'is', null);

      const newCustomersCount = newCustomers?.length ?? 0;
      const previousCustomersCount = previousCustomers?.length ?? 0;
      const growthRate = previousCustomersCount > 0
        ? ((newCustomersCount - previousCustomersCount) / previousCustomersCount) * 100
        : 0;

      // Count unique returning customers (customers with multiple orders)
      const customerOrderCounts = new Map<string, number>();
      (orders ?? []).forEach(order => {
        if (order.customer_id) {
          customerOrderCounts.set(
            order.customer_id,
            (customerOrderCounts.get(order.customer_id) ?? 0) + 1
          );
        }
      });
      const returningCustomers = Array.from(customerOrderCounts.values()).filter(count => count > 1).length;

      const acquisitionRate = totalCustomers
        ? (newCustomersCount / (totalCustomers ?? 1)) * 100
        : 0;

      // Daily acquisition data
      const dailyMap = new Map<string, { newCustomers: number; returningCustomers: number }>();
      for (let i = 0; i < days; i++) {
        const date = format(subDays(endDate, i), 'yyyy-MM-dd');
        dailyMap.set(date, { newCustomers: 0, returningCustomers: 0 });
      }

      (newCustomers ?? []).forEach(customer => {
        const date = format(new Date(customer.created_at), 'yyyy-MM-dd');
        const current = dailyMap.get(date);
        if (current) {
          current.newCustomers += 1;
        }
      });

      const dailyAcquisition = Array.from(dailyMap.entries())
        .map(([date, data]) => ({
          date: format(new Date(date), 'MMM d'),
          ...data
        }))
        .reverse();

      const averageNewPerDay = newCustomersCount / days;

      return {
        totalCustomers: totalCustomers ?? 0,
        newCustomersThisPeriod: newCustomersCount,
        returningCustomers,
        growthRate,
        acquisitionRate,
        dailyAcquisition,
        averageNewPerDay
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

  if (!acquisitionStats) return null;

  const isPositiveGrowth = acquisitionStats.growthRate >= 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Customer Acquisition</h2>
          <p className="text-sm text-muted-foreground">Track new customer growth and retention</p>
        </div>
        <div className="flex gap-2">
          {(['30d', '90d', '365d'] as DateRange[]).map((range) => (
            <Button
              key={range}
              variant={dateRange === range ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDateRange(range)}
            >
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
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{acquisitionStats.totalCustomers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New Customers</CardTitle>
            <UserPlus className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{acquisitionStats.newCustomersThisPeriod}</div>
            <div className="flex items-center gap-1 text-xs">
              <TrendingUp className={`h-3 w-3 ${isPositiveGrowth ? 'text-emerald-500' : 'text-red-500'}`} />
              <span className={isPositiveGrowth ? 'text-emerald-500' : 'text-red-500'}>
                {Math.abs(acquisitionStats.growthRate).toFixed(1)}%
              </span>
              <span className="text-muted-foreground">vs previous period</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Returning Customers</CardTitle>
            <Repeat className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{acquisitionStats.returningCustomers}</div>
            <p className="text-xs text-muted-foreground">Repeat purchases</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. New/Day</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{acquisitionStats.averageNewPerDay.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">Daily average</p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Acquisition Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Acquisition Trend</CardTitle>
          <CardDescription>New customers over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={acquisitionStats.dailyAcquisition}>
                <defs>
                  <linearGradient id="colorNew" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS[0]} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={CHART_COLORS[0]} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="newCustomers"
                  stroke={CHART_COLORS[0]}
                  fillOpacity={1}
                  fill="url(#colorNew)"
                  name="New Customers"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Cumulative Growth */}
      <Card>
        <CardHeader>
          <CardTitle>Growth Metrics</CardTitle>
          <CardDescription>Customer base expansion</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            <div className="p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Growth Rate</p>
              <p className={`text-2xl font-bold ${isPositiveGrowth ? 'text-emerald-500' : 'text-red-500'}`}>
                {acquisitionStats.growthRate >= 0 ? '+' : ''}
                {acquisitionStats.growthRate.toFixed(1)}%
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Acquisition Rate</p>
              <p className="text-2xl font-bold">{acquisitionStats.acquisitionRate.toFixed(1)}%</p>
            </div>
            <div className="p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Retention Indicator</p>
              <p className="text-2xl font-bold">
                {acquisitionStats.newCustomersThisPeriod > 0
                  ? ((acquisitionStats.returningCustomers / acquisitionStats.newCustomersThisPeriod) * 100).toFixed(1)
                  : 0}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
