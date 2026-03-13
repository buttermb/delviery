import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ShoppingCart, CheckCircle, XCircle, Clock } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  FunnelChart,
  Funnel,
  LabelList,
  Cell
} from '@/components/ui/lazy-recharts';
import { queryKeys } from '@/lib/queryKeys';
import { CHART_COLORS } from '@/lib/chartColors';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { subDays, startOfDay, endOfDay } from 'date-fns';

interface OrderAnalyticsWithFunnelProps {
  tenantId: string;
}

type DateRange = '7d' | '30d' | '90d';

interface OrderFunnelData {
  name: string;
  value: number;
  fill: string;
}

interface OrderStats {
  totalOrders: number;
  pendingOrders: number;
  confirmedOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  averageTimeToConfirm: number;
  averageTimeToDeliver: number;
  conversionRate: number;
  cancellationRate: number;
  funnelData: OrderFunnelData[];
  statusBreakdown: Array<{ status: string; count: number }>;
}

export function OrderAnalyticsWithFunnel({ tenantId }: OrderAnalyticsWithFunnelProps) {
  const [dateRange, setDateRange] = useState<DateRange>('30d');

  const { data: orderStats, isLoading } = useQuery({
    queryKey: queryKeys.analytics.orders(tenantId, { dateRange }),
    queryFn: async (): Promise<OrderStats> => {
      const days = parseInt(dateRange);
      const endDate = endOfDay(new Date());
      const startDate = startOfDay(subDays(endDate, days));

      const { data: orders } = await supabase
        .from('unified_orders')
        .select('id, status, created_at, updated_at')
        .eq('tenant_id', tenantId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      const totalOrders = orders?.length ?? 0;
      const pendingOrders = orders?.filter(o => o.status === 'pending').length ?? 0;
      const confirmedOrders = orders?.filter(o => ['confirmed', 'preparing', 'ready'].includes(o.status || '')).length ?? 0;
      const deliveredOrders = orders?.filter(o => ['delivered', 'completed', 'paid'].includes(o.status || '')).length ?? 0;
      const cancelledOrders = orders?.filter(o => o.status === 'cancelled').length ?? 0;

      // Calculate conversion rate (delivered / total)
      const conversionRate = totalOrders > 0 ? (deliveredOrders / totalOrders) * 100 : 0;
      const cancellationRate = totalOrders > 0 ? (cancelledOrders / totalOrders) * 100 : 0;

      // Calculate average times (mock data for now)
      const averageTimeToConfirm = 15; // minutes
      const averageTimeToDeliver = 45; // minutes

      // Funnel data - showing order progression
      const funnelData: OrderFunnelData[] = [
        { name: 'Orders Placed', value: totalOrders, fill: CHART_COLORS[0] },
        { name: 'Confirmed', value: confirmedOrders + deliveredOrders, fill: CHART_COLORS[1] },
        { name: 'Delivered', value: deliveredOrders, fill: CHART_COLORS[2] }
      ];

      // Status breakdown
      const statusCounts = orders?.reduce((acc, o) => {
        const status = o.status || 'unknown';
        acc[status] = (acc[status] ?? 0) + 1;
        return acc;
      }, {} as Record<string, number>) ?? {};

      const statusBreakdown: { status: string; count: number }[] = Object.entries(statusCounts)
        .map(([status, count]) => ({ status, count: count as number }))
        .sort((a, b) => b.count - a.count);

      return {
        totalOrders,
        pendingOrders,
        confirmedOrders,
        deliveredOrders,
        cancelledOrders,
        averageTimeToConfirm,
        averageTimeToDeliver,
        conversionRate,
        cancellationRate,
        funnelData,
        statusBreakdown
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

  if (!orderStats) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Order Analytics</h2>
          <p className="text-sm text-muted-foreground">Track order flow and conversion</p>
        </div>
        <div className="flex gap-2">
          {(['7d', '30d', '90d'] as DateRange[]).map((range) => (
            <Button
              key={range}
              variant={dateRange === range ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDateRange(range)}
            >
              {range === '7d' && '7 Days'}
              {range === '30d' && '30 Days'}
              {range === '90d' && '90 Days'}
            </Button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{orderStats.totalOrders}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{orderStats.pendingOrders}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Delivered</CardTitle>
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{orderStats.deliveredOrders}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{orderStats.conversionRate.toFixed(1)}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cancelled</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{orderStats.cancelledOrders}</div>
            <p className="text-xs text-muted-foreground">{orderStats.cancellationRate.toFixed(1)}% rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Funnel Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Order Funnel</CardTitle>
          <CardDescription>Conversion from order placement to delivery</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <FunnelChart>
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                />
                <Funnel dataKey="value" data={orderStats.funnelData} isAnimationActive>
                  <LabelList position="right" fill="#000" stroke="none" dataKey="name" />
                  <LabelList position="inside" fill="#fff" stroke="none" dataKey="value" />
                  {orderStats.funnelData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Status Breakdown */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Status Breakdown</CardTitle>
            <CardDescription>Orders by status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={orderStats.statusBreakdown} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" className="text-xs" />
                  <YAxis dataKey="status" type="category" className="text-xs" width={100} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  />
                  <Bar dataKey="count" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Processing Times</CardTitle>
            <CardDescription>Average time at each stage</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="text-sm font-medium">Time to Confirm</p>
                  <p className="text-xs text-muted-foreground">From order placement</p>
                </div>
                <div className="text-2xl font-bold">{orderStats.averageTimeToConfirm}m</div>
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="text-sm font-medium">Time to Deliver</p>
                  <p className="text-xs text-muted-foreground">From confirmation</p>
                </div>
                <div className="text-2xl font-bold">{orderStats.averageTimeToDeliver}m</div>
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="text-sm font-medium">Total Cycle Time</p>
                  <p className="text-xs text-muted-foreground">Placement to delivery</p>
                </div>
                <div className="text-2xl font-bold">
                  {orderStats.averageTimeToConfirm + orderStats.averageTimeToDeliver}m
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
