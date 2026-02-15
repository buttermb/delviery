/**
 * Real-time Revenue Chart with Daily/Weekly/Monthly Toggle
 * Uses Recharts for visualization and Supabase real-time for live updates
 */

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Badge } from '@/components/ui/badge';
import TrendingUp from "lucide-react/dist/esm/icons/trending-up";
import TrendingDown from "lucide-react/dist/esm/icons/trending-down";
import Activity from "lucide-react/dist/esm/icons/activity";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import {
  format,
  subDays,
  startOfDay,
  endOfDay,
  startOfWeek,
  startOfMonth,
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
  subWeeks,
  subMonths,
} from 'date-fns';

type Granularity = 'daily' | 'weekly' | 'monthly';

interface RevenueDataPoint {
  label: string;
  revenue: number;
  orders: number;
  date: string;
}

interface RealtimeRevenueChartProps {
  className?: string;
}

function getDateRangeForGranularity(granularity: Granularity): { start: Date; end: Date } {
  const now = new Date();
  const end = endOfDay(now);

  switch (granularity) {
    case 'daily':
      return { start: startOfDay(subDays(now, 30)), end };
    case 'weekly':
      return { start: startOfWeek(subWeeks(now, 12)), end };
    case 'monthly':
      return { start: startOfMonth(subMonths(now, 12)), end };
  }
}

function groupOrdersByGranularity(
  orders: Array<{ total_amount: number; created_at: string; status: string }>,
  granularity: Granularity,
  dateRange: { start: Date; end: Date }
): RevenueDataPoint[] {
  const completedStatuses = ['completed', 'delivered'];
  const completedOrders = orders.filter((o) => completedStatuses.includes(o.status));

  // Create a map for aggregation
  const dataMap = new Map<string, { revenue: number; orders: number }>();

  // Initialize all time periods with zero values
  let intervals: Date[];
  switch (granularity) {
    case 'daily':
      intervals = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
      break;
    case 'weekly':
      intervals = eachWeekOfInterval({ start: dateRange.start, end: dateRange.end });
      break;
    case 'monthly':
      intervals = eachMonthOfInterval({ start: dateRange.start, end: dateRange.end });
      break;
  }

  intervals.forEach((date) => {
    const key = getKeyForDate(date, granularity);
    dataMap.set(key, { revenue: 0, orders: 0 });
  });

  // Aggregate order data
  completedOrders.forEach((order) => {
    const date = new Date(order.created_at);
    const key = getKeyForDate(date, granularity);
    const existing = dataMap.get(key) || { revenue: 0, orders: 0 };
    dataMap.set(key, {
      revenue: existing.revenue + Number(order.total_amount || 0),
      orders: existing.orders + 1,
    });
  });

  // Convert to array and sort
  return Array.from(dataMap.entries())
    .map(([key, data]) => ({
      label: formatLabel(key, granularity),
      date: key,
      revenue: Math.round(data.revenue * 100) / 100,
      orders: data.orders,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function getKeyForDate(date: Date, granularity: Granularity): string {
  switch (granularity) {
    case 'daily':
      return format(date, 'yyyy-MM-dd');
    case 'weekly':
      return format(startOfWeek(date), 'yyyy-MM-dd');
    case 'monthly':
      return format(date, 'yyyy-MM');
  }
}

function formatLabel(key: string, granularity: Granularity): string {
  const date = new Date(key);
  switch (granularity) {
    case 'daily':
      return format(date, 'MMM d');
    case 'weekly':
      return `W ${format(date, 'MMM d')}`;
    case 'monthly':
      return format(date, 'MMM yyyy');
  }
}

export function RealtimeRevenueChart({ className }: RealtimeRevenueChartProps) {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();
  const [granularity, setGranularity] = useState<Granularity>('daily');
  const [isLive, setIsLive] = useState(true);

  const dateRange = useMemo(() => getDateRangeForGranularity(granularity), [granularity]);

  // Real-time subscription for order updates
  useEffect(() => {
    if (!tenantId || !isLive) return;

    const channel = supabase
      .channel(`realtime-revenue-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          logger.debug('Realtime revenue chart: order update received', {
            event: payload.eventType,
            component: 'RealtimeRevenueChart',
          });
          queryClient.invalidateQueries({
            queryKey: queryKeys.analytics.revenue(tenantId, { granularity }),
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'wholesale_orders',
        },
        (payload) => {
          logger.debug('Realtime revenue chart: wholesale order update received', {
            event: payload.eventType,
            component: 'RealtimeRevenueChart',
          });
          queryClient.invalidateQueries({
            queryKey: queryKeys.analytics.revenue(tenantId, { granularity }),
          });
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          logger.warn('Realtime revenue chart subscription error', {
            status,
            component: 'RealtimeRevenueChart',
          });
          setIsLive(false);
        } else if (status === 'SUBSCRIBED') {
          setIsLive(true);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, granularity, queryClient, isLive]);

  const {
    data: revenueData,
    isLoading,
    error,
    isFetching,
  } = useQuery({
    queryKey: queryKeys.analytics.revenue(tenantId, { granularity }),
    queryFn: async (): Promise<{
      data: RevenueDataPoint[];
      totalRevenue: number;
      previousPeriodRevenue: number;
      orderCount: number;
    }> => {
      if (!tenantId) {
        return { data: [], totalRevenue: 0, previousPeriodRevenue: 0, orderCount: 0 };
      }

      // Fetch from both orders and wholesale_orders tables
      const [ordersResult, wholesaleResult] = await Promise.all([
        supabase
          .from('orders')
          .select('total_amount, created_at, status')
          .eq('tenant_id', tenantId)
          .gte('created_at', dateRange.start.toISOString())
          .lte('created_at', dateRange.end.toISOString())
          .order('created_at', { ascending: true }),
        supabase
          .from('wholesale_orders')
          .select('total_amount, created_at, status')
          .eq('tenant_id', tenantId)
          .gte('created_at', dateRange.start.toISOString())
          .lte('created_at', dateRange.end.toISOString())
          .order('created_at', { ascending: true }),
      ]);

      if (ordersResult.error) {
        logger.warn('Failed to fetch orders for revenue chart', ordersResult.error);
      }
      if (wholesaleResult.error) {
        logger.warn('Failed to fetch wholesale orders for revenue chart', wholesaleResult.error);
      }

      const allOrders = [
        ...(ordersResult.data || []).map((o) => ({
          total_amount: Number(o.total_amount || 0),
          created_at: o.created_at,
          status: o.status,
        })),
        ...(wholesaleResult.data || []).map((o) => ({
          total_amount: Number(o.total_amount || 0),
          created_at: o.created_at,
          status: o.status,
        })),
      ];

      const grouped = groupOrdersByGranularity(allOrders, granularity, dateRange);

      const completedStatuses = ['completed', 'delivered'];
      const completedOrders = allOrders.filter((o) => completedStatuses.includes(o.status));
      const totalRevenue = completedOrders.reduce((sum, o) => sum + o.total_amount, 0);

      // Calculate previous period revenue for comparison
      const periodLength = dateRange.end.getTime() - dateRange.start.getTime();
      const previousStart = new Date(dateRange.start.getTime() - periodLength);
      const previousEnd = new Date(dateRange.start.getTime() - 1);

      const [prevOrdersResult, prevWholesaleResult] = await Promise.all([
        supabase
          .from('orders')
          .select('total_amount, status')
          .eq('tenant_id', tenantId)
          .gte('created_at', previousStart.toISOString())
          .lte('created_at', previousEnd.toISOString()),
        supabase
          .from('wholesale_orders')
          .select('total_amount, status')
          .eq('tenant_id', tenantId)
          .gte('created_at', previousStart.toISOString())
          .lte('created_at', previousEnd.toISOString()),
      ]);

      const prevOrders = [
        ...(prevOrdersResult.data || []),
        ...(prevWholesaleResult.data || []),
      ];
      const previousPeriodRevenue = prevOrders
        .filter((o) => completedStatuses.includes(o.status))
        .reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

      return {
        data: grouped,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        previousPeriodRevenue: Math.round(previousPeriodRevenue * 100) / 100,
        orderCount: completedOrders.length,
      };
    },
    enabled: !!tenantId,
    staleTime: 30_000,
    gcTime: 300_000,
    refetchInterval: isLive ? 60_000 : false, // Refetch every minute when live
  });

  const percentageChange = useMemo(() => {
    if (!revenueData || revenueData.previousPeriodRevenue === 0) return 0;
    return (
      ((revenueData.totalRevenue - revenueData.previousPeriodRevenue) /
        revenueData.previousPeriodRevenue) *
      100
    );
  }, [revenueData]);

  const periodLabel = useMemo(() => {
    switch (granularity) {
      case 'daily':
        return 'Last 30 Days';
      case 'weekly':
        return 'Last 12 Weeks';
      case 'monthly':
        return 'Last 12 Months';
    }
  }, [granularity]);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent className="h-[350px]">
          <Skeleton className="h-full w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !revenueData?.data) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Revenue Trends</CardTitle>
          <CardDescription>Real-time revenue analytics</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center h-[350px] text-muted-foreground">
          Unable to load revenue data
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle>Revenue Trends</CardTitle>
              {isLive && (
                <Badge variant="outline" className="text-emerald-600 border-emerald-600">
                  <Activity className="h-3 w-3 mr-1 animate-pulse" />
                  Live
                </Badge>
              )}
              {isFetching && !isLoading && (
                <RefreshCw className="h-4 w-4 text-muted-foreground animate-spin" />
              )}
            </div>
            <CardDescription className="mt-1">
              <span className="text-2xl font-bold text-foreground">
                ${revenueData.totalRevenue.toLocaleString()}
              </span>
              <span className="ml-2 text-sm">
                {periodLabel} ({revenueData.orderCount} orders)
              </span>
            </CardDescription>
            {percentageChange !== 0 && (
              <div className="flex items-center gap-1 mt-1">
                {percentageChange > 0 ? (
                  <>
                    <TrendingUp className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm text-emerald-600">
                      +{percentageChange.toFixed(1)}% vs previous period
                    </span>
                  </>
                ) : (
                  <>
                    <TrendingDown className="h-4 w-4 text-red-600" />
                    <span className="text-sm text-red-600">
                      {percentageChange.toFixed(1)}% vs previous period
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          <ToggleGroup
            type="single"
            value={granularity}
            onValueChange={(value) => value && setGranularity(value as Granularity)}
            className="justify-start"
          >
            <ToggleGroupItem value="daily" aria-label="Daily view">
              Daily
            </ToggleGroupItem>
            <ToggleGroupItem value="weekly" aria-label="Weekly view">
              Weekly
            </ToggleGroupItem>
            <ToggleGroupItem value="monthly" aria-label="Monthly view">
              Monthly
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          {revenueData.data.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              No revenue data available for this period
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData.data}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  interval={granularity === 'daily' ? 4 : 0}
                  angle={granularity === 'monthly' ? -45 : 0}
                  textAnchor={granularity === 'monthly' ? 'end' : 'middle'}
                  height={granularity === 'monthly' ? 60 : 30}
                />
                <YAxis
                  tickFormatter={(v: number) =>
                    `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`
                  }
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  width={60}
                />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === 'revenue') {
                      return [`$${value.toLocaleString()}`, 'Revenue'];
                    }
                    return [value, name];
                  }}
                  labelFormatter={(label) => `Period: ${label}`}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    borderColor: 'hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  itemStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#revenueGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
