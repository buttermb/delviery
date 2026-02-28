import { logger } from '@/lib/logger';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, ComposedChart, Area
} from 'recharts';
import { DollarSign, TrendingUp, ShoppingBag } from 'lucide-react';
import { subDays, startOfYear, format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { isPostgrestError } from "@/utils/errorHandling/typeGuards";
import { TruncatedText } from '@/components/shared/TruncatedText';
import { EnhancedLoadingState } from '@/components/EnhancedLoadingState';
import { queryKeys } from '@/lib/queryKeys';
import { AdminToolbar } from '@/components/admin/shared/AdminToolbar';
import { CHART_COLORS, chartSemanticColors } from '@/lib/chartColors';

interface OrderWithItems {
  total_amount: number | null;
  total?: number | null;
  status: string | null;
  created_at: string | null;
  order_items?: Array<{
    product_name: string | null;
    quantity: number | null;
    price: number | null;
  }>;
  [key: string]: unknown;
}

export default function RevenueReports() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'ytd' | 'all'>('30d');

  // Realtime Subscription for Revenue Updates
  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel(`revenue-reports-updates-${tenantId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `tenant_id=eq.${tenantId}` },
        () => queryClient.invalidateQueries({ queryKey: queryKeys.revenueReports.byTenant(tenantId, dateRange) })
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          logger.error('Revenue subscription error:', status, { component: 'RevenueReports' });
        }
      });

    return () => { supabase.removeChannel(channel); };
  }, [dateRange, queryClient, tenantId]);

  const { data: rawOrders, isLoading } = useQuery({
    queryKey: queryKeys.revenueReports.byTenant(tenantId, dateRange),
    queryFn: async () => {
      if (!tenantId) return [];

      let query = supabase
        .from('orders')
        .select(`
          *,
          order_items (
            product_name,
            quantity,
            price
          )
        `)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: true }); // Ascending for easier chart mapping

      // Apply Date Filter
      const now = new Date();
      if (dateRange === '7d') query = query.gte('created_at', subDays(now, 7).toISOString());
      if (dateRange === '30d') query = query.gte('created_at', subDays(now, 30).toISOString());
      if (dateRange === '90d') query = query.gte('created_at', subDays(now, 90).toISOString());
      if (dateRange === 'ytd') query = query.gte('created_at', startOfYear(now).toISOString());

      // Limit to prevent browser crash, but high enough for analytics
      query = query.limit(2000);

      try {
        const { data, error } = await query;
        if (error) throw error;
        return (data ?? []) as unknown as OrderWithItems[];
      } catch (error) {
        if (isPostgrestError(error) && error.code === '42P01') return [] as OrderWithItems[];
        logger.error("Failed to fetch orders", error);
        return [] as OrderWithItems[];
      }
    },
    enabled: !!tenantId,
  });

  // Analytics Processing
  // Only count completed/delivered orders towards revenue totals
  const analytics = useMemo(() => {
    if (!rawOrders || rawOrders.length === 0) return null;

    let totalRevenue = 0;
    let completedOrderCount = 0;
    const orderCount = rawOrders.length;
    const productSales: Record<string, number> = {};
    const statusCounts: Record<string, number> = {};
    const revenueByDate: Record<string, { date: string; revenue: number; orders: number }> = {};

    rawOrders.forEach(order => {
      const orderTotal = parseFloat(order.total_amount?.toString() || order.total?.toString() || '0');
      const status = order.status || 'unknown';

      // Status counts include all orders
      statusCounts[status] = (statusCounts[status] ?? 0) + 1;

      // Revenue and chart data only count completed/delivered orders
      const isCompleted = status === 'completed' || status === 'delivered';

      if (isCompleted) {
        totalRevenue += orderTotal;
        completedOrderCount += 1;

        // Chart Data Grouping - only completed orders contribute to revenue
        const dateKey = format(parseISO(order.created_at || new Date().toISOString()), 'yyyy-MM-dd');
        if (!revenueByDate[dateKey]) {
          revenueByDate[dateKey] = { date: dateKey, revenue: 0, orders: 0 };
        }
        revenueByDate[dateKey].revenue += orderTotal;
        revenueByDate[dateKey].orders += 1;
      }

      // Products - count all orders for product analytics
      if (order.order_items && Array.isArray(order.order_items)) {
        order.order_items.forEach((item) => {
          const name = item.product_name || 'Unknown Product';
          productSales[name] = (productSales[name] ?? 0) + (item.quantity ?? 0);
        });
      }
    });

    // Format Chart Data
    const chartData = Object.values(revenueByDate).sort((a, b) => a.date.localeCompare(b.date));

    // Format Top Products
    const topProducts = Object.entries(productSales)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Format Status Data
    const statusData = Object.entries(statusCounts)
      .map(([name, value]) => ({ name, value }));

    // Average order value based on completed orders only
    const avgOrderValue = completedOrderCount > 0 ? totalRevenue / completedOrderCount : 0;

    return {
      totalRevenue,
      orderCount: completedOrderCount, // Show completed order count for revenue context
      totalOrders: orderCount, // Keep total for reference
      avgOrderValue,
      chartData,
      topProducts,
      statusData
    };

  }, [rawOrders]);

  if (isLoading) {
    return <EnhancedLoadingState variant="dashboard" message="Loading revenue data..." />;
  }

  const { totalRevenue, orderCount, avgOrderValue, chartData, topProducts, statusData } = analytics || {
    totalRevenue: 0, orderCount: 0, avgOrderValue: 0, chartData: [], topProducts: [], statusData: []
  };

  return (
    <div className="p-4 sm:p-4 space-y-4 max-w-[1600px] mx-auto">
      <AdminToolbar
        hideSearch={true}
        filters={
          <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg">
            {(['7d', '30d', '90d', 'ytd', 'all'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium rounded-md transition-all",
                  dateRange === range
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
                )}
              >
                {range === 'ytd' ? 'Year to Date' : range.toUpperCase()}
              </button>
            ))}
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalRevenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              in selected period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Orders</CardTitle>
            <ShoppingBag className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{orderCount}</div>
            <p className="text-xs text-muted-foreground">
              Avg. Value: ${avgOrderValue.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sales Velocity</CardTitle>
            <TrendingUp className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics && Math.round(orderCount / (chartData.length || 1))}
            </div>
            <p className="text-xs text-muted-foreground">Orders per day (avg)</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-7">
        {/* Main Chart */}
        <Card className="md:col-span-4 lg:col-span-5">
          <CardHeader>
            <CardTitle>Revenue Trend</CardTitle>
            <CardDescription>Daily revenue and order volume</CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={chartSemanticColors.revenue} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={chartSemanticColors.revenue} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(str) => {
                        const date = parseISO(str);
                        return format(date, 'MMM d');
                      }}
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <YAxis
                      yAxisId="left"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickFormatter={(val) => `$${val}`}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <RechartsTooltip
                      contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                    <Legend />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="revenue"
                      stroke={chartSemanticColors.revenue}
                      fillOpacity={1}
                      fill="url(#colorRevenue)"
                      name="Revenue"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="orders"
                      stroke={chartSemanticColors.secondary}
                      strokeWidth={2}
                      dot={false}
                      name="Orders"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[350px] flex items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg">
                No data for this period
              </div>
            )}
          </CardContent>
        </Card>

        {/* Side Charts */}
        <div className="md:col-span-3 lg:col-span-2 space-y-6">
          {/* Top Products */}
          <Card>
            <CardHeader>
              <CardTitle>Top Products</CardTitle>
              <CardDescription>By quantity sold</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topProducts.map((product, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                        {i + 1}
                      </div>
                      <TruncatedText text={product.name} className="text-sm font-medium" maxWidthClass="max-w-[150px]" />
                    </div>
                    <span className="text-sm text-muted-foreground">{product.count} sold</span>
                  </div>
                ))}
                {topProducts.length === 0 && <p className="text-sm text-muted-foreground">No product data</p>}
              </div>
            </CardContent>
          </Card>

          {/* Status Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Order Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                    <Legend layout="vertical" align="right" verticalAlign="middle" iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
