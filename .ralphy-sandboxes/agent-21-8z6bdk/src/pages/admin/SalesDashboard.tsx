import { logger } from '@/lib/logger';
import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { DollarSign, TrendingUp, ShoppingCart, Activity, BarChart3 } from 'lucide-react';
import { motion } from 'framer-motion';
import { isPostgrestError } from "@/utils/errorHandling/typeGuards";
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LastUpdated } from '@/components/shared/LastUpdated';
import { RecentItemsWidget } from "@/components/admin/dashboard/RecentItemsWidget";
import { EnhancedEmptyState } from '@/components/shared/EnhancedEmptyState';
import { PageErrorState } from '@/components/admin/shared/PageErrorState';
import { useSalesReportDrilldown } from '@/hooks/useSalesReportDrilldown';
import { SalesReportDrilldownModal } from '@/components/admin/analytics/SalesReportDrilldownModal';
import { format, parseISO } from 'date-fns';
import { formatCurrency } from '@/lib/formatters';
import { queryKeys } from '@/lib/queryKeys';
import { CHART_COLORS } from '@/lib/chartColors';

interface SalesDataPoint {
  date: string;
  isoDate: string;
  revenue: number;
  orders: number;
}

interface StatusDataPoint {
  name: string;
  value: number;
}

interface OrderRecord {
  id: string;
  created_at: string;
  status: string;
  total?: string | number;
  total_amount?: string | number;
  order_items?: Array<{
    product_name: string;
    quantity: number;
    price: number;
  }>;
  [key: string]: unknown;
}

export default function SalesDashboard() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const drilldown = useSalesReportDrilldown();

  const { data: orders, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.salesDashboard.main(tenantId, timeRange),
    queryFn: async (): Promise<OrderRecord[]> => {
      if (!tenantId) return [];

      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*, order_items(*)')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(1000);

        if (error && error.code === '42P01') return [];
        if (error) throw error;
        return (data as OrderRecord[]) ?? [];
      } catch (error) {
        if (isPostgrestError(error) && error.code === '42P01') return [];
        logger.error('Error fetching sales dashboard data', error, { component: 'SalesDashboard' });
        throw error;
      }
    },
    enabled: !!tenantId,
  });

  const { salesData, statusData, totalRevenue, totalOrders, avgOrderValue } = useMemo(() => {
    const orderList = orders ?? [];
    const dateMap: Record<string, SalesDataPoint> = {};
    const statusMap: Record<string, number> = {};
    let revenue = 0;

    orderList.forEach((order) => {
      const orderTotal = parseFloat((order.total_amount ?? order.total ?? 0).toString());
      revenue += orderTotal;

      const isoDate = format(parseISO(order.created_at), 'yyyy-MM-dd');
      const displayDate = format(parseISO(order.created_at), 'MMM d');

      if (!dateMap[isoDate]) {
        dateMap[isoDate] = { date: displayDate, isoDate, revenue: 0, orders: 0 };
      }
      dateMap[isoDate].revenue += orderTotal;
      dateMap[isoDate].orders += 1;

      const status = order.status || 'unknown';
      statusMap[status] = (statusMap[status] ?? 0) + 1;
    });

    const sortedSalesData = Object.values(dateMap).sort((a, b) => a.isoDate.localeCompare(b.isoDate));
    const statusDataArr: StatusDataPoint[] = Object.entries(statusMap).map(([name, value]) => ({ name, value }));
    const count = orderList.length;
    const avg = count > 0 ? revenue / count : 0;

    return {
      salesData: sortedSalesData,
      statusData: statusDataArr,
      totalRevenue: revenue,
      totalOrders: count,
      avgOrderValue: avg,
    };
  }, [orders]);

  const handleChartClick = useCallback((data: Record<string, unknown> | null | undefined, type: 'date' | 'status') => {
    if (!data) return;
    if (type === 'date') {
      const point = data as unknown as SalesDataPoint;
      if (point.isoDate) {
        drilldown.openDrilldown({
          type: 'date',
          label: point.date,
          value: point.isoDate,
        });
      }
    } else if (type === 'status') {
      const point = data as unknown as StatusDataPoint;
      if (point.name) {
        drilldown.openDrilldown({
          type: 'status',
          label: point.name,
          value: point.name,
        });
      }
    }
  }, [drilldown]);

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="h-8 w-32 bg-muted animate-pulse rounded" />
        </div>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
        <div className="h-96 bg-muted animate-pulse rounded-xl" />
      </div>
    );
  }

  if (isError) {
    return <PageErrorState onRetry={() => refetch()} message="Failed to load sales data. Please try again." />;
  }

  const stats = [
    {
      title: "Total Revenue",
      value: formatCurrency(totalRevenue),
      icon: DollarSign,
      trend: "+12.5%",
      trendUp: true,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10"
    },
    {
      title: "Total Orders",
      value: totalOrders,
      icon: ShoppingCart,
      trend: "+5.2%",
      trendUp: true,
      color: "text-blue-500",
      bg: "bg-blue-500/10"
    },
    {
      title: "Avg Order Value",
      value: formatCurrency(avgOrderValue),
      icon: TrendingUp,
      trend: "-2.1%",
      trendUp: false,
      color: "text-violet-500",
      bg: "bg-violet-500/10"
    },
    {
      title: "Growth Rate",
      value: "15.3%",
      icon: Activity,
      trend: "+4.1%",
      trendUp: true,
      color: "text-amber-500",
      bg: "bg-amber-500/10"
    },
  ];

  return (
    <div className="p-4 sm:p-4 space-y-4 pb-20 sm:pb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-xl font-bold tracking-tight">Sales Dashboard</h1>
          <p className="text-muted-foreground">Real-time performance metrics</p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <LastUpdated date={new Date()} onRefresh={() => refetch()} isLoading={isLoading} />
          <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg self-start sm:self-auto">
            {(['7d', '30d', '90d'] as const).map((range) => (
              <Button
                key={range}
                variant={timeRange === range ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setTimeRange(range)}
                className="text-xs font-medium"
              >
                {range.toUpperCase()}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Cards - Stack on mobile, grid on larger screens */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="border-none shadow-sm bg-gradient-to-br from-card to-muted/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={cn("p-2 rounded-full", stat.bg)}>
                  <stat.icon className={cn("h-4 w-4", stat.color)} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className={cn("text-xs flex items-center mt-1", stat.trendUp ? "text-emerald-500" : "text-red-500")}>
                  {stat.trendUp ? "+" : ""}{stat.trend}
                  <span className="text-muted-foreground ml-1">from last month</span>
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="border-none shadow-md overflow-hidden">
              <CardHeader>
                <CardTitle>Revenue Trend</CardTitle>
                <CardDescription>Daily revenue over time</CardDescription>
              </CardHeader>
              <CardContent className="p-0 sm:p-6">
                <p className="text-xs text-muted-foreground px-4 sm:px-0 mb-2">Click a data point to see orders for that day</p>
                <div className="h-[300px] w-full">
                  {salesData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={salesData}
                        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                        onClick={(e) => {
                          if (e?.activePayload?.[0]?.payload) {
                            handleChartClick(e.activePayload[0].payload as Record<string, unknown>, 'date');
                          }
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        <defs>
                          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis
                          dataKey="date"
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(value) => `$${value}`}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--popover))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="revenue"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#colorRevenue)"
                          activeDot={{ r: 6, strokeWidth: 2, cursor: 'pointer' }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <EnhancedEmptyState
                      icon={BarChart3}
                      title="No Revenue Data"
                      description="Revenue data will appear here once orders are placed."
                      compact
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="border-none shadow-md overflow-hidden">
              <CardHeader>
                <CardTitle>Orders Volume</CardTitle>
                <CardDescription>Daily order count</CardDescription>
              </CardHeader>
              <CardContent className="p-0 sm:p-6">
                <p className="text-xs text-muted-foreground px-4 sm:px-0 mb-2">Click a bar to see orders for that day</p>
                <div className="h-[300px] w-full">
                  {salesData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={salesData}
                        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                        onClick={(e) => {
                          if (e?.activePayload?.[0]?.payload) {
                            handleChartClick(e.activePayload[0].payload as Record<string, unknown>, 'date');
                          }
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis
                          dataKey="date"
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip
                          cursor={{ fill: 'hsl(var(--muted)/0.2)' }}
                          contentStyle={{
                            backgroundColor: 'hsl(var(--popover))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                        <Bar
                          dataKey="orders"
                          fill="hsl(var(--primary))"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={50}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <EnhancedEmptyState
                      icon={ShoppingCart}
                      title="No Order Data"
                      description="Order volume data will appear here once orders are placed."
                      compact
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <div className="space-y-6">
          {/* Order Status Breakdown - Clickable */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6 }}
          >
            <Card className="border-none shadow-md">
              <CardHeader>
                <CardTitle>Order Status</CardTitle>
                <CardDescription>Click a segment to see orders</CardDescription>
              </CardHeader>
              <CardContent>
                {statusData.length > 0 ? (
                  <div className="h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={70}
                          paddingAngle={3}
                          dataKey="value"
                          onClick={(_, index) => {
                            const segment = statusData[index];
                            if (segment) {
                              handleChartClick(segment as unknown as Record<string, unknown>, 'status');
                            }
                          }}
                          style={{ cursor: 'pointer' }}
                        >
                          {statusData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--popover))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                        <Legend
                          verticalAlign="bottom"
                          height={36}
                          wrapperStyle={{ fontSize: '12px' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[220px] text-muted-foreground text-sm">
                    No status data
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <RecentItemsWidget />
        </div>
      </div>

      <SalesReportDrilldownModal
        open={drilldown.isOpen}
        onOpenChange={(open) => { if (!open) drilldown.closeDrilldown(); }}
        filter={drilldown.filter}
        orders={orders ?? []}
      />
    </div>
  );
}
