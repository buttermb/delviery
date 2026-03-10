/**
 * Revenue Chart Widget
 * Displays revenue number + area chart + period toggle (7D/30D/MTD)
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import TrendingUp from "lucide-react/dist/esm/icons/trending-up";
import TrendingDown from "lucide-react/dist/esm/icons/trending-down";
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { formatCurrency } from '@/lib/formatters';
import { format, subDays, startOfDay, startOfMonth } from 'date-fns';
import { queryKeys } from '@/lib/queryKeys';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from '@/components/ui/lazy-recharts';

type ChartPeriod = '7d' | '30d' | 'mtd';

function getPeriodRange(period: ChartPeriod): { start: Date; label: string } {
  const now = new Date();
  switch (period) {
    case '7d':
      return { start: subDays(startOfDay(now), 7), label: 'Last 7 days' };
    case '30d':
      return { start: subDays(startOfDay(now), 30), label: 'Last 30 days' };
    case 'mtd':
      return { start: startOfMonth(now), label: 'Month to date' };
  }
}

interface DayRevenue {
  date: string;
  label: string;
  revenue: number;
}

export function RevenueChartWidget() {
  const { tenant } = useTenantAdminAuth();
  const [period, setPeriod] = useState<ChartPeriod>('7d');

  const { start } = getPeriodRange(period);

  const { data, isLoading } = useQuery({
    queryKey: [...queryKeys.dashboardWidgets.revenueChart(tenant?.id), period],
    queryFn: async (): Promise<{ dailyRevenue: DayRevenue[]; total: number; changePercent: number }> => {
      if (!tenant?.id) return { dailyRevenue: [], total: 0, changePercent: 0 };

      // Fetch completed/delivered orders in period
      const { data: orders } = await supabase
        .from('orders')
        .select('total_amount, created_at')
        .eq('tenant_id', tenant.id)
        .gte('created_at', start.toISOString())
        .in('status', ['completed', 'delivered'])
        .order('created_at', { ascending: true })
        .limit(2000);

      if (!orders || orders.length === 0) {
        return { dailyRevenue: [], total: 0, changePercent: 0 };
      }

      // Group by day
      const dayMap = new Map<string, number>();
      let total = 0;

      for (const order of orders) {
        const dateKey = format(new Date(order.created_at), 'yyyy-MM-dd');
        const amount = Number(order.total_amount || 0);
        dayMap.set(dateKey, (dayMap.get(dateKey) ?? 0) + amount);
        total += amount;
      }

      const dailyRevenue: DayRevenue[] = Array.from(dayMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, revenue]) => ({
          date,
          label: format(new Date(date), 'MMM d'),
          revenue: Math.round(revenue * 100) / 100,
        }));

      // Calculate change vs previous period
      const periodDays = Math.ceil((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24));
      const prevStart = subDays(start, periodDays);

      const { data: prevOrders } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('tenant_id', tenant.id)
        .gte('created_at', prevStart.toISOString())
        .lt('created_at', start.toISOString())
        .in('status', ['completed', 'delivered'])
        .limit(2000);

      const prevTotal = prevOrders?.reduce(
        (sum, o) => sum + Number(o.total_amount || 0), 0
      ) ?? 0;

      const changePercent = prevTotal > 0
        ? Math.round(((total - prevTotal) / prevTotal) * 100)
        : 0;

      return { dailyRevenue, total, changePercent };
    },
    enabled: !!tenant?.id,
    staleTime: 60 * 1000,
  });

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Revenue</CardTitle>
          <ToggleGroup
            type="single"
            value={period}
            onValueChange={(val) => { if (val) setPeriod(val as ChartPeriod); }}
            size="sm"
            variant="outline"
          >
            <ToggleGroupItem value="7d" className="text-xs px-2 h-7">7D</ToggleGroupItem>
            <ToggleGroupItem value="30d" className="text-xs px-2 h-7">30D</ToggleGroupItem>
            <ToggleGroupItem value="mtd" className="text-xs px-2 h-7">MTD</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-[160px] w-full rounded-lg" />
          </div>
        ) : (
          <>
            <div className="mb-3">
              <div className="text-2xl font-bold">
                {formatCurrency(data?.total ?? 0)}
              </div>
              {data?.changePercent !== undefined && data.changePercent !== 0 && (
                <div className="flex items-center gap-1 text-sm mt-0.5">
                  {data.changePercent > 0 ? (
                    <>
                      <TrendingUp className="h-3 w-3 text-emerald-600" />
                      <span className="text-emerald-600 font-medium">+{data.changePercent}%</span>
                    </>
                  ) : (
                    <>
                      <TrendingDown className="h-3 w-3 text-red-600" />
                      <span className="text-red-600 font-medium">{data.changePercent}%</span>
                    </>
                  )}
                  <span className="text-muted-foreground text-xs">vs previous period</span>
                </div>
              )}
            </div>

            {data?.dailyRevenue && data.dailyRevenue.length > 1 ? (
              <div className="h-[160px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.dailyRevenue} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#16a34a" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      hide
                      domain={[0, 'auto']}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const entry = payload[0].payload as DayRevenue;
                        return (
                          <div className="bg-popover border rounded-md px-3 py-2 shadow-md text-sm">
                            <div className="font-medium">{entry.label}</div>
                            <div className="text-emerald-600 font-semibold">
                              {formatCurrency(entry.revenue)}
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#16a34a"
                      strokeWidth={2}
                      fill="url(#revenueGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : data?.dailyRevenue && data.dailyRevenue.length === 1 ? (
              <div className="h-[160px] flex items-center justify-center text-sm text-muted-foreground">
                {formatCurrency(data.dailyRevenue[0].revenue)} on {data.dailyRevenue[0].label}
              </div>
            ) : (
              <div className="h-[160px] flex items-center justify-center text-sm text-muted-foreground">
                No revenue data for this period
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
