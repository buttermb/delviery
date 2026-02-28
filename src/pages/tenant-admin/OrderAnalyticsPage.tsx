import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Clock } from 'lucide-react';
import { useUnifiedOrders } from '@/hooks/unified';
import { EnhancedLoadingState } from '@/components/EnhancedLoadingState';
import { format, subDays, parseISO, getHours } from 'date-fns';
import { CHART_COLORS } from '@/lib/chartColors';

export default function OrderAnalyticsPage() {
  const [timeRange, setTimeRange] = useState('7d');

  // Calculate date range based on selection
  const dateRange = useMemo(() => {
    const now = new Date();
    switch (timeRange) {
      case '24h': return subDays(now, 1);
      case '7d': return subDays(now, 7);
      case '30d': return subDays(now, 30);
      case '90d': return subDays(now, 90);
      default: return subDays(now, 7);
    }
  }, [timeRange]);

  // Fetch real orders from database
  const { data: orders = [], isLoading } = useUnifiedOrders({
    orderType: 'all',
    limit: 1000,
  });

  // Filter orders by date range
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const orderDate = parseISO(order.created_at);
      return orderDate >= dateRange;
    });
  }, [orders, dateRange]);

  // Calculate metrics from real data
  const metrics = useMemo(() => {
    const totalOrders = filteredOrders.length;
    const totalRevenue = filteredOrders.reduce((sum, order) => sum + (order.total_amount ?? 0), 0);
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Calculate previous period for comparison
    const previousPeriodOrders = orders.filter(order => {
      const orderDate = parseISO(order.created_at);
      const previousStart = subDays(dateRange, (new Date().getTime() - dateRange.getTime()) / (1000 * 60 * 60 * 24));
      return orderDate >= previousStart && orderDate < dateRange;
    });

    const previousRevenue = previousPeriodOrders.reduce((sum, order) => sum + (order.total_amount ?? 0), 0);
    const previousOrderCount = previousPeriodOrders.length;
    const previousAvg = previousOrderCount > 0 ? previousRevenue / previousOrderCount : 0;

    const orderGrowth = previousOrderCount > 0 ? ((totalOrders - previousOrderCount) / previousOrderCount) * 100 : 0;
    const revenueGrowth = previousRevenue > 0 ? ((totalRevenue - previousRevenue) / previousRevenue) * 100 : 0;
    const avgGrowth = previousAvg > 0 ? ((avgOrderValue - previousAvg) / previousAvg) * 100 : 0;

    return {
      totalOrders,
      totalRevenue,
      avgOrderValue,
      orderGrowth,
      revenueGrowth,
      avgGrowth,
    };
  }, [filteredOrders, orders, dateRange]);

  // Generate orders by day chart data
  const ordersByDay = useMemo(() => {
    const dayMap = new Map<string, { orders: number; revenue: number }>();

    filteredOrders.forEach(order => {
      const day = format(parseISO(order.created_at), 'EEE');
      const existing = dayMap.get(day) || { orders: 0, revenue: 0 };
      dayMap.set(day, {
        orders: existing.orders + 1,
        revenue: existing.revenue + (order.total_amount ?? 0),
      });
    });

    const daysOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return daysOrder.map(day => ({
      day,
      orders: dayMap.get(day)?.orders ?? 0,
      revenue: Math.round(dayMap.get(day)?.revenue ?? 0),
    }));
  }, [filteredOrders]);

  // Generate orders by status chart data
  const ordersByStatus = useMemo(() => {
    const statusCounts = new Map<string, number>();

    filteredOrders.forEach(order => {
      const status = order.status || 'unknown';
      statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);
    });

    const statusLabels: Record<string, string> = {
      completed: 'Completed',
      pending: 'Pending',
      in_progress: 'In Progress',
      preparing: 'Preparing',
      shipped: 'Shipped',
      delivered: 'Delivered',
      cancelled: 'Cancelled',
    };

    return Array.from(statusCounts.entries()).map(([status, value], index) => ({
      name: statusLabels[status] || status,
      value,
      color: CHART_COLORS[index % CHART_COLORS.length],
    }));
  }, [filteredOrders]);

  // Generate peak hours chart data
  const peakHours = useMemo(() => {
    const hourCounts = new Map<number, number>();

    filteredOrders.forEach(order => {
      const hour = getHours(parseISO(order.created_at));
      hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
    });

    return Array.from({ length: 12 }, (_, i) => {
      const hour = i + 9; // 9AM to 8PM
      return {
        hour: `${hour > 12 ? hour - 12 : hour}${hour >= 12 ? 'PM' : 'AM'}`,
        orders: hourCounts.get(hour) ?? 0,
      };
    });
  }, [filteredOrders]);

  if (isLoading) {
    return <EnhancedLoadingState variant="dashboard" message="Loading..." />;
  }

  return (
    <div className="min-h-dvh bg-background p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Order Analytics</h1>
          <p className="text-muted-foreground">Deep insights into your order performance</p>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select time range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">Last 24 Hours</SelectItem>
            <SelectItem value="7d">Last 7 Days</SelectItem>
            <SelectItem value="30d">Last 30 Days</SelectItem>
            <SelectItem value="90d">Last 90 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalOrders.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {metrics.orderGrowth >= 0 ? (
                <>
                  <TrendingUp className="h-3 w-3 text-green-500" />
                  <span className="text-green-500">+{metrics.orderGrowth.toFixed(1)}%</span>
                </>
              ) : (
                <>
                  <TrendingDown className="h-3 w-3 text-red-500" />
                  <span className="text-red-500">{metrics.orderGrowth.toFixed(1)}%</span>
                </>
              )}
              {' '}from last period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${metrics.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {metrics.revenueGrowth >= 0 ? (
                <>
                  <TrendingUp className="h-3 w-3 text-green-500" />
                  <span className="text-green-500">+{metrics.revenueGrowth.toFixed(1)}%</span>
                </>
              ) : (
                <>
                  <TrendingDown className="h-3 w-3 text-red-500" />
                  <span className="text-red-500">{metrics.revenueGrowth.toFixed(1)}%</span>
                </>
              )}
              {' '}from last period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Order Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${metrics.avgOrderValue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {metrics.avgGrowth >= 0 ? (
                <>
                  <TrendingUp className="h-3 w-3 text-green-500" />
                  <span className="text-green-500">+{metrics.avgGrowth.toFixed(1)}%</span>
                </>
              ) : (
                <>
                  <TrendingDown className="h-3 w-3 text-red-500" />
                  <span className="text-red-500">{metrics.avgGrowth.toFixed(1)}%</span>
                </>
              )}
              {' '}from last period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Order Count</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredOrders.length}</div>
            <p className="text-xs text-muted-foreground">
              In selected period
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList>
          <TabsTrigger value="trends">Order Trends</TabsTrigger>
          <TabsTrigger value="status">Order Status</TabsTrigger>
          <TabsTrigger value="peak">Peak Hours</TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Orders & Revenue Trends</CardTitle>
              <CardDescription>Daily order volume and revenue over time</CardDescription>
            </CardHeader>
            <CardContent>
              {ordersByDay.some(d => d.orders > 0) ? (
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={ordersByDay}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="orders" stroke={CHART_COLORS[0]} strokeWidth={2} name="Orders" />
                    <Line yAxisId="right" type="monotone" dataKey="revenue" stroke={CHART_COLORS[1]} strokeWidth={2} name="Revenue ($)" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                  No order data for selected period
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="status" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Orders by Status</CardTitle>
              <CardDescription>Distribution of order statuses</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-center">
              {ordersByStatus.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <PieChart>
                    <Pie
                      data={ordersByStatus}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={120}
                      fill={CHART_COLORS[0]}
                      dataKey="value"
                    >
                      {ordersByStatus.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                  No order data for selected period
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="peak" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Peak Hours Analysis</CardTitle>
              <CardDescription>Order volume by hour of day</CardDescription>
            </CardHeader>
            <CardContent>
              {peakHours.some(h => h.orders > 0) ? (
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={peakHours}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="orders" fill={CHART_COLORS[0]} name="Orders" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                  No order data for selected period
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
