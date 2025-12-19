/**
 * Storefront Analytics Page
 * Store performance metrics and insights
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { logger } from '@/lib/logger';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  Eye,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import {
  subDays,
  startOfDay,
  endOfDay,
  format,
  eachDayOfInterval,
} from 'date-fns';

interface DailyStat {
  date: string;
  orders: number;
  revenue: number;
}

export default function StorefrontAnalytics() {
  const { tenant } = useTenantAdminAuth();
  const { tenantSlug } = useParams();
  const navigate = useNavigate();
  const tenantId = tenant?.id;

  // Fetch store
  const { data: store } = useQuery({
    queryKey: ['marketplace-store', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const { data } = await supabase
        .from('marketplace_stores')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      return data;
    },
    enabled: !!tenantId,
  });

  // Define order type for analytics
  interface AnalyticsOrder {
    id: string;
    total_amount: number;
    status: string;
    created_at: string;
    customer_email: string | null;
  }

  // Fetch orders for analytics (last 30 days)
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['storefront-analytics-orders', store?.id],
    queryFn: async (): Promise<AnalyticsOrder[]> => {
      if (!store?.id) return [];

      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();

      const { data, error } = await supabase
        .from('marketplace_orders')
        .select('id, total_amount, status, created_at, customer_email')
        .eq('store_id', store.id)
        .gte('created_at', thirtyDaysAgo)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as unknown as AnalyticsOrder[];
    },
    enabled: !!store?.id,
  });

  // Fetch previous period orders for comparison
  const { data: previousOrders = [] } = useQuery({
    queryKey: ['storefront-analytics-previous', store?.id],
    queryFn: async (): Promise<AnalyticsOrder[]> => {
      if (!store?.id) return [];

      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
      const sixtyDaysAgo = subDays(new Date(), 60).toISOString();

      const { data, error } = await supabase
        .from('marketplace_orders')
        .select('id, total_amount, status, created_at')
        .eq('store_id', store.id)
        .gte('created_at', sixtyDaysAgo)
        .lt('created_at', thirtyDaysAgo);

      if (error) throw error;
      return (data || []) as unknown as AnalyticsOrder[];
    },
    enabled: !!store?.id,
  });


  // Calculate metrics
  const metrics = useMemo(() => {
    // Current period
    const completedOrders = orders.filter((o) => o.status === 'delivered');
    const totalRevenue = completedOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const totalOrders = orders.length;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / completedOrders.length : 0;
    const uniqueCustomers = new Set(orders.map((o) => o.customer_email).filter(Boolean)).size;

    // Previous period
    const prevCompletedOrders = previousOrders.filter((o) => o.status === 'delivered');
    const prevRevenue = prevCompletedOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const prevOrders = previousOrders.length;
    const prevAvg = prevOrders > 0 ? prevRevenue / prevCompletedOrders.length : 0;

    // Calculate changes
    const revenueChange = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;
    const ordersChange = prevOrders > 0 ? ((totalOrders - prevOrders) / prevOrders) * 100 : 0;
    const avgChange = prevAvg > 0 ? ((avgOrderValue - prevAvg) / prevAvg) * 100 : 0;

    return {
      totalRevenue,
      totalOrders,
      avgOrderValue,
      uniqueCustomers,
      revenueChange,
      ordersChange,
      avgChange,
    };
  }, [orders, previousOrders]);

  // Daily stats for chart
  const dailyStats = useMemo(() => {
    const last14Days = eachDayOfInterval({
      start: subDays(new Date(), 13),
      end: new Date(),
    });

    return last14Days.map((day) => {
      const dayStart = startOfDay(day);
      const dayEnd = endOfDay(day);

      const dayOrders = orders.filter((o) => {
        const orderDate = new Date(o.created_at);
        return orderDate >= dayStart && orderDate <= dayEnd;
      });

      return {
        date: format(day, 'MMM d'),
        orders: dayOrders.length,
        revenue: dayOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0),
      };
    });
  }, [orders]);

  // Order status breakdown
  const statusBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {};
    orders.forEach((o) => {
      breakdown[o.status] = (breakdown[o.status] || 0) + 1;
    });
    return breakdown;
  }, [orders]);

  // Top performing days
  const topDays = useMemo(() => {
    return [...dailyStats]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 3);
  }, [dailyStats]);

  const formatChange = (value: number) => {
    const isPositive = value >= 0;
    return (
      <span className={`flex items-center gap-1 text-sm ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
        {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
        {Math.abs(value).toFixed(1)}%
      </span>
    );
  };

  if (!store) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Please create a store first.</p>
            <Button
              className="mt-4"
              onClick={() => navigate(`/${tenantSlug}/admin/storefront`)}
            >
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/${tenantSlug}/admin/storefront`)}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Store Analytics</h1>
          <p className="text-muted-foreground">
            Last 30 days performance
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Revenue</p>
                    <p className="text-2xl font-bold">{formatCurrency(metrics.totalRevenue)}</p>
                    {formatChange(metrics.revenueChange)}
                  </div>
                  <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-green-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Orders</p>
                    <p className="text-2xl font-bold">{metrics.totalOrders}</p>
                    {formatChange(metrics.ordersChange)}
                  </div>
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <ShoppingCart className="w-5 h-5 text-blue-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Order Value</p>
                    <p className="text-2xl font-bold">{formatCurrency(metrics.avgOrderValue)}</p>
                    {formatChange(metrics.avgChange)}
                  </div>
                  <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-purple-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Unique Customers</p>
                    <p className="text-2xl font-bold">{metrics.uniqueCustomers}</p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                    <Users className="w-5 h-5 text-orange-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Daily Revenue Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Daily Revenue</CardTitle>
                <CardDescription>Last 14 days</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-48 flex items-end gap-1">
                  {dailyStats.map((day, i) => {
                    const maxRevenue = Math.max(...dailyStats.map((d) => d.revenue), 1);
                    const height = (day.revenue / maxRevenue) * 100;
                    return (
                      <div
                        key={i}
                        className="flex-1 flex flex-col items-center"
                      >
                        <div
                          className="w-full bg-primary rounded-t transition-all hover:bg-primary/80"
                          style={{ height: `${Math.max(height, 4)}%` }}
                          title={`${day.date}: ${formatCurrency(day.revenue)}`}
                        />
                        <span className="text-[10px] text-muted-foreground mt-1 rotate-45 origin-left">
                          {day.date.split(' ')[1]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Order Status Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Order Status</CardTitle>
                <CardDescription>Current period breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(statusBreakdown).map(([status, count]) => {
                    const percentage = (count / metrics.totalOrders) * 100;
                    return (
                      <div key={status} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="capitalize">{status.replace(/_/g, ' ')}</span>
                          <span className="font-medium">{count}</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top Days & Quick Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Performing Days */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Top Performing Days</CardTitle>
                <CardDescription>Best revenue days this period</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {topDays.map((day, i) => (
                    <div
                      key={day.date}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${i === 0 ? 'bg-yellow-500/20 text-yellow-600' :
                            i === 1 ? 'bg-gray-500/20 text-gray-600' :
                              'bg-orange-500/20 text-orange-600'
                          }`}>
                          #{i + 1}
                        </div>
                        <div>
                          <p className="font-medium">{day.date}</p>
                          <p className="text-sm text-muted-foreground">{day.orders} orders</p>
                        </div>
                      </div>
                      <p className="font-bold">{formatCurrency(day.revenue)}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Conversion Funnel */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Insights</CardTitle>
                <CardDescription>Key performance indicators</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <Package className="w-5 h-5 text-primary" />
                      <span>Conversion Rate</span>
                    </div>
                    <Badge variant="secondary">
                      {metrics.totalOrders > 0
                        ? ((statusBreakdown['delivered'] || 0) / metrics.totalOrders * 100).toFixed(1)
                        : 0}%
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <Users className="w-5 h-5 text-primary" />
                      <span>Repeat Customer Rate</span>
                    </div>
                    <Badge variant="secondary">
                      {metrics.uniqueCustomers > 0
                        ? ((1 - metrics.uniqueCustomers / metrics.totalOrders) * 100).toFixed(1)
                        : 0}%
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <TrendingUp className="w-5 h-5 text-primary" />
                      <span>Orders Per Day</span>
                    </div>
                    <Badge variant="secondary">
                      {(metrics.totalOrders / 30).toFixed(1)}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <DollarSign className="w-5 h-5 text-primary" />
                      <span>Revenue Per Day</span>
                    </div>
                    <Badge variant="secondary">
                      {formatCurrency(metrics.totalRevenue / 30)}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
