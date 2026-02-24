import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DateRange } from 'react-day-picker';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import {
  Eye, ShoppingCart, DollarSign, TrendingUp, Users, Package,
  BarChart3, RefreshCw, ArrowUpDown, ArrowDown, ArrowUp
} from 'lucide-react';
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from 'recharts';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import { AnalyticsDateRangePicker } from '@/components/admin/disposable-menus/AnalyticsDateRangePicker';
import { queryKeys } from '@/lib/queryKeys';

interface MenuAnalyticsProps {
  menuId?: string;
  className?: string;
}

interface MenuOption {
  id: string;
  name: string;
}

interface AccessLogRow {
  id: string;
  menu_id: string;
  accessed_at: string;
  ip_address?: string | null;
}

interface MenuOrderRow {
  id: string;
  menu_id: string;
  total_amount: number | null;
  status: string;
  created_at: string;
  order_data: unknown;
}

interface OrderItem {
  product_id?: string;
  product_name: string;
  quantity: number;
  price_per_unit: number;
}

interface MenuAnalyticsData {
  viewsCount: number;
  uniqueVisitors: number;
  addToCartCount: number;
  checkoutStarted: number;
  ordersCompleted: number;
  totalRevenue: number;
  avgOrderValue: number;
  conversionRate: number;
  addToCartRate: number;
  checkoutRate: number;
  viewsOverTime: { date: string; views: number }[];
  ordersOverTime: { date: string; orders: number; revenue: number }[];
  popularProducts: { id: string; name: string; orders: number; revenue: number }[];
  conversionFunnel: { name: string; value: number; fill: string }[];
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  trend,
  trendValue,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', color)}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-2xl font-bold truncate">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
          {trend && trendValue && (
            <div className={cn(
              'text-[10px] mt-0.5 flex items-center gap-0.5',
              trend === 'up' && 'text-green-600',
              trend === 'down' && 'text-red-600',
              trend === 'neutral' && 'text-muted-foreground'
            )}>
              {trend === 'up' && <ArrowUp className="h-3 w-3" />}
              {trend === 'down' && <ArrowDown className="h-3 w-3" />}
              {trend === 'neutral' && <ArrowUpDown className="h-3 w-3" />}
              {trendValue}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

export function MenuAnalytics({ menuId: propMenuId, className }: MenuAnalyticsProps) {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  const [selectedMenuId, setSelectedMenuId] = useState<string | undefined>(propMenuId);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [compareMenuId, setCompareMenuId] = useState<string | undefined>(undefined);

  const currentMenuId = propMenuId || selectedMenuId;

  // Fetch menus for selector
  const { data: menus = [], isLoading: menusLoading } = useQuery({
    queryKey: queryKeys.menuAnalytics.menus(tenantId),
    queryFn: async (): Promise<MenuOption[]> => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('disposable_menus')
        .select('id, name')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) {
        logger.warn('Failed to fetch menus for analytics selector', { error: error.message });
        return [];
      }

      return (data ?? []) as MenuOption[];
    },
    enabled: !!tenantId,
    staleTime: 60 * 1000,
  });

  // Fetch analytics data for selected menu
  const fetchMenuAnalytics = useCallback(async (menuIdToFetch: string): Promise<MenuAnalyticsData> => {
    const fromDate = dateRange?.from ? startOfDay(dateRange.from).toISOString() : undefined;
    const toDate = dateRange?.to ? endOfDay(dateRange.to).toISOString() : undefined;

    // Fetch access logs
    let logsQuery = supabase
      .from('menu_access_logs')
      .select('id, menu_id, accessed_at, ip_address')
      .eq('menu_id', menuIdToFetch);

    if (fromDate) logsQuery = logsQuery.gte('accessed_at', fromDate);
    if (toDate) logsQuery = logsQuery.lte('accessed_at', toDate);

    const { data: accessLogs, error: logsError } = await logsQuery;

    if (logsError) {
      logger.warn('Failed to fetch access logs for menu analytics', { error: logsError.message });
    }

    // Fetch orders for this menu
    let ordersQuery = supabase
      .from('menu_orders')
      .select('id, menu_id, total_amount, status, created_at, order_data')
      .eq('menu_id', menuIdToFetch)
      .eq('tenant_id', tenantId!);

    if (fromDate) ordersQuery = ordersQuery.gte('created_at', fromDate);
    if (toDate) ordersQuery = ordersQuery.lte('created_at', toDate);

    const { data: orders, error: ordersError } = await ordersQuery;

    if (ordersError) {
      logger.warn('Failed to fetch orders for menu analytics', { error: ordersError.message });
    }

    const logs = (accessLogs ?? []) as AccessLogRow[];
    const orderList = (orders ?? []) as MenuOrderRow[];

    // Calculate metrics
    const viewsCount = logs.length;
    const uniqueVisitors = new Set(logs.map(l => l.ip_address || l.id)).size;
    const ordersCompleted = orderList.filter(o =>
      o.status === 'completed' || o.status === 'delivered'
    ).length;
    const totalRevenue = orderList.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
    const avgOrderValue = ordersCompleted > 0 ? totalRevenue / ordersCompleted : 0;

    // Estimated funnel metrics (would come from menu_events table in production)
    const addToCartCount = Math.round(viewsCount * 0.35); // Estimate ~35% add to cart
    const checkoutStarted = orderList.length;

    const conversionRate = viewsCount > 0 ? (ordersCompleted / viewsCount) * 100 : 0;
    const addToCartRate = viewsCount > 0 ? (addToCartCount / viewsCount) * 100 : 0;
    const checkoutRate = addToCartCount > 0 ? (checkoutStarted / addToCartCount) * 100 : 0;

    // Views over time
    const viewsByDate: Record<string, number> = {};
    logs.forEach(log => {
      const date = format(new Date(log.accessed_at), 'yyyy-MM-dd');
      viewsByDate[date] = (viewsByDate[date] || 0) + 1;
    });
    const viewsOverTime = Object.entries(viewsByDate)
      .map(([date, views]) => ({ date, views }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Orders over time
    const ordersByDate: Record<string, { orders: number; revenue: number }> = {};
    orderList.forEach(order => {
      const date = format(new Date(order.created_at), 'yyyy-MM-dd');
      if (!ordersByDate[date]) {
        ordersByDate[date] = { orders: 0, revenue: 0 };
      }
      ordersByDate[date].orders++;
      ordersByDate[date].revenue += Number(order.total_amount || 0);
    });
    const ordersOverTime = Object.entries(ordersByDate)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Popular products
    const productMap: Record<string, { id: string; name: string; orders: number; revenue: number }> = {};
    orderList.forEach(order => {
      const orderData = order.order_data as { items?: OrderItem[] } | null;
      const items = orderData?.items ?? [];
      items.forEach((item: OrderItem) => {
        const key = item.product_id || item.product_name;
        if (!productMap[key]) {
          productMap[key] = { id: key, name: item.product_name, orders: 0, revenue: 0 };
        }
        productMap[key].orders += item.quantity || 1;
        productMap[key].revenue += (item.price_per_unit || 0) * (item.quantity || 1);
      });
    });
    const popularProducts = Object.values(productMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Conversion funnel
    const conversionFunnel = [
      { name: 'Views', value: viewsCount, fill: '#8b5cf6' },
      { name: 'Add to Cart', value: addToCartCount, fill: '#3b82f6' },
      { name: 'Checkout Started', value: checkoutStarted, fill: '#f59e0b' },
      { name: 'Orders Completed', value: ordersCompleted, fill: '#22c55e' },
    ];

    return {
      viewsCount,
      uniqueVisitors,
      addToCartCount,
      checkoutStarted,
      ordersCompleted,
      totalRevenue,
      avgOrderValue,
      conversionRate,
      addToCartRate,
      checkoutRate,
      viewsOverTime,
      ordersOverTime,
      popularProducts,
      conversionFunnel,
    };
  }, [dateRange, tenantId]);

  const { data: analytics, isLoading: analyticsLoading, refetch } = useQuery({
    queryKey: queryKeys.menuAnalytics.specific(currentMenuId, dateRange?.from?.toISOString(), dateRange?.to?.toISOString()),
    queryFn: () => fetchMenuAnalytics(currentMenuId!),
    enabled: !!tenantId && !!currentMenuId,
    staleTime: 30 * 1000,
  });

  const { data: compareAnalytics, isLoading: _compareLoading } = useQuery({
    queryKey: queryKeys.menuAnalytics.compare(compareMenuId, dateRange?.from?.toISOString(), dateRange?.to?.toISOString()),
    queryFn: () => fetchMenuAnalytics(compareMenuId!),
    enabled: !!tenantId && !!compareMenuId,
    staleTime: 30 * 1000,
  });

  const isLoading = menusLoading || analyticsLoading;

  // Format chart data with short dates
  const formattedViewsData = useMemo(() => {
    if (!analytics?.viewsOverTime) return [];
    return analytics.viewsOverTime.map(item => ({
      ...item,
      date: format(new Date(item.date), 'MMM d'),
    }));
  }, [analytics?.viewsOverTime]);

  const formattedOrdersData = useMemo(() => {
    if (!analytics?.ordersOverTime) return [];
    return analytics.ordersOverTime.map(item => ({
      ...item,
      date: format(new Date(item.date), 'MMM d'),
    }));
  }, [analytics?.ordersOverTime]);

  if (isLoading && !analytics) {
    return (
      <div className={cn('space-y-6', className)}>
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-64" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-80" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header with Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Menu Analytics</h2>
          {analyticsLoading && (
            <Badge variant="outline" className="animate-pulse">
              <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
              Updating...
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 ml-auto">
          {/* Menu Selector (if not provided via props) */}
          {!propMenuId && (
            <Select value={selectedMenuId} onValueChange={setSelectedMenuId}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select a menu" />
              </SelectTrigger>
              <SelectContent>
                {menus.map((menu) => (
                  <SelectItem key={menu.id} value={menu.id}>
                    {menu.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Date Range Picker */}
          <AnalyticsDateRangePicker
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
          />

          {/* Compare Menu Selector */}
          <Select value={compareMenuId || '__none__'} onValueChange={(v) => setCompareMenuId(v === '__none__' ? undefined : v)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Compare with..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No comparison</SelectItem>
              {menus.filter(m => m.id !== currentMenuId).map((menu) => (
                <SelectItem key={menu.id} value={menu.id}>
                  {menu.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Refresh Button */}
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {!currentMenuId ? (
        <Card className="p-12">
          <div className="text-center text-muted-foreground">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">Select a menu to view analytics</p>
            <p className="text-sm mt-2">Choose a menu from the dropdown above to see detailed performance metrics</p>
          </div>
        </Card>
      ) : analytics && (
        <>
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Total Views"
              value={analytics.viewsCount.toLocaleString()}
              icon={Eye}
              color="bg-violet-500"
            />
            <StatCard
              label="Unique Visitors"
              value={analytics.uniqueVisitors.toLocaleString()}
              icon={Users}
              color="bg-blue-500"
            />
            <StatCard
              label="Add to Cart Rate"
              value={`${analytics.addToCartRate.toFixed(1)}%`}
              icon={ShoppingCart}
              color="bg-amber-500"
            />
            <StatCard
              label="Checkout Rate"
              value={`${analytics.checkoutRate.toFixed(1)}%`}
              icon={TrendingUp}
              color="bg-pink-500"
            />
            <StatCard
              label="Conversion Rate"
              value={`${analytics.conversionRate.toFixed(1)}%`}
              icon={TrendingUp}
              color="bg-indigo-500"
            />
            <StatCard
              label="Orders Completed"
              value={analytics.ordersCompleted.toLocaleString()}
              icon={Package}
              color="bg-emerald-500"
            />
            <StatCard
              label="Total Revenue"
              value={formatCurrency(analytics.totalRevenue)}
              icon={DollarSign}
              color="bg-green-500"
            />
            <StatCard
              label="Avg Order Value"
              value={formatCurrency(analytics.avgOrderValue)}
              icon={DollarSign}
              color="bg-teal-500"
            />
          </div>

          {/* Compare Banner */}
          {compareMenuId && compareAnalytics && (
            <Card className="bg-gradient-to-r from-blue-500/5 via-indigo-500/5 to-purple-500/5 border-blue-500/20">
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center gap-6 text-sm">
                  <div className="font-medium">Comparing with: {menus.find(m => m.id === compareMenuId)?.name}</div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Views:</span>
                    <span className={cn(
                      analytics.viewsCount > compareAnalytics.viewsCount ? 'text-green-600' : 'text-red-600'
                    )}>
                      {analytics.viewsCount > compareAnalytics.viewsCount ? '+' : ''}
                      {((analytics.viewsCount - compareAnalytics.viewsCount) / Math.max(compareAnalytics.viewsCount, 1) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Revenue:</span>
                    <span className={cn(
                      analytics.totalRevenue > compareAnalytics.totalRevenue ? 'text-green-600' : 'text-red-600'
                    )}>
                      {analytics.totalRevenue > compareAnalytics.totalRevenue ? '+' : ''}
                      {((analytics.totalRevenue - compareAnalytics.totalRevenue) / Math.max(compareAnalytics.totalRevenue, 1) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Conversion:</span>
                    <span className={cn(
                      analytics.conversionRate > compareAnalytics.conversionRate ? 'text-green-600' : 'text-red-600'
                    )}>
                      {analytics.conversionRate > compareAnalytics.conversionRate ? '+' : ''}
                      {(analytics.conversionRate - compareAnalytics.conversionRate).toFixed(2)}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Charts Row 1: Views & Funnel */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Views Over Time */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Eye className="h-4 w-4 text-violet-500" />
                  Views Over Time
                </CardTitle>
                <CardDescription>Daily menu views in selected period</CardDescription>
              </CardHeader>
              <CardContent>
                {formattedViewsData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={formattedViewsData}>
                      <defs>
                        <linearGradient id="viewsGradientMenu" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="views"
                        stroke="#8b5cf6"
                        strokeWidth={2}
                        fill="url(#viewsGradientMenu)"
                        name="Views"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <Eye className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No view data for this period</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Conversion Funnel */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-indigo-500" />
                  Conversion Funnel
                </CardTitle>
                <CardDescription>Customer journey through this menu</CardDescription>
              </CardHeader>
              <CardContent>
                {analytics.conversionFunnel[0]?.value > 0 ? (
                  <div className="space-y-4 py-2">
                    {analytics.conversionFunnel.map((stage, index) => {
                      const maxValue = analytics.conversionFunnel[0].value || 1;
                      const percentage = (stage.value / maxValue) * 100;
                      return (
                        <div key={stage.name} className="space-y-1.5">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">{stage.name}</span>
                            <span className="text-muted-foreground">{stage.value.toLocaleString()}</span>
                          </div>
                          <Progress value={percentage} className="h-3" />
                          {index > 0 && (
                            <div className="text-[10px] text-muted-foreground text-right">
                              {percentage.toFixed(1)}% of views
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No funnel data yet</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Charts Row 2: Orders & Popular Products */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Orders & Revenue Over Time */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-emerald-500" />
                  Orders & Revenue
                </CardTitle>
                <CardDescription>Order count and revenue from this menu</CardDescription>
              </CardHeader>
              <CardContent>
                {formattedOrdersData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={formattedOrdersData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                        formatter={(value: number, name: string) =>
                          name === 'Revenue' ? formatCurrency(value) : value
                        }
                      />
                      <Legend />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="orders"
                        stroke="#22c55e"
                        strokeWidth={2}
                        dot={{ fill: '#22c55e', r: 3 }}
                        name="Orders"
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="revenue"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        dot={{ fill: '#f59e0b', r: 3 }}
                        name="Revenue"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No orders for this period</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Popular Products on This Menu */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-amber-500" />
                  Popular Products on This Menu
                </CardTitle>
                <CardDescription>Top selling products from orders</CardDescription>
              </CardHeader>
              <CardContent>
                {analytics.popularProducts.length > 0 ? (
                  <div className="space-y-3 max-h-[260px] overflow-y-auto">
                    {analytics.popularProducts.slice(0, 7).map((product, idx) => {
                      const maxRevenue = analytics.popularProducts[0]?.revenue || 1;
                      const widthPercent = (product.revenue / maxRevenue) * 100;
                      return (
                        <div key={product.id} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-xs text-muted-foreground w-5 shrink-0">
                                #{idx + 1}
                              </span>
                              <span className="font-medium truncate">{product.name}</span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0 ml-2">
                              <span className="text-xs text-muted-foreground">
                                {product.orders} sold
                              </span>
                              <span className="font-semibold text-emerald-600">
                                {formatCurrency(product.revenue)}
                              </span>
                            </div>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-amber-400 to-amber-600 rounded-full transition-all"
                              style={{ width: `${widthPercent}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No product data yet</p>
                      <p className="text-xs mt-1">Products appear after orders are placed</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
